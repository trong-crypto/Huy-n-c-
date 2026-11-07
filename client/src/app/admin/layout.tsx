import type { Metadata } from "next";
import type { ReactNode } from "react";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = {
  title: { default: "Quản trị Huyền Cơ", template: "%s | Quản trị Huyền Cơ" },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={styles.area}>{children}</div>;
}
