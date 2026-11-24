"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { listConversations, readRoomMessages, readChatCsrf, readChatSession } from "@/services/rest/chat";
import { RestError } from "@/services/rest/transport";
import { useAuthenticatedSocket } from "@/services/websocket/useAuthenticatedSocket";
import type { ChatSession } from "@/types/chatContract";
import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";

type Toast = { id: number; text: string; conversationId: string };
type ChatNotifications = {
  unreadConversations: ReadonlySet<string>;
  activeConversation: (id: string | null) => void;
  markUnread: (id: string, force?: boolean) => void;
};
const empty: ChatNotifications = { unreadConversations: new Set<string>(), activeConversation: () => {}, markUnread: () => {} };
const ChatNotificationContext = createContext<ChatNotifications>(empty);

export function useChatNotifications() { return useContext(ChatNotificationContext); }

export function ChatNotificationsProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const active = useRef<string | null>(null);
  const toastId = useRef(0);
  const accountKey = session ? `huyenco.chat.unread.${session.accountId}` : null;
  const readTimes = useRef<Record<string, number>>({});

  useEffect(() => {
    const controller = new AbortController();
    void readChatSession(controller.signal).then(setSession).catch(error => {
      if (!controller.signal.aborted && error instanceof RestError
          && ["LOGIN_REQUIRED", "INVALID_SESSION", "FORBIDDEN"].includes(error.code)) setSession(null);
    });
    return () => controller.abort();
  }, [sessionAttempt]);

  useEffect(() => {
    if (session) return;
    const retry = () => setSessionAttempt(value => value + 1);
    window.addEventListener("focus", retry);
    window.addEventListener("pageshow", retry);
    return () => {
      window.removeEventListener("focus", retry);
      window.removeEventListener("pageshow", retry);
    };
  }, [session]);

  useEffect(() => {
    if (!accountKey) {
      setUnreadConversations(new Set());
      return;
    }
    try {
      const value: unknown = JSON.parse(localStorage.getItem(accountKey) ?? "[]");
      setUnreadConversations(new Set(Array.isArray(value) ? value.filter(isUuid) : []));
    } catch { setUnreadConversations(new Set()); }
  }, [accountKey]);

  useEffect(() => {
    if (!session || !accountKey) return;
    const controller = new AbortController();
    try { readTimes.current = JSON.parse(localStorage.getItem(`${accountKey}.read`) ?? "{}"); }
    catch { readTimes.current = {}; }
    async function restoreUnread() {
      let page = 0;
      let totalPages = 1;
      const unread = new Set<string>();
      while (page < totalPages && !controller.signal.aborted) {
        const rooms = await listConversations(session!, page++, controller.signal);
        totalPages = rooms.totalPages;
        for (const room of rooms.items) {
          if (room.status === "PENDING") {
            if (session!.role === "CONSULTANT") unread.add(room.conversationId);
            continue;
          }
          let cursor = "0";
          let hasMore = true;
          while (hasMore && !controller.signal.aborted) {
            const messages = await readRoomMessages(room, cursor, controller.signal);
            if (messages.items.some(message => message.senderAccountId !== session!.accountId
                && Date.parse(message.createdAt) > (readTimes.current[room.conversationId] ?? 0))) {
              unread.add(room.conversationId);
              break;
            }
            cursor = messages.nextAfterSequence;
            hasMore = messages.hasMore;
          }
        }
      }
      if (controller.signal.aborted) return;
      unread.delete(active.current ?? "");
      setUnreadConversations(previous => new Set([...previous, ...unread]));
      if (unread.size) setToast({ id: ++toastId.current,
        text: `Bạn có ${unread.size} cuộc trò chuyện có yêu cầu hoặc tin nhắn chưa đọc.`, conversationId: [...unread][0] });
    }
    void restoreUnread().catch(() => { /* Live notifications remain available on a failed history sync. */ });
    return () => controller.abort();
  }, [session, accountKey]);

  const onAccessError = useCallback((code: string) => {
    if (["INVALID_SESSION", "LOGIN_REQUIRED", "FORBIDDEN"].includes(code)) setSession(null);
  }, []);
  const credentials = useCallback((signal: AbortSignal) => session ? readChatCsrf(session, signal)
    : Promise.reject(new RestError("LOGIN_REQUIRED")), [session]);
  const markUnread = useCallback((id: string, force = false) => {
    if (active.current === id && !force || !isUuid(id)) return;
    setUnreadConversations(previous => {
      if (previous.has(id)) return previous;
      const next = new Set(previous).add(id);
      if (session) {
        try { localStorage.setItem(`huyenco.chat.unread.${session.accountId}`, JSON.stringify([...next])); } catch { /* Browser storage is optional. */ }
      }
      return next;
    });
  }, [session]);
  const onMessage = useCallback((body: string) => {
    let event: unknown;
    try { event = JSON.parse(body); } catch { return; }
    if (!isRecord(event) || !isUuid(event.conversationId) || !session) return;
    let message: string | null = null;
    if (event.type === "ROOM_CREATED" && event.status === "PENDING" && session.role === "CONSULTANT") {
      message = "Bạn có yêu cầu tư vấn mới.";
    } else if (event.type === "ROOM_CHANGED" && event.status === "ACTIVE" && session.role === "USER") {
      message = "Bạn có thông báo mới: tư vấn viên đã chấp nhận yêu cầu.";
    } else if (event.type === "MESSAGE_RECEIVED") {
      message = "Bạn có tin nhắn mới.";
      if (active.current === event.conversationId && accountKey) {
        readTimes.current[event.conversationId] = Date.now();
        try { localStorage.setItem(`${accountKey}.read`, JSON.stringify(readTimes.current)); } catch { /* Optional. */ }
      }
    }
    if (!message) return;
    markUnread(event.conversationId, event.type !== "MESSAGE_RECEIVED");
    setToast({ id: ++toastId.current, text: message, conversationId: event.conversationId });
  }, [session, markUnread, accountKey]);
  useAuthenticatedSocket({ endpoint: "chat", destination: "/user/queue/chat/workspace", credentials: session ? credentials : null,
    onMessage, onAccessError, onConnected: socket => {
      socket.publish({ destination: "/app/chat/workspace", body: JSON.stringify({ action: "SYNC" }) });
    } });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(current => current?.id === toast.id ? null : current), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeConversation = useCallback((id: string | null) => {
    active.current = id;
    if (!id) return;
    readTimes.current[id] = Date.now();
    if (accountKey) {
      try { localStorage.setItem(`${accountKey}.read`, JSON.stringify(readTimes.current)); } catch { /* Optional. */ }
    }
    setUnreadConversations(previous => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      if (session) {
        try { localStorage.setItem(`huyenco.chat.unread.${session.accountId}`, JSON.stringify([...next])); } catch { /* Optional. */ }
      }
      return next;
    });
    setToast(current => current?.conversationId === id ? null : current);
  }, [session, accountKey]);

  const value = useMemo(() => ({ unreadConversations, activeConversation, markUnread }), [unreadConversations, activeConversation, markUnread]);
  return <ChatNotificationContext.Provider value={value}>
    {children}
    {toast && <aside className="chat-toast" role="status" aria-live="polite">
      <Link href={session?.role === "CONSULTANT" ? "/tu-van-vien" : "/tu-van"}>{toast.text}</Link>
      <button type="button" aria-label="Đóng thông báo" onClick={() => setToast(null)}>×</button>
    </aside>}
  </ChatNotificationContext.Provider>;
}
