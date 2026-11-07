"use client";

import { useState, type FormEvent } from "react";
import { FieldError, FormField } from "@/components/ui/Controls";
import { contentLimits, validateContentDraft, type ContentDraft } from "./adminContentValidation";
import styles from "./admin.module.css";

export function AdminContentForm({ heading, initialTitle = "", initialBody = "", requiresProvenance = false, hasVisibility = false }: {
  heading: string;
  initialTitle?: string;
  initialBody?: string;
  requiresProvenance?: boolean;
  hasVisibility?: boolean;
}) {
  const [draft, setDraft] = useState<ContentDraft>({ title: initialTitle, body: initialBody, provenance: "", visibility: "visible" });
  const [preview, setPreview] = useState<ContentDraft | null>(null);
  const [validated, setValidated] = useState(false);
  const errors = validated ? validateContentDraft(draft, requiresProvenance) : {};

  function update<K extends keyof ContentDraft>(field: K, value: ContentDraft[K]) {
    setDraft(current => ({ ...current, [field]: value }));
    setPreview(null);
  }

  function showPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidated(true);
    const invalid = Object.keys(validateContentDraft(draft, requiresProvenance))[0];
    if (invalid) {
      event.currentTarget.querySelector<HTMLElement>(`#content-${invalid}`)?.focus();
      return;
    }
    setPreview({ ...draft, title: draft.title.trim(), body: draft.body.trim(), provenance: draft.provenance.trim() });
  }

  return <section className={styles.contentPanel} aria-labelledby="content-form-title">
    <h2 id="content-form-title">{heading}</h2>
    <p className="field-hint">Bản nhập chỉ có trên trang này và sẽ mất khi chuyển mục hoặc tải lại.</p>
    <form className="form-stack" onSubmit={showPreview} noValidate>
      <FormField id="content-title" label="Tiêu đề">
        <input id="content-title" value={draft.title} required maxLength={contentLimits.title} onChange={event => update("title", event.target.value)}
          aria-invalid={!!errors.title || undefined} aria-describedby={errors.title ? "content-title-error" : undefined} />
        {errors.title && <FieldError id="content-title-error">{errors.title}</FieldError>}
      </FormField>
      <FormField id="content-body" label="Nội dung">
        <textarea id="content-body" value={draft.body} required rows={5} maxLength={contentLimits.body} onChange={event => update("body", event.target.value)}
          aria-invalid={!!errors.body || undefined} aria-describedby={errors.body ? "content-body-error" : undefined} />
        {errors.body && <FieldError id="content-body-error">{errors.body}</FieldError>}
      </FormField>
      {requiresProvenance && <FormField id="content-provenance" label="Nguồn hoặc xuất xứ">
        <textarea id="content-provenance" value={draft.provenance} required rows={2} maxLength={contentLimits.provenance} onChange={event => update("provenance", event.target.value)}
          aria-invalid={!!errors.provenance || undefined} aria-describedby={errors.provenance ? "content-provenance-error" : undefined} />
        {errors.provenance && <FieldError id="content-provenance-error">{errors.provenance}</FieldError>}
      </FormField>}
      {hasVisibility && <FormField id="content-visibility" label="Hiển thị đề xuất">
        <select id="content-visibility" value={draft.visibility} onChange={event => update("visibility", event.target.value === "hidden" ? "hidden" : "visible")}>
          <option value="visible">Hoạt động</option><option value="hidden">Ẩn</option>
        </select>
      </FormField>}
      <div className={styles.contentActions}>
        <button type="submit" className="primary-button">Xem trước</button>
        <button type="button" className="secondary-button" aria-describedby="content-write-notice" disabled>Lưu bản nháp</button>
      </div>
    </form>
    {preview && <section className={styles.preview} aria-labelledby="content-preview-title">
      <h3 id="content-preview-title">Xem trước trên trang này</h3>
      <p role="status">Đang xem trước · Chưa lưu</p>
      <strong>{preview.title}</strong><p>{preview.body}</p>
      {preview.provenance && <p>Nguồn hoặc xuất xứ: {preview.provenance}</p>}
      {hasVisibility && <p>Hiển thị đề xuất: {preview.visibility === "hidden" ? "Ẩn" : "Hoạt động"}</p>}
    </section>}
  </section>;
}
