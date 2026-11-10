"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { aiConsultationPath, aiQuestionLimit, type AiReadingRef } from "@/config/aiConsultation";
import { CLIENT_CONFIG } from "@/config/client";
import { askAi, getAiAvailability, type AiAnswer } from "@/services/rest/aiConsultation";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { SessionNotice, useSession } from "@/services/session/SessionProvider";
import { ChatComposer, ChatIcon } from "./ChatComposer";
import { useChatScroll } from "./useChatScroll";
import chat from "./chat.module.css";
import styles from "./aiConsultation.module.css";

type Exchange = { question: string; reply: AiAnswer };

const methodLabels: Record<string, string> = {
  LINES: "Nhập sáu hào", OBJECT_COUNT: "Theo số vật", TIME: "Theo thời gian", TRUONG_XICH: "Trượng xích chiêm",
};
const errorLabels: Record<string, string> = {
  AI_UNAVAILABLE: "Dịch vụ AI hiện không phản hồi. Bạn có thể thử lại hoặc mở Chat với tư vấn viên.",
  NETWORK_ERROR: "Mất kết nối khi gửi câu hỏi. Câu hỏi của bạn vẫn còn trên trang.",
  AI_TIMEOUT: "Trợ lý AI trả lời quá thời gian chờ. Vui lòng thử lại.",
  REQUEST_TIMEOUT: "Trợ lý AI trả lời quá thời gian chờ. Vui lòng thử lại.",
  NOT_FOUND: "Kết quả này không khả dụng trong tài khoản hoặc phiên hiện tại. Hãy mở lại từ Lịch sử hoặc lập quẻ mới.",
  TOO_MANY_REQUESTS: "Trợ lý AI đang bận. Vui lòng thử lại sau.",
  INVALID_INPUT: "Câu hỏi hoặc tham chiếu kết quả không hợp lệ.",
};

export function AiConsultationWorkspace({ reference, invalidReference }: { reference?: AiReadingRef; invalidReference?: boolean }) {
  const session = useSession();
  if (invalidReference) return <AiShell><div className={chat.empty}>
    <p role="alert">Liên kết kết quả Mai Hoa không hợp lệ.</p>
    <Link className="secondary-button" href={aiConsultationPath}>Hỏi AI không kèm kết quả</Link>
  </div></AiShell>;
  if (!CLIENT_CONFIG.accountHistory) return <AiShell badge="Không khả dụng"><div className={chat.empty}>
    <p role="status">Trợ lý AI cần cấu hình đăng nhập tài khoản.</p>
  </div></AiShell>;
  if (!session || session.status !== "ready") return <AiShell><div className={chat.empty}><SessionNotice /></div></AiShell>;
  return <AiConversation key={session.revision} reference={reference} csrf={session.data.csrfToken}
    onSessionError={session.handleError} />;
}

function AiConversation({ reference, csrf, onSessionError }: {
  reference?: AiReadingRef; csrf: string; onSessionError: (error: unknown) => void;
}) {
  const availability = useLookup("ai", getAiAvailability);
  const mode = availability.data?.mode;
  const canSend = mode === "demo" || mode === "live";
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [failure, setFailure] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  const count = Array.from(draft.trim()).length;
  const reading = exchanges.at(-1)?.reply.reading;
  const scroll = useChatScroll(exchanges.length * 2 + Number(waiting));

  useEffect(() => () => pending.current?.abort(), []);

  async function send() {
    const question = draft.trim();
    if (!canSend || !question || count > aiQuestionLimit || pending.current || failure === "NOT_FOUND") return;
    const request = new AbortController();
    pending.current = request;
    setWaiting(true);
    setFailure(undefined);
    try {
      const turns = exchanges.slice(-3).map(item => ({
        question: item.question, answer: Array.from(item.reply.answer).slice(0, 1200).join("").trimEnd(),
      }));
      const reply = await askAi(question, turns, reference, csrf, request.signal);
      if (request.signal.aborted) return;
      setExchanges(items => [...items, { question, reply }]);
      setDraft("");
    } catch (error) {
      if (request.signal.aborted) return;
      onSessionError(error);
      setFailure(error instanceof RestError ? error.code : "NETWORK_ERROR");
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setWaiting(false);
    }
  }

  const badge = mode === "demo" ? "DEMO" : mode === "live" ? "LIVE"
    : availability.status === "loading" ? "Đang kiểm tra" : "Không khả dụng";
  return <AiShell badge={badge} bare>
    <div className={chat.roomStatus}>
      {availability.status === "loading" && <p role="status">Đang kiểm tra dịch vụ AI…</p>}
      {availability.status === "failed" && <>
        <p role="alert">Chưa kết nối được với dịch vụ AI.</p>
        <button type="button" className="secondary-button" onClick={availability.retry}>Kiểm tra lại dịch vụ AI</button>
      </>}
      {mode === "off" && <p role="status">Trợ lý AI đang tắt hoặc thiếu cấu hình. Bạn vẫn có thể chat với tư vấn viên.</p>}
      {mode === "demo" && <p>Câu trả lời minh họa có sẵn. Câu hỏi được xử lý tại Huyền Cơ.</p>}
      {mode === "live" && <p className={styles.disclosure}>Khi bạn gửi, câu hỏi, một phần trao đổi gần đây và thông tin quẻ được chọn sẽ được chuyển tới nhà cung cấp AI bên ngoài. Tránh nhập thông tin cá nhân hoặc bí mật.</p>}
      {reference && <details className={styles.reading}>
        <summary>Đang hỏi về kết quả Mai Hoa</summary>
        {reading ? <ReadingSummary reading={reading} />
          : <p>Server sẽ kiểm tra quyền truy cập khi bạn gửi câu hỏi.</p>}
      </details>}
    </div>
    <div className={chat.timeline} {...scroll} tabIndex={0} aria-label="Vùng trao đổi với trợ lý AI">
      {!exchanges.length && !waiting && <div className={chat.empty}>
        <span className={chat.emptyIcon}><ChatIcon kind="spark" /></span>
        <h3>Bắt đầu cuộc trò chuyện</h3>
        <p>{reference ? "Hỏi về quẻ, hào động hoặc căn cứ của kết quả Mai Hoa." : "Hỏi về cách đọc quẻ hoặc ý nghĩa của một thuật ngữ."}</p>
      </div>}
      <ol className={chat.messages} aria-label="Trao đổi với trợ lý AI" aria-live="polite" aria-relevant="additions">
        {exchanges.map(({ question, reply }, index) => <li key={index} className={styles.exchange}>
          <div className={chat.message} data-own="true"><strong>Bạn</strong><p>{question}</p></div>
          <article className={chat.message}>
            <h3>Trợ lý AI{reply.mode === "demo" ? " · DEMO" : ""}</h3>
            <p>{reply.answer}</p>
            {reply.sources.length > 0 && <details className={styles.sources}>
              <summary>Nguồn đi kèm kết quả từ Server</summary>
              <ul>{reply.sources.map((source, sourceIndex) => <li key={sourceIndex}>
                <strong>{source.title}</strong> · {source.section}
                {source.printedPage && <> · Trang in {source.printedPage}</>}
                {source.pdfPage && <> · Trang PDF {source.pdfPage}</>}
              </li>)}</ul>
            </details>}
          </article>
        </li>)}
      </ol>
      {waiting && <p role="status" className={styles.typing}>Trợ lý AI đang trả lời…</p>}
    </div>
    {failure && <p role="alert" className={styles.failure}>{Object.hasOwn(errorLabels, failure)
      ? errorLabels[failure] : "Chưa nhận được câu trả lời hợp lệ. Vui lòng thử lại."}</p>}
    {failure === "NOT_FOUND" ? <div className={styles.fallback}>
      <Link className="secondary-button" href={aiConsultationPath}>Hỏi AI không kèm kết quả</Link>
    </div> : <ChatComposer id="ai-question" label={exchanges.length ? "Hỏi tiếp" : "Câu hỏi của bạn"} value={draft}
      disabled={!canSend || waiting} sendDisabled={!count || count > aiQuestionLimit}
      sendLabel={failure ? "Thử lại" : "Gửi câu hỏi"} invalid={count > aiQuestionLimit}
      placeholder={reference ? "Hỏi về kết quả Mai Hoa…" : "Nhập câu hỏi cho trợ lý AI…"}
      hint={`${count} / ${aiQuestionLimit} ký tự · Shift + Enter để xuống dòng`}
      onChange={text => { setDraft(text); setFailure(undefined); }} onSend={() => void send()} />}
  </AiShell>;
}

function AiShell({ badge, bare, children }: { badge?: string; bare?: boolean; children: ReactNode }) {
  return <section className={`${chat.room} ${chat.aiRoom}`} aria-labelledby="ai-conversation-title">
    <header className={chat.roomHeader}>
      <span className={chat.avatar}><ChatIcon kind="spark" /></span>
      <div className={chat.roomHeading}><h2 id="ai-conversation-title">Trợ lý AI Huyền Cơ</h2><p>Giải thích quẻ và thuật ngữ</p></div>
      {badge && <span className={chat.badge}>{badge}</span>}
    </header>
    {bare ? children : <div className={chat.timeline}>{children}</div>}
  </section>;
}

function ReadingSummary({ reading }: { reading: NonNullable<AiAnswer["reading"]> }) {
  const hexagrams = [
    ["Quẻ chủ", reading.primary], ["Quẻ hỗ", reading.mutual], ["Quẻ biến", reading.changed],
  ] as const;
  return <div className={styles.readingBody} aria-label="Kết quả Mai Hoa từ Server">
    <h3>Kết quả Mai Hoa từ Server</h3>
    <p>{Object.hasOwn(methodLabels, reading.method) ? methodLabels[reading.method] : reading.method} · Hào động {reading.movingLine}</p>
    <dl>{hexagrams.map(([label, hexagram]) => <div key={label}>
      <dt>{label}</dt><dd>{hexagram.name || hexagram.code}{hexagram.nameStatus !== "VERIFIED" && " (tên chưa xác minh)"}</dd>
    </div>)}</dl>
    <p className="field-hint">{reading.sourceStatus === "VERIFIED" ? "Nguồn quy tắc đã được đối chiếu." : "Nguồn quy tắc còn giới hạn xác minh."}
      {reading.ruleBasis === "TEAM_DECISION" && " Có áp dụng quy ước nhóm."}</p>
  </div>;
}
