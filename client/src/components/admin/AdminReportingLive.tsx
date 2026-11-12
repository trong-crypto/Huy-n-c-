"use client";

import { useCallback, useState } from "react";
import { FormField } from "@/components/ui/Controls";
import { auditActions, auditTargets, listAudit, phase4Error, readMetrics } from "@/services/rest/adminPhase4";
import { useLookup } from "@/services/rest/useLookup";
import { AdminAuditLog } from "./AdminAuditLog";
import { AdminMetrics } from "./AdminMetrics";
import { useAdminSession } from "./AdminSessionGate";
import styles from "./admin.module.css";

export function AdminMetricsLive() {
  const handleError = useAdminSession()?.handleError;
  const [input, setInput] = useState("");
  const [date, setDate] = useState("");
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await readMetrics(date, signal); }
    catch (failure) { if (!signal.aborted) handleError?.(failure); throw failure; }
  }, [date, handleError]);
  const metrics = useLookup(date, load);
  const data = metrics.data;
  return <>
    <form className={styles.contentActions} onSubmit={event => { event.preventDefault(); setDate(input); metrics.retry(); }}>
      <FormField id="metrics-date" label="Ngày thống kê theo giờ Việt Nam">
        <input type="date" id="metrics-date" value={input} onChange={event => setInput(event.target.value)} />
      </FormField>
      <button type="submit" className="secondary-button">Xem thống kê</button>
    </form>
    {data && <p role="status">Ngày {data.date} · {data.timeZone}.
      {data.calculationCoverage === "PARTIAL" && " Số liệu lượt tính chỉ bao phủ một phần ngày."}
      {data.calculationCoverage === "UNAVAILABLE" && " Chưa có dữ liệu lượt tính cho ngày này."}</p>}
    {metrics.status === "failed" && <p role="alert">{phase4Error(metrics.error)}</p>}
    <AdminMetrics state={metrics.status === "loading" ? { status: "loading" }
      : metrics.status === "failed" ? { status: "error" } : { status: "ready", data: metrics.data }} />
  </>;
}

const emptyAudit = { targetType: "", action: "", actorId: "", targetId: "", from: "", to: "" };
const vietnamMidnight = (date: string) => date ? `${date}T00:00:00+07:00` : "";

export function AdminAuditLive() {
  const handleError = useAdminSession()?.handleError;
  const [filters, setFilters] = useState(emptyAudit);
  const [query, setQuery] = useState(emptyAudit);
  const [page, setPage] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await listAudit({ ...query, from: vietnamMidnight(query.from), to: vietnamMidnight(query.to) }, page, signal); }
    catch (failure) { if (!signal.aborted) handleError?.(failure); throw failure; }
  }, [query, page, handleError]);
  const audit = useLookup(JSON.stringify([query, page]), load);
  const data = audit.data;
  return <>
    <form className={styles.auditFilters} aria-label="Bộ lọc nhật ký"
      onSubmit={event => { event.preventDefault(); setQuery({ ...filters }); setPage(0); audit.retry(); }}>
      <FormField id="audit-type" label="Loại đối tượng">
        <select id="audit-type" value={filters.targetType} onChange={event => setFilters({ ...filters, targetType: event.target.value })}>
          <option value="">Tất cả</option>{Object.entries(auditTargets).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </FormField>
      <FormField id="audit-action" label="Thao tác">
        <select id="audit-action" value={filters.action} onChange={event => setFilters({ ...filters, action: event.target.value })}>
          <option value="">Tất cả</option>{Object.entries(auditActions).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </FormField>
      {(["actorId", "targetId", "from", "to"] as const).map((key, index) =>
        <FormField key={key} id={`audit-${key}`} label={["Mã người thực hiện", "Mã đối tượng", "Từ ngày (UTC+7)", "Trước ngày (UTC+7)"][index]}>
          <input id={`audit-${key}`} type={index < 2 ? "text" : "date"} maxLength={36}
            value={filters[key]} onChange={event => setFilters({ ...filters, [key]: event.target.value })} />
        </FormField>)}
      <button type="submit" className="secondary-button">Lọc nhật ký</button>
    </form>
    {audit.status === "failed" && <p role="alert">{phase4Error(audit.error)}</p>}
    <AdminAuditLog state={data ? { status: "ready", data: data.items.map(event => ({
      id: event.id, timeLabel: new Date(event.occurredAt).toLocaleString("vi-VN"),
      action: auditActions[event.action], actorId: event.actorId, target: `${auditTargets[event.targetType]} · ${event.targetId}`, outcome: "Hoàn thành",
    })) } : { status: audit.status === "failed" ? "error" : "loading" }} />
    {data && (page > 0 || data.totalPages > 1) && <nav className={styles.contentActions} aria-label="Phân trang nhật ký">
      <button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Trang trước</button>
      <button type="button" className="secondary-button" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</button>
    </nav>}
  </>;
}
