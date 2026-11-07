import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { ChatRoomPanel } from "./ChatRoomPanel";
import { chatRoutes, roomStatusLabels, type ChatAccess, type ChatAudience, type SubscribeToRoom } from "./chatState";
import styles from "./chat.module.css";

const accessMessages = {
  blocked: "Chat chưa sẵn sàng. Đang chờ Backend cung cấp xác thực và dịch vụ hội thoại.",
  loading: "Đang tải thông tin phiên tư vấn.",
  expired: "Phiên chat đã hết hạn. Cần xác thực lại để tiếp tục.",
  forbidden: "Bạn không có quyền mở cuộc trò chuyện này.",
  error: "Không tải được thông tin tư vấn. Máy chủ có thể chưa phản hồi.",
};

export function ConsultationWorkspace({ audience, access = { status: "blocked" }, subscribe, retry }: {
  audience: ChatAudience;
  access?: ChatAccess;
  subscribe?: SubscribeToRoom;
  retry?: () => void;
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
    <div className={styles.workspace} aria-busy={access.status === "loading"}>
      <aside className={styles.sidebar} aria-label="Thông tin tư vấn">
        {!consultant && <section className="section-card" aria-labelledby="consultants-title">
          <h2 id="consultants-title" className="section-title">Tư vấn viên</h2>
          {authorized?.consultants?.length ? <ul className={styles.entries}>
            {authorized.consultants.map(person => <li key={person.id}>
              <strong>{person.name}</strong>
              {person.profile && <p>{person.profile}</p>}
              {person.availability && <p>{person.availability}</p>}
            </li>)}
          </ul> : <p>{authorized?.consultants ? "Chưa có tư vấn viên trong danh sách." : "Danh sách và trạng thái sẵn sàng đang chờ dữ liệu Backend."}</p>}
          <button type="button" className="secondary-button" disabled>Gửi yêu cầu tư vấn</button>
        </section>}
        <section className="section-card" aria-labelledby="conversations-title">
          <h2 id="conversations-title" className="section-title">{conversationsTitle}</h2>
          {authorized?.conversations?.length ? <ul className={styles.entries}>
            {authorized.conversations.map(item => <li key={item.id}><strong>{item.title}</strong><p>{roomStatusLabels[item.status]}</p></li>)}
          </ul> : <p>{authorized?.conversations ? "Chưa có cuộc trò chuyện." : "Chưa thể tải danh sách hội thoại."}</p>}
          {consultant && <div className={styles.actions}>
            <button type="button" className="secondary-button" disabled>Chấp nhận yêu cầu</button>
            <button type="button" className="secondary-button" disabled>Từ chối yêu cầu</button>
          </div>}
        </section>
      </aside>
      <section className={`section-card ${styles.room}`} aria-labelledby="chat-room-title">
        <h2 id="chat-room-title" className="section-title">Khung trò chuyện</h2>
        {authorized ? <ChatRoomPanel key={JSON.stringify([authorized.accessKey, authorized.room?.id])} state={authorized} subscribe={subscribe} retry={retry} /> : <>
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
