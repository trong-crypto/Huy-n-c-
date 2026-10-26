import { CLIENT_CONFIG } from "@/config/client";
import type { ApiError } from "@/types/contract";
import { isLookupResponse as isRestResponse } from "@/types/hexagramValidation";

export class RestError extends Error {
  constructor(public readonly code: string, public readonly apiError?: ApiError) { super(code); this.name = "RestError"; }
}

// Shared by E02 GET and C01 read-only POST. No session cookies or automatic retry.
export async function requestJson<T>(path: string, guard: (value: unknown) => value is T, signal: AbortSignal, body?: object): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CLIENT_CONFIG.restTimeoutMs);
  try {
    const response = await fetch(`${CLIENT_CONFIG.apiBaseUrl.replace(/\/$/, "")}${path}`, {
      method: body === undefined ? "GET" : "POST", signal: controller.signal,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), credentials: "omit", cache: "no-store",
    });
    if (!/^application\/(?:json|[\w.-]+\+json)(?:\s*;|$)/i.test(response.headers.get("Content-Type") ?? "")) throw new RestError("INVALID_RESPONSE");
    let value: unknown;
    try { value = await response.json(); } catch { throw new RestError("INVALID_RESPONSE"); }
    if (!isRestResponse(value, guard)) throw new RestError("INVALID_RESPONSE");
    if (value.status === "FAILED") {
      const statuses: Record<string, number> = { INVALID_INPUT: 400, INVALID_DATE: 400, NOT_FOUND: 404,
        RULE_NOT_AVAILABLE: 422, DATABASE_UNAVAILABLE: 503, KNOWLEDGE_DATA_INCOMPLETE: 503, INTERNAL_ERROR: 500 };
      if (response.ok || (Object.hasOwn(statuses, value.error.code) && response.status !== statuses[value.error.code])) throw new RestError("INVALID_RESPONSE");
      throw new RestError(value.error.code, value.error);
    }
    if (!response.ok) throw new RestError("INVALID_RESPONSE");
    return value.data;
  } catch (error) {
    if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (timedOut) throw new RestError("REQUEST_TIMEOUT");
    if (error instanceof RestError) throw error;
    throw new RestError("NETWORK_ERROR");
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}
