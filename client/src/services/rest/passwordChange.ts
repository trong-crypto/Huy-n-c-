import { customerOptions } from "./customerAuth";
import { adminOptions } from "./methodGuides";
import { requestJson } from "./transport";

export type PasswordChange = { currentPassword: string; newPassword: string };
export type PasswordRealm = "customer" | "admin";

export function changePassword(realm: PasswordRealm, data: PasswordChange, csrfToken: string, signal: AbortSignal) {
  const admin = realm === "admin";
  const options = admin ? adminOptions(csrfToken) : customerOptions();
  return requestJson(admin ? "/auth/admin/password/change" : "/auth/password/change",
    (value): value is null => value === null, signal, data, {
      ...options, headers: { ...options.headers, "X-CSRF-Token": csrfToken }, successStatus: 204,
    });
}
