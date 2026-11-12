import { customerOptions } from "./customerAuth";
import { adminOptions } from "./methodGuides";
import { requestJson } from "./transport";
import { isRecord } from "@/types/contractValidation";

export type PasswordChange = { currentPassword: string; newPassword: string };
export type PasswordRealm = "customer" | "admin";
export type PasswordDecision = "APPROVE" | "REJECT";


export function requestPasswordChange(data: PasswordChange, csrfToken: string, signal: AbortSignal) {
  const options = customerOptions();
  return requestJson("/auth/password/requests",
    (value): value is { status: "PENDING" } => isRecord(value) && value.status === "PENDING", signal, data,
    { ...options, headers: { ...options.headers, "X-CSRF-Token": csrfToken }, successStatus: 202 });
}

export function decidePasswordChange(accountId: string, requestId: string, decision: PasswordDecision,
  csrfToken: string, signal: AbortSignal) {
  return requestJson("/auth/admin/password/requests", (value): value is null => value === null, signal,
    { accountId, requestId, decision }, { ...adminOptions(csrfToken), method: "POST", successStatus: 204 });
}

export function changePassword(realm: PasswordRealm, data: PasswordChange, csrfToken: string, signal: AbortSignal) {
  const admin = realm === "admin";
  const options = admin ? adminOptions(csrfToken) : customerOptions();
  return requestJson(admin ? "/auth/admin/password/change" : "/auth/password/change",
    (value): value is null => value === null, signal, data, {
      ...options, headers: { ...options.headers, "X-CSRF-Token": csrfToken }, successStatus: 204,
    });
}
