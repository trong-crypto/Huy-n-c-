import { CLIENT_CONFIG } from "@/config/client";
import { isHistoryDeleted, isHistoryDetail, isHistoryPage, isSessionResult, isUuid } from "@/types/historyValidation";
import { requestJson, RestError } from "./transport";
export type HistoryQuery = { q: string; type: string; page: number; size: number };
const options = { credentials: "same-origin" as const };
function sameOrigin() {
  if (typeof window !== "undefined" && new URL(CLIENT_CONFIG.apiBaseUrl, window.location.href).origin !== window.location.origin) throw new RestError("SESSION_CONFIGURATION");
}
function mutation(csrf: string) {
  if (csrf.length !== 64 || !/^[0-9a-f]{64}$/.test(csrf)) throw new RestError("INVALID_SESSION");
  return { ...options, headers: { "X-HuyenCo-Request": "1", "X-CSRF-Token": csrf } };
}
export async function bootstrapSession(signal: AbortSignal) {
  sameOrigin(); return requestJson("/session", isSessionResult, signal, {}, { ...options, headers: { "X-HuyenCo-Request": "1" } });
}
export function historyQueryString(query: HistoryQuery) {
  if (query.q.length > 100 || !["", "MAI_HOA", "TAM_THE"].includes(query.type) || !Number.isInteger(query.page) || query.page < 0 || query.page > 2147483647
    || !Number.isInteger(query.size) || query.size < 1 || query.size > 100) throw new RestError("INVALID_INPUT");
  const params = new URLSearchParams({ q: query.q, page: String(query.page), size: String(query.size) });
  if (query.type) params.set("type", query.type); return params.toString();
}
export async function listHistory(query: HistoryQuery, signal: AbortSignal) {
  sameOrigin(); const page = await requestJson(`/history?${historyQueryString(query)}`, isHistoryPage, signal, undefined, options);
  if (page.page !== query.page || page.size !== query.size) throw new RestError("INVALID_RESPONSE"); return page;
}
export async function getHistory(id: string, signal: AbortSignal) {
  sameOrigin(); if (!isUuid(id)) throw new RestError("INVALID_INPUT");
  const detail = await requestJson(`/history/${id}`, isHistoryDetail, signal, undefined, options);
  if (detail.id !== id) throw new RestError("INVALID_RESPONSE"); return detail;
}
export function saveHistory(calculationRequestId: string, title: string, csrf: string, signal: AbortSignal) {
  sameOrigin(); if (!isUuid(calculationRequestId)) throw new RestError("INVALID_INPUT");
  const cleaned = title.trim();
  if ((title !== "" && cleaned === "") || cleaned.length > 100 || /[\x00-\x1f\x7f-\x9f]/.test(title)) throw new RestError("INVALID_INPUT");
  return requestJson("/history", isHistoryDetail, signal, { calculationRequestId, ...(cleaned ? { title: cleaned } : {}) }, { ...mutation(csrf), successStatus: 201 });
}
export function deleteHistory(id: string, csrf: string, signal: AbortSignal) {
  sameOrigin(); if (!isUuid(id)) throw new RestError("INVALID_INPUT");
  return requestJson(`/history/${id}`, isHistoryDeleted, signal, undefined, { ...mutation(csrf), method: "DELETE" });
}
export function historyErrorMessage(error: unknown): string {
  const messages: Record<string, string> = {
    INVALID_SESSION: "Phiên không hợp lệ hoặc đã hết hạn. Dữ liệu riêng tư đã được ẩn; cần kiểm tra lại phiên.",
    CSRF_REJECTED: "Yêu cầu bị từ chối do kiểm tra phiên/CSRF. Không tự động gửi lại thao tác.",
    NOT_FOUND: "Không tìm thấy dữ liệu trong phiên của bạn. Kết quả chưa lưu có thể đã hết hạn hoặc bị loại khỏi cache.",
    INVALID_INPUT: "Thông tin không hợp lệ. Tiêu đề không trắng, tối đa 100 ký tự; hãy kiểm tra lại bộ lọc hoặc mã dữ liệu.",
    DATABASE_UNAVAILABLE: "Kho lịch sử tạm thời không truy cập được. Vui lòng thử lại sau.",
    INTERNAL_ERROR: "Server chưa thể xử lý lịch sử. Vui lòng thử lại sau.",
    INVALID_RESPONSE: "Phản hồi lịch sử không đúng hợp đồng. Không hiển thị dữ liệu chưa xác thực.",
    REQUEST_TIMEOUT: "Yêu cầu quá thời gian chờ. Server có thể đã nhận thao tác; không tự gửi lại.",
    NETWORK_ERROR: "Không kết nối được dịch vụ. Server có thể đã nhận thao tác; không tự gửi lại.",
    SESSION_CONFIGURATION: "Cấu hình dịch vụ phiên phải cùng origin với giao diện để bảo vệ cookie.",
  };
  return error instanceof RestError && Object.hasOwn(messages, error.code) ? messages[error.code] : "Không thể xử lý yêu cầu lịch sử. Vui lòng thử lại.";
}
