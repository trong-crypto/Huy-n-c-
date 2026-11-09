import { CLIENT_CONFIG } from "@/config/client";
import type { ApiError } from "@/types/contract";
import { isLookupResponse as isRestResponse } from "@/types/hexagramValidation";

export class RestError extends Error {
  constructor(public readonly code: string, public readonly apiError?: ApiError) { super(code); this.name = "RestError"; }
}

type RequestOptions = { method?: "GET" | "POST" | "PUT" | "DELETE"; credentials?: "omit" | "same-origin"; headers?: Record<string, string>; successStatus?: number | readonly number[] };
// Public requests omit cookies. H01 opts into same-origin cookies explicitly; never auto-retry writes.
export async function requestJson<T>(path: string, guard: (value: unknown) => value is T, signal: AbortSignal, body?: object, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CLIENT_CONFIG.restTimeoutMs);
  try {
    const response = await fetch(`${CLIENT_CONFIG.apiBaseUrl.replace(/\/$/, "")}${path}`, {
      method: options.method ?? (body === undefined ? "GET" : "POST"), signal: controller.signal,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...options.headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), credentials: options.credentials ?? "omit", cache: "no-store",
    });
    if (response.status === 204 && options.successStatus === 204) {
      const empty: unknown = null;
      if (guard(empty)) return empty;
      throw new RestError("INVALID_RESPONSE");
    }
    if (!/^application\/(?:json|[\w.-]+\+json)(?:\s*;|$)/i.test(response.headers.get("Content-Type") ?? "")) throw new RestError("INVALID_RESPONSE");
    let value: unknown;
    try { value = await response.json(); } catch { throw new RestError("INVALID_RESPONSE"); }
    if (!isRestResponse(value, guard)) throw new RestError("INVALID_RESPONSE");
    if (value.status === "FAILED") {
      const statuses: Record<string, number> = { INVALID_INPUT: 400, INVALID_DATE: 400, NOT_FOUND: 404,
        INVALID_SESSION: 401, LOGIN_REQUIRED: 401, INVALID_CREDENTIALS: 401, FORBIDDEN: 403, CSRF_REJECTED: 403,
        IDENTIFIER_TAKEN: 409, GUIDE_EXISTS: 409, GLOSS_DRAFT_EXISTS: 409, SOURCE_PROPOSAL_EXISTS: 409,
        VERSION_CONFLICT: 409, INVALID_TRANSITION: 409, SOURCE_CHANGED: 409, SOURCE_ALREADY_APPLIED: 409, REQUEST_ID_CONFLICT: 409,
        INVALID_SOURCE: 400,
        RULE_NOT_AVAILABLE: 422, TOO_MANY_REQUESTS: 429,
        DATABASE_UNAVAILABLE: 503, KNOWLEDGE_DATA_INCOMPLETE: 503, INTERNAL_ERROR: 500 };
      if (response.ok || (Object.hasOwn(statuses, value.error.code) && response.status !== statuses[value.error.code])) throw new RestError("INVALID_RESPONSE");
      throw new RestError(value.error.code, value.error);
    }
    const expected = options.successStatus ?? 200;
    if (!response.ok || !(typeof expected === "number" ? response.status === expected : expected.includes(response.status))) {
      throw new RestError("INVALID_RESPONSE");
    }
    return value.data;
  } catch (error) {
    if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (timedOut) throw new RestError("REQUEST_TIMEOUT");
    if (error instanceof RestError) throw error;
    throw new RestError("NETWORK_ERROR");
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}
