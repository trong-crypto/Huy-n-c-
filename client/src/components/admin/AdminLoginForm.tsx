"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import { CLIENT_CONFIG } from "@/config/client";
import { loginAdmin, methodGuideError } from "@/services/rest/methodGuides";
import styles from "./admin.module.css";

export function AdminLoginForm() {
  const account = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState({ account: false, password: false });
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    setReady(true);
    return () => pending.current?.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.current || !password.current || pending.current) return;
    setServerError(null);

    const missingAccount = account.current.value.trim().length === 0;
    const missingPassword = password.current.value.length === 0;
    setErrors({ account: missingAccount, password: missingPassword });
    setValidated(!missingAccount && !missingPassword && !CLIENT_CONFIG.adminEnabled);
    if (missingAccount || missingPassword) {
      (missingAccount ? account.current : password.current).focus();
      return;
    }
    if (!CLIENT_CONFIG.adminEnabled) {
      password.current.value = "";
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      await loginAdmin(account.current.value, password.current.value, controller.signal);
      if (!controller.signal.aborted) window.location.replace(CLIENT_CONFIG.adminAccounts ? "/admin/users"
        : CLIENT_CONFIG.methodGuides ? "/admin/methods"
          : CLIENT_CONFIG.adminHexagramGlosses ? "/admin/readings"
            : CLIENT_CONFIG.adminSourceCatalog ? "/admin/sources" : "/admin/website");
    } catch (failure) {
      if (!controller.signal.aborted) setServerError(failure);
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) {
        if (password.current) password.current.value = "";
        setBusy(false);
      }
    }
  }

  return <form className="form-stack" aria-label="Biểu mẫu đăng nhập quản trị" aria-describedby="admin-login-availability"
    autoComplete="off" method="post" noValidate onSubmit={submit}>
    <FormField id="admin-account" label="Tài khoản">
      <input ref={account} id="admin-account" type="text" required autoComplete="username" disabled={busy}
        aria-invalid={errors.account || undefined} aria-describedby={errors.account ? "admin-account-error" : undefined}
        onChange={() => { setErrors(current => ({ ...current, account: false })); setValidated(false); }} />
      {errors.account && <FieldError id="admin-account-error">Vui lòng nhập tài khoản.</FieldError>}
    </FormField>
    <FormField id="admin-password" label="Mật khẩu">
      <input ref={password} id="admin-password" type="password" required autoComplete="current-password" disabled={busy}
        aria-invalid={errors.password || undefined} aria-describedby={errors.password ? "admin-password-error" : undefined}
        onChange={() => { setErrors(current => ({ ...current, password: false })); setValidated(false); }} />
      {errors.password && <FieldError id="admin-password-error">Vui lòng nhập mật khẩu.</FieldError>}
    </FormField>
    <PrimaryButton type="submit" disabled={busy || !ready}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</PrimaryButton>
    {validated && <p className={styles.notice} role="status">Đã kiểm tra dữ liệu nhập. Đăng nhập đang chờ tích hợp Backend.</p>}
    {serverError !== null && <p className={styles.notice} role="alert">{methodGuideError(serverError)}</p>}
  </form>;
}
