import Link from "next/link";
import type { ReactNode } from "react";
import { AdminBrand } from "@/components/admin/AdminBrand";
import { adminModules } from "@/components/admin/adminModules";
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
        <nav aria-label="Điều hướng quản trị">
          <p className="eyebrow">KHU VỰC QUẢN TRỊ</p>
          <Link href="/admin" className={styles.current} aria-current="page">Tổng quan</Link>
          <ul className={styles.moduleMenu}>
            {adminModules.map(module => <li key={module.id}>
              <span>{module.title}</span><small>Chưa triển khai</small>
            </li>)}
          </ul>
        </nav>
        <Link href="/" className={styles.textLink}>← Về website người dùng</Link>
      </aside>
      <main id="admin-content" tabIndex={-1} className={styles.content}>{children}</main>
    </div>
  </>;
}
