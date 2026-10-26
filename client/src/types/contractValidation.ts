import type { ApiError, CalculationResponse, CalculationType, ErrorCode } from "@/types/contract";
import { hasValidWealthMetadata, isDetailedReading } from "./readingValidation";

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

const inRange = (v: unknown, min: number, max: number) => integer(v) && v >= min && v <= max;

// C01 covers SOLAR 1900..2099; early 1900 can return lunar year 1899.
// Check wire structure and repeated fields only, never recompute calendar or hexagrams.
function timeResult(v: Record<string, unknown>): boolean {
  const lunar = v.lunarDate;
  const steps = v.calculationSteps;
  const hasReading = Object.hasOwn(v, "detailedReading");
  const stepCodes = hasReading
    ? ["TIME_NUMBERS", "MUTUAL", "CHANGE", "READING_BODY_USE", "READING_PHASES", "READING_SEASON"]
    : ["TIME_NUMBERS", "MUTUAL", "CHANGE"];
  if (!isRecord(lunar) || !inRange(lunar.year, 1899, 2099)
      || !inRange(lunar.month, 1, 12) || !inRange(lunar.day, 1, 30)
      || typeof lunar.isLeapMonth !== "boolean" || !Array.isArray(steps)
      || steps.length !== stepCodes.length
      || !stepCodes.every((code, index) => isRecord(steps[index])
        && steps[index].code === code && isRecord(steps[index].values))) return false;
  const [numbers, mutual, change] = steps;
  if (!isRecord(numbers) || numbers.code !== "TIME_NUMBERS" || !isRecord(numbers.values)
      || !isRecord(mutual) || mutual.code !== "MUTUAL" || !isRecord(mutual.values)
      || !isRecord(change) || change.code !== "CHANGE" || !isRecord(change.values)) return false;
  if (hasReading) {
    const reading = v.detailedReading;
    if (!isDetailedReading(reading) || reading.season.status !== "EVALUATED") return false;
    const body = steps[3].values;
    const phases = steps[4].values;
    const season = steps[5].values;
    // Compare repeated Server fields only; never derive roles, relations or seasons locally.
    if (body.movingLine !== v.movingLine || body.bodySide !== reading.body.side
        || body.bodyTrigram !== reading.body.trigramCode || body.bodyElement !== reading.body.element
        || body.useTrigram !== reading.use.trigramCode || body.useElement !== reading.use.element
        || phases.initialRelation !== reading.phases[0].relation
        || phases.bodyMutualRelation !== reading.phases[1].relation
        || phases.useMutualRelation !== reading.phases[2].relation
        || phases.finalRelation !== reading.phases[3].relation
        || season.status !== "EVALUATED" || season.lunarMonth !== lunar.month
        || season.isLeapMonth !== lunar.isLeapMonth || season.season !== reading.season.season
        || season.bodyStrength !== reading.season.bodyStrength || season.ruleBasis !== "TEAM_DECISION"
        || reading.season.lunarDate.year !== lunar.year || reading.season.lunarDate.month !== lunar.month
        || reading.season.lunarDate.day !== lunar.day || reading.season.lunarDate.isLeapMonth !== lunar.isLeapMonth) return false;
  }
  const values = numbers.values;
  return values.lunarYear === lunar.year && values.lunarMonth === lunar.month
    && values.lunarDay === lunar.day && values.isLeapMonth === lunar.isLeapMonth
    && inRange(values.yearBranchIndex, 1, 12) && inRange(values.hourIndex, 1, 12)
    && inRange(values.dateSum, 3, 54) && inRange(values.timeSum, 4, 66)
    && inRange(values.upperTrigram, 1, 8) && inRange(values.lowerTrigram, 1, 8)
    && values.movingLine === v.movingLine && change.values.movingLine === v.movingLine
    && mutual.values.lowerLineStart === 2 && mutual.values.upperLineStart === 3
    && values.utcOffset === "+07:00" && values.dayBoundary === "00:00"
    && values.leapMonthPolicy === "SAME_MONTH_NUMBER";
}

function maiHoa(v: Record<string, unknown>): boolean {
  return member(v.method, ["TIME", "OBJECT_COUNT", "LINES"])
    && (!Object.hasOwn(v, "detailedReading") || isDetailedReading(v.detailedReading))
    && [v.primaryHexagram, v.mutualHexagram, v.changedHexagram].every(hexagram)
    && integer(v.movingLine) && v.movingLine >= 1 && v.movingLine <= 6
    && (v.method !== "TIME" ? v.lunarDate === null : timeResult(v))
    && array(v.calculationSteps, s => isRecord(s) && text(s.code) && text(s.message)
      && isRecord(s.values) && Object.values(s.values).every(x => text(x)
        || (typeof x === "number" && Number.isFinite(x)) || typeof x === "boolean"
        || array(x, b => typeof b === "boolean")));
}
function tamThe(v: Record<string, unknown>): boolean {
  return v.ruleBasis === "SOURCE_VERIFIED" && v.sourceStatus === "VERIFIED"
    && hasValidWealthMetadata(v)
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
