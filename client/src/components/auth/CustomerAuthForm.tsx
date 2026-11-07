"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    setValidated(!firstError);
    if (firstError) {
      inputs.current[firstError.key]?.focus();
      return;
    }

    event.currentTarget.reset();
  }

  function clearError(key: FieldKey) {
    setErrors(current => ({
      ...current,
      [key]: undefined,
      ...(key === "password" ? { confirmation: undefined } : {}),
    }));
    setValidated(false);
  }

  return (
    <form method="post" noValidate onSubmit={submit} aria-label={actionLabel} aria-describedby="customer-auth-availability">
      <fieldset className={`form-stack ${styles.fields}`} disabled={!hydrated}>
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
        <PrimaryButton type="submit">{actionLabel}</PrimaryButton>
      </fieldset>
      {validated && <p className={styles.feedback} role="status">
        Đã kiểm tra biểu mẫu. Yêu cầu {registering ? "đăng ký" : "đăng nhập"} chưa được gửi vì tính năng đang chờ máy chủ.
      </p>}
    </form>
  );
}
