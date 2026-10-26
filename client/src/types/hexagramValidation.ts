import type { HexagramDetail, HexagramRecord, Page, RestResponse, SourceReference } from "./contract";
import { isRecord } from "./contractValidation";

export const TRIGRAMS = ["CAN", "DOAI", "LY", "CHAN", "TON", "KHAM", "CAN2", "KHON"] as const;
export const TRIGRAM_LABELS: Record<typeof TRIGRAMS[number], string> = {
  CAN: "Càn", DOAI: "Đoài", LY: "Ly", CHAN: "Chấn", TON: "Tốn", KHAM: "Khảm", CAN2: "Cấn", KHON: "Khôn",
};
const statuses = ["DRAFT", "SOURCE_LOCATED", "SOURCE_AMBIGUOUS", "BLOCKED_SOURCE_CONFLICT", "VERIFIED"];
const nonempty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const nullableText = (v: unknown) => v === null || typeof v === "string";
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
export const isHexagramCode = (v: unknown): v is string => typeof v === "string" && v.length <= 64 && /^H_[A-Z0-9]+_[A-Z0-9]+$/.test(v);

function source(v: unknown): v is SourceReference {
  return isRecord(v) && [v.sourceId, v.title, v.version, v.section].every(nonempty)
    && [v.printedPage, v.sha256, v.url].every(nullableText)
    && (v.pdfPage === null || (integer(v.pdfPage) && v.pdfPage > 0));
}
function sources(v: unknown): v is SourceReference[] { return Array.isArray(v) && v.every(source); }
function traceable(v: SourceReference) {
  return v.pdfPage !== null || (v.printedPage !== null && v.printedPage.trim() !== "") || (v.url !== null && v.url.trim() !== "");
}
export function isHexagramRecord(v: unknown): v is HexagramRecord {
  return isRecord(v) && isHexagramCode(v.code) && nonempty(v.name)
    && ["STRUCTURAL_LABEL", "CANONICAL_TITLE"].includes(String(v.nameKind))
    && statuses.includes(String(v.verificationStatus))
    && TRIGRAMS.includes(v.upperTrigramCode as typeof TRIGRAMS[number])
    && TRIGRAMS.includes(v.lowerTrigramCode as typeof TRIGRAMS[number])
    && v.code === `H_${v.upperTrigramCode}_${v.lowerTrigramCode}`
    && Array.isArray(v.linesBottomUp) && v.linesBottomUp.length === 6 && v.linesBottomUp.every(x => typeof x === "boolean")
    && sources(v.sourceReferences)
    && (v.verificationStatus !== "VERIFIED" || v.sourceReferences.some(traceable));
}
export function isHexagramPage(v: unknown): v is Page<HexagramRecord> {
  if (!isRecord(v) || !integer(v.page) || v.page < 0 || v.page > 2147483647
    || !integer(v.size) || v.size < 1 || v.size > 100
    || !integer(v.totalElements) || v.totalElements < 0 || v.totalElements > 64
    || v.totalPages !== Math.ceil(v.totalElements / v.size)
    || !Array.isArray(v.items) || !v.items.every(isHexagramRecord)) return false;
  const expected = Math.max(0, Math.min(v.size, v.totalElements - v.page * v.size));
  return v.items.length === expected && new Set(v.items.map(x => x.code)).size === v.items.length;
}
export function isHexagramDetail(v: unknown): v is HexagramDetail {
  if (!isRecord(v)) return false;
  const interpretations = v.interpretations;
  return isHexagramRecord(v) && Array.isArray(interpretations) && interpretations.length <= 1
    && interpretations.every(g => isRecord(g) && g.resultCode === "NAME_GLOSS" && g.category === "NAME_GLOSS"
      && nonempty(g.title) && nonempty(g.content) && g.verificationStatus === "VERIFIED"
      && integer(g.sourceOrder) && g.sourceOrder >= 1 && g.sourceOrder <= 64
      && nonempty(g.printedSourceLabel) && nonempty(g.verificationNote)
      && sources(g.sourceReferences) && g.sourceReferences.some(traceable));
}
export function isLookupResponse<T>(v: unknown, dataGuard: (data: unknown) => data is T): v is RestResponse<T> {
  if (!isRecord(v) || typeof v.requestId !== "string" || v.requestId.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.requestId)) return false;
  if (v.status === "COMPLETED") return v.error === null && dataGuard(v.data);
  return v.status === "FAILED" && v.data === null && isRecord(v.error)
    && nonempty(v.error.code) && nonempty(v.error.message)
    && nullableText(v.error.ruleCode) && nullableText(v.error.reason);
}
