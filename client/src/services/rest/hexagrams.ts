import type { HexagramDetail, HexagramRecord, Page } from "@/types/contract";
import { isHexagramCode, isHexagramDetail, isHexagramPage, TRIGRAMS } from "@/types/hexagramValidation";
import { requestJson, RestError as LookupError } from "./transport";
export { RestError as LookupError } from "./transport";

export type HexagramQuery = { q: string; upper: string; lower: string; page: number; size: number };
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
  return requestJson(`/hexagrams${path}`, guard, signal);
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
