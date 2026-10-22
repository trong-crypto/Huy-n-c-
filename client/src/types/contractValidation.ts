import type { CalculationResponse, ErrorCode, ServerError } from "@/types/contract";

const SERVER_ERROR_CODES: readonly ErrorCode[] = [
  "INVALID_INPUT", "INVALID_DATE", "INVALID_METHOD",
  "RULE_NOT_AVAILABLE", "SERVER_BUSY", "INTERNAL_ERROR",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isServerError(value: unknown): value is ServerError {
  return isRecord(value)
    && SERVER_ERROR_CODES.some((code) => code === value.code)
    && typeof value.message === "string"
    && (value.ruleCode === null || typeof value.ruleCode === "string");
}

export function isCalculationResponse(value: unknown): value is CalculationResponse {
  if (!isRecord(value)
    || typeof value.requestId !== "string" || !UUID.test(value.requestId)
    || (value.type !== "MAI_HOA" && value.type !== "TAM_THE")) return false;

  if (value.status === "COMPLETED") {
    return value.data !== null && value.data !== undefined && value.error === null;
  }
  if (value.status === "FAILED") {
    return value.data === null && isServerError(value.error);
  }
  return false;
}
