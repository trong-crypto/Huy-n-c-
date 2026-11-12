"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormField } from "@/components/ui/Controls";
import { deleteMethod, listMethods, methodCatalogError, methodGroups, methodStates, readMethod,
  type MethodDetail, type MethodFilters, type MethodGroup, type MethodState, type MethodSummary } from "@/services/rest/methodCatalog";
import { isGuideMethodCode } from "@/services/rest/methodGuides";
import { useLookup } from "@/services/rest/useLookup";
import { useAdminSession } from "./AdminSessionGate";
import { MethodCatalogForm } from "./MethodCatalogForm";
import { MethodGuideEditor } from "./MethodGuideWorkspace";
import styles from "./admin.module.css";

const firstPage: MethodFilters = { q: "", group: "", state: "", page: 0 };
type Selection = { kind: "create" } | { kind: "view" | "edit"; code: string }
  | { kind: "visibility"; code: string; listed: boolean };

export function MethodCatalogWorkspace() {
  const auth = useAdminSession();
  return auth ? <Catalog csrf={auth.session.csrfToken} handleError={auth.handleError} />
    : <p role="status">Cần phiên Admin để quản lý danh mục phương pháp.</p>;
}

function Catalog({ csrf, handleError }: { csrf: string; handleError: (failure: unknown) => void }) {
  const [form, setForm] = useState(firstPage);
  const [filters, setFilters] = useState(firstPage);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [deleting, setDeleting] = useState<MethodSummary | null>(null);
  const [notice, setNotice] = useState("");
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listMethods(filters, signal); }
    catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [filters, handleError]);
  const list = useLookup(JSON.stringify(filters), load);

  function filter(next: MethodFilters) {
    setSelection(null);
    setNotice("");
    setFilters(next);
  }

  function saved(detail: MethodDetail, created: boolean) {
    if (created) { setForm(firstPage); setFilters(firstPage); }
    setNotice(created ? "Đã thêm phương pháp." : "Đã lưu phương pháp.");
    setSelection({ kind: "view", code: detail.method.code });
    list.retry();
  }

  return <div className={styles.contentStack}>
    <header className={`${styles.dashboardIntro} ${styles.methodCatalogHeader}`}>
      <div>
        <p className="eyebrow">HUYỀN CƠ / QUẢN TRỊ NỘI DUNG</p>
        <h1>Quản lý phương pháp bói</h1>
        <p>Quản lý danh mục, thông tin và nội dung của các phương pháp bói toán.</p>
      </div>
      <button type="button" className="primary-button" onClick={() => { setNotice(""); setSelection({ kind: "create" }); }}>+ Thêm phương pháp</button>
    </header>
    {notice && <p role="status">{notice}</p>}
    {selection?.kind === "create" && <MethodCatalogForm csrf={csrf} handleError={handleError} onSaved={saved} onCancel={() => setSelection(null)} />}
    <form className={`${styles.contentPanel} ${styles.methodFilters}`} aria-label="Lọc danh mục phương pháp"
      onSubmit={event => { event.preventDefault(); filter({ ...form, q: form.q.trim(), page: 0 }); }}>
      <FormField id="method-search" label="Tìm tên hoặc mã phương pháp">
        <input id="method-search" type="search" maxLength={100} value={form.q}
          onChange={event => setForm({ ...form, q: event.target.value })} />
      </FormField>
      <FormField id="method-group" label="Nhóm phương pháp">
        <select id="method-group" value={form.group} onChange={event => setForm({ ...form, group: event.target.value as MethodGroup | "" })}>
          <option value="">Tất cả</option>
          {Object.entries(methodGroups).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </FormField>
      <FormField id="method-state" label="Trạng thái">
        <select id="method-state" value={form.state} onChange={event => setForm({ ...form, state: event.target.value as MethodState | "" })}>
          <option value="">Tất cả</option>
          {Object.entries(methodStates).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </FormField>
      <button type="submit" className="secondary-button">Tìm kiếm</button>
      <button type="button" className="secondary-button" onClick={() => { setForm(firstPage); filter(firstPage); }}>Đặt lại</button>
    </form>
    <section className={styles.contentPanel} aria-label="Danh sách phương pháp" aria-busy={list.status === "loading"}>
      <h2>Danh sách phương pháp</h2>
      {list.status === "loading" && <p role="status">Đang tải danh sách…</p>}
      {list.status === "failed" && <><p role="alert">{methodCatalogError(list.error)}</p>
        <button type="button" className="secondary-button" onClick={list.retry}>Tải lại danh sách</button></>}
      {list.data && <>
        <p role="status">{list.data.totalElements} phương pháp phù hợp</p>
        {list.data.items.length ? <div className={styles.accountTableWrap}><table className={styles.accountTable}>
          <thead><tr><th scope="col">Tên phương pháp</th><th scope="col">Nhóm</th><th scope="col">Mô tả ngắn</th>
            <th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{list.data.items.map(method => <tr key={method.code}>
            <th scope="row">{method.name}<small>{method.code}</small></th>
            <td>{methodGroups[method.group]}</td><td>{method.summary}</td><td><MethodBadge state={method.state} /></td>
            <td><div className={styles.methodRowActions}>
              <button type="button" className="secondary-button" onClick={() => setSelection({ kind: "view", code: method.code })}>Xem</button>
              <button type="button" className="secondary-button" onClick={() => setSelection({ kind: "edit", code: method.code })}>Sửa</button>
              {method.formPath ? <button type="button" className="secondary-button"
                onClick={() => setSelection({ kind: "visibility", code: method.code, listed: method.state !== "LISTED" })}>{method.state === "LISTED" ? "Ẩn" : "Hiện"}</button>
                : <button type="button" className="secondary-button" onClick={() => setDeleting(method)}>Xóa</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div> : <p>Không có phương pháp phù hợp.</p>}
        {(filters.page > 0 || list.data.totalPages > 1) && <nav className={styles.accountPagination} aria-label="Phân trang phương pháp">
          <button type="button" className="secondary-button" disabled={filters.page === 0}
            onClick={() => filter({ ...filters, page: filters.page - 1 })}>Trang trước</button>
          <button type="button" className="secondary-button" disabled={filters.page + 1 >= list.data.totalPages}
            onClick={() => filter({ ...filters, page: filters.page + 1 })}>Trang sau</button>
        </nav>}
      </>}
    </section>
    {selection && selection.kind !== "create" && <MethodPanel key={`${selection.code}:${selection.kind}`}
      code={selection.code} mode={selection.kind} listedOverride={selection.kind === "visibility" ? selection.listed : undefined}
      csrf={csrf} handleError={handleError} onSaved={saved}
      onEdit={() => setSelection({ kind: "edit", code: selection.code })}
      onView={() => setSelection({ kind: "view", code: selection.code })} onClose={() => setSelection(null)} />}
    {deleting && <DeleteMethodDialog method={deleting} csrf={csrf} handleError={handleError}
      onClose={() => setDeleting(null)} onDeleted={() => {
        if (selection && selection.kind !== "create" && selection.code === deleting.code) setSelection(null);
        setDeleting(null);
        setNotice("Đã xóa phương pháp.");
        if (filters.page > 0 && list.data?.items.length === 1) setFilters({ ...filters, page: filters.page - 1 });
        list.retry();
      }} onRefresh={list.retry} />}
  </div>;
}

function MethodBadge({ state }: { state: MethodState }) {
  return <span className={styles.badge} data-method-state={state}>{methodStates[state]}</span>;
}

function MethodPanel({ code, mode, listedOverride, csrf, handleError, onSaved, onEdit, onView, onClose }: {
  code: string; mode: "view" | "edit" | "visibility"; listedOverride?: boolean; csrf: string; handleError: (failure: unknown) => void;
  onSaved: (detail: MethodDetail, created: boolean) => void; onEdit: () => void; onView: () => void; onClose: () => void;
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await readMethod(code, signal); }
    catch (error) { if (!signal.aborted) handleError(error); throw error; }
  }, [code, handleError]);
  const result = useLookup(code, load);
  if (result.status === "loading") return <p role="status">Đang tải chi tiết phương pháp…</p>;
  if (result.status === "failed") return <div className={styles.contentPanel}><p role="alert">{methodCatalogError(result.error)}</p>
    <button type="button" className="secondary-button" onClick={result.retry}>Tải lại chi tiết</button></div>;
  if (mode !== "view") return <MethodCatalogForm initial={result.data} listedOverride={listedOverride}
    csrf={csrf} handleError={handleError} onSaved={onSaved} onCancel={onView} />;
  return <MethodDetails detail={result.data} onEdit={onEdit} onClose={onClose} />;
}

function MethodDetails({ detail, onEdit, onClose }: { detail: MethodDetail; onEdit: () => void; onClose: () => void }) {
  const { method } = detail;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className={styles.contentStack} aria-label="Chi tiết phương pháp">
    <div className={styles.contentPanel}>
      <div className={styles.methodCatalogHeader}>
        <h2 ref={heading} tabIndex={-1}>{method.name}</h2>
        <div className={styles.methodRowActions}>
          <button type="button" className="secondary-button" onClick={onEdit}>Chỉnh sửa</button>
          <button type="button" className="secondary-button" onClick={onClose}>Đóng chi tiết</button>
        </div>
      </div>
      <p><code>{method.code}</code> · {methodGroups[method.group]} · <MethodBadge state={method.state} /></p>
      <p>{method.summary}</p>
      <h3>Nội dung giới thiệu</h3><p className={styles.guideText}>{detail.introduction || "Chưa có nội dung."}</p>
      <h3>Thông tin đầu vào</h3><p>{detail.requiredInput || "Chưa có thông tin."}</p>
      <h3>Hướng dẫn và các bước thực hiện</h3><p className={styles.guideText}>{detail.instructions || "Chưa có nội dung."}</p>
      <h3>Tích hợp hệ thống</h3>
      {method.formPath ? <p>{method.code === "TAM_THE" ? "Tra cứu và luận giải theo dữ kiện sinh."
        : method.code === "TRUONG_XICH" ? "Hỗ trợ lập quẻ." : "Hỗ trợ lập quẻ và luận giải theo chủ đề."}
        {" "}<Link className={styles.textLink} href={method.formPath}>Mở biểu mẫu người dùng</Link></p>
        : <p>Chưa có bộ tính hoặc biểu mẫu người dùng.</p>}
    </div>
    {method.guideSupported && isGuideMethodCode(method.code) && <section aria-label="Hướng dẫn sử dụng">
      <h3>Hướng dẫn sử dụng</h3>
      <MethodGuideEditor method={{ code: method.code, title: method.name, body: detail.instructions || method.summary }} />
    </section>}
  </section>;
}

function DeleteMethodDialog({ method, csrf, handleError, onClose, onDeleted, onRefresh }: {
  method: MethodSummary; csrf: string; handleError: (failure: unknown) => void;
  onClose: () => void; onDeleted: () => void; onRefresh: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { pending.current?.abort(); element?.close(); };
  }, []);

  async function remove() {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setFailure(null);
    try {
      await deleteMethod(method.code, method.version, csrf, request.signal);
      if (!request.signal.aborted) onDeleted();
    } catch (error) {
      if (!request.signal.aborted) { setFailure(error); handleError(error); onRefresh(); }
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return <dialog ref={dialog} className={styles.methodDeleteDialog} aria-labelledby="delete-method-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="delete-method-title">Xóa phương pháp?</h2>
    <p>Bạn đang xóa <strong>{method.name}</strong> ({method.code}). Chỉ có thể xóa khi phương pháp chưa được tham chiếu.</p>
    {failure !== null && <p role="alert">{methodCatalogError(failure)}</p>}
    <div className={styles.contentActions}>
      <button type="button" className="secondary-button" autoFocus disabled={busy} onClick={onClose}>Đóng</button>
      <button type="button" className="primary-button" disabled={busy || failure !== null} onClick={() => void remove()}>
        {busy ? "Đang xóa…" : "Xác nhận xóa"}
      </button>
    </div>
  </dialog>;
}
