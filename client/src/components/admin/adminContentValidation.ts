export type ContentDraft = { title: string; body: string; provenance: string; visibility: "visible" | "hidden" };

export const contentLimits = { title: 120, body: 6000, provenance: 500 };

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
