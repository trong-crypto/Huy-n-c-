"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { aiConsultationPath, aiQuestionLimit, type AiReadingRef } from "@/config/aiConsultation";
import { CLIENT_CONFIG } from "@/config/client";
import { askAi, getAiAvailability, type AiAnswer } from "@/services/rest/aiConsultation";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { SessionNotice, useSession } from "@/services/session/SessionProvider";
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
  if (invalidReference) return <section className="section-card">
    <p role="alert">Liên kết kết quả Mai Hoa không hợp lệ.</p>
    <Link className="secondary-button" href={aiConsultationPath}>Hỏi AI không kèm kết quả</Link>
  </section>;
  if (!CLIENT_CONFIG.accountHistory) return <p className="status-banner" role="status">Trợ lý AI cần cấu hình đăng nhập tài khoản.</p>;
  if (!session || session.status !== "ready") return <SessionNotice />;
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

  return <section className="section-card" aria-labelledby="ai-conversation-title">
    <h2 className="section-title" id="ai-conversation-title"><span aria-hidden="true">✦ </span>Trợ lý AI</h2>
    {availability.status === "loading" && <p role="status">Đang kiểm tra dịch vụ AI…</p>}
    {availability.status === "failed" && <>
      <p role="alert" className="response-error">Chưa kết nối được với dịch vụ AI.</p>
      <button type="button" className="secondary-button" onClick={availability.retry}>Kiểm tra lại dịch vụ AI</button>
    </>}
    {mode === "off" && <p role="status">Trợ lý AI đang tắt hoặc thiếu cấu hình. Bạn vẫn có thể chat với tư vấn viên.</p>}
    {mode === "demo" && <p className="status-banner"><strong>DEMO.</strong> Câu trả lời minh họa có sẵn. Câu hỏi được xử lý tại Huyền Cơ.</p>}
    {mode === "live" && <p className="status-banner">Khi bạn gửi, câu hỏi, một phần trao đổi gần đây và thông tin quẻ được chọn sẽ được chuyển tới nhà cung cấp AI bên ngoài. Tránh nhập thông tin cá nhân hoặc bí mật.</p>}
    {reference && <p className="field-hint">Đã gắn tham chiếu Mai Hoa. Server sẽ kiểm tra quyền truy cập khi bạn gửi câu hỏi.</p>}
    {reading && <ReadingSummary reading={reading} />}

    <ol className={styles.transcript} aria-label="Trao đổi với trợ lý AI" aria-live="polite" aria-relevant="additions">
      {exchanges.map(({ question, reply }, index) => <li key={index} className={styles.exchange}>
        <div className={styles.question}><strong>Bạn</strong><p>{question}</p></div>
        <article className={styles.answer}>
          <h3><span aria-hidden="true">✦ </span>Trợ lý AI{reply.mode === "demo" ? " · DEMO" : ""}</h3>
          <p>{reply.answer}</p>
          {reply.sources.length > 0 && <details className={styles.sources}>
            <summary>Nguồn đi kèm kết quả từ Server</summary>
            <ul>{reply.sources.map((source, index) => <li key={index}>
              <strong>{source.title}</strong> · {source.section}
              {source.printedPage && <> · Trang in {source.printedPage}</>}
              {source.pdfPage && <> · Trang PDF {source.pdfPage}</>}
            </li>)}</ul>
          </details>}
        </article>
      </li>)}
    </ol>

    {waiting && <p role="status">Trợ lý AI đang trả lời…</p>}
    {failure && <p role="alert" className="response-error">{Object.hasOwn(errorLabels, failure)
      ? errorLabels[failure] : "Chưa nhận được câu trả lời hợp lệ. Vui lòng thử lại."}</p>}
    {failure === "NOT_FOUND" ? <Link className="secondary-button" href={aiConsultationPath}>Hỏi AI không kèm kết quả</Link>
      : <form className={styles.form} onSubmit={event => { event.preventDefault(); void send(); }}>
        <label htmlFor="ai-question">{exchanges.length ? "Hỏi tiếp" : "Câu hỏi của bạn"}</label>
        <textarea id="ai-question" rows={4} value={draft} disabled={!canSend || waiting}
          placeholder={reference ? "Hào động có vai trò gì trong kết quả này?" : "Quẻ chủ và quẻ biến khác nhau thế nào?"}
          aria-describedby="ai-question-limit" aria-invalid={count > aiQuestionLimit || undefined}
          onChange={event => { setDraft(event.target.value); setFailure(undefined); }} />
        <p className={count > aiQuestionLimit ? "response-error" : "field-hint"} id="ai-question-limit">
          {count} / {aiQuestionLimit} ký tự. Trao đổi được giữ trên trang này.
        </p>
        <button className="primary-button" type="submit" disabled={!canSend || waiting || !count || count > aiQuestionLimit}>
          {failure ? "Thử lại" : "Gửi câu hỏi"}
        </button>
      </form>}
  </section>;
}

function ReadingSummary({ reading }: { reading: NonNullable<AiAnswer["reading"]> }) {
  const hexagrams = [
    ["Quẻ chủ", reading.primary], ["Quẻ hỗ", reading.mutual], ["Quẻ biến", reading.changed],
  ] as const;
  return <aside className={styles.reading} aria-label="Kết quả Mai Hoa từ Server">
    <h3>Kết quả Mai Hoa từ Server</h3>
    <p>{Object.hasOwn(methodLabels, reading.method) ? methodLabels[reading.method] : reading.method} · Hào động {reading.movingLine}</p>
    <dl>{hexagrams.map(([label, hexagram]) => <div key={label}>
      <dt>{label}</dt><dd>{hexagram.name || hexagram.code}{hexagram.nameStatus !== "VERIFIED" && " (tên chưa xác minh)"}</dd>
    </div>)}</dl>
    <p className="field-hint">{reading.sourceStatus === "VERIFIED" ? "Nguồn quy tắc đã được đối chiếu." : "Nguồn quy tắc còn giới hạn xác minh."}
      {reading.ruleBasis === "TEAM_DECISION" && " Có áp dụng quy ước nhóm."}</p>
  </aside>;
}
