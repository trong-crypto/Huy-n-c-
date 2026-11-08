import Link from "next/link";
import type { ReactNode } from "react";
import { AdminBrand } from "@/components/admin/AdminBrand";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminSessionActions, AdminSessionGate } from "@/components/admin/AdminSessionGate";
import { CLIENT_CONFIG } from "@/config/client";
import styles from "@/components/admin/admin.module.css";

export default function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  const workspace = <>
    <a className="skip-link" href="#admin-content">Đến nội dung quản trị</a>
    <header className={styles.header}>
      <AdminBrand />
      <div className={styles.headerActions}>
        <AdminSessionActions />
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
  return CLIENT_CONFIG.adminEnabled ? <AdminSessionGate>{workspace}</AdminSessionGate> : workspace;
}
