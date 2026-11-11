"use client";

import { Client } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import { RestError } from "@/services/rest/transport";

type Options = {
  endpoint: "chat" | "admin" | "account";
  destination?: string;
  credentials: ((signal: AbortSignal, reconnecting: boolean) => Promise<string>) | null;
  onMessage?: (body: string) => void;
  onConnected?: (socket: Client) => void;
  onDisconnected?: () => void;
  onAccessError: (code: string) => void;
};

export function useAuthenticatedSocket({ endpoint, destination, credentials, ...handlers }: Options) {
  const client = useRef<Client | null>(null);
  const listeners = useRef(handlers);
  const [connected, setConnected] = useState(false);
  useEffect(() => { listeners.current = handlers; });

  useEffect(() => {
    if (!credentials) return;
    const getCsrf = credentials;
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempted = false;

    function reconnect() {
      timer = setTimeout(() => void connect(), CLIENT_CONFIG.reconnectDelayMs);
    }

    async function connect() {
      try {
        const reconnecting = attempted;
        attempted = true;
        const csrf = await getCsrf(signal, reconnecting);
        if (signal.aborted) return;
        const url = new URL(`/api/v1/ws/${endpoint}`, window.location.origin);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const socket = new Client({
          brokerURL: url.href, connectHeaders: { "X-CSRF-Token": csrf }, reconnectDelay: 0,
          connectionTimeout: CLIENT_CONFIG.connectionTimeoutMs,
          onConnect: () => {
            if (signal.aborted || client.current !== socket) return;
            try {
              if (destination) socket.subscribe(destination, frame => {
                if (!signal.aborted && client.current === socket) listeners.current.onMessage?.(frame.body);
              });
              setConnected(true);
              listeners.current.onConnected?.(socket);
            } catch {
              disconnect();
            }
          },
          onWebSocketClose: () => disconnect(),
          onStompError: frame => {
            const code = frame.headers.message;
            disconnect(code === "INVALID_SESSION" || code === "FORBIDDEN" ? code : undefined);
          },
        });
        function disconnect(accessError?: string) {
          if (signal.aborted || client.current !== socket) return;
          client.current = null;
          void socket.deactivate();
          setConnected(false);
          listeners.current.onDisconnected?.();
          if (accessError) listeners.current.onAccessError(accessError);
          else reconnect();
        }
        client.current = socket;
        try { socket.activate(); } catch { disconnect(); }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof RestError && ["INVALID_SESSION", "LOGIN_REQUIRED", "FORBIDDEN"].includes(error.code)) {
          listeners.current.onAccessError(error.code);
          return;
        }
        reconnect();
      }
    }

    void connect();
    return () => {
      controller.abort();
      clearTimeout(timer);
      const socket = client.current;
      client.current = null;
      void socket?.deactivate();
    };
  }, [endpoint, destination, credentials]);

  return { connected: !!credentials && connected, client };
}
