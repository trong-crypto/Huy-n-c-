"use client";

import { Client } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MaiHoaPayload, TamThePayload } from "@/types/contract";
import { CLIENT_TIMEOUT_MS, initialState, parseProgress, parseTerminal, reduceCalculation } from "./calculationState";
import type { Action } from "./calculationState";

type Connection = "connecting" | "connected" | "disconnected";

export function useCalculation() {
  const clientRef = useRef<Client | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const stateRef = useRef(initialState);
  const [state, setState] = useState(initialState);
  const update = useCallback((action: Action) => {
    stateRef.current = reduceCalculation(stateRef.current, action);
    if (stateRef.current.requestState !== "waiting" && timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
    setState(stateRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;
    const client = new Client({
      brokerURL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws",
      reconnectDelay: 3000,
      onConnect: () => {
        if (!mounted) return;
        setConnection("connected");
        client.subscribe("/user/queue/progress", (message) => {
          if (!mounted || stateRef.current.requestState !== "waiting") return;
          try { update({ kind: "progress", event: parseProgress(JSON.parse(message.body)) }); }
          catch { update({ kind: "error", message: "INVALID_RESPONSE: Không đọc được tiến trình từ Server." }); }
        });
        for (const destination of ["/user/queue/results", "/user/queue/errors"]) {
          client.subscribe(destination, (message) => {
            if (!mounted || stateRef.current.requestState !== "waiting") return;
            try {
              update({ kind: "terminal", response: parseTerminal(JSON.parse(message.body)) });
            } catch {
              update({ kind: "error", message: "INVALID_RESPONSE: Không đọc được phản hồi từ Server." });
            }
          });
        }
      },
      onWebSocketClose: () => {
        if (!mounted) return;
        setConnection("disconnected");
        update({ kind: "disconnect" });
      },
      onStompError: () => { if (mounted) update({ kind: "error", message: "Server từ chối thông điệp STOMP." }); },
    });
    clientRef.current = client;
    client.activate();
    return () => {
      mounted = false;
      if (timeout.current) clearTimeout(timeout.current);
      stateRef.current = initialState;
      void client.deactivate();
      clientRef.current = null;
    };
  }, [update]);

  const submit = useCallback((...[type, payload]: ["MAI_HOA", MaiHoaPayload] | ["TAM_THE", TamThePayload]) => {
    const client = clientRef.current;
    if (!client?.connected) {
      update({ kind: "error", message: "DISCONNECTED: Chưa kết nối được với Server." });
      return;
    }
    if (stateRef.current.requestState === "waiting") return;
    const request = { requestId: crypto.randomUUID(), type, payload };
    update({ kind: "begin", requestId: request.requestId, type });
    timeout.current = setTimeout(() => update({ kind: "timeout", requestId: request.requestId }), CLIENT_TIMEOUT_MS);
    try {
      client.publish({
        destination: type === "MAI_HOA" ? "/app/mai-hoa/calculate" : "/app/tam-the/calculate",
        body: JSON.stringify(request), headers: { "content-type": "application/json" },
      });
    } catch { update({ kind: "error", message: "DISCONNECTED: Không gửi được yêu cầu." }); }
  }, [update]);

  return { connection, requestState: state.requestState, response: state.response,
    progress: state.progress, localError: state.localError, submit };
}

