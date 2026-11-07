import { AdminDataState, type AdminData } from "./AdminDataState";
import styles from "./admin.module.css";

type AuditEntry = { id: string; timeLabel: string; action: string; target: string; outcome: string };

export function AdminAuditLog({ state = { status: "blocked" } }: { state?: AdminData<readonly AuditEntry[]> }) {
  return <>
    <header className={styles.dashboardIntro}>
      <p className="eyebrow">HUYỀN CƠ / QUẢN TRỊ</p>
      <h1>Nhật ký quản trị</h1>
      <p>Đối chiếu các thao tác theo thời gian, loại thao tác, đối tượng và kết quả.</p>
    </header>
    <section className={styles.contentPanel} aria-label="Danh sách nhật ký" aria-busy={state.status === "loading"}>
      {state.status !== "ready" ? <AdminDataState state={state} /> : state.data.length ? <table className={styles.adminTable}>
        <thead><tr><th scope="col">Thời gian</th><th scope="col">Thao tác</th><th scope="col">Đối tượng</th><th scope="col">Kết quả</th></tr></thead>
        <tbody>{state.data.map(entry => <tr key={entry.id}>
          <td>{entry.timeLabel}</td><td>{entry.action}</td><td>{entry.target}</td><td>{entry.outcome}</td>
        </tr>)}</tbody>
      </table> : <p role="status">Chưa có thao tác quản trị trong phạm vi đã chọn.</p>}
    </section>
  </>;
}
