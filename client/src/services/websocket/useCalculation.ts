"use client";

import { Client } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CalculationRequest, CalculationResponse, CalculationType, MaiHoaPayload, TamThePayload } from "@/types/contract";

type Connection = "connecting" | "connected" | "disconnected";
type RequestState = "idle" | "waiting" | "done" | "timeout";

export function useCalculation() {
  const clientRef = useRef<Client | null>(null);
  const pendingId = useRef<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [response, setResponse] = useState<CalculationResponse | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const client = new Client({
      brokerURL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws",
      reconnectDelay: 3000,
      onConnect: () => {
        setConnection("connected");
        for (const destination of ["/user/queue/results", "/user/queue/errors"]) {
          client.subscribe(destination, (message) => {
            try {
              const incoming = JSON.parse(message.body) as CalculationResponse;
              if (incoming.requestId !== pendingId.current) return;
              if (timeout.current) clearTimeout(timeout.current);
              pendingId.current = null;
              setResponse(incoming);
              setRequestState("done");
            } catch {
              setLocalError("Không đọc được phản hồi từ Server.");
            }
          });
        }
      },
      onWebSocketClose: () => {
        setConnection("disconnected");
        if (pendingId.current) {
          if (timeout.current) clearTimeout(timeout.current);
          pendingId.current = null;
          setRequestState("idle");
          setLocalError("DISCONNECTED: Kết nối bị ngắt. Vui lòng gửi lại yêu cầu.");
        }
      },
      onStompError: () => setLocalError("Server từ chối thông điệp STOMP."),
    });
    clientRef.current = client;
    client.activate();
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
      pendingId.current = null;
      void client.deactivate();
      clientRef.current = null;
    };
  }, []);

  const submit = useCallback((type: CalculationType, payload: MaiHoaPayload | TamThePayload) => {
    const client = clientRef.current;
    if (!client?.connected) {
      setLocalError("DISCONNECTED: Chưa kết nối được với Server.");
      return;
    }
    if (timeout.current) clearTimeout(timeout.current);
    const request: CalculationRequest = { requestId: crypto.randomUUID(), type, payload };
    pendingId.current = request.requestId;
    setResponse(null);
    setLocalError(null);
    setRequestState("waiting");
    client.publish({
      destination: type === "MAI_HOA" ? "/app/mai-hoa/calculate" : "/app/tam-the/calculate",
      body: JSON.stringify(request),
      headers: { "content-type": "application/json" },
    });
    timeout.current = setTimeout(() => {
      if (pendingId.current !== request.requestId) return;
      pendingId.current = null;
      setRequestState("timeout");
      setLocalError("REQUEST_TIMEOUT: Yêu cầu quá thời gian chờ 15 giây.");
    }, 15_000);
  }, []);

  return { connection, requestState, response, localError, submit };
}

