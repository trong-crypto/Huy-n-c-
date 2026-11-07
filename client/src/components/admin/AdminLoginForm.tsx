"use client";

import { useRef, useState, type FormEvent } from "react";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import styles from "./admin.module.css";

export function AdminLoginForm() {
  const account = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState({ account: false, password: false });
  const [validated, setValidated] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.current || !password.current) return;

    const missingAccount = account.current.value.trim().length === 0;
    const missingPassword = password.current.value.length === 0;
    setErrors({ account: missingAccount, password: missingPassword });
    setValidated(!missingAccount && !missingPassword);
    if (missingAccount || missingPassword) {
      (missingAccount ? account.current : password.current).focus();
      return;
    }
    password.current.value = "";
  }

  return <form className="form-stack" aria-label="Biểu mẫu đăng nhập quản trị" aria-describedby="admin-login-availability"
    autoComplete="off" method="post" noValidate onSubmit={submit}>
    <FormField id="admin-account" label="Tài khoản">
      <input ref={account} id="admin-account" type="text" required autoComplete="off"
        aria-invalid={errors.account || undefined} aria-describedby={errors.account ? "admin-account-error" : undefined}
        onChange={() => { setErrors(current => ({ ...current, account: false })); setValidated(false); }} />
      {errors.account && <FieldError id="admin-account-error">Vui lòng nhập tài khoản.</FieldError>}
    </FormField>
    <FormField id="admin-password" label="Mật khẩu">
      <input ref={password} id="admin-password" type="password" required autoComplete="off"
        aria-invalid={errors.password || undefined} aria-describedby={errors.password ? "admin-password-error" : undefined}
        onChange={() => { setErrors(current => ({ ...current, password: false })); setValidated(false); }} />
      {errors.password && <FieldError id="admin-password-error">Vui lòng nhập mật khẩu.</FieldError>}
    </FormField>
    <PrimaryButton type="submit">Đăng nhập</PrimaryButton>
    {validated && <p className={styles.notice} role="status">Đã kiểm tra dữ liệu nhập. Đăng nhập đang chờ tích hợp Backend.</p>}
  </form>;
}
