import Link from "next/link";
import styles from "./admin.module.css";

export type AdminData<T> =
  | { status: "blocked" }
  | { status: "loading" }
  | { status: "error"; httpStatus?: number }
  | { status: "ready"; data: T };

export function AdminDataState({ state }: { state: Exclude<AdminData<unknown>, { status: "ready" }> }) {
  if (state.status === "blocked") return <p role="status" className={styles.notice}>Chưa có dữ liệu Backend. Tích hợp đang chờ API và xác thực quản trị.</p>;
  if (state.status === "loading") return <p role="status">Đang tải dữ liệu quản trị…</p>;
  if (state.httpStatus === 401) return <div className={styles.notice}>
    <p role="alert">Phiên quản trị không hợp lệ hoặc đã hết hạn.</p>
    <Link className={styles.textLink} href="/admin/login">Về trang đăng nhập quản trị</Link>
  </div>;
  if (state.httpStatus === 403) return <p role="alert" className={styles.notice}>Bạn không có quyền xem dữ liệu quản trị này.</p>;
  return <p role="alert" className={styles.notice}>Không tải được dữ liệu quản trị. Vui lòng thử lại sau.</p>;
}
