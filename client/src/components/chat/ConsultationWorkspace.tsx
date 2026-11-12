import Link from "next/link";
import type { ReactNode } from "react";
import { customerAuthRoutes } from "@/config/customerAuthRoutes";
import { PageContainer } from "@/components/ui/Page";
import { ChatComposer, ChatIcon } from "./ChatComposer";
import { ChatRoomPanel } from "./ChatRoomPanel";
import { ConsultationNavigation } from "./ConsultationNavigation";
import { chatRoutes, roomStatusLabels, type ChatAccess, type ChatAudience, type ChatMessaging, type SubscribeToRoom } from "./chatState";
import type { ConsultationNotice } from "./useConsultationSocket";
import styles from "./chat.module.css";

const accessMessages = {
  blocked: "Chat chưa sẵn sàng. Đang chờ Backend cung cấp xác thực và dịch vụ hội thoại.",
  loading: "Đang tải thông tin phiên tư vấn.",
  expired: "Phiên chat đã hết hạn. Cần xác thực lại để tiếp tục.",
  forbidden: "Bạn không có quyền mở cuộc trò chuyện này.",
  error: "Không tải được thông tin tư vấn. Máy chủ có thể chưa phản hồi.",
};

const noticeMessages = {
  request: "Bạn có yêu cầu tư vấn mới.",
  accepted: "Tư vấn viên đã chấp nhận yêu cầu. Phòng chat đã mở.",
  message: "Bạn có tin nhắn mới.",
};

export function ConsultationWorkspace({ audience, access = { status: "blocked" }, canOpenConsultantWorkspace, subscribe, retry, messaging, controls }: {
  audience: ChatAudience;
  access?: ChatAccess;
  canOpenConsultantWorkspace?: boolean;
  subscribe?: SubscribeToRoom;
  retry?: () => void;
  messaging?: ChatMessaging;
  controls?: {
    consultantId: string;
    selectConsultant: (id: string) => void;
    create: () => void;
    ready?: boolean;
    prioritizeRequest?: boolean;
    sending: boolean;
    transitioning: boolean;
    roomId: string | null;
    openRoom: (id: string) => void;
    notices: readonly ConsultationNotice[];
    dismissNotice: (notice: ConsultationNotice) => void;
    directoryStatus: ReactNode;
    listStatus: ReactNode;
    roomStatus: ReactNode;
    lifecycleControls: ReactNode;
  };
}) {
  const consultant = audience === "consultant";
  const authorized = access.status === "authorized" ? access : null;
  return <PageContainer className={styles.page}>
    <header className={styles.masthead}>
      <div>
        <p className="eyebrow">HUYỀN CƠ / TƯ VẤN</p>
        <h1>{consultant ? "Không gian tư vấn viên" : "Tư vấn trực tuyến"}</h1>
      </div>
      {!consultant && <ConsultationNavigation current="human" />}
      {(consultant || canOpenConsultantWorkspace) && <Link className="source-link" href={consultant ? chatRoutes.user : chatRoutes.consultant}>
        {consultant ? "Về trang tư vấn người dùng" : "Mở không gian tư vấn viên"} →
      </Link>}
    </header>
    {authorized && controls && <div aria-live="polite" aria-relevant="additions text">
      {controls.notices.length > 0 && <section className={styles.notifications} aria-label="Thông báo tư vấn">
        <ul className={styles.entries}>
          {controls.notices.map(notice => <li className={styles.notification} key={`${notice.conversationId}:${notice.kind}`}>
            <p><strong>{noticeMessages[notice.kind]}</strong>
              {notice.kind === "message" && ` Từ ${consultant ? "người dùng" : "tư vấn viên"}.`}</p>
            <div className={styles.notificationActions}>
              <button type="button" className="secondary-button" disabled={controls.sending || controls.transitioning}
                onClick={() => controls.openRoom(notice.conversationId)}>
                {notice.kind === "request" ? "Xem yêu cầu" : "Mở hội thoại"}
              </button>
              <button type="button" className="secondary-button" onClick={() => controls.dismissNotice(notice)}>Bỏ qua</button>
            </div>
          </li>)}
        </ul>
      </section>}
    </div>}
    <div className={styles.workspace} aria-busy={access.status === "loading"}>
      <aside className={styles.sidebar} aria-label="Thông tin tư vấn">
        <div className={styles.sidebarHeader}>
          <h2>Tin nhắn</h2>
          <p>{consultant ? "Yêu cầu và hội thoại được phân" : "Cuộc trò chuyện của bạn"}</p>
        </div>
        <div className={styles.directory}>
          {authorized?.conversations?.length ? <ul className={styles.entries}>
            {authorized.conversations.map(item => {
              const status = authorized.room?.id === item.id ? authorized.room.status : item.status;
              return <li key={item.id}>
                {controls ? <button type="button" className={styles.roomChoice} aria-pressed={controls.roomId === item.id}
                  disabled={controls.transitioning || controls.sending}
                  onClick={() => controls.openRoom(item.id)}>
                  <span className={styles.avatar}><ChatIcon /></span>
                  <span className={styles.choiceText}><strong>{item.title}</strong><span>{roomStatusLabels[status]}</span></span>
                </button> : <><strong>{item.title}</strong><p>{roomStatusLabels[status]}</p></>}
              </li>;
            })}
          </ul> : (authorized?.conversations || !controls) && <p className={styles.sidebarEmpty}>
            {authorized?.conversations ? "Chưa có cuộc trò chuyện." : "Chưa thể tải danh sách hội thoại."}
          </p>}
          {controls?.listStatus}
          {consultant && !controls && <div className={styles.actions}>
            <button type="button" className="secondary-button" disabled>Chấp nhận yêu cầu</button>
            <button type="button" className="secondary-button" disabled>Từ chối yêu cầu</button>
          </div>}
        </div>
        {!consultant && <details className={styles.newRequest} open={controls?.prioritizeRequest || !authorized?.conversations?.length}>
          <summary><ChatIcon kind="plus" /> Yêu cầu tư vấn mới</summary>
          <section className={styles.directory} aria-labelledby="consultants-title">
            <h3 id="consultants-title" className={styles.directoryLabel}>Tư vấn viên</h3>
            {authorized?.consultants?.length ? <ul className={styles.entries}>
              {authorized.consultants.map(person => <li key={person.id}>
                {controls ? <label className={styles.choice}>
                  <input type="radio" name="chat-consultant" checked={controls.consultantId === person.id}
                    aria-label={person.name}
                    onChange={() => controls.selectConsultant(person.id)} disabled={controls.sending} />
                  <span className={styles.choiceText}><strong>{person.name}</strong>
                    {person.profile && <span>{person.profile}</span>}
                    {person.availability && <span>{person.availability}</span>}</span>
                </label> : <strong>{person.name}</strong>}
              </li>)}
            </ul> : (authorized?.consultants || !controls) && <div className={styles.directoryEmpty}>
              <ChatIcon /><p>{authorized?.consultants ? "Chưa có tư vấn viên trong danh sách." : "Danh sách tư vấn viên chưa khả dụng."}</p>
            </div>}
            {controls?.directoryStatus}
            <button type="button" className="secondary-button" disabled={!controls?.consultantId || controls.sending || controls.transitioning || controls.ready === false}
              onClick={controls?.create}>{controls?.sending ? "Đang gửi yêu cầu…" : "Gửi yêu cầu tư vấn"}</button>
          </section>
        </details>}
      </aside>
      <section className={styles.room} aria-label="Khung trò chuyện">
        {access.status === "authorized" ? <ChatRoomPanel key={JSON.stringify([access.accessKey, access.room?.id])} state={access}
          subscribe={subscribe} retry={retry} messaging={messaging} lifecycleControls={controls?.lifecycleControls}
          roomStatus={controls?.roomStatus} /> : <>
          <header className={styles.roomHeader}><span className={styles.avatar}><ChatIcon /></span><h2>Khung trò chuyện</h2></header>
          <div className={styles.timeline}><div className={styles.empty}>
            <span className={styles.emptyIcon}><ChatIcon /></span>
            <h3>Phòng chat chưa sẵn sàng</h3>
            <p role={access.status === "blocked" || access.status === "loading" ? "status" : "alert"}>{accessMessages[access.status]}</p>
            {access.status === "expired" && <Link className="secondary-button" href={customerAuthRoutes.login}>Đăng nhập để tiếp tục</Link>}
            {access.status === "error" && retry && <button type="button" className="secondary-button" onClick={retry}>Tải lại phiên tư vấn</button>}
          </div></div>
          <ChatComposer id="chat-disabled-draft" label="Tin nhắn" value="" onChange={() => {}} onSend={() => {}}
            disabled sendLabel="Gửi tin nhắn" placeholder="Cần mở cuộc trò chuyện" hint="Tin nhắn chỉ gửi được trong phòng đang tư vấn." />
        </>}
      </section>
    </div>
  </PageContainer>;
}
