"use client";

import { useState, type FormEvent } from "react";
import { FieldError, FormField } from "@/components/ui/Controls";
import { CLIENT_CONFIG } from "@/config/client";
import { AccountDirectoryLive } from "./AccountDirectoryLive";
import { ConsultantDirectoryLive } from "./ConsultantDirectoryLive";
import { AdminDataState, type AdminData } from "./AdminDataState";
import type { DirectoryModule } from "./adminModules";
import styles from "./admin.module.css";

// Presentation values. Wire enums and field names will be mapped after contract review.
const roles = { USER: "Người dùng", ADMIN: "Quản trị viên", CONSULTANT: "Tư vấn viên" };
const accountStatuses = { ACTIVE: "Hoạt động", LOCKED: "Bị khóa" };
const reviewStatuses = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Đã từ chối" };

type Account = {
  id: string;
  name: string;
  role: keyof typeof roles;
  status: keyof typeof accountStatuses;
  permissions?: readonly string[];
  profile?: { summary: string; review: keyof typeof reviewStatuses; rejectionReason?: string };
};

type DirectoryData = {
  records: readonly Account[];
  pageSize?: number;
  canProposeRoleChange?: boolean;
};

function AccountProposal({ account, consultant, roleChange }: { account: Account; consultant: boolean; roleChange: boolean }) {
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [review, setReview] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  function showPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((status && (!Object.hasOwn(accountStatuses, status) || status === account.status))
      || (role && (!roleChange || !Object.hasOwn(roles, role) || role === account.role))
      || (review && (!consultant || !account.profile || !["APPROVED", "REJECTED"].includes(review) || review === account.profile.review))) {
      setError("Giá trị đề xuất không hợp lệ.");
    } else if (!status && !role && !review) {
      setError("Chọn ít nhất một thay đổi để xem trước.");
    } else if (review === "REJECTED" && (!reason.trim() || reason.trim().length > 500)) {
      setError("Nhập lý do từ chối từ 1 đến 500 ký tự.");
      event.currentTarget.querySelector<HTMLElement>("#admin-review-reason")?.focus();
    } else {
      setError("");
      setPreview(true);
    }
  }

  return <form className="form-stack" aria-label="Đề xuất thay đổi" onSubmit={showPreview} onChange={() => { setPreview(false); setError(""); }} noValidate>
    <FormField id="admin-proposed-status" label="Trạng thái tài khoản đề xuất">
      <select id="admin-proposed-status" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="">Giữ nguyên</option>
        {Object.entries(accountStatuses).filter(([key]) => key !== account.status).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </FormField>
    {roleChange && <FormField id="admin-proposed-role" label="Vai trò đề xuất">
      <select id="admin-proposed-role" value={role} onChange={event => setRole(event.target.value)}>
        <option value="">Giữ nguyên</option>
        {Object.entries(roles).filter(([key]) => key !== account.role).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </FormField>}
    {consultant && account.profile && <FormField id="admin-proposed-review" label="Kết quả duyệt đề xuất">
      <select id="admin-proposed-review" value={review} onChange={event => setReview(event.target.value)}>
        <option value="">Giữ nguyên</option>
        {(["APPROVED", "REJECTED"] as const).filter(key => key !== account.profile?.review)
          .map(key => <option key={key} value={key}>{reviewStatuses[key]}</option>)}
      </select>
    </FormField>}
    {review === "REJECTED" && <FormField id="admin-review-reason" label="Lý do từ chối đề xuất">
      <textarea id="admin-review-reason" value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={500} required />
    </FormField>}
    {error && <FieldError id="admin-proposal-error">{error}</FieldError>}
    <div className={styles.contentActions}>
      <button type="submit" className="primary-button">Xem trước đề xuất</button>
      <button type="button" className="secondary-button" disabled>Gửi thay đổi</button>
    </div>
    {preview && <div className={styles.preview}>
      <p role="status">Bản xem trước · Chưa gửi</p>
      {status && <p>Trạng thái đề xuất: {accountStatuses[status as keyof typeof accountStatuses]}</p>}
      {role && <p>Vai trò đề xuất: {roles[role as keyof typeof roles]}</p>}
      {review && <p>Kết quả duyệt đề xuất: {reviewStatuses[review as keyof typeof reviewStatuses]}</p>}
      {review === "REJECTED" && <p>Lý do: {reason.trim()}</p>}
    </div>}
  </form>;
}

function DirectoryRecords({ data, consultant }: { data: DirectoryData; consultant: boolean }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [review, setReview] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const keyword = query.trim().toLocaleLowerCase("vi");
  const matches = data.records.filter(account => (!role || account.role === role) && (!status || account.status === status)
    && (!review || account.profile?.review === review) && account.name.toLocaleLowerCase("vi").includes(keyword));
  const pageSize = data.pageSize && data.pageSize > 0 ? data.pageSize : Math.max(1, matches.length);
  const lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const account = visible.find(item => item.id === selected);

  function changeFilter(setValue: (value: string) => void, value: string) {
    setValue(value);
    setPage(0);
    setSelected(null);
  }

  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel} aria-label={consultant ? "Danh sách tư vấn viên" : "Danh sách tài khoản"}>
      <h2>{consultant ? "Danh sách tư vấn viên" : "Danh sách tài khoản"}</h2>
      <div className="form-stack">
        <FormField id="admin-directory-search" label={consultant ? "Tìm tư vấn viên" : "Tìm người dùng"}>
          <input id="admin-directory-search" type="search" value={query} maxLength={100} onChange={event => changeFilter(setQuery, event.target.value)} />
        </FormField>
        {!consultant && <FormField id="admin-directory-role" label="Lọc theo vai trò">
          <select id="admin-directory-role" value={role} onChange={event => changeFilter(setRole, event.target.value)}>
            <option value="">Tất cả</option>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FormField>}
        <FormField id="admin-directory-status" label="Lọc theo trạng thái tài khoản">
          <select id="admin-directory-status" value={status} onChange={event => changeFilter(setStatus, event.target.value)}>
            <option value="">Tất cả</option>{Object.entries(accountStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FormField>
        {consultant && <FormField id="admin-directory-review" label="Lọc theo trạng thái duyệt">
          <select id="admin-directory-review" value={review} onChange={event => changeFilter(setReview, event.target.value)}>
            <option value="">Tất cả</option>{Object.entries(reviewStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FormField>}
      </div>
      {visible.length === 0 ? <p role="status">{data.records.length ? "Không có kết quả phù hợp với bộ lọc." : "Danh sách chưa có bản ghi."}</p> : <ul className={styles.recordList}>
        {visible.map(item => <li key={item.id}><button type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
          {item.name}<small>{accountStatuses[item.status]} · {item.profile && consultant ? reviewStatuses[item.profile.review] : roles[item.role]}</small>
        </button></li>)}
      </ul>}
      {lastPage > 0 && <nav className={styles.contentActions} aria-label="Phân trang danh sách">
        <button type="button" className="secondary-button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setSelected(null); }}>Trang trước</button>
        <span role="status">Trang {currentPage + 1}/{lastPage + 1}</span>
        <button type="button" className="secondary-button" disabled={currentPage === lastPage} onClick={() => { setPage(currentPage + 1); setSelected(null); }}>Trang sau</button>
      </nav>}
    </section>
    <section className={styles.contentPanel} aria-labelledby="admin-directory-detail">
      <h2 id="admin-directory-detail">{consultant ? "Hồ sơ tư vấn viên" : "Chi tiết tài khoản"}</h2>
      {account ? <>
        <h3>{account.name}</h3>
        <dl>
          <div><dt>Vai trò</dt><dd>{roles[account.role]} ({account.role})</dd></div>
          <div><dt>Trạng thái tài khoản</dt><dd>{accountStatuses[account.status]}</dd></div>
          <div><dt>Quyền</dt><dd>{account.permissions?.join(", ") || "Chưa có thông tin quyền."}</dd></div>
          {consultant && account.profile && <>
            <div><dt>Giới thiệu hồ sơ</dt><dd>{account.profile.summary}</dd></div>
            <div><dt>Trạng thái duyệt</dt><dd>{reviewStatuses[account.profile.review]}</dd></div>
            {account.profile.review === "REJECTED" && account.profile.rejectionReason && <div><dt>Lý do từ chối</dt><dd>{account.profile.rejectionReason}</dd></div>}
          </>}
        </dl>
        <AccountProposal key={account.id} account={account} consultant={consultant} roleChange={!consultant && data.canProposeRoleChange === true} />
      </> : <p className="field-hint">Chọn một bản ghi để xem thông tin và chuẩn bị đề xuất thay đổi.</p>}
    </section>
  </div>;
}

export function AdminDirectory({ module, state = { status: "blocked" }, showHeading = true }: {
  module: DirectoryModule;
  state?: AdminData<DirectoryData>;
  showHeading?: boolean;
}) {
  const consultant = module.id === "consultants";
  return <div className={styles.contentStack}>
    {showHeading && <header className={styles.dashboardIntro}>
      <p className="eyebrow">HUYỀN CƠ / QUẢN TRỊ TÀI KHOẢN</p>
      <h1>{module.title}</h1><p>{module.description}</p>
    </header>}
    {CLIENT_CONFIG.adminAccounts ? (consultant ? <ConsultantDirectoryLive /> : <AccountDirectoryLive />) : state.status !== "ready" ? <>
      <AdminDataState state={state} />
      <div className={styles.contentGrid}>
        <section className={styles.contentPanel}>
          <h2>{consultant ? "Danh sách tư vấn viên" : "Danh sách tài khoản"}</h2>
          <p className="field-hint">Tìm kiếm, bộ lọc và phân trang sẽ hiển thị khi nhận được dữ liệu đã được cấp quyền.</p>
        </section>
        <section className={styles.contentPanel}>
          <h2>{consultant ? "Hồ sơ và duyệt hồ sơ" : "Chi tiết, vai trò và trạng thái"}</h2>
          <p className="field-hint">Đang khóa thao tác xem chi tiết và gửi thay đổi. Quyền phải được Backend xác nhận.</p>
        </section>
      </div>
    </> : <DirectoryRecords data={state.data} consultant={consultant} />}
  </div>;
}
