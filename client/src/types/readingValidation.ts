// Schema checks for M02. Actual book authorization and calculations remain on the Server.
import type { DetailedReading } from "./readingContract";

const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const oneOf = (v: unknown, values: readonly string[]) => text(v) && values.includes(v);
const list = (v: unknown, check: (item: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.every(check);
const nonempty = (v: unknown, check: (item: unknown) => boolean) => list(v, check) && v.length > 0;

function source(v: unknown): boolean {
  if (!record(v) || ![v.sourceId, v.title, v.version, v.section].every(text)) return false;
  if (v.pdfPage !== null || v.printedPage !== null) {
    return integer(v.pdfPage) && v.pdfPage > 0 && text(v.printedPage)
      && text(v.sha256) && /^[0-9a-f]{64}$/i.test(v.sha256)
      && (v.url === null || typeof v.url === "string");
  }
  return text(v.url) && v.url.startsWith("https://") && v.url.length > 8
    && (v.sha256 === null || typeof v.sha256 === "string");
}
function decision(v: unknown): boolean {
  return record(v) && [v.decisionId, v.policy, v.description, v.limitation].every(text)
    && oneOf(v.purpose, ["CALCULATION", "EDITORIAL_LINK"]) && v.ruleBasis === "TEAM_DECISION"
    && oneOf(v.sourceStatus, ["SOURCE_LOCATED", "SOURCE_AMBIGUOUS", "BLOCKED_SOURCE_CONFLICT", "VERIFIED"])
    && nonempty(v.sourceReferences, source);
}
function role(v: unknown): v is Record<string, unknown> {
  return record(v) && oneOf(v.side, ["UPPER", "LOWER"])
    && oneOf(v.trigramCode, ["CAN", "DOAI", "LY", "CHAN", "TON", "KHAM", "CAN2", "KHON"])
    && oneOf(v.element, ["KIM", "MOC", "THUY", "HOA", "THO"]);
}
function season(v: unknown): boolean {
  if (!record(v)) return false;
  if (v.status === "NOT_EVALUATED") {
    return v.reason === "MISSING_READING_TIME" && v.datetime === null && v.lunarDate === null
      && v.season === null && v.bodyStrength === null && Array.isArray(v.sourceReferences) && v.sourceReferences.length === 0;
  }
  if (v.status !== "EVALUATED" || v.reason !== null || !text(v.datetime)
    || !/(Z|[+-]\d{2}:\d{2})$/.test(v.datetime) || !Number.isFinite(Date.parse(v.datetime))) return false;
  const localYear = new Date(Date.parse(v.datetime) + 7 * 3600_000).getUTCFullYear();
  return localYear >= 1900 && localYear <= 2099 && record(v.lunarDate)
    && integer(v.lunarDate.year) && integer(v.lunarDate.month) && v.lunarDate.month >= 1 && v.lunarDate.month <= 12
    && integer(v.lunarDate.day) && v.lunarDate.day >= 1 && v.lunarDate.day <= 30 && typeof v.lunarDate.isLeapMonth === "boolean"
    && oneOf(v.season, ["SPRING", "SUMMER", "AUTUMN", "WINTER", "EARTH_MONTH"])
    && oneOf(v.bodyStrength, ["VIGOROUS", "WEAK", "UNCLASSIFIED"]) && nonempty(v.sourceReferences, source);
}

export function isDetailedReading(v: unknown): v is DetailedReading {
  const phases = ["INITIAL_USE", "MIDDLE_BODY_MUTUAL", "MIDDLE_USE_MUTUAL", "FINAL_USE"];
  return record(v) && v.schemaVersion === "1.0" && text(v.bundleId)
    && oneOf(v.topic, ["GENERAL", "CAREER", "WEALTH", "LOVE"]) && v.textKind === "EDITORIAL_PARAPHRASE"
    && role(v.body) && role(v.use) && v.body.side !== v.use.side && season(v.season) && text(v.summary)
    && Array.isArray(v.phases) && v.phases.length === 4
    && v.phases.every((p, i) => record(p) && p.kind === phases[i] && role(p.comparator)
      && oneOf(p.relation, ["SAME_ELEMENT", "USE_GENERATES_BODY", "BODY_GENERATES_USE", "BODY_CONTROLS_USE", "USE_CONTROLS_BODY"])
      && text(p.templateCode) && text(p.content) && p.textKind === "EDITORIAL_PARAPHRASE"
      && p.ruleBasis === "SOURCE_VERIFIED" && p.sourceStatus === "VERIFIED" && nonempty(p.sourceReferences, source))
    && nonempty(v.calculationDecisions, d => decision(d) && record(d) && d.purpose === "CALCULATION")
    && nonempty(v.sourceReferences, source);
}

function entry(v: unknown, code: unknown): boolean {
  return record(v) && [v.resultCode, v.title, v.content].every(text)
    && v.subreadingCode === code && nonempty(v.sourceReferences, source);
}
function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (record(v)) return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

export function hasValidWealthMetadata(v: Record<string, unknown>): boolean {
  if (!Array.isArray(v.categories)) return false;
  if (v.coverageMode !== "EXTENDED") {
    return (!Object.hasOwn(v, "coverageMode") || v.coverageMode === "LEGACY")
      && !Object.hasOwn(v, "bundleId") && !Object.hasOwn(v, "editorialDecisions")
      && v.categories.every(c => record(c) && !Object.hasOwn(c, "subreadings")
        && list(c.entries, e => record(e) && !Object.hasOwn(e, "subreadingCode")));
  }
  if (!text(v.bundleId) || !list(v.editorialDecisions, decision)) return false;
  const wealth = v.categories.find(c => record(c) && c.category === "WEALTH");
  if (!record(wealth) || !Array.isArray(wealth.subreadings) || wealth.subreadings.length !== 3) return false;
  if (v.categories.some(c => !record(c) || (c.category !== "WEALTH" && Object.hasOwn(c, "subreadings")))) return false;
  const codes = ["LOC", "SANG_HEN", "DIEN_SAN"];
  const rules = ["TT-TAI-LOC", "TT-SANG-HEN", "TT-DIEN-SAN"];
  const valid = wealth.subreadings.every((s, i) => record(s) && s.code === codes[i]
    && s.ruleCode === rules[i] && text(s.lookupKey) && nonempty(s.sourceReferences, source) && list(s.decisionReferences, decision)
    && s.decisionReferences.every(d => (v.editorialDecisions as unknown[]).some(root => stable(root) === stable(d)))
    && (s.status === "MATCHED" ? s.reason === null && nonempty(s.entries, e => entry(e, s.code))
      : s.status === "NO_SOURCE_MATCH" && s.code === "LOC" && s.reason === "NO_PRINTED_INTERSECTION"
        && Array.isArray(s.entries) && s.entries.length === 0));
  return valid && stable(wealth.entries) === stable(wealth.subreadings.flatMap(s => s.entries));
}
