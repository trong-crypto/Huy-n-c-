"use client";

import { Client } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import { readChatCsrf, readChatSession, readRoomMessages } from "@/services/rest/chat";
import { RestError } from "@/services/rest/transport";
import { readChatEvent, type ChatSend, type ChatSession, type Conversation, type RoomMessage } from "@/types/chatContract";
import type { ChatConnection, ChatMessage, ChatMessaging } from "./chatState";

const SYNC_INTERVAL_MS = 10_000;
const MAX_PAGES_PER_SYNC = 10;
type Pending = { id: string; text: string };
type View = Pick<ChatMessaging, "delivery" | "acknowledgedId" | "historyStatus" | "notice"> & {
  connection: ChatConnection; messages: ChatMessage[];
};

const initialView: View = { connection: "unavailable", messages: [], delivery: "idle", historyStatus: "idle" };

export function chatRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function useRoomChat(session: ChatSession, room: Conversation | undefined, onAccessError: (code: string) => void) {
  const [current, setCurrent] = useState<{ room: Conversation; view: View }>();
  const commands = useRef<{ send: (text: string) => void; retry: () => void } | null>(null);

  useEffect(() => {
    if (!room || room.status === "PENDING") return;
    const activeRoom = room;
    const { conversationId: roomId } = activeRoom;
    const controller = new AbortController();
    const { signal } = controller;
    const stored = new Map<string, RoomMessage>();
    let view: View = { ...initialView, historyStatus: "loading",
      connection: activeRoom.status === "ACTIVE" ? "connecting" : "unavailable" };
    let cursor = "0";
    let client: Client | null = null;
    let connecting = false;
    let syncing = false;
    let blocked = false;
    let pending: Pending | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let ackTimer: ReturnType<typeof setTimeout> | undefined;
    const alive = () => !signal.aborted && !blocked;

    function update(patch: Partial<View>) {
      view = { ...view, ...patch };
      if (!signal.aborted) setCurrent({ room: activeRoom, view });
    }

    function merge(items: RoomMessage[]) {
      for (const item of items) stored.set(item.messageId, item);
      const messages = [...stored.values()].sort((a, b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1
        : BigInt(a.sequence) > BigInt(b.sequence) ? 1 : a.messageId.localeCompare(b.messageId))
        .map(item => ({ id: item.messageId, roomId, text: item.text, author: item.senderAccountId === session.accountId
          ? "Bạn" : session.role === "USER" ? "Tư vấn viên" : "Người dùng" }));
      update({ messages });
    }

    function failAccess(error: unknown) {
      const code = error instanceof RestError ? error.code : "";
      if (!["INVALID_SESSION", "LOGIN_REQUIRED", "FORBIDDEN", "NOT_FOUND"].includes(code)) return false;
      blocked = true;
      stored.clear();
      pending = null;
      const previous = client;
      client = null;
      void previous?.deactivate();
      update({ messages: [], historyStatus: "error", connection: "unavailable", delivery: "idle",
        notice: code === "NOT_FOUND" ? "Hội thoại này không còn khả dụng." : undefined });
      onAccessError(code);
      return true;
    }

    async function synchronize() {
      if (!alive() || syncing) return;
      syncing = true;
      try {
        const currentSession = await readChatSession(signal);
        if (currentSession.accountId !== session.accountId || currentSession.role !== session.role) {
          throw new RestError("INVALID_SESSION");
        }
        for (let index = 0; index < MAX_PAGES_PER_SYNC && alive(); index++) {
          const page = await readRoomMessages(activeRoom, cursor, signal);
          if (!alive()) return;
          cursor = page.nextAfterSequence;
          merge(page.items);
          if (!page.hasMore) break;
        }
        if (alive()) update({ historyStatus: "ready" });
      } catch (error) {
        if (alive() && !failAccess(error)) update({ historyStatus: "error" });
      } finally {
        syncing = false;
      }
    }

    function deliveryUnknown() {
      clearTimeout(ackTimer);
      if (pending) update({ delivery: "unknown" });
    }

    function receive(body: string) {
      let value: unknown;
      try { value = JSON.parse(body); } catch { return; }
      const event = readChatEvent(value, activeRoom);
      if (!event) return;
      if (event.type === "MESSAGE") {
        merge([event]);
        return;
      }
      if (!pending || event.clientMessageId !== pending.id) return;
      if (event.type === "ACK") {
        clearTimeout(ackTimer);
        const sent = pending;
        pending = null;
        merge([{ conversationId: roomId, messageId: event.messageId, senderAccountId: session.accountId,
          sequence: event.sequence, text: sent.text, createdAt: event.createdAt }]);
        update({ delivery: "idle", acknowledgedId: sent.id, notice: undefined });
      } else {
        clearTimeout(ackTimer);
        if (event.code === "SERVER_BUSY" || event.code === "DATABASE_UNAVAILABLE") {
          update({ delivery: "unknown", notice: "Máy chủ chưa xác nhận tin. Bạn có thể gửi lại cùng nội dung." });
        } else {
          pending = null;
          update({ delivery: "idle", notice: event.code === "MESSAGE_EXPIRED" ? "Mã tin đã hết thời hạn lưu."
            : event.code === "ROOM_NOT_ACTIVE" ? "Phòng hiện không nhận tin mới." : "Máy chủ từ chối tin nhắn." });
        }
      }
    }

    function reconnect() {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => void connect(), CLIENT_CONFIG.reconnectDelayMs);
    }

    async function connect() {
      if (!alive() || connecting || client || activeRoom.status !== "ACTIVE") return;
      connecting = true;
      try {
        const csrf = await readChatCsrf(session, signal);
        if (!alive()) return;
        const url = new URL("/api/v1/ws/chat", window.location.origin);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const socket = new Client({
          brokerURL: url.href, connectHeaders: { "X-CSRF-Token": csrf }, reconnectDelay: 0,
          connectionTimeout: CLIENT_CONFIG.connectionTimeoutMs,
          onConnect: () => {
            if (!alive() || client !== socket) return;
            try {
              socket.subscribe(`/user/queue/chat/rooms/${roomId}`, frame => {
                if (alive() && client === socket) receive(frame.body);
              });
              update({ connection: "connected" });
              void synchronize();
            } catch {
              disconnect();
            }
          },
          onWebSocketClose: () => disconnect(),
          onStompError: () => disconnect(),
        });
        function disconnect() {
          if (!alive() || client !== socket) return;
          client = null;
          void socket.deactivate();
          update({ connection: "disconnected" });
          deliveryUnknown();
          reconnect();
        }
        client = socket;
        try { socket.activate(); } catch { disconnect(); }
      } catch (error) {
        if (alive() && !failAccess(error)) {
          update({ connection: "disconnected" });
          reconnect();
        }
      } finally {
        connecting = false;
      }
    }

    commands.current = {
      send(text) {
        if (!alive() || !client?.connected || view.delivery === "waiting" || pending && pending.text !== text) return;
        pending ??= { id: chatRequestId(), text };
        update({ delivery: "waiting", notice: undefined });
        ackTimer = setTimeout(deliveryUnknown, CLIENT_CONFIG.requestTimeoutMs);
        try {
          const payload: ChatSend = { clientMessageId: pending.id, text };
          client.publish({ destination: `/app/chat/rooms/${roomId}/send`,
            headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        } catch {
          deliveryUnknown();
        }
      },
      retry() {
        clearTimeout(reconnectTimer);
        if (activeRoom.status === "ACTIVE" && !client) update({ connection: "reconnecting" });
        void connect();
        void synchronize();
      },
    };
    update({});
    void synchronize();
    void connect();
    const poll = setInterval(() => void synchronize(), SYNC_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(poll);
      clearTimeout(reconnectTimer);
      clearTimeout(ackTimer);
      commands.current = null;
      void client?.deactivate();
    };
  }, [session, room, onAccessError]);

  const view = room && current?.room === room ? current.view : initialView;
  const messaging: ChatMessaging | undefined = room && room.status !== "PENDING" ? {
    delivery: view.delivery, historyStatus: view.historyStatus, acknowledgedId: view.acknowledgedId, notice: view.notice,
    send: text => commands.current?.send(text),
  } : undefined;
  return { connection: view.connection, messages: view.messages, messaging, retry: () => commands.current?.retry() };
}
