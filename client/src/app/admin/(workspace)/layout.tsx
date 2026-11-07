import Link from "next/link";
import type { ReactNode } from "react";
import { AdminBrand } from "@/components/admin/AdminBrand";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import styles from "@/components/admin/admin.module.css";

export default function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  return <>
    <a className="skip-link" href="#admin-content">Đến nội dung quản trị</a>
    <header className={styles.header}>
      <AdminBrand />
      <div className={styles.headerActions}>
        <span className={styles.badge}>Chưa tích hợp xác thực</span>
        <Link href="/admin/login" className="secondary-button">Đăng nhập</Link>
        <button type="button" className="secondary-button" disabled>Đăng xuất</button>
      </div>
    </header>
    <div className={styles.workspace}>
      <aside className={styles.sidebar}>
        <AdminNavigation />
        <Link href="/" className={styles.textLink}>← Về website người dùng</Link>
      </aside>
      <main id="admin-content" tabIndex={-1} className={styles.content}>{children}</main>
    </div>
  </>;
}
