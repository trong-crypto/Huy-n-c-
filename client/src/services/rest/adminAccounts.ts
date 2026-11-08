import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";
import { adminOptions, methodGuideError } from "./methodGuides";
import { requestJson, RestError } from "./transport";

export const accountRoles = { USER: "Người dùng", ADMIN: "Quản trị viên", CONSULTANT: "Tư vấn viên" } as const;
export const accountStatuses = { ACTIVE: "Hoạt động", LOCKED: "Bị khóa" } as const;
export type Role = keyof typeof accountRoles;
export type Status = keyof typeof accountStatuses;
export type CustomerRole = Exclude<Role, "ADMIN">;
export type Account = { id: string; identifier: string; displayName: string; role: Role; status: Status;
  version: number; createdAt: string; canChangeStatus: boolean };
type Change = { actorId: string; previousStatus: Status; status: Status; revokedSessions: number; occurredAt: string };
type RoleChange = { actorId: string; previousRole: CustomerRole; role: CustomerRole; revokedSessions: number; occurredAt: string };
export type AccountDetail = { account: Account; lastStatusChange: Change | null; lastRoleChange?: RoleChange | null;
  allowedRoleChanges?: CustomerRole[] };
export type AccountQuery = { q: string; role: string; status: string; page: number };
type Page = { items: Account[]; page: number; size: number; totalElements: number; totalPages: number };

const path = "/admin/accounts";
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const status = (value: unknown): value is Status => typeof value === "string" && Object.hasOwn(accountStatuses, value);
const customerRole = (value: unknown): value is CustomerRole => value === "USER" || value === "CONSULTANT";
const isAccount = (value: unknown): value is Account => isRecord(value) && isUuid(value.id)
  && typeof value.identifier === "string" && typeof value.displayName === "string"
  && typeof value.role === "string" && Object.hasOwn(accountRoles, value.role) && status(value.status)
  && integer(value.version) && value.version > 0 && timestamp(value.createdAt)
  && value.canChangeStatus === (value.role !== "ADMIN");
const isDetail = (value: unknown): value is AccountDetail => isRecord(value) && isAccount(value.account)
  && (value.lastStatusChange === null || isRecord(value.lastStatusChange) && isUuid(value.lastStatusChange.actorId)
    && status(value.lastStatusChange.previousStatus) && value.lastStatusChange.status === value.account.status
    && value.lastStatusChange.previousStatus !== value.lastStatusChange.status
    && integer(value.lastStatusChange.revokedSessions) && timestamp(value.lastStatusChange.occurredAt))
  && (value.allowedRoleChanges === undefined || Array.isArray(value.allowedRoleChanges) && value.allowedRoleChanges.every(customerRole))
  && (value.lastRoleChange == null || isRecord(value.lastRoleChange) && isUuid(value.lastRoleChange.actorId)
    && customerRole(value.lastRoleChange.previousRole) && customerRole(value.lastRoleChange.role)
    && value.lastRoleChange.role === value.account.role && value.lastRoleChange.previousRole !== value.lastRoleChange.role
    && integer(value.lastRoleChange.revokedSessions) && timestamp(value.lastRoleChange.occurredAt));
const isPage = (value: unknown): value is Page => isRecord(value) && Array.isArray(value.items) && value.items.every(isAccount)
  && integer(value.page) && integer(value.size) && value.size > 0 && integer(value.totalElements) && integer(value.totalPages);

export async function listAccounts(query: AccountQuery, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query.q, page: String(query.page), size: "20" });
  if (query.role) params.set("role", query.role);
  if (query.status) params.set("status", query.status);
  const data = await requestJson(`${path}?${params}`, isPage, signal, undefined, adminOptions());
  if (data.page !== query.page || data.size !== 20) throw new RestError("INVALID_RESPONSE");
  return data;
}

export async function readAccount(id: string, signal: AbortSignal) {
  const result = await requestJson(`${path}/${id}`, isDetail, signal, undefined, adminOptions());
  if (result.account.id !== id) throw new RestError("INVALID_RESPONSE");
  return result;
}

export async function setAccountStatus(account: Account, status: Status, csrf: string, signal: AbortSignal) {
  const result = await requestJson(`${path}/${account.id}/status`, isDetail, signal,
    { expectedVersion: account.version, status }, { ...adminOptions(csrf), method: "PUT" });
  if (result.account.id !== account.id || result.account.status !== status
      || result.account.version !== account.version + 1) throw new RestError("INVALID_RESPONSE");
  return result;
}

export async function setAccountRole(account: Account, role: CustomerRole, csrf: string, signal: AbortSignal) {
  const result = await requestJson(`${path}/${account.id}/role`, isDetail, signal,
    { expectedVersion: account.version, role }, { ...adminOptions(csrf), method: "PUT" });
  if (result.account.id !== account.id || result.account.role !== role
      || result.account.version !== account.version + 1) throw new RestError("INVALID_RESPONSE");
  return result;
}

export function accountError(error: unknown): string {
  if (!(error instanceof RestError)) return methodGuideError(error);
  const messages: Record<string, string> = {
    VERSION_CONFLICT: "Tài khoản đã thay đổi. Hãy tải lại chi tiết.",
    CONSULTANT_APPROVAL_REQUIRED: "Tài khoản cần hồ sơ tư vấn viên đã được duyệt.",
    ACCOUNT_LOCKED: "Hãy mở khóa tài khoản trước khi đổi vai trò.",
    INVALID_TRANSITION: "Tài khoản đang ở trạng thái này.",
    INVALID_INPUT: "Dữ liệu quản lý tài khoản không hợp lệ.",
    NOT_FOUND: "Không tìm thấy tài khoản.",
  };
  return Object.hasOwn(messages, error.code) ? messages[error.code] : methodGuideError(error);
}
