import { RestError } from "@/services/rest/transport";

export type ContentDraft = { title: string; body: string; provenance: string; visibility: "visible" | "hidden" };

export const contentLimits = { title: 120, body: 6000, provenance: 500 };

export function stripCmsText(value: string) {
  // Match Java String.strip() while leaving non-breaking spaces in the content.
  return value.replace(/^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+$/gu, "");
}

export function cmsTextError(raw: string, limit: number, label: string, multiline = false, optional = false) {
  if (/[\p{Cc}\p{Cs}]/u.test(multiline ? raw.replace(/[\t\r\n]/g, "") : raw)) return `${label} chứa ký tự không hợp lệ.`;
  const value = stripCmsText(raw);
  if (!value && !optional) return `Vui lòng nhập ${label.toLocaleLowerCase("vi")}.`;
  if ([...value].length > limit) return `${label} tối đa ${limit} ký tự.`;
  return "";
}

export function cmsFieldError<T extends Record<string, string>>(error: unknown, messages: T) {
  if (!(error instanceof RestError) || !["INVALID_INPUT", "INVALID_SOURCE"].includes(error.code)) return null;
  const field = error.apiError?.reason;
  if (field === undefined || field === null || !Object.hasOwn(messages, field)) return null;
  return { field, message: messages[field] };
}

export function cmsFieldProps(id: string, error: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}

export function validateContentDraft(draft: ContentDraft, requiresProvenance: boolean) {
  const errors: Partial<Record<"title" | "body" | "provenance", string>> = {};
  if (!draft.title.trim()) errors.title = "Vui lòng nhập tiêu đề.";
  else if (draft.title.trim().length > contentLimits.title) errors.title = `Tiêu đề tối đa ${contentLimits.title} ký tự.`;
  if (!draft.body.trim()) errors.body = "Vui lòng nhập nội dung.";
  else if (draft.body.trim().length > contentLimits.body) errors.body = `Nội dung tối đa ${contentLimits.body} ký tự.`;
  if (requiresProvenance && !draft.provenance.trim()) errors.provenance = "Vui lòng ghi nguồn hoặc xuất xứ.";
  else if (draft.provenance.trim().length > contentLimits.provenance) errors.provenance = `Nguồn tối đa ${contentLimits.provenance} ký tự.`;
  return errors;
}
