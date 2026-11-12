"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { workspaceModules } from "./adminModules";
import styles from "./admin.module.css";

export function AdminNavigation() {
  const pathname = usePathname() ?? "/admin";
  return <nav aria-label="Điều hướng quản trị">
    <p className="eyebrow">KHU VỰC QUẢN TRỊ</p>
    <Link href="/admin" className={styles.overview} aria-current={pathname === "/admin" ? "page" : undefined}>Tổng quan</Link>
    <ul className={styles.moduleMenu}>
      {workspaceModules.map(module => <li key={module.id}>
        <Link href={module.href} aria-current={pathname === module.href ? "page" : undefined}>{module.title}</Link>
      </li>)}
    </ul>
  </nav>;
}
