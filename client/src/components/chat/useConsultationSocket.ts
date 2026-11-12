"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import { ownRoom, readChatCsrf } from "@/services/rest/chat";
import { RestError } from "@/services/rest/transport";
import { useAuthenticatedSocket } from "@/services/websocket/useAuthenticatedSocket";
import type { ChatSession, Conversation, ConversationAction } from "@/types/chatContract";
import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";

type Command = { requestId: string } & ({ action: "CREATE"; consultantId: string }
  | { action: ConversationAction; conversationId: string });
type Pending = { id: string; accept: (room: Conversation) => void; fail: (error: RestError) => void };
type PeerSignal = { conversationId: string; marker: symbol };
const signalTimeouts = { PRESENCE: 20_000, TYPING: 4_000, PEER_ONLINE: 20_000 };
type OutgoingSignal = "PRESENCE" | "TYPING";

export type ConsultationNotice = {
  conversationId: string;
  kind: "request" | "accepted" | "message";
};

export function useConsultationSocket(session: ChatSession, activeRoomId: string | undefined,
  onRoomChanged: (conversationId?: string) => void, onAccessError: (code: string) => void,
  onNotice: (notice: ConsultationNotice) => void) {
  const credentials = useCallback((signal: AbortSignal) => readChatCsrf(session, signal), [session]);
  const pending = useRef<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [presence, setPresence] = useState<PeerSignal>();
  const [typing, setTyping] = useState<PeerSignal>();
  const [online, setOnline] = useState<PeerSignal>();
  const timers = useRef<Partial<Record<keyof typeof signalTimeouts, ReturnType<typeof setTimeout>>>>({});
  const lastTyping = useRef(0);

  function failPending() {
    pending.current?.fail(new RestError("NETWORK_ERROR"));
  }

  const { connected: transportConnected, client } = useAuthenticatedSocket({
    endpoint: "chat", destination: "/user/queue/chat/workspace", credentials, onAccessError,
    onConnected: socket => {
      readyTimer.current = setTimeout(() => socket.forceDisconnect(), CLIENT_CONFIG.requestTimeoutMs);
      socket.publish({ destination: "/app/chat/workspace", body: JSON.stringify({ action: "SYNC" }) });
    },
    onDisconnected: () => {
      clearTimeout(readyTimer.current);
      setReady(false);
      failPending();
      setPresence(undefined);
      setTyping(undefined);
      setOnline(undefined);
    },
    onMessage(body) {
      let value: unknown;
      try { value = JSON.parse(body); } catch { return; }
      if (!isRecord(value)) return;
      if (value.type === "READY") {
        clearTimeout(readyTimer.current);
        setReady(true);
        onRoomChanged();
      } else if ((value.type === "ROOM_CREATED" || value.type === "ROOM_CHANGED") && isUuid(value.conversationId)) {
        onRoomChanged(value.conversationId);
        if (value.type === "ROOM_CREATED" && session.role === "CONSULTANT" && value.status === "PENDING") {
          onNotice({ conversationId: value.conversationId, kind: "request" });
        } else if (value.type === "ROOM_CHANGED" && session.role === "USER" && value.status === "ACTIVE") {
          onNotice({ conversationId: value.conversationId, kind: "accepted" });
        }
      } else if (value.type === "MESSAGE_RECEIVED" && isUuid(value.conversationId)) {
        onNotice({ conversationId: value.conversationId, kind: "message" });
      } else if ((value.type === "PRESENCE" || value.type === "TYPING" || value.type === "PEER_ONLINE")
          && isUuid(value.conversationId)
          && value.conversationId === activeRoomId) {
        const event = { conversationId: value.conversationId, marker: Symbol() };
        const type = value.type;
        const update = type === "PRESENCE" ? setPresence : type === "TYPING" ? setTyping : setOnline;
        clearTimeout(timers.current[type]);
        update(type === "PEER_ONLINE" && value.online !== true ? undefined : event);
        timers.current[type] = setTimeout(() => update(current => current?.marker === event.marker ? undefined : current), signalTimeouts[type]);
      } else if (pending.current && value.requestId === pending.current.id) {
        if (value.type === "ACK" && ownRoom(value.conversation, session)) pending.current.accept(value.conversation);
        else if (value.type === "ERROR" && typeof value.code === "string") pending.current.fail(new RestError(value.code));
      }
    },
  });
  const connected = transportConnected && ready;

  const publishSignal = useCallback((action: OutgoingSignal, conversationId: string) => {
    if (!client.current?.connected) return;
    try {
      client.current.publish({ destination: "/app/chat/workspace", body: JSON.stringify({ action, conversationId }) });
    } catch {
      // Presence expires automatically when the transport is unavailable.
    }
  }, [client]);

  useEffect(() => {
    if (!connected || !activeRoomId) return;
    publishSignal("PRESENCE", activeRoomId);
    const interval = setInterval(() => publishSignal("PRESENCE", activeRoomId), 8_000);
    return () => clearInterval(interval);
  }, [activeRoomId, connected, publishSignal]);
  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      clearTimeout(readyTimer.current);
      Object.values(activeTimers).forEach(clearTimeout);
    };
  }, []);

  function command(input: Command, signal: AbortSignal): Promise<Conversation> {
    const socket = client.current;
    if (!socket?.connected || !connected || pending.current || signal.aborted) {
      return Promise.reject(new RestError("NETWORK_ERROR"));
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(fail, CLIENT_CONFIG.requestTimeoutMs);
      function finish() {
        clearTimeout(timeout);
        signal.removeEventListener("abort", fail);
        pending.current = null;
      }
      function fail() { finish(); reject(new RestError("NETWORK_ERROR")); }
      pending.current = {
        id: input.requestId,
        accept: room => {
          if (input.action === "CREATE" ? room.consultantId !== input.consultantId : room.conversationId !== input.conversationId) {
            fail();
            return;
          }
          finish();
          resolve(room);
        },
        fail: error => { finish(); reject(error); },
      };
      signal.addEventListener("abort", fail, { once: true });
      try {
        socket.publish({ destination: "/app/chat/workspace", body: JSON.stringify(input) });
      } catch {
        fail();
      }
    });
  }

  return {
    connected, command,
    peerPresent: !!activeRoomId && presence?.conversationId === activeRoomId,
    peerTyping: !!activeRoomId && typing?.conversationId === activeRoomId,
    peerOnline: !!activeRoomId && online?.conversationId === activeRoomId,
    notifyTyping() {
      if (!activeRoomId || Date.now() - lastTyping.current < 2_000) return;
      lastTyping.current = Date.now();
      publishSignal("TYPING", activeRoomId);
    },
  };
}
