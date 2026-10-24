"use client";

import { Client, type StompSubscription } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import type { CalculationRequest, CalculationType, MaiHoaPayload, TamThePayload } from "@/types/contract";
import { isCalculationResponse, isRecord } from "@/types/contractValidation";
import { initialState, parseProgress, reduceCalculation, type Action } from "./calculationState";
export type { RequestState } from "./calculationState";

export type ConnectionState = "connecting" | "connected" | "disconnected";
type PendingRequest = Readonly<{
  requestId: string;
  expectedType: CalculationType;
  client: Client;
  generation: number;
  body: string;
}>;

const SEND_FAILURE = "Lỗi Client: Không xác nhận được việc gửi yêu cầu. Server có thể đã nhận; không tự động gửi lại.";

export function useCalculation() {
  const clientRef = useRef<Client | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const generationRef = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [request, setRequest] = useState(initialState);
  const stateRef = useRef(initialState);

  const clearTimer = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
  }, []);

  const update = useCallback((action: Action) => {
    const next = reduceCalculation(stateRef.current, action);
    stateRef.current = next;
    if (next.requestState !== "waiting") {
      clearTimer();
      pendingRef.current = null;
    }
    setRequest(next);
  }, [clearTimer]);

  const settle = useCallback((pending: PendingRequest, action: Action) => {
    if (pendingRef.current === pending) update(action);
  }, [update]);

  useEffect(() => {
    let active = true;
    let connected = false;
    let subscriptions: StompSubscription[] = [];
    const isCurrent = () => active && clientRef.current === client;

    const client = new Client({
      brokerURL: CLIENT_CONFIG.wsUrl,
      reconnectDelay: CLIENT_CONFIG.reconnectDelayMs,
      onConnect: () => {
        if (!isCurrent() || connected) return;
        connected = true;
        const generation = ++generationRef.current;
        setConnection("connected");
        for (const destination of ["/user/queue/results", "/user/queue/errors", "/user/queue/progress"]) {
          subscriptions.push(client.subscribe(destination, (message) => {
            if (!isCurrent() || generationRef.current !== generation) return;
            const pending = pendingRef.current;
            if (!pending || pending.client !== client || pending.generation !== generation) return;
            let incoming: unknown;
            try {
              incoming = JSON.parse(message.body);
            } catch {
              // Cannot attribute malformed JSON to a request. Keep its bounded timeout.
              return;
            }
            if (!isRecord(incoming)
              || incoming.requestId !== pending.requestId
              || incoming.type !== pending.expectedType) return;
            if (destination === "/user/queue/progress") {
              try {
                settle(pending, { kind: "progress", event: parseProgress(incoming) });
              } catch {
                settle(pending, { kind: "error", message: "INVALID_RESPONSE: Invalid progress frame." });
              }
              return;
            }
            if (!isCalculationResponse(incoming)) {
              settle(pending, { kind: "error", message: "Lỗi giao thức phía Client: Phản hồi không đúng hợp đồng đã thống nhất." });
              return;
            }
            settle(pending, { kind: "terminal", response: incoming });
          }));
        }
      },
      onWebSocketClose: () => {
        if (!isCurrent()) return;
        connected = false;
        ++generationRef.current;
        // Subscriptions belong to the closed socket; do not unsubscribe them on a new one.
        subscriptions = [];
        setConnection("disconnected");
        const pending = pendingRef.current;
        if (pending?.client === client) {
          settle(pending, { kind: "error", message: "Lỗi Client (DISCONNECTED): Kết nối bị ngắt. Không tự động gửi lại yêu cầu." });
        }
      },
      onStompError: () => {
        if (!isCurrent()) return;
        const pending = pendingRef.current;
        if (pending?.client === client) {
          settle(pending, { kind: "error", message: "Lỗi kết nối STOMP phía Client: Không thể tiếp tục chờ phản hồi cho yêu cầu này." });
        }
      },
    });
    clientRef.current = client;
    client.activate();
    return () => {
      active = false;
      if (clientRef.current === client) {
        ++generationRef.current;
        clearTimer();
        pendingRef.current = null;
        clientRef.current = null;
      }
      for (const subscription of subscriptions) {
        try {
          if (client.connected) subscription.unsubscribe();
        } catch {
          // A concurrent socket close can make unsubscribe unavailable.
        }
      }
      subscriptions = [];
      // Stop reconnect and close the old socket without waiting for a broker receipt.
      void client.deactivate({ force: true }).catch(() => {
        // Teardown must not set React state or produce an unhandled rejection.
      });
    };
  }, [clearTimer, settle]);

  const submit = useCallback((...args: [type: "MAI_HOA", payload: MaiHoaPayload] | [type: "TAM_THE", payload: TamThePayload]) => {
    if (pendingRef.current) return;
    const client = clientRef.current;
    if (!client) return; // Includes calls retained by a consumer after unmount.
    if (!client.connected) {
      update({ kind: "error", message: "Lỗi Client (DISCONNECTED): Chưa kết nối được với Server." });
      return;
    }
    let snapshot: CalculationRequest;
    let body: string;
    try {
      const requestId = crypto.randomUUID();
      snapshot = args[0] === "MAI_HOA"
        ? { requestId, type: "MAI_HOA", payload: args[1] }
        : { requestId, type: "TAM_THE", payload: args[1] };
      body = JSON.stringify(snapshot);
    } catch {
      update({ kind: "error", message: SEND_FAILURE });
      return;
    }
    // The serialized body is an immutable in-memory copy, not a reference to form data.
    const pending: PendingRequest = Object.freeze({
      requestId: snapshot.requestId, expectedType: snapshot.type, body,
      client, generation: generationRef.current,
    });
    pendingRef.current = pending;
    update({ kind: "begin", requestId: pending.requestId, type: pending.expectedType });
    timeout.current = setTimeout(() => {
      if (clientRef.current !== client || generationRef.current !== pending.generation) return;
      settle(pending, { kind: "timeout", requestId: pending.requestId });
    }, CLIENT_CONFIG.requestTimeoutMs);
    try {
      client.publish({
        destination: pending.expectedType === "MAI_HOA" ? "/app/mai-hoa/calculate" : "/app/tam-the/calculate",
        body: pending.body,
        headers: { "content-type": "application/json" },
      });
    } catch {
      settle(pending, { kind: "error", message: SEND_FAILURE });
    }
  }, [settle, update]);

  return { connection, ...request, submit };
}

