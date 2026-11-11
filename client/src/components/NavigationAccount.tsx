"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import { customerAuthRoutes, passwordChangeRoutes } from "@/config/customerAuthRoutes";
import { getCustomerSession, logoutCustomer } from "@/services/rest/customerAuth";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { useSession } from "@/services/session/SessionProvider";
import { useAuthenticatedSocket } from "@/services/websocket/useAuthenticatedSocket";

function GuestLinks({ pathname }: { pathname: string }) {
  return <>
    <Link href={customerAuthRoutes.login} aria-current={pathname === customerAuthRoutes.login ? "page" : undefined}>
      Đăng nhập
    </Link>
    <Link href={customerAuthRoutes.register} className="navigation-register"
      aria-current={pathname === customerAuthRoutes.register ? "page" : undefined}>
      Đăng ký
    </Link>
  </>;
}

export function NavigationAccount({ pathname }: { pathname: string }) {
  return <div className="navigation-account">
    {CLIENT_CONFIG.accountHistory ? <CustomerAccount pathname={pathname} /> : <GuestLinks pathname={pathname} />}
  </div>;
}

function CustomerAccount({ pathname }: { pathname: string }) {
  const router = useRouter();
  const historySession = useSession();
  const [revision, setRevision] = useState(0);
  const lookup = useLookup(String(revision), getCustomerSession);
  const session = lookup.data;
  const invalidSession = lookup.error instanceof RestError && lookup.error.code === "INVALID_SESSION";
  const [signingOut, setSigningOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [revokedCsrf, setRevokedCsrf] = useState<string>();
  const logoutRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    if (logoutRequest.current) return;
    setSignedOut(false);
    setRevision(value => value + 1);
  }, []);
  const accountId = session?.account.id;
  const role = session?.account.role;
  const csrf = session?.csrfToken;
  const revoked = !!csrf && revokedCsrf === csrf;
  const credentials = useCallback(async (signal: AbortSignal, reconnecting: boolean) => {
    if (csrf && !reconnecting) return csrf;
    const current = await getCustomerSession(signal);
    if (current.account.id !== accountId || current.account.role !== role) throw new RestError("INVALID_SESSION");
    return current.csrfToken;
  }, [accountId, role, csrf]);
  useAuthenticatedSocket({
    endpoint: "account",
    credentials: accountId && !signedOut && !revoked ? credentials : null,
    onAccessError: code => {
      setRevokedCsrf(csrf);
      historySession?.invalidate(new RestError(code));
    },
  });

  useEffect(() => {
    function restore(event: PageTransitionEvent) {
      if (event.persisted) refresh();
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", restore);
      logoutRequest.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!session || signedOut) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = window.setTimeout(refresh, Math.max(0, Math.min(remaining, 2_147_483_647)));
    return () => window.clearTimeout(timer);
  }, [session, signedOut, refresh]);

  useEffect(() => {
    if (invalidSession && historySession?.status === "ready") historySession.invalidate(lookup.error);
  }, [invalidSession, historySession, lookup.error]);

  async function signOut() {
    if (!session || logoutRequest.current) return;
    const request = new AbortController();
    logoutRequest.current = request;
    setSigningOut(true);
    setLogoutFailed(false);
    try {
      await logoutCustomer(session.csrfToken, request.signal);
    } catch (error) {
      if (request.signal.aborted) return;
      if (!(error instanceof RestError) || error.code !== "INVALID_SESSION") {
        setLogoutFailed(true);
        setRevision(value => value + 1);
        return;
      }
    } finally {
      logoutRequest.current = null;
      if (!request.signal.aborted) setSigningOut(false);
    }
    if (request.signal.aborted) return;
    setSignedOut(true);
    historySession?.invalidate(new RestError("INVALID_SESSION"));
    router.replace(customerAuthRoutes.login);
  }

  if (signedOut || invalidSession || revoked) {
    return <GuestLinks pathname={pathname} />;
  }
  return <>
    {lookup.status === "loading" && <span className="navigation-session-status" role="status">Đang kiểm tra phiên…</span>}
    {lookup.status === "failed" && <>
      <span className="navigation-session-status" role="status">Chưa xác minh được phiên.</span>
      <button type="button" onClick={refresh}>Thử lại</button>
    </>}
    {session && <>
      <span className="navigation-account-name" title={session.account.displayName}>{session.account.displayName}</span>
      <Link href={passwordChangeRoutes.customer} aria-current={pathname === passwordChangeRoutes.customer ? "page" : undefined}>
        Đổi mật khẩu
      </Link>
      <button type="button" disabled={signingOut} onClick={() => void signOut()}>
        {signingOut ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
    </>}
    {logoutFailed && <p className="navigation-session-status" role="alert">Chưa xác nhận được đăng xuất.</p>}
  </>;
}
