"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import { createConversation, listChatConsultants, listConversations, readChatSession, readConversation, transitionConversation } from "@/services/rest/chat";
import { RestError } from "@/services/rest/transport";
import type { Page } from "@/types/contract";
import type { ChatSession, Conversation, ConversationAction } from "@/types/chatContract";
import { ConsultationWorkspace } from "./ConsultationWorkspace";
import type { ChatAudience, ChatRoom } from "./chatState";
import { chatRequestId, useRoomChat } from "./useRoomChat";
import styles from "./chat.module.css";

type Loader<T> = (signal: AbortSignal) => Promise<T>;
type AccessFailure = "expired" | "forbidden";
type Resource<T> = { data?: T; error?: string; busy: boolean; reload: () => void };

const errorCode = (error: unknown) => error instanceof RestError ? error.code : "NETWORK_ERROR";
const accessFailure = (code: string): AccessFailure | null => {
  if (code === "INVALID_SESSION" || code === "LOGIN_REQUIRED") return "expired";
  if (code === "FORBIDDEN") return "forbidden";
  return null;
};

function useResource<T>(load: Loader<T> | null, onError?: (code: string) => void): Resource<T> {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ load: Loader<T>; revision: number; data?: T; error?: string }>();
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!load) return;
    const controller = new AbortController();
    const { signal } = controller;
    async function run(loader: Loader<T>) {
      try {
        const data = await loader(signal);
        if (!signal.aborted) setResult({ load: loader, revision, data });
      } catch (error) {
        if (signal.aborted) return;
        const code = errorCode(error);
        onError?.(code);
        setResult({ load: loader, revision, error: code });
      }
    }
    void run(load);
    return () => controller.abort();
  }, [load, onError, revision]);
  const current = result?.load === load && result.revision === revision ? result : undefined;
  return { data: current?.data, error: current?.error, busy: !!load && !current, reload };
}

export function LiveConsultationWorkspace({ audience }: { audience: ChatAudience }) {
  return CLIENT_CONFIG.accountHistory ? <SessionGate audience={audience} /> : <ConsultationWorkspace audience={audience} />;
}

function SessionGate({ audience }: { audience: ChatAudience }) {
  const resource = useResource(readChatSession);
  const session = resource.data;
  const [failure, setFailure] = useState<AccessFailure | null>(null);
  const invalidate = useCallback((code: string) => {
    const denied = accessFailure(code);
    if (denied) setFailure(denied);
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => setFailure("expired"), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session]);

  if (failure) return <ConsultationWorkspace audience={audience} access={{ status: failure }} />;
  if (!session) {
    const status = resource.busy ? "loading" : accessFailure(resource.error ?? "") ?? "error";
    return <ConsultationWorkspace audience={audience} access={{ status }} retry={resource.reload} />;
  }
  if (session.role !== (audience === "user" ? "USER" : "CONSULTANT")) {
    return <ConsultationWorkspace audience={audience} access={{ status: "forbidden" }} />;
  }
  return <SessionWorkspace key={session.accountId} session={session} audience={audience} onAuthError={invalidate} />;
}

const roomStates = { PENDING: "pending", ACTIVE: "active", ENDED: "ended" } as const;
const endingLabels = { DECLINED: "Tư vấn viên đã từ chối yêu cầu.", CANCELLED: "Người gửi đã hủy yêu cầu.", COMPLETED: "Phiên tư vấn đã kết thúc." };
const actionLabels = { ACCEPT: "Chấp nhận yêu cầu", DECLINE: "Từ chối yêu cầu", CANCEL: "Hủy yêu cầu", END: "Kết thúc cuộc trò chuyện" };
const pendingActions = { user: ["CANCEL"], consultant: ["ACCEPT", "DECLINE"] } as const;
const roomDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function SessionWorkspace({ session, audience, onAuthError }: { session: ChatSession; audience: ChatAudience; onAuthError: (code: string) => void }) {
  const [directoryPage, setDirectoryPage] = useState(0);
  const [conversationPage, setConversationPage] = useState(0);
  const [selectedConsultant, setSelectedConsultant] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendNotice, setSendNotice] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [roomNotice, setRoomNotice] = useState("");
  const requestIds = useRef(new Map<string, string>());
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const loadDirectory = useCallback((signal: AbortSignal) => listChatConsultants(directoryPage, signal), [directoryPage]);
  const loadConversations = useCallback((signal: AbortSignal) => listConversations(session, conversationPage, signal), [session, conversationPage]);
  const loadRoom = useCallback((signal: AbortSignal) => readConversation(session, roomId!, signal), [session, roomId]);
  const directory = useResource(audience === "user" ? loadDirectory : null, onAuthError);
  const conversations = useResource(loadConversations, onAuthError);
  const detail = useResource(roomId ? loadRoom : null, onAuthError);
  const onChatAccessError = useCallback((code: string) => {
    if (code === "NOT_FOUND") {
      setRoomId(null);
      setRoomNotice("Hội thoại này không còn khả dụng.");
    } else {
      onAuthError(code);
    }
  }, [onAuthError]);
  const chat = useRoomChat(session, detail.data, onChatAccessError);
  const consultants = directory.data?.items;
  const consultantId = consultants?.find(item => item.consultantId === selectedConsultant)?.consultantId ?? "";

  async function create() {
    if (!consultantId || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSending(true);
    setSendNotice("");
    try {
      const requestId = requestIds.current.get(consultantId) ?? chatRequestId();
      requestIds.current.set(consultantId, requestId);
      const created = await createConversation(session, consultantId, requestId, controller.signal);
      if (controller.signal.aborted) return;
      requestIds.current.delete(consultantId);
      setSelectedConsultant("");
      setRoomNotice("");
      setConversationPage(0);
      conversations.reload();
      setRoomId(created.conversationId);
      detail.reload();
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = errorCode(error);
      onAuthError(code);
      if (code === "NOT_FOUND") {
        requestIds.current.delete(consultantId);
        setSelectedConsultant("");
        directory.reload();
        setSendNotice("Tư vấn viên này không còn trong danh bạ. Hãy chọn người khác.");
      } else if (code === "REQUEST_ID_CONFLICT") {
        requestIds.current.delete(consultantId);
        setSendNotice("Mã yêu cầu đã được sử dụng. Bấm gửi lại để tạo yêu cầu mới.");
      } else {
        setSendNotice("Chưa xác nhận được yêu cầu. Bạn có thể bấm gửi lại.");
      }
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setSending(false);
      }
    }
  }

  async function changeRoom(action: ConversationAction) {
    if (!detail.data || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setTransitioning(true);
    setRoomNotice("");
    try {
      await transitionConversation(session, detail.data.conversationId, action, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = errorCode(error);
      onAuthError(code);
      if (code === "INVALID_TRANSITION") {
        setRoomNotice("Trạng thái hội thoại đã thay đổi. Hãy kiểm tra trạng thái vừa tải lại.");
      } else if (code !== "NOT_FOUND") {
        setRoomNotice("Chưa xác nhận được thao tác. Hãy kiểm tra trạng thái phòng trước khi thử lại.");
      }
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setTransitioning(false);
        detail.reload();
        conversations.reload();
      }
    }
  }

  function roomSummary(room: Conversation) {
    const consultant = consultants?.find(item => item.consultantId === room.consultantId)?.displayName;
    const title = `${consultant ?? "Hội thoại"} · ${roomDate.format(new Date(room.createdAt))} · ${room.conversationId.slice(0, 8)}`;
    return { id: room.conversationId, title, status: roomStates[room.status] };
  }

  const room: ChatRoom | null = detail.data ? { ...roomSummary(detail.data), history: chat.messages,
    ending: detail.data.endReason ? endingLabels[detail.data.endReason] : undefined } : null;
  const actions: readonly ConversationAction[] = room?.status === "pending" ? pendingActions[audience]
    : room?.status === "active" ? ["END"] : [];
  return <ConsultationWorkspace audience={audience} access={{ status: "authorized", accessKey: session.accountId,
    connection: chat.connection, room, conversations: conversations.data?.items.map(roomSummary),
    consultants: consultants?.map(item => ({ id: item.consultantId, name: item.displayName, profile: item.summary ?? undefined })),
  }} messaging={chat.messaging} retry={chat.retry} controls={{
    consultantId, selectConsultant: id => { setSelectedConsultant(id); setSendNotice(""); }, create, sending, transitioning, roomId,
    openRoom: id => { setRoomId(id); setRoomNotice(""); detail.reload(); },
    directoryStatus: <>
      <PageStatus resource={directory} label="danh bạ tư vấn viên" changePage={setDirectoryPage} />
      {sendNotice && <p role="alert">{sendNotice}</p>}
    </>,
    listStatus: <PageStatus resource={conversations} label="danh sách hội thoại" changePage={setConversationPage} />,
    roomStatus: <>
      {transitioning && <p role="status">Đang cập nhật hội thoại…</p>}
      {roomNotice && <p role="alert">{roomNotice}</p>}
      {roomId && detail.busy && <p role="status">Đang mở hội thoại…</p>}
      {roomId && detail.error && <p role="alert">{detail.error === "NOT_FOUND" ? "Hội thoại này không còn khả dụng." : "Không tải được hội thoại."}</p>}
      {roomId && !detail.busy && <button type="button" className="secondary-button" disabled={transitioning}
        onClick={() => { setRoomNotice(""); detail.reload(); }}>Tải lại phòng</button>}
    </>,
    lifecycleControls: actions.length > 0 && <div className={styles.actions} aria-label="Thao tác hội thoại">
      {actions.map(action => <button key={action} type="button" className="secondary-button"
        disabled={sending || transitioning} onClick={() => void changeRoom(action)}>{actionLabels[action]}</button>)}
    </div>,
  }} />;
}

function PageStatus<T>({ resource, label, changePage }: { resource: Resource<Page<T>>; label: string; changePage: (page: number) => void }) {
  if (resource.busy) return <p role="status">Đang tải {label}…</p>;
  if (resource.error) return <>
    <p role="alert">Không tải được {label}.</p>
    <button type="button" className="secondary-button" onClick={resource.reload}>Tải lại {label}</button>
  </>;
  const data = resource.data;
  if (!data || data.totalPages < 2 && data.page === 0) return null;
  return <nav aria-label={`Phân trang ${label}`} className={styles.actions}>
    <button type="button" className="secondary-button" disabled={data.page === 0} onClick={() => changePage(data.page - 1)}>Trang trước</button>
    <span>Trang {data.page + 1}</span>
    <button type="button" className="secondary-button" disabled={data.page + 1 >= data.totalPages} onClick={() => changePage(data.page + 1)}>Trang sau</button>
  </nav>;
}
