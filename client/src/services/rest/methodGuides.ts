import { CLIENT_CONFIG } from "@/config/client";
import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";
import { requestJson, RestError } from "./transport";

const adminPath = "/admin/method-guides";
export type MethodCode = "TIME" | "OBJECT_COUNT" | "LINES" | "TAM_THE";
export type GuideStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
export type GuideDraft = { title: string; body: string; editorNote?: string };
type Revision = { revision: number; title: string; body: string; editorNote: string | null };
export type GuideSummary = { methodCode: MethodCode; group: "MAI_HOA" | "TAM_THE"; title: string;
  status: GuideStatus; visible: boolean; version: number; updatedAt: string };
export type Guide = GuideSummary & { working: Revision | null; published: (Revision & { publishedAt: string }) | null };
export type PublicGuide = { methodCode: MethodCode; title: string; body: string; revision: number; publishedAt: string };
export type AdminSession = { account: { id: string; displayName: string; role: "ADMIN" }; expiresAt: string; csrfToken: string };
export type Page<T> = { items: T[]; page: number; size: number; totalElements: number; totalPages: number };
export type GuideEvent = { version: number; action: string; revision: number; actorId: string; occurredAt: string; reason: string | null };

const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const positive = (value: unknown): value is number => integer(value) && value > 0;
const methodCode = (value: unknown): value is MethodCode => typeof value === "string" && ["TIME", "OBJECT_COUNT", "LINES", "TAM_THE"].includes(value);
const isAdminSession = (value: unknown): value is AdminSession =>
  isRecord(value) && isRecord(value.account) && value.account.role === "ADMIN" && isUuid(value.account.id)
  && typeof value.account.displayName === "string" && timestamp(value.expiresAt)
  && typeof value.csrfToken === "string" && /^[A-Za-z0-9_-]{43}$/.test(value.csrfToken);
const isSummary = (value: unknown): value is GuideSummary =>
  isRecord(value) && methodCode(value.methodCode) && value.group === (value.methodCode === "TAM_THE" ? "TAM_THE" : "MAI_HOA")
  && typeof value.title === "string" && typeof value.status === "string" && ["DRAFT", "PENDING_REVIEW", "PUBLISHED"].includes(value.status)
  && typeof value.visible === "boolean" && positive(value.version) && timestamp(value.updatedAt);
const isRevision = (value: unknown): value is Revision => isRecord(value) && positive(value.revision)
  && typeof value.title === "string" && typeof value.body === "string" && (value.editorNote === null || typeof value.editorNote === "string");
function isGuide(value: unknown): value is Guide {
  if (!isRecord(value)) return false;
  const { working, published } = value;
  return (working === null || isRevision(working))
    && (published === null || isRecord(published) && timestamp(published.publishedAt) && isRevision(published))
    && isSummary(value) && (value.status === "PUBLISHED" ? working === null && published !== null : working !== null)
    && (!value.visible || published !== null);
}
const isPublicGuide = (value: unknown): value is PublicGuide => isRecord(value) && methodCode(value.methodCode)
  && typeof value.title === "string" && typeof value.body === "string" && positive(value.revision) && timestamp(value.publishedAt);
export const isEvent = (value: unknown): value is GuideEvent => isRecord(value) && positive(value.version) && positive(value.revision)
  && typeof value.action === "string" && isUuid(value.actorId) && timestamp(value.occurredAt)
  && (value.reason === null || typeof value.reason === "string");
export function isPage<T>(value: unknown, isItem: (item: unknown) => item is T): value is Page<T> {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(isItem)
    && integer(value.page) && positive(value.size) && integer(value.totalElements) && integer(value.totalPages);
}

export function adminOptions(csrf?: string) {
  if (new URL(CLIENT_CONFIG.apiBaseUrl, window.location.href).origin !== window.location.origin) {
    throw new RestError("SESSION_CONFIGURATION");
  }
  return { credentials: "same-origin" as const, headers: {
    "X-HuyenCo-Request": "1", ...(csrf === undefined ? {} : { "X-CSRF-Token": csrf }),
  } };
}

export function loginAdmin(identifier: string, password: string, signal: AbortSignal) {
  return requestJson("/auth/admin/login", isAdminSession, signal, { identifier, password }, adminOptions());
}
export async function readAdminSession(signal: AbortSignal) {
  return requestJson("/auth/admin/session", isAdminSession, signal, undefined, adminOptions());
}
export function logoutAdmin(csrf: string, signal: AbortSignal) {
  return requestJson("/auth/admin/logout", (value): value is null => value === null, signal, {},
    { ...adminOptions(csrf), successStatus: 204 });
}
export async function listGuides(signal: AbortSignal) {
  return requestJson(adminPath, (value): value is Page<GuideSummary> => isPage(value, isSummary),
    signal, undefined, adminOptions());
}
export async function readGuide(code: MethodCode, signal: AbortSignal): Promise<Guide | null> {
  try { return await requestJson(`${adminPath}/${code}`, isGuide, signal, undefined, adminOptions()); }
  catch (error) { if (error instanceof RestError && error.code === "NOT_FOUND") return null; throw error; }
}
export async function listGuideEvents(code: MethodCode, page: number, signal: AbortSignal) {
  return requestJson(`${adminPath}/${code}/events?page=${page}`, (value): value is Page<GuideEvent> => isPage(value, isEvent),
    signal, undefined, adminOptions());
}
export function createGuide(code: MethodCode, draft: GuideDraft, csrf: string, signal: AbortSignal) {
  return requestJson(adminPath, isGuide, signal, { methodCode: code, ...draft }, { ...adminOptions(csrf), successStatus: 201 });
}
export function saveGuide(code: MethodCode, expectedVersion: number, draft: GuideDraft, csrf: string, signal: AbortSignal) {
  return requestJson(`${adminPath}/${code}/draft`, isGuide, signal, { expectedVersion, ...draft }, { ...adminOptions(csrf), method: "PUT" });
}
export function reviewGuide(code: MethodCode, expectedVersion: number,
    action: "submit-review" | "return-to-draft" | "publish", reason: string | undefined, csrf: string, signal: AbortSignal) {
  return requestJson(`${adminPath}/${code}/${action}`, isGuide, signal,
    { expectedVersion, ...(reason === undefined ? {} : { reason }) }, adminOptions(csrf));
}
export function setGuideVisibility(code: MethodCode, expectedVersion: number, visible: boolean, csrf: string, signal: AbortSignal) {
  return requestJson(`${adminPath}/${code}/visibility`, isGuide, signal,
    { expectedVersion, visible }, { ...adminOptions(csrf), method: "PUT" });
}
export function listPublishedGuides(signal: AbortSignal) {
  return requestJson("/method-guides", (value): value is { items: PublicGuide[] } =>
    isRecord(value) && Array.isArray(value.items) && value.items.every(isPublicGuide), signal);
}

export function methodGuideError(error: unknown): string {
  const messages: Record<string, string> = {
    INVALID_SESSION: "Phiên quản trị đã hết hiệu lực. Vui lòng đăng nhập lại.",
    INVALID_CREDENTIALS: "Tài khoản hoặc mật khẩu không hợp lệ.",
    FORBIDDEN: "Tài khoản không có quyền quản trị.",
    CSRF_REJECTED: "Yêu cầu bị từ chối. Kiểm tra lại phiên quản trị.",
    VERSION_CONFLICT: "Một người khác đã sửa bài này. Hãy tải phiên bản mới trước khi tiếp tục.",
    GUIDE_EXISTS: "Phương pháp đã có bài hướng dẫn. Hãy tải bản hiện tại trước khi tiếp tục.",
    INVALID_TRANSITION: "Trạng thái bài hiện tại không cho phép thao tác.",
    INVALID_INPUT: "Kiểm tra lại tiêu đề, nội dung và độ dài các trường.",
    TOO_MANY_REQUESTS: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.",
  };
  return error instanceof RestError && Object.hasOwn(messages, error.code)
    ? messages[error.code] : "Không thể xác nhận yêu cầu. Vui lòng thử lại.";
}
