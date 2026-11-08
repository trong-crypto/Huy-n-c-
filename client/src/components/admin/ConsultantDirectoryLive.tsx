"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/Controls";
import { accountRoles, accountStatuses } from "@/services/rest/adminAccounts";
import { createConsultant, listConsultants, phase4Error, readConsultant, reviewConsultant, reviewStatuses,
  type ConsultantDetail, type Decision } from "@/services/rest/adminPhase4";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { isUuid } from "@/types/historyValidation";
import { useAdminSession } from "./AdminSessionGate";
import styles from "./admin.module.css";

const firstFilter = { q: "", reviewStatus: "", accountStatus: "" };

export function ConsultantDirectoryLive() {
  const auth = useAdminSession();
  const handleError = auth?.handleError;
  const [filters, setFilters] = useState(firstFilter);
  const [query, setQuery] = useState(firstFilter);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ accountId: "", summary: "" });
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const loadList = useCallback(async (signal: AbortSignal) => {
    try { return await listConsultants(query, page, signal); }
    catch (failure) { if (!signal.aborted) handleError?.(failure); throw failure; }
  }, [query, page, handleError]);
  const loadDetail = useCallback(async (signal: AbortSignal) => {
    if (!selected) return null;
    try { return await readConsultant(selected, signal); }
    catch (failure) { if (!signal.aborted) handleError?.(failure); throw failure; }
  }, [selected, handleError]);
  const list = useLookup(JSON.stringify([query, page]), loadList);
  const detail = useLookup(selected ?? "", loadDetail);
  if (!auth) return <p role="status">Cần phiên Admin để quản lý hồ sơ.</p>;
  const csrf = auth.session.csrfToken;
  const selectedProfile = detail.data;
  const mustReload = error instanceof RestError && ["VERSION_CONFLICT", "INVALID_TRANSITION", "NETWORK_ERROR",
    "REQUEST_TIMEOUT", "INVALID_RESPONSE"].includes(error.code);

  function select(id: string | null) {
    setSelected(id);
    setDecision(null);
    setReason("");
    setNotice("");
    setError(null);
  }

  async function mutate(action: (signal: AbortSignal) => Promise<ConsultantDetail>, creating: boolean) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const updated = await action(controller.signal);
      if (controller.signal.aborted) return;
      if (creating) {
        setForm({ accountId: "", summary: "" });
        setShowCreate(false);
        setSelected(updated.profile.accountId);
      }
      setDecision(null);
      setReason("");
      setNotice(creating ? "Đã tạo hồ sơ chờ duyệt." : `Đã lưu quyết định: ${reviewStatuses[updated.profile.reviewStatus]}.`);
      list.retry();
      detail.retry();
    } catch (failure) {
      if (!controller.signal.aborted) { setError(failure); handleError?.(failure); }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function create(event: FormEvent) {
    event.preventDefault();
    const id = form.accountId.trim().toLowerCase();
    const summary = form.summary.trim();
    if (!isUuid(id) || !summary) { setError(new RestError("INVALID_INPUT")); return; }
    void mutate(signal => createConsultant(id, summary, csrf, signal), true);
  }

  function review(event: FormEvent) {
    event.preventDefault();
    if (!selectedProfile || !decision || mustReload) return;
    if (decision === "REJECTED" && !reason.trim()) { setError(new RestError("INVALID_INPUT")); return; }
    const { accountId, version } = selectedProfile.profile;
    void mutate(signal => reviewConsultant(accountId, version, decision, reason.trim(), csrf, signal), false);
  }

  return <>
    {error !== null && <p role="alert">{phase4Error(error)}</p>}
    {notice && <p role="status">{notice}</p>}
    <button type="button" className="secondary-button" disabled={busy} onClick={() => {
      setShowCreate(!showCreate); setError(null); setDecision(null);
    }}>{showCreate ? "Đóng biểu mẫu" : "Tạo hồ sơ tư vấn viên"}</button>
    {showCreate && <form className={styles.contentPanel} onSubmit={create}>
      <FormField id="consultant-create-account" label="Mã UUID tài khoản (trong trang Quản lý người dùng)">
        <input id="consultant-create-account" value={form.accountId} onChange={event => setForm({ ...form, accountId: event.target.value })} required maxLength={36} />
      </FormField>
      <FormField id="consultant-summary" label="Giới thiệu ứng viên">
        <textarea id="consultant-summary" value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} maxLength={500} required />
      </FormField>
      <button type="submit" className="primary-button" disabled={busy}>Lưu hồ sơ chờ duyệt</button>
    </form>}
    <div className={styles.contentGrid}>
      <section className={styles.contentPanel} aria-label="Danh sách tư vấn viên">
        <h2>Danh sách tư vấn viên</h2>
        <form className="form-stack" onSubmit={event => {
          event.preventDefault(); setQuery({ ...filters }); setPage(0); select(null); list.retry();
        }}>
          <FormField id="consultant-search" label="Tìm theo tên hiển thị">
            <input id="consultant-search" type="search" maxLength={100} value={filters.q}
              onChange={event => setFilters({ ...filters, q: event.target.value })} />
          </FormField>
          {(["accountStatus", "reviewStatus"] as const).map(key => <FormField key={key} id={`consultant-${key}`}
            label={key === "accountStatus" ? "Trạng thái tài khoản" : "Trạng thái duyệt"}>
            <select id={`consultant-${key}`} value={filters[key]} onChange={event => setFilters({ ...filters, [key]: event.target.value })}>
              <option value="">Tất cả</option>
              {Object.entries(key === "accountStatus" ? accountStatuses : reviewStatuses)
                .map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </FormField>)}
          <button type="submit" className="secondary-button" disabled={busy}>Tìm hồ sơ</button>
        </form>
        {list.status === "loading" && <p role="status">Đang tải hồ sơ…</p>}
        {list.status === "failed" && <><p role="alert">{phase4Error(list.error)}</p>
          <button type="button" className="secondary-button" onClick={list.retry}>Tải lại danh sách</button></>}
        {list.data && <>
          <p role="status">{list.data.totalElements} hồ sơ phù hợp</p>
          <ul className={styles.recordList}>{list.data.items.map(profile => <li key={profile.accountId}>
            <button type="button" aria-pressed={selected === profile.accountId} disabled={busy} onClick={() => select(profile.accountId)}>
              {profile.displayName}<small>{reviewStatuses[profile.reviewStatus]} · {accountStatuses[profile.accountStatus]}</small>
            </button>
          </li>)}</ul>
          {(page > 0 || list.data.totalPages > 1) && <nav className={styles.contentActions} aria-label="Phân trang hồ sơ">
            <button type="button" className="secondary-button" disabled={busy || page === 0} onClick={() => { setPage(page - 1); select(null); }}>Trang trước</button>
            <button type="button" className="secondary-button" disabled={busy || page + 1 >= list.data.totalPages}
              onClick={() => { setPage(page + 1); select(null); }}>Trang sau</button>
          </nav>}
        </>}
      </section>
      <section className={styles.contentPanel} aria-label="Chi tiết hồ sơ">
        <h2>Chi tiết hồ sơ</h2>
        {!selected && <p>Chọn một hồ sơ để xem chi tiết.</p>}
        {selected && detail.status === "loading" && <p role="status">Đang tải chi tiết…</p>}
        {selected && detail.status === "failed" && <p role="alert">{phase4Error(detail.error)}</p>}
        {selected && (detail.status === "failed" || mustReload) && <button type="button" className="secondary-button"
          onClick={() => { setError(null); setDecision(null); detail.retry(); }}>Tải lại chi tiết</button>}
        {selectedProfile && <>
          <h3>{selectedProfile.profile.displayName}</h3>
          <dl>
            <dt>Vai trò</dt><dd>{accountRoles[selectedProfile.profile.role]}</dd>
            <dt>Trạng thái tài khoản</dt><dd>{accountStatuses[selectedProfile.profile.accountStatus]}</dd>
            <dt>Trạng thái duyệt</dt><dd>{reviewStatuses[selectedProfile.profile.reviewStatus]}</dd>
            <dt>Giới thiệu</dt><dd>{selectedProfile.summary ?? "Chưa có dữ liệu"}</dd>
            {selectedProfile.rejectionReason && <><dt>Lý do từ chối</dt><dd>{selectedProfile.rejectionReason}</dd></>}
          </dl>
          {selectedProfile.profile.reviewStatus === "PENDING_REVIEW" && !mustReload && <form className="form-stack" onSubmit={review}>
            <FormField id="consultant-decision" label="Quyết định duyệt">
              <select id="consultant-decision" value={decision ?? ""} onChange={event => {
                const value = event.target.value;
                setDecision(value === "APPROVED" || value === "REJECTED" ? value : null);
              }}>
                <option value="">Chọn quyết định</option><option value="APPROVED">Duyệt hồ sơ</option><option value="REJECTED">Từ chối hồ sơ</option>
              </select>
            </FormField>
            {decision === "REJECTED" && <FormField id="consultant-reason" label="Lý do từ chối">
              <textarea id="consultant-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} required />
            </FormField>}
            <p>Quyết định duyệt được lưu riêng với vai trò tài khoản.</p>
            <button type="submit" className="primary-button" disabled={busy || !decision}>Xác nhận quyết định</button>
          </form>}
        </>}
      </section>
    </div>
  </>;
}
