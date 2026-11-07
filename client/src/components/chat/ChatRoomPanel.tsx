"use client";

import { useEffect, useState } from "react";
import { FieldError, FormField } from "@/components/ui/Controls";
import { draftLimit, isChatMessage, roomStatusLabels, validateChatDraft, type ChatAccess, type ChatMessage, type SubscribeToRoom } from "./chatState";
import styles from "./chat.module.css";

type Authorized = Extract<ChatAccess, { status: "authorized" }>;

const connectionLabels = {
  connecting: "Đang kết nối.",
  connected: "Đã kết nối.",
  disconnected: "Mất kết nối. Bản nháp vẫn được giữ trên trang.",
  reconnecting: "Đang kết nối lại.",
  unresponsive: "Máy chủ chưa phản hồi.",
};

export function ChatRoomPanel({ state, subscribe, retry }: { state: Authorized; subscribe?: SubscribeToRoom; retry?: () => void }) {
  const room = state.room;
  const roomId = room?.id;
  const listening = room?.status === "active" && state.connection === "connected";
  const [received, setReceived] = useState<ChatMessage[]>([]);
  const [receiveError, setReceiveError] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

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

  return <>
    <p role="status">{connectionLabels[state.connection]}</p>
    {(state.connection === "disconnected" || state.connection === "unresponsive") &&
      <button type="button" className="secondary-button" disabled={!retry} onClick={retry}>Thử kết nối lại</button>}
    {state.failure === "sendFailed" && <p role="alert">Gửi tin nhắn thất bại.</p>}
    {state.failure === "deliveryUnknown" && <p role="alert">Chưa xác định máy chủ đã nhận tin. Hãy đối chiếu lịch sử trước khi gửi lại.</p>}
    {receiveError && <p role="alert">Có lỗi khi nhận dữ liệu hội thoại.</p>}
    {!room ? <p>Chưa mở cuộc trò chuyện.</p> : <>
      <h3>{room.title}</h3>
      <p className="field-hint">{roomStatusLabels[room.status]}</p>
      {messages.size === 0 ? <p>Cuộc trò chuyện chưa có tin nhắn.</p> : <ol className={styles.messages} aria-label="Tin nhắn trong cuộc trò chuyện">
        {Array.from(messages.values(), message => <li key={message.id}>
          <strong>{message.author}</strong><p>{message.text}</p>
        </li>)}
      </ol>}
    </>}
    <form className="form-stack" onSubmit={event => event.preventDefault()}>
      <FormField id="chat-draft" label="Tin nhắn" hint={`Bản nháp tối đa ${draftLimit} ký tự và chỉ hiển thị trên trang. Gửi tin đang chờ Backend.`}>
        <textarea id="chat-draft" rows={3} maxLength={draftLimit} value={draft} disabled={room?.status !== "active"}
          aria-invalid={!!draftError || undefined} aria-describedby={draftError ? "chat-draft-hint chat-draft-error" : "chat-draft-hint"}
          onChange={event => { setDraft(event.target.value); setChecked(false); setDraftError(null); }} />
        {draftError && <FieldError id="chat-draft-error">{draftError}</FieldError>}
      </FormField>
      {checked && !draftError && <p role="status">Bản nháp hợp lệ · Chưa gửi.</p>}
      <div className={styles.actions}>
        {room?.status === "active" && <button type="button" className="secondary-button" onClick={() => {
          setDraftError(validateChatDraft(draft)); setChecked(true);
        }}>Kiểm tra bản nháp</button>}
        <button type="submit" className="primary-button" disabled>Gửi tin nhắn</button>
        <button type="button" className="secondary-button" disabled>Kết thúc cuộc trò chuyện</button>
      </div>
    </form>
  </>;
}
