"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/Controls";
import { accountError, accountRoles, accountStatuses, listAccounts, readAccount, setAccountRole, setAccountStatus,
  type AccountDetail, type AccountQuery, type CustomerRole } from "@/services/rest/adminAccounts";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { useAdminSession } from "./AdminSessionGate";
import styles from "./admin.module.css";

const firstPage: AccountQuery = { q: "", role: "", status: "", page: 0 };

export function AccountDirectoryLive() {
  const auth = useAdminSession();
  const handleError = auth?.handleError;
  const [filters, setFilters] = useState(firstPage);
  const [query, setQuery] = useState(firstPage);
  const [selected, setSelected] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const reloadList = useCallback(() => setRefresh(value => value + 1), []);
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listAccounts(query, signal); }
    catch (failure) { if (!signal.aborted) handleError?.(failure); throw failure; }
  }, [query, handleError]);
  const list = useLookup(JSON.stringify([query, refresh]), load);
  if (!auth) return <p role="status">Cần phiên Admin để quản lý tài khoản.</p>;

  function filter(event: FormEvent) {
    event.preventDefault();
    setSelected(null);
    setQuery({ ...filters, q: filters.q.trim(), page: 0 });
  }

  function page(number: number) {
    setSelected(null);
    setQuery(current => ({ ...current, page: number }));
  }

  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel} aria-label="Danh sách tài khoản">
      <h2>Danh sách tài khoản</h2>
      <form className="form-stack" onSubmit={filter}>
        <FormField id="account-query" label="Tìm theo tên hoặc định danh">
          <input id="account-query" type="search" maxLength={100} value={filters.q}
            onChange={event => setFilters({ ...filters, q: event.target.value })} />
        </FormField>
        <FormField id="account-role-filter" label="Vai trò">
          <select id="account-role-filter" value={filters.role} onChange={event => setFilters({ ...filters, role: event.target.value })}>
            <option value="">Tất cả</option>
            {Object.entries(accountRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FormField>
        <FormField id="account-status-filter" label="Trạng thái">
          <select id="account-status-filter" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Tất cả</option>
            {Object.entries(accountStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FormField>
        <button type="submit" className="secondary-button">Tìm tài khoản</button>
      </form>
      {list.status === "loading" && <p role="status">Đang tải danh sách…</p>}
      {list.status === "failed" && <><p role="alert">{accountError(list.error)}</p>
        <button type="button" className="secondary-button" onClick={list.retry}>Tải lại danh sách</button></>}
      {list.data && <>
        <p role="status">{list.data.totalElements} tài khoản phù hợp</p>
        <ul className={styles.recordList}>
          {list.data.items.map(account => <li key={account.id}>
            <button type="button" aria-pressed={selected === account.id} onClick={() => setSelected(account.id)}>
              {account.displayName}<small>{account.identifier} · {accountRoles[account.role]} · {accountStatuses[account.status]}</small>
            </button>
          </li>)}
        </ul>
        {(query.page > 0 || list.data.totalPages > 1) && <nav className={styles.contentActions} aria-label="Phân trang tài khoản">
          <button type="button" className="secondary-button" disabled={query.page === 0} onClick={() => page(query.page - 1)}>Trang trước</button>
          <button type="button" className="secondary-button" disabled={query.page + 1 >= list.data.totalPages}
            onClick={() => page(query.page + 1)}>Trang sau</button>
        </nav>}
      </>}
    </section>
    <section className={styles.contentPanel} aria-label="Chi tiết tài khoản">
      <h2>Chi tiết tài khoản</h2>
      {selected ? <AccountDetails key={selected} id={selected} csrf={auth.session.csrfToken}
        onChanged={reloadList} handleError={auth.handleError} /> : <p>Chọn một tài khoản để xem chi tiết.</p>}
    </section>
  </div>;
}

function AccountDetails({ id, csrf, handleError, onChanged }: {
  id: string; csrf: string; handleError: (error: unknown) => void; onChanged: () => void;
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await readAccount(id, signal); }
    catch (failure) { if (!signal.aborted) handleError(failure); throw failure; }
  }, [id, handleError]);
  const detail = useLookup(id, load);
  if (detail.status === "loading") return <p role="status">Đang tải tài khoản…</p>;
  if (detail.status === "failed") return <><p role="alert">{accountError(detail.error)}</p>
    <button type="button" className="secondary-button" onClick={detail.retry}>Tải lại chi tiết</button></>;
  return <AccountStatusEditor initial={detail.data} csrf={csrf} handleError={handleError} onChanged={onChanged} reload={detail.retry} />;
}

function AccountStatusEditor({ initial, csrf, handleError, onChanged, reload }: {
  initial: AccountDetail; csrf: string; handleError: (error: unknown) => void; onChanged: () => void; reload: () => void;
}) {
  const [detail, setDetail] = useState(initial);
  const [confirming, setConfirming] = useState<"status" | CustomerRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const { account, lastStatusChange, lastRoleChange, allowedRoleChanges } = detail;
  const locking = account.status === "ACTIVE";
  const conflict = error instanceof RestError && ["VERSION_CONFLICT", "INVALID_TRANSITION", "ACCOUNT_LOCKED",
    "CONSULTANT_APPROVAL_REQUIRED", "NETWORK_ERROR", "REQUEST_TIMEOUT", "INVALID_RESPONSE"].includes(error.code);

  async function change() {
    if (!confirming || pending.current || !account.canChangeStatus) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const updated = confirming === "status"
        ? await setAccountStatus(account, locking ? "LOCKED" : "ACTIVE", csrf, controller.signal)
        : await setAccountRole(account, confirming, csrf, controller.signal);
      if (controller.signal.aborted) return;
      setDetail(updated);
      setNotice(confirming === "status" ? (locking ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.")
        : `Đã đổi vai trò thành ${accountRoles[confirming]}.`);
      onChanged();
    } catch (failure) {
      if (!controller.signal.aborted) { setError(failure); handleError(failure); }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) { setBusy(false); setConfirming(null); }
    }
  }

  return <>
    <h3>{account.displayName}</h3>
    <dl>
      <dt>Định danh</dt><dd>{account.identifier}</dd>
      <dt>Mã tài khoản</dt><dd>{account.id}</dd>
      <dt>Vai trò</dt><dd>{accountRoles[account.role]}</dd>
      <dt>Trạng thái tài khoản</dt><dd>{accountStatuses[account.status]}</dd>
      <dt>Ngày tạo</dt><dd><time dateTime={account.createdAt}>{new Date(account.createdAt).toLocaleString("vi-VN")}</time></dd>
    </dl>
    {lastStatusChange && <p>Thay đổi gần nhất bởi Admin {lastStatusChange.actorId} lúc{" "}
      <time dateTime={lastStatusChange.occurredAt}>{new Date(lastStatusChange.occurredAt).toLocaleString("vi-VN")}</time>.
      {lastStatusChange.status === "LOCKED" && ` Đã thu hồi ${lastStatusChange.revokedSessions} phiên.`}</p>}
    {lastRoleChange && <p>Đổi vai trò gần nhất bởi Admin {lastRoleChange.actorId}. Đã thu hồi {lastRoleChange.revokedSessions} phiên.</p>}
    {notice && <p role="status">{notice}</p>}
    {error !== null && <p role="alert">{accountError(error)}</p>}
    {conflict && <button type="button" className="secondary-button" onClick={reload}>Tải lại chi tiết</button>}
    {!account.canChangeStatus && <p>Trạng thái tài khoản Admin chỉ được quản lý qua quy trình cấp quyền riêng.</p>}
    {account.canChangeStatus && !conflict && (confirming ? <div className={styles.contentActions}>
      <p>{confirming === "status"
        ? (locking ? "Khóa tài khoản sẽ thu hồi tất cả phiên đang hoạt động." : "Người dùng sẽ có thể đăng nhập lại sau khi mở khóa.")
        : `Đổi vai trò thành ${accountRoles[confirming]} sẽ thu hồi các phiên đang hoạt động.`}</p>
      <button type="button" className="primary-button" disabled={busy} onClick={() => void change()}>
        {confirming === "status" ? (locking ? "Xác nhận khóa" : "Xác nhận mở khóa") : "Xác nhận đổi vai trò"}</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirming(null)}>Hủy</button>
    </div> : <div className={styles.contentActions}>
      <button type="button" className="secondary-button" onClick={() => setConfirming("status")}>
        {locking ? "Khóa tài khoản" : "Mở khóa tài khoản"}</button>
      {allowedRoleChanges?.map(role => <button key={role} type="button" className="secondary-button" onClick={() => setConfirming(role)}>
        {role === "CONSULTANT" ? "Cấp quyền tư vấn viên" : "Thu hồi quyền tư vấn viên"}</button>)}
    </div>)}
  </>;
}
