import { CLIENT_CONFIG } from "@/config/client";
import type { HexagramDetail, HexagramRecord, Page } from "@/types/contract";
import { isHexagramCode, isHexagramDetail, isHexagramPage, isLookupResponse, TRIGRAMS } from "@/types/hexagramValidation";

export type HexagramQuery = { q: string; upper: string; lower: string; page: number; size: number };
export class LookupError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "LookupError"; }
}
export function lookupErrorMessage(error: unknown): string {
  const messages: Record<string, string> = {
    INVALID_INPUT: "Tham số tra cứu không hợp lệ. Kiểm tra từ khóa, mã quẻ và bộ lọc.",
    NOT_FOUND: "Không tìm thấy quẻ có mã này.",
    DATABASE_UNAVAILABLE: "Kho dữ liệu tạm thời không truy cập được. Vui lòng thử lại sau.",
    KNOWLEDGE_DATA_INCOMPLETE: "Dữ liệu nguồn đang thiếu hoặc không nhất quán. Chưa thể hiển thị kết quả.",
    INVALID_RESPONSE: "Phản hồi không đúng hợp đồng tra cứu. Không hiển thị dữ liệu chưa xác thực.",
    REQUEST_TIMEOUT: "Tra cứu quá thời gian chờ. Vui lòng thử lại.",
    NETWORK_ERROR: "Không kết nối được dịch vụ tra cứu. Vui lòng kiểm tra kết nối và thử lại.",
  };
  return error instanceof LookupError
    ? Object.hasOwn(messages, error.code) ? messages[error.code] : "Dịch vụ chưa thể xử lý yêu cầu tra cứu. Vui lòng thử lại sau."
    : "Không thể hoàn tất tra cứu. Vui lòng thử lại.";
}
export function hexagramQueryString(query: HexagramQuery): string {
  if (query.q.length > 100 || !Number.isInteger(query.page) || query.page < 0 || query.page > 2147483647
    || !Number.isInteger(query.size) || query.size < 1 || query.size > 100
    || [query.upper, query.lower].some(code => code !== "" && !TRIGRAMS.includes(code as typeof TRIGRAMS[number]))) throw new LookupError("INVALID_INPUT");
  const params = new URLSearchParams({ q: query.q, page: String(query.page), size: String(query.size) });
  if (query.upper) params.set("upperTrigramCode", query.upper);
  if (query.lower) params.set("lowerTrigramCode", query.lower);
  return params.toString();
}
async function get<T>(path: string, guard: (v: unknown) => v is T, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CLIENT_CONFIG.restTimeoutMs);
  try {
    const response = await fetch(`${CLIENT_CONFIG.apiBaseUrl.replace(/\/$/, "")}/hexagrams${path}`, {
      method: "GET", signal: controller.signal, headers: { Accept: "application/json" }, credentials: "omit", cache: "no-store",
    });
    let value: unknown;
    try { value = await response.json(); } catch { throw new LookupError("INVALID_RESPONSE"); }
    if (!isLookupResponse(value, guard)) throw new LookupError("INVALID_RESPONSE");
    if (value.status === "FAILED") {
      const httpCodes: Record<string, number> = { INVALID_INPUT: 400, NOT_FOUND: 404, DATABASE_UNAVAILABLE: 503, KNOWLEDGE_DATA_INCOMPLETE: 503, INTERNAL_ERROR: 500 };
      if (response.ok || (Object.hasOwn(httpCodes, value.error.code) && response.status !== httpCodes[value.error.code])) throw new LookupError("INVALID_RESPONSE");
      throw new LookupError(value.error.code);
    }
    if (!response.ok) throw new LookupError("INVALID_RESPONSE");
    return value.data;
  } catch (error) {
    if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
    if (timedOut) throw new LookupError("REQUEST_TIMEOUT");
    if (error instanceof LookupError) throw error;
    throw new LookupError("NETWORK_ERROR");
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}
export async function listHexagrams(query: HexagramQuery, signal: AbortSignal): Promise<Page<HexagramRecord>> {
  const page = await get(`?${hexagramQueryString(query)}`, isHexagramPage, signal);
  if (page.page !== query.page || page.size !== query.size) throw new LookupError("INVALID_RESPONSE");
  return page;
}
export async function getHexagram(code: string, signal: AbortSignal): Promise<HexagramDetail> {
  if (!isHexagramCode(code)) throw new LookupError("INVALID_INPUT");
  const result = await get(`/${encodeURIComponent(code)}`, isHexagramDetail, signal);
  if (result.code !== code) throw new LookupError("INVALID_RESPONSE");
  return result;
}
