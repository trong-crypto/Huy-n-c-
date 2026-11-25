"use client";

import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/services/rest/transport";
import { adminOptions, readAdminSession } from "@/services/rest/methodGuides";
import { isRecord } from "@/types/contractValidation";
import { useAuthenticatedSocket } from "@/services/websocket/useAuthenticatedSocket";
import { useAdminSession } from "./AdminSessionGate";
import styles from "./admin.module.css";

type Counts = { users: number; consultants: number };
const valid = (value: unknown): value is Counts => isRecord(value)
  && Number.isSafeInteger(value.users) && Number(value.users) >= 0
  && Number.isSafeInteger(value.consultants) && Number(value.consultants) >= 0;

export function AdminOnlineChart() {
  const auth = useAdminSession();
  const accountId = auth?.session.account.id;
  const handleError = auth?.handleError;
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const update = useCallback((next: Counts) => {
    setCounts(previous => previous?.users === next.users && previous.consultants === next.consultants ? previous : next);
    setFailed(false);
  }, []);
  const credentials = useCallback(async (signal: AbortSignal) => {
    const session = await readAdminSession(signal);
    if (session.account.id !== accountId) throw new Error("Account changed");
    return session.csrfToken;
  }, [accountId]);
  const { connected } = useAuthenticatedSocket({ endpoint: "admin", destination: "/queue/admin/reviews",
    credentials: accountId ? credentials : null,
    onAccessError: () => setFailed(true),
    onConnected: () => setRevision(value => value + 1),
    onMessage(body) {
      let event: unknown;
      try { event = JSON.parse(body); } catch { return; }
      if (isRecord(event) && event.type === "ONLINE_COUNTS" && valid(event)) update(event);
    },
  });
  useEffect(() => {
    if (!accountId || !connected) return;
    const controller = new AbortController();
    void requestJson("/admin/metrics/online", valid, controller.signal, undefined, adminOptions())
      .then(value => { if (!controller.signal.aborted) update(value); })
      .catch(error => { if (!controller.signal.aborted) { setFailed(true); handleError?.(error); } });
    return () => controller.abort();
  }, [accountId, connected, revision, update, handleError]);
  const maximum = Math.max(5, counts?.users ?? 0, counts?.consultants ?? 0);
  return <>
    <h3 id="service-status-title">Người đang trực tuyến</h3>
    <div className={styles.onlineTwoColumns} role="img" aria-label={`Đang trực tuyến: ${counts?.users ?? "chưa có số liệu"} người dùng, ${counts?.consultants ?? "chưa có số liệu"} tư vấn viên`}>
      {[{ key: "users", label: "Người dùng" }, { key: "consultants", label: "Tư vấn viên" }].map(({ key, label }) => {
        const count = counts?.[key as keyof Counts];
        return <div key={key} className={styles.onlineColumn}>
          <strong>{count ?? "—"}</strong>
          <div className={styles.onlineBarTrack}><div className={styles.onlineBar} data-role={key}
            style={{ height: `${(count ?? 0) / maximum * 100}%` }} /></div>
          <span>{label}</span>
        </div>;
      })}
    </div>
    <p className="field-hint" role="status">{failed ? "Chưa lấy được số liệu. Thử tải lại trang." : !connected
      ? "Đang kết nối để cập nhật số người trực tuyến…" : "Tự cập nhật khi tài khoản vào hoặc rời hệ thống."}</p>
    <p className="field-hint">Mỗi tài khoản có kết nối WebSocket được tính một lần. Mất mạng được ghi nhận khi Server phát hiện ngắt kết nối.</p>
  </>;
}
