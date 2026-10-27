"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionResult } from "@/types/contract";
import { bootstrapSession, historyErrorMessage } from "@/services/rest/history";
import { RestError } from "@/services/rest/transport";

type SessionState = { status: "loading" | "failed" | "invalid"; data: null; error: unknown } | { status: "ready"; data: SessionResult; error: null };
type Context = SessionState & { revision: number; retry: () => void; invalidate: (error: unknown) => void; handleError: (error: unknown) => void };
const SessionContext = createContext<Context | null>(null);
export const useSession = () => useContext(SessionContext);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<SessionState>({ status: "loading", data: null, error: null });
  const generation = useRef(0);
  const bootstrap = useRef<{ attempt: number; controller: AbortController; promise: Promise<SessionResult> | null } | null>(null);
  const invalidate = useCallback((error: unknown) => {
    generation.current++; bootstrap.current?.controller.abort(); bootstrap.current = null;
    setRevision(value => value + 1); setState({ status: "invalid", data: null, error });
  }, []);
  const handleError = useCallback((error: unknown) => { if (error instanceof RestError && ["INVALID_SESSION", "CSRF_REJECTED"].includes(error.code)) invalidate(error); }, [invalidate]);
  useEffect(() => {
    const id = ++generation.current;
    if (!bootstrap.current?.promise || bootstrap.current.attempt !== attempt || bootstrap.current.controller.signal.aborted) {
      bootstrap.current?.controller.abort();
      const controller = new AbortController();
      bootstrap.current = { attempt, controller, promise: bootstrapSession(controller.signal) };
    }
    const current = bootstrap.current;
    current.promise!.then(data => {
      if (generation.current !== id) return;
      current.promise = null;
      if (Date.parse(data.expiresAt) <= Date.now()) { invalidate(new RestError("INVALID_SESSION")); return; }
      setRevision(value => value + 1); setState({ status: "ready", data, error: null });
    }, error => { if (generation.current === id) { current.promise = null; setState({ status: error instanceof RestError && ["INVALID_SESSION", "CSRF_REJECTED"].includes(error.code) ? "invalid" : "failed", data: null, error }); } });
    return () => {
      const cleanupId = ++generation.current;
      // StrictMode's immediate remount reuses the same bootstrap; real unmount aborts it.
      queueMicrotask(() => { if (generation.current === cleanupId) current.controller.abort(); });
    };
  }, [attempt, invalidate]);
  useEffect(() => {
    if (state.status !== "ready") return;
    let timer: ReturnType<typeof setTimeout>;
    function checkExpiry() {
      if (state.status !== "ready") return;
      const remaining = Date.parse(state.data.expiresAt) - Date.now();
      if (remaining <= 0) invalidate(new RestError("INVALID_SESSION"));
      else timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_000_000));
    }
    checkExpiry(); return () => clearTimeout(timer);
  }, [state, invalidate]);
  function retry() { setState({ status: "loading", data: null, error: null }); setRevision(value => value + 1); setAttempt(value => value + 1); }
  return <SessionContext.Provider value={{ ...state, revision, retry, invalidate, handleError }}>{children}</SessionContext.Provider>;
}
export function SessionNotice() {
  const session = useSession();
  if (!session || session.status === "ready") return null;
  return <div className="session-notice"><p role="status">{session.status === "loading" ? "Đang khởi tạo phiên riêng tư…" : historyErrorMessage(session.error)}</p>
    {session.status !== "loading" && <button type="button" className="secondary-button" onClick={session.retry}>Kiểm tra lại phiên</button>}
    <p className="field-hint">Lịch sử gắn với phiên của trình duyệt này. Nếu xóa dữ liệu trình duyệt, bạn có thể mất quyền truy cập lịch sử.</p></div>;
}
