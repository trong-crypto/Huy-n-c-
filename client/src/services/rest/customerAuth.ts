import { CLIENT_CONFIG } from "@/config/client";
import { isRecord } from "@/types/contractValidation";
import { isHistoryCsrf, isUuid } from "@/types/historyValidation";
import { requestJson, RestError } from "./transport";

type Credentials = { identifier: string; password: string };
type Account = { id: string; displayName: string; role: "USER" | "CONSULTANT" };
type Registration = { account: Account };
type Session = Registration & { expiresAt: string; csrfToken: string };

function isRegistration(value: unknown): value is Registration {
  if (!isRecord(value) || !isRecord(value.account)) return false;
  const { id, displayName, role } = value.account;
  return isUuid(id) && typeof displayName === "string" && (role === "USER" || role === "CONSULTANT");
}

function isSession(value: unknown): value is Session {
  return isRecord(value) && typeof value.expiresAt === "string" && Number.isFinite(Date.parse(value.expiresAt))
    && isHistoryCsrf(value.csrfToken) && isRegistration(value);
}

export function customerOptions() {
  if (new URL(CLIENT_CONFIG.apiBaseUrl, window.location.href).origin !== window.location.origin) {
    throw new RestError("SESSION_CONFIGURATION");
  }
  return { credentials: "same-origin" as const, headers: { "X-HuyenCo-Request": "1" } };
}

export function registerCustomer(data: Credentials & { displayName: string; phoneNumber?: string }, signal: AbortSignal) {
  return requestJson("/auth/register", isRegistration, signal, data, { ...customerOptions(), successStatus: 201 });
}

export function loginCustomer(data: Credentials, signal: AbortSignal) {
  return requestJson("/auth/login", isSession, signal, data, customerOptions());
}

export function readCustomerSession(signal: AbortSignal) {
  return requestJson("/auth/session", isSession, signal, undefined, customerOptions());
}

export async function getCustomerSession(signal: AbortSignal) {
  const session = await readCustomerSession(signal);
  if (Date.parse(session.expiresAt) <= Date.now()) throw new RestError("INVALID_SESSION");
  return session;
}

export function logoutCustomer(csrfToken: string, signal: AbortSignal) {
  const request = customerOptions();
  return requestJson("/auth/logout", (value): value is null => value === null, signal, {},
    { ...request, headers: { ...request.headers, "X-CSRF-Token": csrfToken }, successStatus: 204 });
}
