"use client";

import { Client, type StompSubscription } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import type { CalculationRequest, CalculationResponse, CalculationType, MaiHoaPayload, TamThePayload } from "@/types/contract";
import { isCalculationResponse, isRecord } from "@/types/contractValidation";

export type ConnectionState = "connecting" | "connected" | "disconnected";
export type RequestState = "idle" | "waiting" | "completed" | "failed" | "timeout";

type RequestView = {
  requestState: RequestState;
  response: CalculationResponse | null;
  localError: string | null;
};

type PendingRequest = Readonly<{
  requestId: string;
  expectedType: CalculationType;
  client: Client;
  generation: number;
  body: string;
}>;

const INITIAL_REQUEST: RequestView = { requestState: "idle", response: null, localError: null };
const SEND_FAILURE = "Lỗi Client: Không xác nhận được việc gửi yêu cầu. Server có thể đã nhận; không tự động gửi lại.";

export function useCalculation() {
  const clientRef = useRef<Client | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const generationRef = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [request, setRequest] = useState<RequestView>(INITIAL_REQUEST);

  const clearTimer = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
  }, []);

  const settle = useCallback((pending: PendingRequest, next: RequestView) => {
    if (pendingRef.current !== pending) return;
    clearTimer();
    pendingRef.current = null;
    setRequest(next);
  }, [clearTimer]);

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
        for (const destination of ["/user/queue/results", "/user/queue/errors"]) {
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
            if (!isCalculationResponse(incoming)) {
              settle(pending, { requestState: "failed", response: null, localError: "Lỗi giao thức phía Client: Phản hồi không đúng envelope đã thống nhất." });
              return;
            }
            settle(pending, {
              requestState: incoming.status === "COMPLETED" ? "completed" : "failed",
              response: incoming,
              localError: null,
            });
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
          settle(pending, { requestState: "failed", response: null, localError: "Lỗi Client (DISCONNECTED): Kết nối bị ngắt. Không tự động gửi lại yêu cầu." });
        }
      },
      onStompError: () => {
        if (!isCurrent()) return;
        const pending = pendingRef.current;
        if (pending?.client === client) {
          settle(pending, { requestState: "failed", response: null, localError: "Lỗi kết nối STOMP phía Client: Không thể tiếp tục chờ phản hồi cho yêu cầu này." });
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

  const submit = useCallback((type: CalculationType, payload: MaiHoaPayload | TamThePayload) => {
    if (pendingRef.current) return;
    const client = clientRef.current;
    if (!client) return; // Includes calls retained by a consumer after unmount.
    if (!client.connected) {
      setRequest({ requestState: "failed", response: null, localError: "Lỗi Client (DISCONNECTED): Chưa kết nối được với Server." });
      return;
    }
    let snapshot: CalculationRequest;
    let body: string;
    try {
      snapshot = { requestId: crypto.randomUUID(), type, payload };
      body = JSON.stringify(snapshot);
    } catch {
      setRequest({ requestState: "failed", response: null, localError: SEND_FAILURE });
      return;
    }
    // The serialized body is an immutable in-memory copy, not a reference to form data.
    const pending: PendingRequest = Object.freeze({
      requestId: snapshot.requestId, expectedType: type, body,
      client, generation: generationRef.current,
    });
    pendingRef.current = pending;
    setRequest({ requestState: "waiting", response: null, localError: null });
    timeout.current = setTimeout(() => {
      if (clientRef.current !== client || generationRef.current !== pending.generation) return;
      settle(pending, {
        requestState: "timeout", response: null,
        localError: `REQUEST_TIMEOUT: Yêu cầu quá thời gian chờ ${CLIENT_CONFIG.requestTimeoutMs / 1000} giây. Không tự động gửi lại.`,
      });
    }, CLIENT_CONFIG.requestTimeoutMs);
    try {
      client.publish({
        destination: type === "MAI_HOA" ? "/app/mai-hoa/calculate" : "/app/tam-the/calculate",
        body: pending.body,
        headers: { "content-type": "application/json" },
      });
    } catch {
      settle(pending, { requestState: "failed", response: null, localError: SEND_FAILURE });
    }
  }, [settle]);

  return { connection, ...request, submit };
}

