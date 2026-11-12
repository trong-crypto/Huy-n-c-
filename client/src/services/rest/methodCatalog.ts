import { isRecord } from "@/types/contractValidation";
import { adminOptions, isPage, methodGuideError, type Page } from "./methodGuides";
import { requestJson, RestError } from "./transport";

const path = "/admin/methods";
export const methodGroups = { MAI_HOA: "Mai Hoa", TAM_THE: "Tam Thế", OTHER: "Khác" } as const;
export const methodStates = { LISTED: "Đang hiển thị", HIDDEN: "Đã ẩn", UNAVAILABLE: "Chưa khả dụng" } as const;
export type MethodGroup = keyof typeof methodGroups;
export type MethodState = keyof typeof methodStates;
export type MethodSummary = { code: string; group: MethodGroup; name: string; summary: string; state: MethodState;
  version: number; formPath: "/mai-hoa" | "/tam-the" | null; guideSupported: boolean };
export type MethodDetail = { method: MethodSummary; introduction: string; instructions: string; requiredInput: string };
export type MethodInput = Pick<MethodDetail, "introduction" | "instructions" | "requiredInput">
  & Pick<MethodSummary, "name" | "summary" | "group"> & { listed: boolean };
export type MethodFilters = { q: string; group: MethodGroup | ""; state: MethodState | ""; page: number };

export const validMethodCode = (value: string) => /^[A-Z][A-Z0-9_]{1,31}$/.test(value);

function isMethod(value: unknown): value is MethodSummary {
  return isRecord(value) && typeof value.code === "string" && validMethodCode(value.code)
    && typeof value.group === "string" && Object.hasOwn(methodGroups, value.group)
    && typeof value.state === "string" && Object.hasOwn(methodStates, value.state)
    && typeof value.name === "string" && typeof value.summary === "string"
    && typeof value.version === "number" && Number.isSafeInteger(value.version) && value.version > 0
    && (value.formPath === null || value.formPath === "/mai-hoa" || value.formPath === "/tam-the")
    && (value.state === "UNAVAILABLE") === (value.formPath === null) && typeof value.guideSupported === "boolean";
}

const isDetail = (value: unknown): value is MethodDetail => isRecord(value) && isMethod(value.method)
  && typeof value.introduction === "string" && typeof value.instructions === "string" && typeof value.requiredInput === "string";

export function listMethods(filters: MethodFilters, signal: AbortSignal) {
  const query = new URLSearchParams({ page: String(filters.page) });
  if (filters.q) query.set("q", filters.q);
  if (filters.group) query.set("group", filters.group);
  if (filters.state) query.set("state", filters.state);
  return requestJson(`${path}?${query}`, (value): value is Page<MethodSummary> => isPage(value, isMethod),
    signal, undefined, adminOptions());
}

const methodPath = (code: string) => `${path}/${encodeURIComponent(code)}`;
const forCode = (code: string) => (value: unknown): value is MethodDetail =>
  isDetail(value) && value.method.code === code;

export const readMethod = (code: string, signal: AbortSignal) =>
  requestJson(methodPath(code), forCode(code), signal, undefined, adminOptions());
export const createMethod = (code: string, input: MethodInput, csrf: string, signal: AbortSignal) =>
  requestJson(path, forCode(code), signal, { code, ...input }, { ...adminOptions(csrf), successStatus: 201 });
export const updateMethod = (code: string, version: number, input: MethodInput, csrf: string, signal: AbortSignal) =>
  requestJson(methodPath(code), forCode(code), signal, { expectedVersion: version, ...input }, { ...adminOptions(csrf), method: "PUT" });

export function deleteMethod(code: string, version: number, csrf: string, signal: AbortSignal) {
  return requestJson(methodPath(code), (value): value is { deleted: true } => isRecord(value) && value.deleted === true,
    signal, { expectedVersion: version }, { ...adminOptions(csrf), method: "DELETE" });
}

export function listPublicMethods(signal: AbortSignal) {
  return requestJson("/methods", (value): value is { items: MethodDetail[] } => isRecord(value) && Array.isArray(value.items)
    && value.items.every(item => isDetail(item) && item.method.state === "LISTED"), signal);
}

export function methodCatalogError(error: unknown) {
  const messages: Record<string, string> = {
    METHOD_EXISTS: "Mã phương pháp đã được sử dụng.",
    METHOD_PROTECTED: "Phương pháp lõi chỉ có thể ẩn khỏi danh mục. Mã và nhóm được giữ cố định.",
    METHOD_IN_USE: "Không thể xóa phương pháp đang được dữ liệu khác tham chiếu.",
    METHOD_UNAVAILABLE: "Phương pháp chưa có bộ tính nên chưa thể hiển thị trong danh mục.",
    VERSION_CONFLICT: "Phương pháp đã thay đổi. Hãy tải lại chi tiết trước khi thử tiếp.",
    NOT_FOUND: "Không tìm thấy phương pháp.",
    INVALID_INPUT: "Kiểm tra lại mã, nhóm, nội dung và độ dài các trường.",
  };
  return error instanceof RestError && Object.hasOwn(messages, error.code) ? messages[error.code] : methodGuideError(error);
}
