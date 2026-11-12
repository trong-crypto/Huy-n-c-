"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import { changePassword, requestPasswordChange, type PasswordRealm } from "@/services/rest/passwordChange";
import { RestError } from "@/services/rest/transport";
import styles from "./customerAuth.module.css";

const fields = [
  { key: "currentPassword", label: "Mật khẩu hiện tại", autoComplete: "current-password" },
  { key: "newPassword", label: "Mật khẩu mới", autoComplete: "new-password", hint: "Từ 8 đến 128 ký tự." },
  { key: "confirmation", label: "Xác nhận mật khẩu mới", autoComplete: "new-password" },
] as const;
type Field = (typeof fields)[number]["key"];
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const errorsByCode: Record<string, string> = {
  INVALID_CREDENTIALS: "Mật khẩu hiện tại không đúng.",
  INVALID_INPUT: "Kiểm tra mật khẩu hiện tại và độ dài mật khẩu mới từ 8 đến 128 ký tự.",
  INVALID_SESSION: "Phiên đã hết hiệu lực. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Tài khoản không có quyền đổi mật khẩu tại đây.",
  CSRF_REJECTED: "Không xác minh được yêu cầu. Hãy tải lại trang và thử lại.",
  TOO_MANY_REQUESTS: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.",
  REQUEST_TIMEOUT: "Chưa xác nhận được kết quả. Hãy kiểm tra phiên trước khi thử lại.",
  PASSWORD_REQUEST_PENDING: "Bạn đã có yêu cầu đổi mật khẩu đang chờ Admin xử lý.",
};

function changedFromUrl() {
  return new URLSearchParams(window.location.search).get("passwordChanged") === "1";
}

export function PasswordChangedNotice() {
  const changed = useSyncExternalStore(subscribe, changedFromUrl, serverSnapshot);
  return changed ? <p className="status-banner" role="status">Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.</p> : null;
}

export function PasswordChangeForm({ realm, csrfToken, loginUrl }: {
  realm: PasswordRealm; csrfToken: string; loginUrl: string;
}) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [visible, setVisible] = useState<Partial<Record<Field, boolean>>>({});
  const [failure, setFailure] = useState("");
  const [requested, setRequested] = useState(false);
  const expired = failure === "INVALID_SESSION";
  useEffect(() => () => pending.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || expired) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const reviewRequired = realm === "customer" && submitter instanceof HTMLButtonElement && submitter.value === "request";
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get("currentPassword") ?? "");
    const newPassword = String(values.get("newPassword") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    const next: Partial<Record<Field, string>> = {};
    const length = Array.from(newPassword).length;
    if (!currentPassword) next.currentPassword = "Vui lòng nhập mật khẩu hiện tại.";
    if (length < 8 || length > 128) next.newPassword = "Mật khẩu mới cần từ 8 đến 128 ký tự.";
    if (confirmation !== newPassword) next.confirmation = "Mật khẩu xác nhận chưa trùng khớp.";
    setErrors(next);
    setFailure("");
    setRequested(false);
    const first = fields.find(field => next[field.key]);
    if (first) {
      (form.elements.namedItem(first.key) as HTMLInputElement | null)?.focus();
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      if (reviewRequired) {
        await requestPasswordChange({ currentPassword, newPassword }, csrfToken, controller.signal);
        if (controller.signal.aborted) return;
        form.reset();
        setVisible({});
        setRequested(true);
        return;
      }
      await changePassword(realm, { currentPassword, newPassword }, csrfToken, controller.signal);
      if (controller.signal.aborted) return;
      form.reset();
      setVisible({});
      // A full navigation discards the account and CSRF state from this document.
      window.location.replace(`${loginUrl}?passwordChanged=1`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure(error instanceof RestError ? error.code : "NETWORK_ERROR");
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  return <form method="post" aria-label="Đổi mật khẩu" onSubmit={submit} noValidate>
    <fieldset className={`form-stack ${styles.fields}`} disabled={!hydrated || busy || expired}>
      {fields.map(field => {
        const id = `password-change-${field.key}`;
        const hint = "hint" in field ? field.hint : undefined;
        const shown = Boolean(visible[field.key]);
        const error = errors[field.key];
        const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
        return <FormField key={field.key} id={id} label={field.label} hint={hint}>
          <input id={id} name={field.key} type={shown ? "text" : "password"} autoComplete={field.autoComplete}
            required aria-invalid={error ? true : undefined} aria-describedby={description || undefined}
            onChange={() => { setErrors({}); setFailure(""); }} />
          <button type="button" className={styles.passwordToggle} aria-controls={id}
            aria-label={`${shown ? "Ẩn" : "Hiện"} ${field.label.toLocaleLowerCase("vi")}`}
            onClick={() => setVisible(previous => ({ ...previous, [field.key]: !shown }))}>
            {shown ? "Ẩn" : "Hiện"}
          </button>
          {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
        </FormField>;
      })}
      <PrimaryButton type="submit">{busy ? "Đang lưu…" : "Lưu mật khẩu"}</PrimaryButton>
      {realm === "customer" && <button type="submit" value="request" className="secondary-button">Gửi yêu cầu đổi mật khẩu</button>}
    </fieldset>
    {failure && <p className={styles.feedback} role="alert">{Object.hasOwn(errorsByCode, failure)
      ? errorsByCode[failure] : "Không thể xác nhận yêu cầu. Vui lòng thử lại."}</p>}
    {requested && <p className={styles.feedback} role="status">Đã gửi yêu cầu. Mật khẩu mới có hiệu lực sau khi Admin duyệt.</p>}
    {expired && <Link href={loginUrl} className={styles.link}>Đăng nhập lại</Link>}
  </form>;
}
