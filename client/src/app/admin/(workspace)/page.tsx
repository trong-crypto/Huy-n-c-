import Link from "next/link";
import { adminModules } from "@/components/admin/adminModules";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import styles from "@/components/admin/admin.module.css";

export default function AdminDashboardPage() {
  return <>
    <header className={styles.dashboardIntro}>
      <p className="eyebrow">HUYỀN CƠ / TỔNG QUAN</p>
      <h1>Chào mừng đến khu vực quản trị</h1>
      <p>Theo dõi chỉ số vận hành và mở các module quản trị từ cùng một nơi.</p>
    </header>
    <section className={styles.sessionCard} aria-labelledby="admin-session-title">
      <div>
        <h2 id="admin-session-title">Phiên quản trị</h2>
        <p>Đang chờ Backend cung cấp đăng nhập và thông tin phiên quản trị.</p>
      </div>
      <Link href="/admin/login" className="secondary-button">Mở trang đăng nhập</Link>
    </section>
    <AdminMetrics />
    <section aria-labelledby="admin-modules-title">
      <h2 id="admin-modules-title" className={styles.modulesTitle}>Các module quản trị</h2>
      <ul className={styles.cards}>
        {adminModules.map(module => <li key={module.id} className={styles.card}>
          <span className={styles.badge}>Giao diện · chờ Backend</span>
          <h3>{module.title}</h3>
          <p>{module.description}</p>
          <Link className={styles.textLink} href={module.href}>Mở {module.title.toLowerCase()}</Link>
        </li>)}
      </ul>
    </section>
  </>;
}
