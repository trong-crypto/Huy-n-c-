import { AdminDataState, type AdminData } from "./AdminDataState";
import styles from "./admin.module.css";

type Metrics = {
  users: number;
  calculations: number | null;
  pendingContent: number;
  consultants: number;
  methods: readonly { id: string; name: string; count: number }[];
  services?: readonly { id: string; name: string; status: string }[];
};

const metrics = [
  { key: "users", label: "Tổng số người dùng" },
  { key: "calculations", label: "Tổng lượt tính quẻ" },
  { key: "pendingContent", label: "Nội dung chờ duyệt" },
  { key: "consultants", label: "Số tư vấn viên" },
] as const;

const formatCount = new Intl.NumberFormat("vi-VN");

export function AdminMetrics({ state = { status: "blocked" } }: { state?: AdminData<Metrics | null> }) {
  const data = state.status === "ready" ? state.data : null;
  return <section className={styles.metrics} aria-labelledby="admin-metrics-title" aria-busy={state.status === "loading"}>
    <h2 id="admin-metrics-title" className={styles.modulesTitle}>Thống kê quản trị</h2>
    {state.status !== "ready" && <AdminDataState state={state} />}
    {state.status === "ready" && !data && <p role="status">Chưa có chỉ số thống kê trong phạm vi đã chọn.</p>}
    <dl className={styles.metricGrid}>
      {metrics.map(({ key, label }) => <div key={key} className={styles.contentPanel}>
        <dt>{label}</dt><dd>{data?.[key] != null ? formatCount.format(data[key]) : <span aria-label="Chưa có số liệu">—</span>}</dd>
      </div>)}
    </dl>
    <div className={styles.metricTables}>
      <section className={styles.contentPanel} aria-labelledby="method-metrics-title">
        <h3 id="method-metrics-title">Lượt tính theo phương pháp</h3>
        {data?.methods.length ? <table className={styles.adminTable}>
          <thead><tr><th scope="col">Phương pháp</th><th scope="col">Lượt tính</th></tr></thead>
          <tbody>{data.methods.map(method => <tr key={method.id}><td>{method.name}</td><td>{formatCount.format(method.count)}</td></tr>)}</tbody>
        </table> : <p className="field-hint">{data?.calculations == null ? "Chưa có số liệu lượt tính." : "Chưa có lượt tính theo phương pháp."}</p>}
      </section>
      <section className={styles.contentPanel} aria-labelledby="service-status-title">
        <h3 id="service-status-title">Trạng thái dịch vụ</h3>
        {data?.services?.length ? <table className={styles.adminTable}>
          <thead><tr><th scope="col">Dịch vụ</th><th scope="col">Trạng thái</th></tr></thead>
          <tbody>{data.services.map(service => <tr key={service.id}><td>{service.name}</td><td>{service.status}</td></tr>)}</tbody>
        </table> : <p className="field-hint">Chưa có trạng thái dịch vụ từ API quản trị.</p>}
      </section>
    </div>
  </section>;
}
