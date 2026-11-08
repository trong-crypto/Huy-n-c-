"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { CLIENT_CONFIG } from "@/config/client";
import { customerAuthRoutes } from "@/config/customerAuthRoutes";
import { loginCustomer, registerCustomer } from "@/services/rest/customerAuth";
import { RestError } from "@/services/rest/transport";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import styles from "./customerAuth.module.css";

const displayName = { key: "displayName", label: "Tên hiển thị", type: "text", autoComplete: "name", requiredError: "Vui lòng nhập tên hiển thị." } as const;
const identifier = { key: "identifier", label: "Tài khoản hoặc email", type: "text", autoComplete: "username", requiredError: "Vui lòng nhập tài khoản hoặc email." } as const;
const password = { key: "password", label: "Mật khẩu", type: "password", requiredError: "Vui lòng nhập mật khẩu." } as const;
const confirmation = { key: "confirmation", label: "Xác nhận mật khẩu", type: "password", autoComplete: "new-password", requiredError: "Vui lòng xác nhận mật khẩu." } as const;

const loginFields = [identifier, { ...password, autoComplete: "current-password" }] as const;
const registrationFields = [displayName, identifier, { ...password, autoComplete: "new-password" }, confirmation] as const;
type FieldKey = (typeof registrationFields)[number]["key"];
type FieldErrors = Partial<Record<FieldKey, string>>;

// Keep the preview form inert until React can handle submit locally.
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CustomerAuthForm({ registering }: { registering: boolean }) {
  const fields = registering ? registrationFields : loginFields;
  const actionLabel = registering ? "Đăng ký" : "Đăng nhập";
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const inputs = useRef<Partial<Record<FieldKey, HTMLInputElement | null>>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setApiError("");
    const nextErrors: FieldErrors = {};
    for (const field of fields) {
      const value = inputs.current[field.key]?.value ?? "";
      if (!(field.type === "text" ? value.trim() : value)) {
        nextErrors[field.key] = field.requiredError;
      } else if (field.key === "identifier" && value.includes("@") && !emailFormat.test(value.trim())) {
        nextErrors.identifier = "Vui lòng nhập email đúng định dạng.";
      } else if (field.key === "confirmation" && value !== inputs.current.password?.value) {
        nextErrors.confirmation = "Mật khẩu xác nhận chưa trùng khớp.";
      }
    }

    const firstError = fields.find(field => nextErrors[field.key]);
    setErrors(nextErrors);
    setValidated(!firstError && !CLIENT_CONFIG.accountHistory);
    if (firstError) {
      inputs.current[firstError.key]?.focus();
      return;
    }

    if (!CLIENT_CONFIG.accountHistory) {
      event.currentTarget.reset();
      return;
    }
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    const credentials = { identifier: inputs.current.identifier!.value, password: inputs.current.password!.value };
    try {
      if (registering) {
        await registerCustomer({ ...credentials, displayName: inputs.current.displayName!.value }, request.signal);
        window.location.assign(customerAuthRoutes.login);
      } else {
        await loginCustomer(credentials, request.signal);
        window.location.assign("/history");
      }
    } catch (failure) {
      if (request.signal.aborted) return;
      const messages: Record<string, string> = {
        INVALID_CREDENTIALS: "Tài khoản hoặc mật khẩu không hợp lệ.",
        IDENTIFIER_TAKEN: "Tài khoản hoặc email đã được sử dụng.",
        INVALID_INPUT: "Kiểm tra tên hiển thị, tài khoản hoặc email và mật khẩu. Mật khẩu đăng ký dài 15–128 ký tự.",
        TOO_MANY_REQUESTS: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
        FORBIDDEN: "Tài khoản này không có quyền đăng nhập tại đây.",
      };
      setApiError(failure instanceof RestError && Object.hasOwn(messages, failure.code)
        ? messages[failure.code] : "Không thể xác nhận yêu cầu. Vui lòng thử lại.");
    } finally {
      if (!request.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  function clearError(key: FieldKey) {
    setErrors(current => ({
      ...current,
      [key]: undefined,
      ...(key === "password" ? { confirmation: undefined } : {}),
    }));
    setValidated(false);
    setApiError("");
  }

  return (
    <form method="post" noValidate onSubmit={submit} aria-label={actionLabel} aria-describedby="customer-auth-availability">
      <fieldset className={`form-stack ${styles.fields}`} disabled={!hydrated || busy}>
        {fields.map(field => {
          const id = `customer-auth-${field.key}`;
          return (
            <FormField key={field.key} id={id} label={field.label}>
              <input id={id} type={field.type} autoComplete={field.autoComplete} required
                ref={input => { inputs.current[field.key] = input; }}
                aria-invalid={errors[field.key] ? true : undefined}
                aria-describedby={errors[field.key] ? `${id}-error` : undefined}
                onChange={() => clearError(field.key)} />
              {errors[field.key] && <FieldError id={`${id}-error`}>{errors[field.key]}</FieldError>}
            </FormField>
          );
        })}
        <PrimaryButton type="submit">{busy ? "Đang gửi…" : actionLabel}</PrimaryButton>
      </fieldset>
      {validated && <p className={styles.feedback} role="status">
        Đã kiểm tra biểu mẫu. Yêu cầu {registering ? "đăng ký" : "đăng nhập"} chưa được gửi vì tính năng đang chờ máy chủ.
      </p>}
      {apiError && <p className={styles.feedback} role="alert">{apiError}</p>}
    </form>
  );
}
