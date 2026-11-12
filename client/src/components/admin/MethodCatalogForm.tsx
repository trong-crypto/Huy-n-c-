"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import { createMethod, methodCatalogError, methodGroups, updateMethod, validMethodCode,
  type MethodDetail, type MethodGroup, type MethodInput } from "@/services/rest/methodCatalog";
import { RestError } from "@/services/rest/transport";
import { cmsFieldProps, cmsTextError, stripCmsText } from "./adminContentValidation";
import styles from "./admin.module.css";

const fields = {
  name: { label: "Tên phương pháp", limit: 120, optional: false, multiline: false },
  summary: { label: "Mô tả ngắn", limit: 500, optional: false, multiline: false },
  requiredInput: { label: "Thông tin đầu vào", limit: 500, optional: true, multiline: false },
  introduction: { label: "Nội dung giới thiệu", limit: 4000, optional: true, multiline: true },
  instructions: { label: "Hướng dẫn và các bước thực hiện", limit: 6000, optional: true, multiline: true },
} as const;
type TextField = keyof typeof fields;

const initialInput: MethodInput = {
  name: "", group: "OTHER", summary: "", requiredInput: "", introduction: "", instructions: "", listed: false,
};

export function MethodCatalogForm({ initial, listedOverride, csrf, handleError, onSaved, onCancel }: {
  initial?: MethodDetail;
  listedOverride?: boolean;
  csrf: string;
  handleError: (failure: unknown) => void;
  onSaved: (detail: MethodDetail, created: boolean) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.method.code ?? "");
  const [input, setInput] = useState<MethodInput>(() => initial ? {
    name: initial.method.name, group: initial.method.group, summary: initial.method.summary,
    requiredInput: initial.requiredInput, introduction: initial.introduction, instructions: initial.instructions,
    listed: listedOverride ?? (initial.method.state === "LISTED"),
  } : initialInput);
  const [errors, setErrors] = useState<Partial<Record<TextField | "code", string>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const builtIn = !!initial?.method.formPath;
  const stale = failure instanceof RestError && ["VERSION_CONFLICT", "NOT_FOUND"].includes(failure.code);

  useEffect(() => {
    heading.current?.focus();
    return () => pending.current?.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || stale) return;
    const normalizedCode = code.trim().toUpperCase();
    const nextErrors: typeof errors = {};
    if (!validMethodCode(normalizedCode)) nextErrors.code = "Dùng 2–32 ký tự A–Z, 0–9 hoặc dấu gạch dưới, bắt đầu bằng chữ.";
    for (const key of Object.keys(fields) as TextField[]) {
      const { limit, label, multiline, optional } = fields[key];
      const message = cmsTextError(input[key], limit, label, multiline, optional);
      if (message) nextErrors[key] = message;
    }
    setFailure(null);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      event.currentTarget.querySelector<HTMLElement>(`#method-editor-${first}`)?.focus();
      return;
    }
    const values: MethodInput = { ...input };
    for (const key of Object.keys(fields) as TextField[]) values[key] = stripCmsText(input[key]);
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    try {
      const result = initial
        ? await updateMethod(initial.method.code, initial.method.version, values, csrf, request.signal)
        : await createMethod(normalizedCode, values, csrf, request.signal);
      if (!request.signal.aborted) onSaved(result, !initial);
    } catch (error) {
      if (!request.signal.aborted) { setFailure(error); handleError(error); }
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return <section className={styles.contentPanel} aria-labelledby="method-form-title">
    <h2 id="method-form-title" ref={heading} tabIndex={-1}>{initial ? "Chỉnh sửa phương pháp" : "Thêm phương pháp"}</h2>
    <form onSubmit={submit} noValidate aria-label={initial ? "Chỉnh sửa phương pháp" : "Thêm phương pháp"}>
      {failure !== null && <p role="alert">{methodCatalogError(failure)}</p>}
      <fieldset className={styles.methodEditorFields} disabled={busy}>
        <FormField id="method-editor-code" label="Mã định danh" hint={initial ? "Mã được giữ cố định." : "Ví dụ XEM_QUA_SO"}>
          <input id="method-editor-code" value={code} readOnly={!!initial} required
            {...cmsFieldProps("method-editor-code", errors.code ?? "")}
            onChange={event => { setCode(event.target.value); setErrors(current => ({ ...current, code: undefined })); }} />
          {errors.code && <FieldError id="method-editor-code-error">{errors.code}</FieldError>}
        </FormField>
        <FormField id="method-editor-group" label="Nhóm phương pháp">
          <select id="method-editor-group" value={input.group} disabled={builtIn}
            onChange={event => setInput(current => ({ ...current, group: event.target.value as MethodGroup }))}>
            {Object.entries(methodGroups).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </FormField>
        {(Object.keys(fields) as TextField[]).map(key => {
          const field = fields[key];
          const id = `method-editor-${key}`;
          const props = { id, value: input[key], required: !field.optional, ...cmsFieldProps(id, errors[key] ?? ""),
            onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              setInput(current => ({ ...current, [key]: event.target.value }));
              setErrors(current => ({ ...current, [key]: undefined }));
            } };
          return <div key={key} className={field.multiline || key === "summary" ? styles.fullRow : undefined}>
            <FormField id={id} label={field.label}>
              {field.multiline ? <textarea rows={4} {...props} /> : <input {...props} />}
              {errors[key] && <FieldError id={`${id}-error`}>{errors[key]}</FieldError>}
            </FormField>
          </div>;
        })}
        {builtIn ? <FormField id="method-editor-listed" label="Trạng thái hiển thị"
          hint="Ẩn khỏi danh mục vẫn giữ biểu mẫu, bộ tính và lịch sử.">
          <select id="method-editor-listed" value={String(input.listed)}
            onChange={event => setInput(current => ({ ...current, listed: event.target.value === "true" }))}>
            <option value="true">Đang hiển thị</option><option value="false">Đã ẩn</option>
          </select>
        </FormField> : <p className={styles.notice}>Chưa khả dụng. Phương pháp sẽ xuất hiện trong danh mục công khai sau khi có bộ tính được tích hợp.</p>}
      </fieldset>
      <div className={styles.contentActions}>
        <PrimaryButton type="submit" disabled={busy || stale}>{busy ? "Đang lưu…" : "Lưu phương pháp"}</PrimaryButton>
        <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>{stale ? "Tải lại chi tiết" : "Hủy"}</button>
      </div>
    </form>
  </section>;
}
