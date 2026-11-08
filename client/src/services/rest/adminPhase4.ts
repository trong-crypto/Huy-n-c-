import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";
import { accountRoles, accountStatuses, type Role, type Status } from "./adminAccounts";
import { adminOptions, methodGuideError } from "./methodGuides";
import { requestJson, RestError } from "./transport";

const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const text = (value: unknown): value is string => typeof value === "string";
const optional = <T,>(value: unknown, guard: (value: unknown) => value is T): value is T | null => value === null || guard(value);
const validDate = (value: unknown): value is string => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

type Page<T> = { items: T[]; page: number; size: number; totalElements: number; totalPages: number };
function isPage<T>(value: unknown, item: (value: unknown) => value is T): value is Page<T> {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(item)
    && integer(value.page) && integer(value.size) && value.size > 0 && integer(value.totalElements) && integer(value.totalPages);
}

export type Metrics = { date: string; timeZone: string; calculationCoverage: "UNAVAILABLE" | "PARTIAL" | "AVAILABLE";
  users: number; consultants: number; pendingContent: number; calculations: number | null;
  methods: { id: string; name: string; count: number }[] };
const isMetrics = (value: unknown): value is Metrics => isRecord(value) && validDate(value.date)
  && value.timeZone === "Asia/Ho_Chi_Minh" && integer(value.users) && integer(value.consultants)
  && integer(value.pendingContent) && Array.isArray(value.methods) && value.methods.every(method =>
    isRecord(method) && text(method.id) && text(method.name) && integer(method.count))
  && (value.calculationCoverage === "UNAVAILABLE" ? value.calculations === null && value.methods.length === 0
    : (value.calculationCoverage === "PARTIAL" || value.calculationCoverage === "AVAILABLE") && integer(value.calculations));

export async function readMetrics(date: string, signal: AbortSignal) {
  const data = await requestJson("/admin/metrics" + (date ? "?" + new URLSearchParams({ date }) : ""), isMetrics, signal, undefined, adminOptions());
  if (date && data.date !== date) throw new RestError("INVALID_RESPONSE");
  return data;
}

export const reviewStatuses = { PENDING_REVIEW: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Đã từ chối" } as const;
type ReviewStatus = keyof typeof reviewStatuses;
export type Decision = Exclude<ReviewStatus, "PENDING_REVIEW">;
type Profile = { accountId: string; displayName: string; role: Role; accountStatus: Status; reviewStatus: ReviewStatus;
  version: number; submittedAt: string | null };
export type ConsultantDetail = { profile: Profile; summary: string | null; submittedBy: string | null;
  reviewedBy: string | null; reviewedAt: string | null; rejectionReason: string | null };
const isProfile = (value: unknown): value is Profile => isRecord(value) && isUuid(value.accountId)
  && text(value.displayName) && text(value.role) && Object.hasOwn(accountRoles, value.role) && value.role !== "ADMIN"
  && text(value.accountStatus) && Object.hasOwn(accountStatuses, value.accountStatus)
  && text(value.reviewStatus) && Object.hasOwn(reviewStatuses, value.reviewStatus)
  && integer(value.version) && value.version > 0 && optional(value.submittedAt, timestamp);
const isConsultant = (value: unknown): value is ConsultantDetail => isRecord(value) && isProfile(value.profile)
  && optional(value.summary, text) && optional(value.submittedBy, isUuid) && optional(value.reviewedBy, isUuid)
  && optional(value.reviewedAt, timestamp) && optional(value.rejectionReason, text);

export const auditTargets = { METHOD_GUIDE: "Bài hướng dẫn", ACCOUNT: "Tài khoản", CONSULTANT_PROFILE: "Hồ sơ tư vấn viên" } as const;
export const auditActions = { CREATE: "Tạo bài", SAVE_DRAFT: "Lưu bản nháp", SUBMIT_REVIEW: "Gửi duyệt bài",
  RETURN_TO_DRAFT: "Trả về bản nháp", PUBLISH: "Công bố", SHOW: "Hiện bài", HIDE: "Ẩn bài",
  LOCK_ACCOUNT: "Khóa tài khoản", UNLOCK_ACCOUNT: "Mở khóa tài khoản", CHANGE_ROLE: "Đổi vai trò",
  SUBMIT_PROFILE: "Tạo hồ sơ", APPROVE_PROFILE: "Duyệt hồ sơ", REJECT_PROFILE: "Từ chối hồ sơ" } as const;
export type AuditEvent = { id: string; occurredAt: string; actorId: string; targetId: string;
  targetType: keyof typeof auditTargets; action: keyof typeof auditActions; outcome: "COMPLETED" };
const isAuditEvent = (value: unknown): value is AuditEvent => isRecord(value) && text(value.id)
  && timestamp(value.occurredAt) && isUuid(value.actorId) && text(value.targetId)
  && text(value.targetType) && Object.hasOwn(auditTargets, value.targetType)
  && text(value.action) && Object.hasOwn(auditActions, value.action) && value.outcome === "COMPLETED";

async function list<T>(path: string, filters: Record<string, string>, page: number, item: (value: unknown) => value is T, signal: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), size: "20" });
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
  const data = await requestJson(`${path}?${params}`, (value): value is Page<T> => isPage(value, item),
    signal, undefined, adminOptions());
  if (data.page !== page || data.size !== 20) throw new RestError("INVALID_RESPONSE");
  return data;
}

const profiles = "/admin/consultants";
export const listConsultants = (filters: Record<string, string>, page: number, signal: AbortSignal) =>
  list(profiles, filters, page, isProfile, signal);
export const listAudit = (filters: Record<string, string>, page: number, signal: AbortSignal) =>
  list("/admin/audit", filters, page, isAuditEvent, signal);

async function consultant(id: string, path: string, signal: AbortSignal, body?: object, options: Parameters<typeof requestJson>[4] = adminOptions()) {
  const data = await requestJson(path, isConsultant, signal, body, options);
  if (data.profile.accountId !== id) throw new RestError("INVALID_RESPONSE");
  return data;
}
export const readConsultant = (id: string, signal: AbortSignal) => consultant(id, `${profiles}/${id}`, signal);
export async function createConsultant(accountId: string, summary: string, csrf: string, signal: AbortSignal) {
  const data = await consultant(accountId, profiles, signal, { accountId, summary }, { ...adminOptions(csrf), successStatus: 201 });
  if (data.profile.version !== 1 || data.profile.reviewStatus !== "PENDING_REVIEW") throw new RestError("INVALID_RESPONSE");
  return data;
}
export async function reviewConsultant(id: string, version: number, decision: Decision, reason: string, csrf: string, signal: AbortSignal) {
  const data = await consultant(id, `${profiles}/${id}/review`, signal,
    { expectedVersion: version, decision, ...(decision === "REJECTED" ? { reason } : {}) },
    { ...adminOptions(csrf), method: "PUT" });
  if (data.profile.version !== version + 1 || data.profile.reviewStatus !== decision) throw new RestError("INVALID_RESPONSE");
  return data;
}

export function phase4Error(error: unknown) {
  const messages: Record<string, string> = {
    INVALID_INPUT: "Kiểm tra dữ liệu và bộ lọc rồi thử lại.",
    VERSION_CONFLICT: "Hồ sơ đã thay đổi. Hãy tải lại chi tiết.",
    INVALID_TRANSITION: "Hồ sơ hiện không thể xử lý.",
    PROFILE_EXISTS: "Tài khoản này đã có hồ sơ tư vấn viên.",
    NOT_FOUND: "Không tìm thấy tài khoản hoặc hồ sơ.",
  };
  return error instanceof RestError && Object.hasOwn(messages, error.code) ? messages[error.code] : methodGuideError(error);
}
