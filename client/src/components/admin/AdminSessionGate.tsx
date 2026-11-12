"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLookup } from "@/services/rest/useLookup";
import { logoutAdmin, methodGuideError, readAdminSession, type AdminSession } from "@/services/rest/methodGuides";
import { RestError } from "@/services/rest/transport";
import { passwordChangeRoutes } from "@/config/customerAuthRoutes";
import { useAuthenticatedSocket } from "@/services/websocket/useAuthenticatedSocket";
import { isRecord } from "@/types/contractValidation";
import styles from "./admin.module.css";

const AdminContext = createContext<{ session: AdminSession; handleError: (error: unknown) => void } | null>(null);
export const useAdminSession = () => useContext(AdminContext);

export function AdminSessionGate({ children }: { children: ReactNode }) {
  const state = useLookup("admin-session", readAdminSession);
  const [expired, setExpired] = useState(false);
  const handleError = useCallback((error: unknown) => {
    if (error instanceof RestError && error.code === "INVALID_SESSION") setExpired(true);
  }, []);
  const session = state.data;
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);

  if (state.status === "loading") return <main className={styles.loginPanel}><p role="status">Đang kiểm tra phiên quản trị…</p></main>;
  if (!session || expired || Date.parse(session.expiresAt) <= Date.now()) {
    const loginRequired = expired || session !== null || (state.error instanceof RestError && state.error.code === "INVALID_SESSION");
    return <main className={styles.loginPanel}>
      <h1>{loginRequired ? "Cần đăng nhập quản trị" : "Chưa kiểm tra được phiên quản trị"}</h1>
      <p role="alert">{loginRequired ? "Đăng nhập bằng tài khoản Admin để tiếp tục." : methodGuideError(state.error)}</p>
      <Link className="secondary-button" href="/admin/login">Đăng nhập quản trị</Link>
      {!loginRequired && <button type="button" className="secondary-button" onClick={state.retry}>Thử lại</button>}
    </main>;
  }
  return <AdminContext.Provider value={{ session, handleError }}>
    <AdminReviewNotices session={session} handleError={handleError} />
    {children}
  </AdminContext.Provider>;
}

const reviewAreas = {
  METHOD_GUIDE: { title: "Hướng dẫn phương pháp", href: "/admin/methods" },
  SOURCE: { title: "Dữ liệu nguồn", href: "/admin/sources" },
  NAME_GLOSS: { title: "Nghĩa tên quẻ", href: "/admin/readings" },
  INTERPRETATION: { title: "Lời giải nghĩa quẻ", href: "/admin/readings" },
};

function AdminReviewNotices({ session, handleError }: { session: AdminSession; handleError: (error: unknown) => void }) {
  const accountId = session.account.id;
  const csrf = session.csrfToken;
  const [areas, setAreas] = useState<(keyof typeof reviewAreas)[]>([]);
  const credentials = useCallback(async (signal: AbortSignal, reconnecting: boolean) => {
    if (!reconnecting) return csrf;
    const current = await readAdminSession(signal);
    if (current.account.id !== accountId) throw new RestError("INVALID_SESSION");
    return current.csrfToken;
  }, [accountId, csrf]);
  useAuthenticatedSocket({
    endpoint: "admin", destination: "/queue/admin/reviews", credentials,
    onAccessError: () => handleError(new RestError("INVALID_SESSION")),
    onMessage(body) {
      let event: unknown;
      try { event = JSON.parse(body); } catch { return; }
      if (!isRecord(event) || event.type !== "REVIEW_PENDING" || typeof event.area !== "string" || !Object.hasOwn(reviewAreas, event.area)) return;
      const area = event.area as keyof typeof reviewAreas;
      setAreas(previous => previous.includes(area) ? previous : [...previous, area]);
    },
  });
  if (areas.length === 0) return null;
  return <aside className={styles.notice} aria-label="Thông báo chờ duyệt">
    <p role="status">Có nội dung mới được gửi duyệt.</p>
    <ul>{areas.map(area => <li key={area}><a className={styles.textLink} href={reviewAreas[area].href}>{reviewAreas[area].title}</a></li>)}</ul>
    <button className="secondary-button" type="button" onClick={() => setAreas([])}>Đóng thông báo</button>
  </aside>;
}

export function AdminSessionActions() {
  const auth = useAdminSession();
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => () => pending.current?.abort(), []);
  if (!auth) return <>
    <span className={styles.badge}>Chưa tích hợp xác thực</span>
    <Link href="/admin/login" className="secondary-button">Đăng nhập</Link>
    <button type="button" className="secondary-button" disabled>Đăng xuất</button>
  </>;
  const { session, handleError } = auth;
  async function signOut() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      await logoutAdmin(session.csrfToken, controller.signal);
      if (!controller.signal.aborted) window.location.replace("/admin/login");
    } catch (failure) {
      if (!controller.signal.aborted) {
        handleError(failure);
        setError(failure);
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <>
    <span className={styles.badge}>{session.account.displayName} · Admin</span>
    <Link href={passwordChangeRoutes.admin} className="secondary-button">Đổi mật khẩu</Link>
    <button type="button" className="secondary-button" disabled={busy} onClick={() => void signOut()}>
      {busy ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
    {error !== null && <p role="alert">{methodGuideError(error)}</p>}
  </>;
}
