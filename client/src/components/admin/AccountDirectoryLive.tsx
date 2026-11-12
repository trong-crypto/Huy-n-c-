"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/Controls";
import { accountError, accountRoles, accountStatuses, listAccounts, readAccount, setAccountRole, setAccountStatus,
  type Account, type AccountDetail, type AccountQuery, type CustomerRole, type Status } from "@/services/rest/adminAccounts";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { useAdminSession } from "./AdminSessionGate";
import styles from "./admin.module.css";

const firstPage: AccountQuery = { q: "", role: "", status: "", page: 0 };
type AccountAction = Status | CustomerRole;
const roleAction = (account: Account): CustomerRole => account.role === "CONSULTANT" ? "USER" : "CONSULTANT";
const roleLabel = (role: CustomerRole) => role === "CONSULTANT" ? "Cấp lên thành tư vấn viên" : "Thu hồi quyền tư vấn viên";
const accountDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function AccountTime({ value }: { value: string }) {
  return <time dateTime={value}>{accountDate.format(new Date(value))}</time>;
}

export function AccountDirectoryLive() {
  const auth = useAdminSession();
  const handleError = auth?.handleError;
  const [filters, setFilters] = useState(firstPage);
  const [query, setQuery] = useState(firstPage);
  const [selected, setSelected] = useState<{ id: string; action: AccountAction | null } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closeDetails = useCallback(() => {
    setSelected(null);
    opener.current?.focus();
  }, []);
  useEffect(() => { if (selected) closeButton.current?.focus(); }, [selected]);
  const [refresh, setRefresh] = useState(0);
  const reloadList = useCallback(() => setRefresh(value => value + 1), []);
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listAccounts(query, signal); }
    catch (failure) { if (!signal.aborted) handleError?.(failure); throw failure; }
  }, [query, handleError]);
  const list = useLookup(JSON.stringify([query, refresh]), load);
  if (!auth) return <p role="status">Cần phiên Admin để quản lý tài khoản.</p>;

  function select(id: string, action: AccountAction | null, button: HTMLButtonElement) {
    opener.current = button;
    setSelected({ id, action });
  }

  function filter(event: FormEvent) {
    event.preventDefault();
    setSelected(null);
    setQuery({ ...filters, q: filters.q.trim(), page: 0 });
  }

  function page(number: number) {
    setSelected(null);
    setQuery(current => ({ ...current, page: number }));
  }

  return <div className={styles.contentStack}>
    <section className={styles.contentPanel} aria-label="Danh sách tài khoản">
      <h2>Danh sách tài khoản</h2>
      <form className={styles.accountFilters} onSubmit={filter}>
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
        <div className={styles.accountTableWrap}><table className={styles.accountTable} aria-label="Tài khoản người dùng">
          <thead><tr><th scope="col">Tên hiển thị</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Hành động</th></tr></thead>
          <tbody>{list.data.items.length === 0 && <tr><td colSpan={4}>Không có tài khoản phù hợp.</td></tr>}
          {list.data.items.map(account => <tr key={account.id} data-selected={selected?.id === account.id || undefined}>
            <th scope="row"><button type="button" className={styles.accountName} aria-controls={selected?.id === account.id ? "account-details" : undefined}
              onClick={event => select(account.id, null, event.currentTarget)}>{account.displayName}</button><small>{account.identifier}</small></th>
            <td>{accountRoles[account.role]}</td><td>{accountStatuses[account.status]}</td>
            <td>{account.canChangeStatus ? <div className={styles.contentActions}>
              <button type="button" className="secondary-button" onClick={event => select(account.id,
                account.status === "ACTIVE" ? "LOCKED" : "ACTIVE", event.currentTarget)}>
                {account.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}</button>
              <button type="button" className="secondary-button" disabled={account.status !== "ACTIVE"}
                title={account.status !== "ACTIVE" ? "Mở khóa tài khoản trước khi đổi vai trò" : undefined}
                onClick={event => select(account.id, roleAction(account), event.currentTarget)}>{roleLabel(roleAction(account))}</button>
            </div> : "—"}</td>
          </tr>)}</tbody>
        </table></div>
        {(query.page > 0 || list.data.totalPages > 1) && <nav className={styles.accountPagination} aria-label="Phân trang tài khoản">
          <button type="button" className="secondary-button" disabled={query.page === 0} onClick={() => page(query.page - 1)}>Trang trước</button>
          <button type="button" className="secondary-button" disabled={query.page + 1 >= list.data.totalPages}
            onClick={() => page(query.page + 1)}>Trang sau</button>
        </nav>}
      </>}
    </section>
    {selected && <aside id="account-details" className={styles.accountDrawer} aria-labelledby="account-details-title"
      onKeyDown={event => { if (event.key === "Escape") closeDetails(); }}>
      <div className={styles.drawerHeading}><h2 id="account-details-title">Chi tiết tài khoản</h2>
        <button type="button" ref={closeButton} className="secondary-button" onClick={closeDetails}>Đóng</button></div>
      <div className={styles.drawerBody}>
        <AccountDetails key={`${selected.id}:${selected.action}`} id={selected.id} action={selected.action} csrf={auth.session.csrfToken}
          onChanged={reloadList} handleError={auth.handleError} />
      </div>
    </aside>}
  </div>;
}

function AccountDetails({ id, action, csrf, handleError, onChanged }: {
  id: string; action: AccountAction | null; csrf: string; handleError: (error: unknown) => void; onChanged: () => void;
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await readAccount(id, signal); }
    catch (failure) { if (!signal.aborted) handleError(failure); throw failure; }
  }, [id, handleError]);
  const detail = useLookup(id, load);
  if (detail.status === "loading") return <p role="status">Đang tải tài khoản…</p>;
  if (detail.status === "failed") return <><p role="alert">{accountError(detail.error)}</p>
    <button type="button" className="secondary-button" onClick={detail.retry}>Tải lại chi tiết</button></>;
  return <AccountStatusEditor initial={detail.data} action={action} csrf={csrf} handleError={handleError} onChanged={onChanged} reload={detail.retry} />;
}

function AccountStatusEditor({ initial, action, csrf, handleError, onChanged, reload }: {
  initial: AccountDetail; action: AccountAction | null; csrf: string; handleError: (error: unknown) => void; onChanged: () => void; reload: () => void;
}) {
  const [detail, setDetail] = useState(initial);
  const [confirming, setConfirming] = useState(action);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const { account, lastStatusChange, lastRoleChange } = detail;
  const changes = [
    ...(lastStatusChange ? [{ ...lastStatusChange, title: "Đổi trạng thái",
      from: accountStatuses[lastStatusChange.previousStatus], to: accountStatuses[lastStatusChange.status] }] : []),
    ...(lastRoleChange ? [{ ...lastRoleChange, title: "Đổi vai trò",
      from: accountRoles[lastRoleChange.previousRole], to: accountRoles[lastRoleChange.role] }] : []),
  ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const statusChange = confirming === "LOCKED" || confirming === "ACTIVE";
  const locking = confirming === "LOCKED";
  const alreadyApplied = confirming === account.status || confirming === account.role;
  const requiresUnlock = !!confirming && !statusChange && account.status === "LOCKED";
  const conflict = error instanceof RestError && ["VERSION_CONFLICT", "INVALID_TRANSITION", "ACCOUNT_LOCKED",
    "CONSULTANT_APPROVAL_REQUIRED", "NETWORK_ERROR", "REQUEST_TIMEOUT", "INVALID_RESPONSE"].includes(error.code);

  async function change() {
    if (!confirming || pending.current || !account.canChangeStatus || alreadyApplied || requiresUnlock) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const updated = statusChange
        ? await setAccountStatus(account, confirming, csrf, controller.signal)
        : await setAccountRole(account, confirming, csrf, controller.signal);
      if (controller.signal.aborted) return;
      setDetail(updated);
      setNotice(statusChange ? (locking ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.")
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
    <div className={styles.accountIdentity}>
      <h3>{account.displayName}</h3>
      <div className={styles.accountTags}>
        <span className={styles.badge}>{accountRoles[account.role]}</span>
        <span className={styles.accountStatus} data-status={account.status}>{accountStatuses[account.status]}</span>
      </div>
    </div>
    <section className={styles.accountDetailsSection} aria-labelledby="account-information">
      <h4 id="account-information">Thông tin tài khoản</h4>
      <dl className={styles.accountDetailsList}>
        <div><dt>Định danh đăng nhập</dt><dd>{account.identifier}</dd></div>
        <div><dt>Ngày tạo</dt><dd><AccountTime value={account.createdAt} /></dd></div>
        <div><dt>Mã tài khoản</dt><dd><code>{account.id}</code></dd></div>
      </dl>
    </section>
    {notice && <p role="status">{notice}</p>}
    {error !== null && <p role="alert">{accountError(error)}</p>}
    {conflict && <button type="button" className="secondary-button" onClick={reload}>Tải lại chi tiết</button>}
    {!account.canChangeStatus && <p>Trạng thái tài khoản Admin chỉ được quản lý qua quy trình cấp quyền riêng.</p>}
    {account.canChangeStatus && !conflict && confirming && <div className={`${styles.contentActions} ${styles.accountConfirmation}`}>
      <p>{alreadyApplied ? "Tài khoản đã ở trạng thái hoặc vai trò này." : requiresUnlock ? "Hãy mở khóa tài khoản trước khi đổi vai trò." : statusChange
        ? (locking ? "Khóa tài khoản sẽ thu hồi tất cả phiên đang hoạt động." : "Người dùng sẽ có thể đăng nhập lại sau khi mở khóa.")
        : confirming === "CONSULTANT"
          ? "Cấp quyền sẽ duyệt hồ sơ tư vấn viên và thu hồi các phiên đang hoạt động."
          : "Thu hồi quyền tư vấn viên sẽ đưa tài khoản về vai trò người dùng và ngắt các phiên đang hoạt động."}</p>
      <button type="button" className="primary-button" disabled={busy || alreadyApplied || requiresUnlock} onClick={() => void change()}>
        {statusChange ? (locking ? "Xác nhận khóa" : "Xác nhận mở khóa") : "Xác nhận đổi vai trò"}</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirming(null)}>Hủy</button>
    </div>}
    <section className={styles.accountDetailsSection} aria-labelledby="account-changes">
      <h4 id="account-changes">Thay đổi gần nhất</h4>
      {changes.length === 0 ? <p className="field-hint">Chưa có thay đổi vai trò hoặc trạng thái.</p>
        : <ul className={styles.accountChanges}>{changes.map(change => <li key={change.title}>
          <strong>{change.title}</strong>
          <p>{change.from} → {change.to}</p>
          <p className="field-hint"><AccountTime value={change.occurredAt} />
            {change.revokedSessions > 0 && ` · Đã thu hồi ${change.revokedSessions} phiên`}</p>
          <details><summary>Mã quản trị viên thực hiện</summary><code>{change.actorId}</code></details>
        </li>)}</ul>}
    </section>
  </>;
}
