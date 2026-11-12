import { AdminDirectory } from "./AdminDirectory";
import { adminModules } from "./adminModules";
import styles from "./admin.module.css";

export function AdminUsersWorkspace() {
  return <div className={styles.contentStack}>
    <header className={styles.dashboardIntro}>
      <p className="eyebrow">HUYỀN CƠ / QUẢN TRỊ TÀI KHOẢN</p>
      <h1>{adminModules[0].title}</h1>
      <p>{adminModules[0].description}</p>
    </header>
    <AdminDirectory module={adminModules[0]} showHeading={false} />
  </div>;
}
