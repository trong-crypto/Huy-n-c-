import type { HistoryDeleteResult, HistoryDetail, HistoryItem, Page, SessionResult } from "./contract";
import { isCalculationResponse, isRecord } from "./contractValidation";

export const isUuid = (value: unknown): value is string => typeof value === "string" && value.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
export function isSessionResult(value: unknown): value is SessionResult {
  return isRecord(value) && Object.keys(value).length === 2 && timestamp(value.expiresAt)
    && typeof value.csrfToken === "string" && /^[0-9a-f]{64}$/.test(value.csrfToken) && value.csrfToken.length === 64;
}
export function isHistoryItem(value: unknown): value is HistoryItem {
  return isRecord(value) && isUuid(value.id) && (value.type === "MAI_HOA" || value.type === "TAM_THE")
    && typeof value.title === "string" && value.title.trim().length > 0 && value.title.length <= 100 && !/[\x00-\x1f\x7f-\x9f]/.test(value.title)
    && timestamp(value.createdAt) && (value.ruleBasis === "SOURCE_VERIFIED" || value.ruleBasis === "TEAM_DECISION");
}
export function isHistoryDetail(value: unknown): value is HistoryDetail {
  if (!isRecord(value)) return false;
  const result = value.result;
  return isHistoryItem(value) && isRecord(result) && value.ruleBasis === result.ruleBasis
    && isCalculationResponse({ requestId: value.id, type: value.type, status: "COMPLETED", data: result, error: null });
}
export function isHistoryPage(value: unknown): value is Page<HistoryItem> {
  if (!isRecord(value)) return false;
  const { items, page, size, totalElements, totalPages } = value;
  if (typeof page !== "number" || !Number.isInteger(page) || page < 0 || page > 2147483647
    || typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > 100
    || typeof totalElements !== "number" || !Number.isSafeInteger(totalElements) || totalElements < 0
    || totalPages !== Math.ceil(totalElements / size) || !Array.isArray(items) || !items.every(isHistoryItem)) return false;
  return items.length === Math.max(0, Math.min(size, totalElements - page * size)) && new Set(items.map(item => item.id)).size === items.length;
}
export function isHistoryDeleted(value: unknown): value is HistoryDeleteResult { return isRecord(value) && value.deleted === true && Object.keys(value).length === 1; }
