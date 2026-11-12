"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FormField, PrimaryButton } from "@/components/ui/Controls";
import { recoverPassword } from "@/services/rest/passwordChange";
import { RestError } from "@/services/rest/transport";
import styles from "./customerAuth.module.css";

export function PasswordRecoveryForm() {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [complete, setComplete] = useState(false);
  useEffect(() => () => pending.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || complete) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const identifier = String(values.get("identifier") ?? "").trim();
    const code = String(values.get("code") ?? "").trim();
    const newPassword = String(values.get("newPassword") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    if (!identifier || !/^[A-Za-z0-9_-]{43}$/.test(code) || Array.from(newPassword).length < 8
        || Array.from(newPassword).length > 128 || confirmation !== newPassword) {
      setFailure("Kiểm tra định danh, mã khôi phục và mật khẩu mới (8–128 ký tự); hai mật khẩu phải trùng nhau.");
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFailure("");
    try {
      await recoverPassword({ identifier, code, newPassword }, controller.signal);
      if (!controller.signal.aborted) { form.reset(); setComplete(true); }
    } catch (error) {
      if (!controller.signal.aborted) setFailure(error instanceof RestError && error.code === "INVALID_RECOVERY"
        ? "Mã khôi phục không hợp lệ hoặc đã hết hạn. Hãy liên hệ quản trị viên để được cấp mã mới."
        : error instanceof RestError && error.code === "TOO_MANY_REQUESTS"
          ? "Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại."
          : "Không thể đặt lại mật khẩu. Hãy kiểm tra kết nối và thử lại.");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return complete ? <><p role="status">Đã đặt mật khẩu mới và đăng xuất các phiên cũ.</p>
    <Link className={styles.link} href="/dang-nhap">Đăng nhập bằng mật khẩu mới</Link></>
    : <form method="post" className="form-stack" onSubmit={submit} noValidate>
      <fieldset className={`form-stack ${styles.fields}`} disabled={busy}>
        <FormField id="recovery-identifier" label="Tài khoản hoặc email">
          <input id="recovery-identifier" name="identifier" autoComplete="username" required maxLength={254} />
        </FormField>
        <FormField id="recovery-code" label="Mã khôi phục do Admin cấp">
          <input id="recovery-code" name="code" autoComplete="off" required maxLength={43} spellCheck={false} />
        </FormField>
        <FormField id="recovery-password" label="Mật khẩu mới">
          <input id="recovery-password" name="newPassword" type="password" autoComplete="new-password" required />
        </FormField>
        <FormField id="recovery-confirmation" label="Xác nhận mật khẩu mới">
          <input id="recovery-confirmation" name="confirmation" type="password" autoComplete="new-password" required />
        </FormField>
        <PrimaryButton type="submit">{busy ? "Đang xác nhận…" : "Đặt lại mật khẩu"}</PrimaryButton>
      </fieldset>
      {failure && <p role="alert" className={styles.feedback}>{failure}</p>}
      <Link className={styles.link} href="/dang-nhap">Về trang đăng nhập</Link>
    </form>;
}
