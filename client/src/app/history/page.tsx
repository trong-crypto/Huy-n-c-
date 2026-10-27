"use client";
import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import { SessionNotice, useSession } from "@/services/session/SessionProvider";
import { listHistory, historyErrorMessage, type HistoryQuery } from "@/services/rest/history";
import { useLookup } from "@/services/rest/useLookup";
import type { HistoryItem } from "@/types/contract";
import { DeleteHistoryDialog } from "@/components/history/DeleteHistoryDialog";

export default function HistoryPage() {
  const session = useSession();
  return <PageContainer><PageHeader eyebrow="05 / LỊCH SỬ RIÊNG TƯ" title="Những kết quả bạn chọn lưu.">
    <p>Xem lại những kết quả bạn đã lưu trên trình duyệt này. Chỉ bạn trong phiên hiện tại có thể truy cập lịch sử riêng tư.</p>
  </PageHeader>{session?.status === "ready" ? <HistoryList key={session.revision} /> : <SessionNotice />}</PageContainer>;
}
function HistoryList() {
  const session = useSession()!; const handleError = session.handleError;
  const [draft, setDraft] = useState({ q: "", type: "" });
  const [query, setQuery] = useState<HistoryQuery>({ q: "", type: "", page: 0, size: 20 });
  const [refresh, setRefresh] = useState(0); const [inputError, setInputError] = useState(false);
  const [deleting, setDeleting] = useState<HistoryItem | null>(null); const [message, setMessage] = useState("");
  const search = useRef<HTMLInputElement>(null); const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listHistory(query, signal); } catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [query, refresh, handleError]);
  const result = useLookup(JSON.stringify([query, refresh]), load);
  function submit(event: FormEvent) {
    event.preventDefault(); if (draft.q.length > 100) { setInputError(true); search.current?.focus(); return; }
    setInputError(false); setMessage(""); setQuery({ ...draft, page: 0, size: 20 });
  }
  function closeDialog() { setDeleting(null); deleteTrigger.current?.focus(); }
  function deleted() {
    setDeleting(null); setMessage("Server đã xác nhận xóa bản lịch sử."); search.current?.focus();
    if (query.page > 0 && result.status === "completed" && result.data.items.length === 1) setQuery({ ...query, page: query.page - 1 });
    else setRefresh(value => value + 1);
  }
  return <>
    <form className="section-card history-search" aria-label="Tìm lịch sử" onSubmit={submit} noValidate>
      <FormField id="history-search" label="Tìm theo tiêu đề" hint="Tối đa 100 ký tự. Hãy nhập đúng dấu để tìm chính xác hơn.">
        <input id="history-search" ref={search} type="search" value={draft.q} maxLength={100} aria-invalid={inputError || undefined}
          aria-describedby={`history-search-hint${inputError ? " history-search-error" : ""}`} onChange={event => { setDraft({ ...draft, q: event.target.value }); setInputError(false); }} />
        {inputError && <FieldError id="history-search-error">Từ khóa tối đa 100 ký tự.</FieldError>}
      </FormField>
      <FormField id="history-type" label="Loại kết quả"><select id="history-type" value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}>
        <option value="">Tất cả</option><option value="MAI_HOA">Mai Hoa</option><option value="TAM_THE">Tam Thế</option>
      </select></FormField><PrimaryButton type="submit">Tìm lịch sử</PrimaryButton>
    </form>
    <section className="history-results" aria-label="Danh sách lịch sử" aria-busy={result.status === "loading"}>
      <p role="status" aria-live="polite">{message || (result.status === "loading" ? "Đang tải lịch sử…" : result.status === "completed" ? `${result.data.totalElements} bản lịch sử · Trang ${query.page + 1}/${Math.max(1, result.data.totalPages)}` : "Chưa tải được lịch sử.")}</p>
      {result.status === "failed" && <><p role="alert" className="response-error">{historyErrorMessage(result.error)}</p><button type="button" className="secondary-button" onClick={result.retry}>Tải lại danh sách</button></>}
      {result.status === "completed" && <>
        {result.data.items.length === 0 ? <p className="status-banner">{query.q || query.type ? "Không có lịch sử phù hợp bộ lọc." : "Phiên này chưa có lịch sử. Bạn có thể chủ động lưu sau khi tính thành công."}</p> : <ul className="history-list">{result.data.items.map(item => <li className="section-card history-item" key={item.id}>
          <div><p className="eyebrow">{item.type === "MAI_HOA" ? "Mai Hoa" : "Tam Thế"}</p><h2><Link href={`/history/${item.id}`}>{item.title}</Link></h2>
            <p className="field-hint">Đã lưu: <time dateTime={item.createdAt}>{item.createdAt.replace("T", " ").replace("Z", " UTC")}</time></p>
            <p className="field-hint">{item.ruleBasis === "TEAM_DECISION" ? "Có quy ước nhóm trong bản đã lưu" : "Theo nguồn đã duyệt"}</p></div>
          <button type="button" className="secondary-button" aria-label={`Xóa ${item.title}`} onClick={event => { deleteTrigger.current = event.currentTarget; setDeleting(item); }}>Xóa</button>
        </li>)}</ul>}
        {result.data.totalPages > 1 && <nav className="lookup-pagination" aria-label="Phân trang lịch sử">
          <button type="button" disabled={query.page === 0} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Trang trước</button>
          <span>Trang {query.page + 1}/{result.data.totalPages}</span>
          <button type="button" disabled={query.page + 1 >= result.data.totalPages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Trang sau</button>
        </nav>}
      </>}
    </section>
    {deleting && <DeleteHistoryDialog item={deleting} onCancel={closeDialog} onDeleted={deleted} />}
  </>;
}
