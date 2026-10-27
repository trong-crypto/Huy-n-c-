"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CalculationType, HistoryDetail } from "@/types/contract";
import { RestError } from "@/services/rest/transport";
import { useSession, SessionNotice } from "@/services/session/SessionProvider";
import { historyErrorMessage, saveHistory } from "@/services/rest/history";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";

export function SaveResult({ requestId, ownerRevision, type }: { requestId: string; ownerRevision?: number | null; type: CalculationType }) {
  const session = useSession();
  if (!session) return null;
  if (session.status !== "ready") return <SessionNotice />;
  if (ownerRevision !== session.revision) return <p className="status-banner">Kết quả này chưa được xác nhận thuộc phiên hiện tại. Muốn lưu, hãy chủ động tính một kết quả mới sau khi phiên đã sẵn sàng; không tự gửi lại yêu cầu cũ.</p>;
  return <SaveForm key={`${session.revision}:${requestId}`} requestId={requestId} type={type} />;
}
function SaveForm({ requestId, type }: { requestId: string; type: CalculationType }) {
  const session = useSession();
  const [title, setTitle] = useState(""); const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<HistoryDetail | null>(null); const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null); const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!session || session.status !== "ready" || pending.current || saved) return;
    if ((title !== "" && !title.trim()) || title.trim().length > 100 || /[\x00-\x1f\x7f-\x9f]/.test(title)) { setError("Tiêu đề không trắng, tối đa 100 ký tự và không có ký tự điều khiển."); titleRef.current?.focus(); return; }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(null);
    try {
      const result = await saveHistory(requestId, title, session.data.csrfToken, controller.signal);
      if (result.type !== type) throw new RestError("INVALID_RESPONSE");
      if (!controller.signal.aborted) setSaved(result);
    } catch (failure) { if (!controller.signal.aborted) { session.handleError(failure); setError(failure); } }
    finally { if (!controller.signal.aborted) { pending.current = null; setBusy(false); } }
  }
  return <section className="history-save" aria-label="Lưu kết quả vào lịch sử">
    <h3>Lưu vào lịch sử riêng tư</h3><p className="field-hint">Kết quả chỉ được lưu khi bạn bấm nút. Hãy lưu sớm: kết quả chưa lưu chỉ khả dụng tối đa 15 phút và có thể hết hạn sớm hơn.</p>
    {saved ? <p role="status">Đã lưu thành công. <a className="source-link" href={`/history/${saved.id}`}>Xem bản đã lưu</a></p> : <form onSubmit={save} noValidate className="form-stack" aria-label="Lưu kết quả">
      <FormField id="history-save-title" label="Tiêu đề lịch sử (tùy chọn)" hint="Để trống để dùng tên mặc định. Không cần nhập ngày sinh hoặc câu hỏi riêng tư.">
        <input id="history-save-title" ref={titleRef} value={title} maxLength={100} disabled={busy} aria-invalid={typeof error === "string" || undefined}
          aria-describedby={`history-save-title-hint${typeof error === "string" ? " history-save-title-error" : ""}`} onChange={event => { setTitle(event.target.value); setError(null); }} />
        {typeof error === "string" && <FieldError id="history-save-title-error">{error}</FieldError>}
      </FormField>
      <PrimaryButton type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu kết quả"}</PrimaryButton>
      {error !== null && typeof error !== "string" && <p role="alert" className="response-error">{historyErrorMessage(error)}</p>}
    </form>}
  </section>;
}
