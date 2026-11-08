"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLookup } from "@/services/rest/useLookup";
import { logoutAdmin, methodGuideError, readAdminSession, type AdminSession } from "@/services/rest/methodGuides";
import { RestError } from "@/services/rest/transport";
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
  return <AdminContext.Provider value={{ session, handleError }}>{children}</AdminContext.Provider>;
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
    <button type="button" className="secondary-button" disabled={busy} onClick={() => void signOut()}>
      {busy ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
    {error !== null && <p role="alert">{methodGuideError(error)}</p>}
  </>;
}
