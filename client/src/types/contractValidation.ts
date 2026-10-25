import type { ApiError, CalculationResponse, CalculationType, ErrorCode } from "@/types/contract";

const SERVER_ERROR_CODES: readonly ErrorCode[] = [
  "INVALID_INPUT", "INVALID_DATE", "INVALID_METHOD",
  "RULE_NOT_AVAILABLE", "SERVER_BUSY", "INTERNAL_ERROR",
  "PROCESSING_TIMEOUT", "DATABASE_UNAVAILABLE", "KNOWLEDGE_DATA_INCOMPLETE",
  "NOT_FOUND", "INVALID_SESSION", "CSRF_REJECTED",
];
const CLIENT_LOCAL_CODES = ["REQUEST_TIMEOUT", "DISCONNECTED", "INVALID_RESPONSE"];
const STATUSES = ["DRAFT", "SOURCE_LOCATED", "SOURCE_AMBIGUOUS", "BLOCKED_SOURCE_CONFLICT", "VERIFIED"];
const BASES = ["SOURCE_VERIFIED", "TEAM_DECISION"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isServerError(value: unknown): value is ApiError {
  return isRecord(value)
    && typeof value.code === "string" && value.code.trim().length > 0
    && !CLIENT_LOCAL_CODES.includes(value.code)
    && typeof value.message === "string"
    && (value.ruleCode === null || typeof value.ruleCode === "string")
    && (value.reason === null || (typeof value.reason === "string" && value.reason.trim().length > 0));
}

export function isKnownServerErrorCode(code: string): code is ErrorCode {
  return SERVER_ERROR_CODES.some(known => known === code);
}

function hasFailureBody(value: Record<string, unknown>): boolean {
  return value.status === "FAILED" && value.data === null && isServerError(value.error);
}

// Notice routing only; never upgrades a malformed ID into a CalculationResponse.
// Shares the same failure-field checks as the existing envelope/response guards.
export function isUncorrelatedServerFailure(value: unknown): boolean {
  return isRecord(value) && hasFailureBody(value)
    && (value.type === null || value.type === "MAI_HOA" || value.type === "TAM_THE")
    && (typeof value.requestId !== "string" || !UUID.test(value.requestId));
}

// Envelope validation keeps success data opaque; it does not assert business types.
export type CalculationEnvelope = { requestId: string; type: CalculationType } & (
  { status: "COMPLETED"; data: NonNullable<unknown>; error: null }
  | { status: "FAILED"; data: null; error: ApiError });
export function isCalculationEnvelope(value: unknown): value is CalculationEnvelope {
  if (!isRecord(value)
    || typeof value.requestId !== "string" || !UUID.test(value.requestId)
    || (value.type !== "MAI_HOA" && value.type !== "TAM_THE")) return false;

  if (value.status === "COMPLETED") {
    return value.data !== null && value.data !== undefined && value.error === null;
  }
  if (value.status === "FAILED") {
    return hasFailureBody(value);
  }
  return false;
}

const text = (v: unknown): v is string => typeof v === "string";
const nullableText = (v: unknown) => v === null || text(v);
const member = (v: unknown, list: readonly string[]) => text(v) && list.includes(v);
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const array = (v: unknown, check: (item: unknown) => boolean) => Array.isArray(v) && v.every(check);
function source(v: unknown): boolean {
  return isRecord(v) && [v.sourceId, v.title, v.version, v.section].every(text)
    && [v.printedPage, v.sha256, v.url].every(nullableText)
    && (v.pdfPage === null || (integer(v.pdfPage) && v.pdfPage > 0));
}
function decision(v: unknown): boolean {
  return isRecord(v) && [v.decisionId, v.decidedAt, v.document, v.description].every(text);
}
function evidence(v: Record<string, unknown>): boolean {
  return text(v.ruleVersion) && member(v.ruleBasis, BASES) && member(v.sourceStatus, STATUSES)
    && array(v.sourceReferences, source) && array(v.decisionReferences, decision);
}
function resultEvidence(v: Record<string, unknown>): boolean {
  return evidence(v) && array(v.rules, r => isRecord(r) && evidence(r)
    && text(r.ruleCode) && member(r.executionPolicy, BASES));
}
function hexagram(v: unknown): boolean {
  return isRecord(v) && nullableText(v.code) && Array.isArray(v.linesBottomUp)
    && v.linesBottomUp.length === 6 && v.linesBottomUp.every(x => typeof x === "boolean")
    && (v.nameStatus === "VERIFIED" ? nullableText(v.name)
      : (v.nameStatus === null || member(v.nameStatus, STATUSES)) && v.name === null);
}
function maiHoa(v: Record<string, unknown>): boolean {
  return member(v.method, ["TIME", "OBJECT_COUNT", "LINES"])
    && [v.primaryHexagram, v.mutualHexagram, v.changedHexagram].every(hexagram)
    && integer(v.movingLine) && v.movingLine >= 1 && v.movingLine <= 6
    && (v.method !== "TIME" ? v.lunarDate === null : (isRecord(v.lunarDate)
      && integer(v.lunarDate.year) && integer(v.lunarDate.month) && integer(v.lunarDate.day)
      && typeof v.lunarDate.isLeapMonth === "boolean"))
    && array(v.calculationSteps, s => isRecord(s) && text(s.code) && text(s.message)
      && isRecord(s.values) && Object.values(s.values).every(x => text(x)
        || (typeof x === "number" && Number.isFinite(x)) || typeof x === "boolean"
        || array(x, b => typeof b === "boolean")));
}
function tamThe(v: Record<string, unknown>): boolean {
  return v.ruleBasis === "SOURCE_VERIFIED" && v.sourceStatus === "VERIFIED"
    && Array.isArray(v.categories) && v.categories.length >= 1 && v.categories.length <= 3
    && array(v.categories, c => isRecord(c) && member(c.category, ["CAREER", "WEALTH", "LOVE"])
      && Array.isArray(c.entries) && c.entries.length > 0
      && array(c.entries, e => isRecord(e) && [e.resultCode, e.title, e.content].every(text)
        && array(e.sourceReferences, source)))
    && new Set(v.categories.map(c => c.category)).size === v.categories.length;
}
// Structural validation only: source verification and calculations belong to the Server.
export function isCalculationResponse(v: unknown): v is CalculationResponse {
  if (!isRecord(v)) return false;
  if (v.status === "FAILED") {
    return (v.requestId === null || (text(v.requestId) && UUID.test(v.requestId)))
      && (v.type === null || member(v.type, ["MAI_HOA", "TAM_THE"]))
      && hasFailureBody(v);
  }
  return isCalculationEnvelope(v) && v.status === "COMPLETED" && isRecord(v.data)
    && resultEvidence(v.data) && (v.type === "MAI_HOA" ? maiHoa(v.data) : tamThe(v.data));
}
