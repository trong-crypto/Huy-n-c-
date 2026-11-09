import Link from "next/link";
import type { ReactNode } from "react";
import { customerAuthRoutes } from "@/config/customerAuthRoutes";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { ChatRoomPanel } from "./ChatRoomPanel";
import { chatRoutes, roomStatusLabels, type ChatAccess, type ChatAudience, type ChatMessaging, type SubscribeToRoom } from "./chatState";
import styles from "./chat.module.css";

const accessMessages = {
  blocked: "Chat chưa sẵn sàng. Đang chờ Backend cung cấp xác thực và dịch vụ hội thoại.",
  loading: "Đang tải thông tin phiên tư vấn.",
  expired: "Phiên chat đã hết hạn. Cần xác thực lại để tiếp tục.",
  forbidden: "Bạn không có quyền mở cuộc trò chuyện này.",
  error: "Không tải được thông tin tư vấn. Máy chủ có thể chưa phản hồi.",
};

export function ConsultationWorkspace({ audience, access = { status: "blocked" }, subscribe, retry, messaging, controls }: {
  audience: ChatAudience;
  access?: ChatAccess;
  subscribe?: SubscribeToRoom;
  retry?: () => void;
  messaging?: ChatMessaging;
  controls?: {
    consultantId: string;
    selectConsultant: (id: string) => void;
    create: () => void;
    sending: boolean;
    transitioning: boolean;
    roomId: string | null;
    openRoom: (id: string) => void;
    directoryStatus: ReactNode;
    listStatus: ReactNode;
    roomStatus: ReactNode;
    lifecycleControls: ReactNode;
  };
}) {
  const consultant = audience === "consultant";
  const authorized = access.status === "authorized" ? access : null;
  const conversationsTitle = consultant ? "Yêu cầu và hội thoại được phân" : "Cuộc trò chuyện của bạn";
  return <PageContainer>
    <PageHeader eyebrow="TƯ VẤN TRỰC TIẾP 1:1" title={consultant ? "Không gian tư vấn viên" : "Tư vấn trực tuyến"}>
      <p>{consultant
        ? "Xem yêu cầu được phân và trả lời trong cuộc trò chuyện được cấp quyền."
        : "Chọn tư vấn viên và trao đổi riêng trong cuộc trò chuyện được Server cấp quyền."}</p>
      <Link className="source-link" href={consultant ? chatRoutes.user : chatRoutes.consultant}>
        {consultant ? "Về trang tư vấn người dùng" : "Mở không gian tư vấn viên"} →
      </Link>
    </PageHeader>
    {access.status !== "authorized" && <p className="status-banner"
      role={access.status === "blocked" || access.status === "loading" ? "status" : "alert"}>{accessMessages[access.status]}</p>}
    {access.status === "expired" && <Link className="source-link" href={customerAuthRoutes.login}>Đăng nhập để tiếp tục</Link>}
    {access.status === "error" && retry && <button type="button" className="secondary-button" onClick={retry}>Tải lại phiên tư vấn</button>}
    <div className={styles.workspace} aria-busy={access.status === "loading"}>
      <aside className={styles.sidebar} aria-label="Thông tin tư vấn">
        {!consultant && <section className="section-card" aria-labelledby="consultants-title">
          <h2 id="consultants-title" className="section-title">Tư vấn viên</h2>
          {authorized?.consultants?.length ? <ul className={styles.entries}>
            {authorized.consultants.map(person => <li key={person.id}>
              {controls ? <label className={styles.choice}>
                <input type="radio" name="chat-consultant" checked={controls.consultantId === person.id}
                  onChange={() => controls.selectConsultant(person.id)} disabled={controls.sending} />
                <strong>{person.name}</strong>
              </label> : <strong>{person.name}</strong>}
              {person.profile && <p>{person.profile}</p>}
              {person.availability && <p>{person.availability}</p>}
            </li>)}
          </ul> : (authorized?.consultants || !controls) && <p>{authorized?.consultants ? "Chưa có tư vấn viên trong danh sách." : "Danh sách tư vấn viên chưa khả dụng."}</p>}
          {controls?.directoryStatus}
          <button type="button" className="secondary-button" disabled={!controls?.consultantId || controls.sending || controls.transitioning}
            onClick={controls?.create}>{controls?.sending ? "Đang gửi yêu cầu…" : "Gửi yêu cầu tư vấn"}</button>
        </section>}
        <section className="section-card" aria-labelledby="conversations-title">
          <h2 id="conversations-title" className="section-title">{conversationsTitle}</h2>
          {authorized?.conversations?.length ? <ul className={styles.entries}>
            {authorized.conversations.map(item => <li key={item.id}>
              {controls ? <button type="button" className="secondary-button" aria-pressed={controls.roomId === item.id}
                disabled={controls.transitioning || controls.sending}
                onClick={() => controls.openRoom(item.id)}>{item.title}</button> : <strong>{item.title}</strong>}
              <p>{roomStatusLabels[item.status]}</p>
            </li>)}
          </ul> : (authorized?.conversations || !controls) && <p>{authorized?.conversations ? "Chưa có cuộc trò chuyện." : "Chưa thể tải danh sách hội thoại."}</p>}
          {controls?.listStatus}
          {consultant && !controls && <div className={styles.actions}>
            <button type="button" className="secondary-button" disabled>Chấp nhận yêu cầu</button>
            <button type="button" className="secondary-button" disabled>Từ chối yêu cầu</button>
          </div>}
        </section>
      </aside>
      <section className={`section-card ${styles.room}`} aria-labelledby="chat-room-title">
        <h2 id="chat-room-title" className="section-title">Khung trò chuyện</h2>
        {controls?.roomStatus}
        {authorized ? <ChatRoomPanel key={JSON.stringify([authorized.accessKey, authorized.room?.id])} state={authorized}
          subscribe={subscribe} retry={retry} messaging={messaging} lifecycleControls={controls?.lifecycleControls} /> : <>
          <p>Phòng chat chưa sẵn sàng.</p>
          <FormDisabled />
        </>}
      </section>
    </div>
  </PageContainer>;
}

function FormDisabled() {
  return <div className="form-stack">
    <label htmlFor="chat-disabled-draft">Tin nhắn</label>
    <textarea id="chat-disabled-draft" rows={3} disabled />
    <div className={styles.actions}>
      <button type="button" className="primary-button" disabled>Gửi tin nhắn</button>
      <button type="button" className="secondary-button" disabled>Kết thúc cuộc trò chuyện</button>
    </div>
  </div>;
}
