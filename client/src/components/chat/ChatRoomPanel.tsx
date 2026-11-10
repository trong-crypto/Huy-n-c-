"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChatComposer, ChatIcon } from "./ChatComposer";
import { useChatScroll } from "./useChatScroll";
import { draftLimit, isChatMessage, roomStatusLabels, validateChatDraft,
  type ChatAccess, type ChatMessage, type ChatMessaging, type SubscribeToRoom } from "./chatState";
import styles from "./chat.module.css";

type Authorized = Extract<ChatAccess, { status: "authorized" }>;

const connectionLabels = {
  connecting: "Đang kết nối.",
  connected: "Đã kết nối.",
  disconnected: "Mất kết nối. Bản nháp vẫn được giữ trên trang.",
  reconnecting: "Đang kết nối lại.",
  unresponsive: "Máy chủ chưa phản hồi.",
  unavailable: "Đã mở phòng. Gửi nhận tin nhắn sẽ khả dụng khi kết nối chat được triển khai.",
};

export function ChatRoomPanel({ state, subscribe, retry, messaging, lifecycleControls, roomStatus }: {
  state: Authorized; subscribe?: SubscribeToRoom; retry?: () => void; messaging?: ChatMessaging; lifecycleControls?: ReactNode; roomStatus?: ReactNode;
}) {
  const room = state.room;
  const roomId = room?.id;
  const messagingAvailable = state.connection !== "unavailable";
  const listening = room?.status === "active" && state.connection === "connected";
  const [received, setReceived] = useState<ChatMessage[]>([]);
  const [receiveError, setReceiveError] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const acknowledgedId = messaging?.acknowledgedId;
  useEffect(() => {
    if (acknowledgedId) {
      setDraft("");
      setDraftError(null);
    }
  }, [acknowledgedId]);

  useEffect(() => {
    if (!listening || !subscribe || !roomId) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribe(roomId, event => {
        if (!active) return;
        if (!isChatMessage(event)) { setReceiveError(true); return; }
        if (event.roomId !== roomId) return;
        setReceived(messages => messages.some(message => message.id === event.id) ? messages : [...messages, event]);
      });
    } catch {
      setReceiveError(true);
    }
    return () => {
      active = false;
      try { unsubscribe?.(); } catch { /* The transport may already be closed. */ }
    };
  }, [listening, roomId, subscribe]);

  const messages = new Map<string, ChatMessage>();
  for (const message of [...(room?.history ?? []), ...received]) {
    if (message.roomId === roomId && !messages.has(message.id)) messages.set(message.id, message);
  }

  const historyAvailable = messaging !== undefined || messagingAvailable;
  const scroll = useChatScroll(historyAvailable ? messages.size : 0);
  const draftDisabled = !messagingAvailable || room?.status !== "active";
  const sendDisabled = !messaging || state.connection !== "connected" || messaging.delivery === "waiting";

  function send() {
    if (!messaging || draftDisabled || sendDisabled) return;
    const error = validateChatDraft(draft);
    setDraftError(error);
    if (!error) messaging.send(draft.trim());
  }

  return <>
    <header className={styles.roomHeader}>
      <span className={styles.avatar}><ChatIcon /></span>
      <div className={styles.roomHeading}>
        <h2>{room?.title ?? "Khung trò chuyện"}</h2>
        {room && <span className={styles.badge} data-status={room.status}>{roomStatusLabels[room.status]}</span>}
      </div>
      {lifecycleControls}
    </header>
    <div className={styles.roomStatus}>
      {roomStatus}
      {room?.ending && <p>{room.ending}</p>}
      {(room || messagingAvailable) && (!messaging || room?.status === "active") &&
        <p role="status">{connectionLabels[state.connection]}</p>}
      {(state.connection === "disconnected" || state.connection === "unresponsive") &&
        <button type="button" className="secondary-button" disabled={!retry} onClick={retry}>Thử kết nối lại</button>}
      {state.failure === "sendFailed" && <p role="alert">Gửi tin nhắn thất bại.</p>}
      {state.failure === "deliveryUnknown" && <p role="alert">Chưa xác định máy chủ đã nhận tin. Hãy đối chiếu lịch sử trước khi gửi lại.</p>}
      {messaging?.delivery === "waiting" && <p role="status">Đang chờ xác nhận tin nhắn…</p>}
      {messaging?.delivery === "unknown" && !messaging.notice &&
        <p role="alert">Chưa nhận được xác nhận. Bạn có thể gửi lại tin này khi kết nối hoạt động.</p>}
      {messaging?.notice && <p role="alert">{messaging.notice}</p>}
      {receiveError && <p role="alert">Có lỗi khi nhận dữ liệu hội thoại.</p>}
      {messaging?.historyStatus === "loading" && <p role="status">Đang tải lịch sử tin nhắn…</p>}
      {messaging?.historyStatus === "error" && <>
        <p role="alert">Chưa đồng bộ được lịch sử tin nhắn.</p>
        <button type="button" className="secondary-button" onClick={retry}>Tải lại lịch sử</button>
      </>}
    </div>
    <div className={styles.timeline} {...scroll} tabIndex={0} aria-label="Vùng tin nhắn">
      {historyAvailable && messages.size > 0 ? <ol className={styles.messages} aria-label="Tin nhắn trong cuộc trò chuyện" aria-live="polite" aria-relevant="additions">
        {Array.from(messages.values(), message => <li key={message.id} className={styles.message}
          data-own={message.author === "Bạn" ? "true" : undefined}>
          <strong>{message.author}</strong><p>{message.text}</p>
        </li>)}
      </ol> : <div className={styles.empty}>
        <span className={styles.emptyIcon}><ChatIcon /></span>
        {!room ? <><h3>Chưa mở cuộc trò chuyện.</h3><p>Chọn một cuộc trò chuyện trong danh sách để bắt đầu.</p></>
          : !historyAvailable ? <p>Lịch sử tin nhắn chưa khả dụng.</p>
            : (!messaging || messaging.historyStatus === "ready") && <h3>Cuộc trò chuyện chưa có tin nhắn.</h3>}
      </div>}
    </div>
    <ChatComposer id="chat-draft" label="Tin nhắn" value={draft} maxLength={draftLimit}
      disabled={draftDisabled} readOnly={messaging !== undefined && messaging.delivery !== "idle"}
      sendDisabled={sendDisabled} sendLabel={messaging?.delivery === "unknown" ? "Gửi lại tin này" : "Gửi tin nhắn"}
      placeholder={draftDisabled ? "Chỉ gửi trong phòng đang tư vấn" : "Nhập tin nhắn…"}
      hint={draftDisabled ? "Bạn có thể đọc lại các tin nhắn đã có." : `Tối đa ${draftLimit} ký tự · Shift + Enter để xuống dòng`}
      invalid={!!draftError} error={draftError} onSend={send}
      onChange={text => { setDraft(text); setChecked(false); setDraftError(null); }}>
      {checked && !draftError && <p role="status">Bản nháp hợp lệ · Chưa gửi.</p>}
      {!messaging && !draftDisabled && <button type="button" className="secondary-button" onClick={() => {
        setDraftError(validateChatDraft(draft)); setChecked(true);
      }}>Kiểm tra bản nháp</button>}
      {!messaging && messagingAvailable && <button type="button" className="secondary-button" disabled>Kết thúc cuộc trò chuyện</button>}
    </ChatComposer>
  </>;
}
