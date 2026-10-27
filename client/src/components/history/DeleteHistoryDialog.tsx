"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { HistoryItem } from "@/types/contract";
import { deleteHistory, historyErrorMessage } from "@/services/rest/history";
import { useSession } from "@/services/session/SessionProvider";

export function DeleteHistoryDialog({ item, onCancel, onDeleted }: { item: HistoryItem; onCancel: () => void; onDeleted: () => void }) {
  const session = useSession(); const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  const cancel = useRef<HTMLButtonElement>(null); const confirm = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => { cancel.current?.focus(); return () => pending.current?.abort(); }, []);
  async function remove() {
    if (!session || session.status !== "ready" || pending.current) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(null);
    try { await deleteHistory(item.id, session.data.csrfToken, controller.signal); if (!controller.signal.aborted) onDeleted(); }
    catch (failure) { if (!controller.signal.aborted) { session.handleError(failure); setError(failure); } }
    finally { if (!controller.signal.aborted) { pending.current = null; setBusy(false); } }
  }
  function keyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onCancel(); }
    if (event.key === "Tab") {
      event.preventDefault(); if (busy) return;
      (document.activeElement === cancel.current ? confirm.current : cancel.current)?.focus();
    }
  }
  return <div className="history-dialog-backdrop"><div className="section-card history-dialog" role="alertdialog" aria-modal="true" aria-labelledby="history-delete-title" aria-describedby="history-delete-description" onKeyDown={keyDown}>
    <h2 id="history-delete-title">Xóa bản lịch sử này?</h2><p id="history-delete-description">“{item.title}” sẽ bị xóa khi Server xác nhận. Thao tác này không có chức năng khôi phục.</p>
    {error !== null && <p role="alert" className="response-error">{historyErrorMessage(error)}</p>}
    <div className="history-actions"><button ref={cancel} type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Hủy</button>
      <button ref={confirm} type="button" className="primary-button" disabled={busy} onClick={() => void remove()}>{busy ? "Đang xóa…" : "Xác nhận xóa"}</button></div>
    {busy && <p role="status">Đang chờ Server xác nhận xóa…</p>}
  </div></div>;
}
