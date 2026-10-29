import { describe, expect, it } from "vitest";
import { isCalculationResponse, isCalculationEnvelope, isUncorrelatedServerFailure } from "@/types/contractValidation";
import { initialState, parseTerminal, reduceCalculation } from "@/services/websocket/calculationState";
import m03Time from "../../../docs/examples/m03-time-reading.response.json";
import m03Lines from "../../../docs/examples/m03-lines-reading.response.json";
import m03Objects from "../../../docs/examples/m03-object-reading.response.json";
import legacyObjects from "../../../docs/examples/mai-hoa-object-count.response.json";
import legacyTamThe from "../../../docs/examples/tam-the.response.json";
import d04Matched from "../../../docs/examples/d04-wealth-matched.response.json";
import d04NoLoc from "../../../docs/examples/d04-wealth-no-loc.response.json";

// Envelope fixtures only: these are not verified business results.
const requestId = "550e8400-e29b-41d4-a716-446655440000";
const completed = () => ({ requestId, type: "MAI_HOA", status: "COMPLETED", data: { fixtureOnly: true }, error: null });
const failed = () => ({ requestId, type: "TAM_THE", status: "FAILED", data: null, error: { code: "RULE_NOT_AVAILABLE", message: "Chưa kiểm chứng.", ruleCode: "TEST-FIXTURE", reason: "IMPLEMENTATION_UNAVAILABLE" } });

describe("isCalculationEnvelope", () => {
  it("accepts a valid COMPLETED envelope", () => {
    expect(isCalculationEnvelope(completed())).toBe(true);
  });

  it("accepts a valid FAILED envelope", () => {
    expect(isCalculationEnvelope(failed())).toBe(true);
  });

  it.each([false, 0, "", [], { arbitrary: "opaque" }].map((data) => [data]))("keeps non-null success data opaque: %j", (data) => {
    expect(isCalculationEnvelope({ ...completed(), data })).toBe(true);
  });

  it.each(["INVALID_INPUT", "INVALID_DATE", "INVALID_METHOD", "RULE_NOT_AVAILABLE", "SERVER_BUSY", "INTERNAL_ERROR", "PROCESSING_TIMEOUT", "DATABASE_UNAVAILABLE", "KNOWLEDGE_DATA_INCOMPLETE", "NOT_FOUND", "INVALID_SESSION", "CSRF_REJECTED"])("accepts existing Server code %s", (code) => {
    expect(isCalculationEnvelope({ ...failed(), error: { ...failed().error, code } })).toBe(true);
  });

  it.each([null, "TEST-FIXTURE"])("accepts ruleCode %j", (ruleCode) => {
    expect(isCalculationEnvelope({ ...failed(), error: { ...failed().error, ruleCode } })).toBe(true);
  });

  it("allows harmless extra fields without interpreting business data", () => {
    expect(isCalculationEnvelope({ ...completed(), futureMetadata: 1 })).toBe(true);
    expect(isCalculationEnvelope({ ...failed(), error: { ...failed().error, futureMetadata: 1 } })).toBe(true);
  });

  it.each(["requestId", "type", "status", "data", "error"])("rejects missing envelope field %s", (field) => {
    const value: Record<string, unknown> = completed();
    delete value[field];
    expect(isCalculationEnvelope(value)).toBe(false);
  });

  it.each([null, undefined, "", "not-a-uuid", 123])("rejects invalid requestId %j", (value) => {
    expect(isCalculationEnvelope({ ...completed(), requestId: value })).toBe(false);
  });

  it.each([null, "OTHER", 1])("rejects invalid type %j", (type) => {
    expect(isCalculationEnvelope({ ...completed(), type })).toBe(false);
  });

  it.each([null, "WAITING", "done", 1])("rejects invalid status %j", (status) => {
    expect(isCalculationEnvelope({ ...completed(), status })).toBe(false);
  });

  it("rejects COMPLETED with non-null error", () => {
    expect(isCalculationEnvelope({ ...completed(), error: failed().error })).toBe(false);
  });

  it.each([null, undefined])("rejects null or missing COMPLETED data: %j", (data) => {
    expect(isCalculationEnvelope({ ...completed(), data })).toBe(false);
  });

  it.each([false, 0, {}, []].map((data) => [data]))("rejects FAILED with non-null data: %j", (data) => {
    expect(isCalculationEnvelope({ ...failed(), data })).toBe(false);
  });

  it.each([null, undefined, "error", [], {}].map((error) => [error]))("rejects invalid FAILED error: %j", (error) => {
    expect(isCalculationEnvelope({ ...failed(), error })).toBe(false);
  });

  it("rejects a Client-local code used as a Server error code", () => {
    expect(isCalculationEnvelope({ ...failed(), error: { ...failed().error, code: "REQUEST_TIMEOUT" } })).toBe(false);
  });

  it.each(["code", "message", "ruleCode", "reason"])("rejects missing Server error field %s", (field) => {
    const error: Record<string, unknown> = { ...failed().error };
    delete error[field];
    expect(isCalculationEnvelope({ ...failed(), error })).toBe(false);
  });

  it.each([false, 123, {}])("rejects invalid ruleCode type: %j", (ruleCode) => {
    expect(isCalculationEnvelope({ ...failed(), error: { ...failed().error, ruleCode } })).toBe(false);
  });

  it("rejects non-string error message", () => {
    expect(isCalculationEnvelope({ ...failed(), error: { ...failed().error, message: null } })).toBe(false);
  });

  it.each([null, undefined, false, 0, "text", []].map((value) => [value]))("rejects non-object root: %j", (value) => {
    expect(isCalculationEnvelope(value)).toBe(false);
  });
});

import lines from "../../../docs/examples/mai-hoa-lines.response.json";
import objects from "../../../docs/examples/mai-hoa-object-count.response.json";
import timeFixture from "../../../docs/examples/mai-hoa-time.response.json";
describe("complete business response validation", () => {
  it("requires a lunarDate for TIME without performing calendar calculations", () => {
    expect(isCalculationResponse({ ...timeFixture, data: { ...timeFixture.data, lunarDate: null } })).toBe(false);
    expect(isCalculationResponse(timeFixture)).toBe(true);
  });
  it.each(["LINES", "OBJECT_COUNT"])("requires null lunarDate for %s", method => {
    expect(isCalculationResponse({ ...lines, data: { ...lines.data, method, lunarDate: { year: 2026, month: 1, day: 1, isLeapMonth: false } } })).toBe(false);
  });
  it.each([[], [{ category: "CAREER", entries: [] }]].map(categories => [categories]))("rejects empty Tam The success content %#", categories => {
    const data = { ...lines.data, categories };
    expect(isCalculationResponse({ ...lines, type: "TAM_THE", data })).toBe(false);
  });
  it("allows nonempty Tam The schema but rejects duplicate categories", () => {
    // Schema-only data, no prediction or approved success fixture.
    const entry = { resultCode: "TEST_ONLY", title: "Schema test", content: "TEST ONLY", sourceReferences: [] };
    const category = { category: "CAREER", entries: [entry, entry] };
    const response = { ...lines, type: "TAM_THE", data: { ...lines.data, categories: [category] } };
    expect(isCalculationResponse(response)).toBe(true);
    expect(isCalculationResponse({ ...response, data: { ...response.data, categories: [category, category] } })).toBe(false);
  });
  it.each([lines, objects])("accepts canonical Server fixture ($data.method)", value => {
    expect(isCalculationResponse(value)).toBe(true);
  });
  it.each([false, 0, "", [], { fixtureOnly: true }].map(data => [data]))("rejects opaque data as a typed business result: %j", data => {
    expect(isCalculationEnvelope({ ...completed(), data })).toBe(true);
    expect(isCalculationResponse({ ...completed(), data })).toBe(false);
  });
  it("rejects malformed hexagrams and source metadata", () => {
    expect(isCalculationResponse({ ...lines, data: { ...lines.data, primaryHexagram: { ...lines.data.primaryHexagram, linesBottomUp: [true] } } })).toBe(false);
    expect(isCalculationResponse({ ...lines, data: { ...lines.data, sourceReferences: [{}] } })).toBe(false);
    expect(isCalculationResponse({ ...lines, data: { ...lines.data, decisionReferences: [{}] } })).toBe(false);
    expect(isCalculationResponse({ ...lines, data: { ...lines.data, primaryHexagram: { ...lines.data.primaryHexagram, nameStatus: "DRAFT" } } })).toBe(false);
  });
  it("retains rule failure reason and permits uncorrelatable Server errors for separate routing", () => {
    expect(isCalculationResponse(failed())).toBe(true);
    expect(isCalculationResponse({ ...failed(), requestId: null, type: null })).toBe(true);
    // Forward-compatible reason strings are intentional; their shape stays mandatory.
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, reason: "invented" } })).toBe(true);
  });
  it("rejects Mai Hoa data labeled as Tam The", () => {
    expect(isCalculationResponse({ ...lines, type: "TAM_THE" })).toBe(false);
  });
});

describe("B04 TIME runtime structure from the actual Server fixture", () => {
  function reject(change: (data: Record<string, unknown>) => void) {
    const response = structuredClone(timeFixture);
    change(response.data as unknown as Record<string, unknown>);
    expect(isCalculationResponse(response)).toBe(false);
  }
  const numbers = (data: Record<string, unknown>) => (data.calculationSteps as { values: Record<string, unknown> }[])[0].values;
  const lunar = (data: Record<string, unknown>) => data.lunarDate as Record<string, unknown>;

  it("accepts the approved TEAM_DECISION/VERIFIED fixture and leaves it unchanged", () => {
    const original = JSON.stringify(timeFixture);
    expect(isCalculationResponse(timeFixture)).toBe(true);
    expect(JSON.stringify(timeFixture)).toBe(original);
  });
  it.each([null, undefined])("rejects absent lunarDate %j", lunarDate => reject(data => { data.lunarDate = lunarDate; }));
  it.each([1898, 2100, 2024.5, NaN, Infinity, "2024", null, undefined])("rejects unsupported/raw lunar year %j", year => reject(data => { lunar(data).year = year; }));
  it.each([0, 13, 1.5, "1", null])("rejects lunar month %j", month => reject(data => { lunar(data).month = month; }));
  it.each([0, 31, 99, "1", null])("rejects lunar day %j", day => reject(data => { lunar(data).day = day; }));
  it.each(["true", 1, null, undefined])("rejects nonboolean leap flag %j", flag => reject(data => { lunar(data).isLeapMonth = flag; }));
  it.each(["lunarYear", "lunarMonth", "lunarDay", "isLeapMonth"])("rejects contradictory repeated %s", field => reject(data => {
    numbers(data)[field] = field === "isLeapMonth" ? true : 2;
  }));
  it.each([
    "lunarYear", "lunarMonth", "lunarDay", "isLeapMonth", "yearBranchIndex", "hourIndex", "dateSum", "timeSum",
    "upperTrigram", "lowerTrigram", "movingLine", "utcOffset", "dayBoundary", "leapMonthPolicy",
  ])("requires TIME_NUMBERS field %s", field => reject(data => { delete numbers(data)[field]; }));
  it.each([
    "lunarYear", "lunarMonth", "lunarDay", "yearBranchIndex", "hourIndex", "dateSum", "timeSum", "upperTrigram", "lowerTrigram", "movingLine",
  ])("does not coerce numeric field %s", field => reject(data => { numbers(data)[field] = String(numbers(data)[field]); }));
  it.each([
    ["yearBranchIndex", 0], ["yearBranchIndex", 13], ["hourIndex", 0], ["hourIndex", 13],
    ["upperTrigram", 0], ["upperTrigram", 9], ["lowerTrigram", 0], ["lowerTrigram", 9],
    ["dateSum", 2], ["dateSum", 55], ["timeSum", 3], ["timeSum", 67], ["dateSum", 7.5], ["timeSum", Infinity],
    ["utcOffset", "+08:00"], ["utcOffset", 7], ["dayBoundary", "23:00"], ["leapMonthPolicy", "NEXT_MONTH"],
  ])("rejects unsupported TIME value %s=%j", (field, value) => reject(data => { numbers(data)[field] = value; }));
  it.each([null, undefined, {}, [], "TIME_NUMBERS"])("rejects malformed TIME_NUMBERS values %j", values => reject(data => {
    (data.calculationSteps as Record<string, unknown>[])[0].values = values;
  }));
  it.each([null, undefined, [], [timeFixture.data.calculationSteps[1], timeFixture.data.calculationSteps[2]]])("requires TIME steps %#", steps => reject(data => { data.calculationSteps = steps; }));
  it.each([0, 1, 2])("rejects missing/duplicate/wrong required step code at index %i", index => reject(data => {
    (data.calculationSteps as { code: unknown }[])[index].code = index === 0 ? "MUTUAL" : "TIME_NUMBERS";
  }));
  it("rejects reordered steps", () => reject(data => { (data.calculationSteps as unknown[]).reverse(); }));
  it("rejects an extra duplicate required step", () => reject(data => { (data.calculationSteps as unknown[]).push(structuredClone(timeFixture.data.calculationSteps[2])); }));
  it.each([0, 7, 1.5, "2"])("rejects invalid movingLine %j", movingLine => reject(data => { data.movingLine = movingLine; }));
  it("rejects a contradictory TIME_NUMBERS moving line", () => reject(data => { numbers(data).movingLine = 3; }));
  it("rejects a contradictory CHANGE moving line", () => reject(data => { (data.calculationSteps as { values: Record<string, unknown> }[])[2].values.movingLine = 3; }));
  it.each(["lowerLineStart", "upperLineStart"])("requires MUTUAL field %s", field => reject(data => {
    delete (data.calculationSteps as { values: Record<string, unknown> }[])[1].values[field];
  }));
  it.each(["primaryHexagram", "mutualHexagram", "changedHexagram"])("rejects invalid six-line shape in %s", field => reject(data => {
    (data[field] as Record<string, unknown>).linesBottomUp = [true, false];
  }));
  it.each([{ year: 1899, month: 12, day: 1 }, { year: 2099, month: 11, day: 20 }])("accepts supported lunar-year edge $year without converting a date", ({ year, month, day }) => {
    const response = structuredClone(timeFixture);
    Object.assign(response.data.lunarDate, { year, month, day });
    Object.assign(response.data.calculationSteps[0].values, { lunarYear: year, lunarMonth: month, lunarDay: day });
    // Alternate DTO shape only: this does not assert a new calculated hexagram result.
    expect(isCalculationResponse(response)).toBe(true);
  });
  it("accepts an alternate leap-month DTO when repeated fields agree", () => {
    const response = structuredClone(timeFixture);
    response.data.lunarDate = { year: 2023, month: 2, day: 1, isLeapMonth: true };
    Object.assign(response.data.calculationSteps[0].values, { lunarYear: 2023, lunarMonth: 2, lunarDay: 1, isLeapMonth: true });
    expect(isCalculationResponse(response)).toBe(true);
  });
  it("keeps safe additional metadata and generic step values forward-compatible", () => {
    const response = structuredClone(timeFixture);
    Object.assign(response.data.calculationSteps[0].values, { futureLabel: "safe", futureFlag: true, futureLines: [true, false] });
    Object.assign(response.data.lunarDate, { futureMetadata: "safe" });
    expect(isCalculationResponse(response)).toBe(true);
  });
});

describe("V12 merge preserves strict B04 checks alongside M03 and D04", () => {
  type MutableTime = {
    lunarDate: Record<string, unknown>;
    calculationSteps: { code: string; message: string; values: Record<string, unknown> }[];
    detailedReading: typeof m03Time.data.detailedReading;
  };
  function rejectTime(mutate: (data: MutableTime) => void) {
    const response = structuredClone(m03Time);
    mutate(response.data as unknown as MutableTime);
    expect(isCalculationResponse(response)).toBe(false);
    expect(() => parseTerminal(response)).toThrow("Invalid terminal response");
  }

  it.each([
    ["B04 TIME", timeFixture], ["M03 TIME", m03Time], ["legacy LINES", lines],
    ["legacy OBJECT_COUNT", legacyObjects], ["M03 LINES", m03Lines], ["M03 OBJECT_COUNT", m03Objects],
    ["D03 LEGACY", legacyTamThe], ["D04 matched", d04Matched], ["D04 LOC no-match", d04NoLoc],
  ])("accepts %s through the guard, terminal parser and reducer without progress", (_name, response) => {
    expect(isCalculationResponse(response)).toBe(true);
    const terminal = parseTerminal(response);
    const waiting = reduceCalculation(initialState, { kind: "begin", requestId: response.requestId, type: terminal.type! });
    const completed = reduceCalculation(waiting, { kind: "terminal", response: terminal });
    expect(completed.requestState).toBe("completed");
    expect(completed.progress).toEqual([]);
    expect(completed.response).toEqual(response);
    expect(reduceCalculation(completed, { kind: "terminal", response: terminal })).toBe(completed);
  });
  it("retains M03 TIME aggregate provenance independently of its verified interpretation phases", () => {
    expect(parseTerminal(m03Time).data).toMatchObject({ ruleBasis: "TEAM_DECISION", sourceStatus: "SOURCE_AMBIGUOUS" });
    expect(m03Time.data.detailedReading.phases.every(phase => phase.ruleBasis === "SOURCE_VERIFIED" && phase.sourceStatus === "VERIFIED")).toBe(true);
  });
  it.each([1898, 2100, 2024.5, "2024", Number.MAX_SAFE_INTEGER + 1])("M03 rejects invalid lunar year %j", year => rejectTime(data => { data.lunarDate.year = year; }));
  it.each([0, 13, 1.5, "1"])("M03 rejects invalid lunar month %j", month => rejectTime(data => { data.lunarDate.month = month; }));
  it.each([0, 31, 1.5, "1"])("M03 rejects invalid lunar day %j", day => rejectTime(data => { data.lunarDate.day = day; }));
  it.each(["true", 1, null, undefined])("M03 rejects invalid leap flag %j", flag => rejectTime(data => { data.lunarDate.isLeapMonth = flag; }));
  it.each([
    "lunarYear", "lunarMonth", "lunarDay", "isLeapMonth", "yearBranchIndex", "hourIndex", "dateSum", "timeSum",
    "upperTrigram", "lowerTrigram", "movingLine", "utcOffset", "dayBoundary", "leapMonthPolicy",
  ])("M03 still requires TIME_NUMBERS.%s", field => rejectTime(data => { delete data.calculationSteps[0].values[field]; }));
  it.each([
    ["yearBranchIndex", 0], ["hourIndex", 13], ["dateSum", 2], ["timeSum", 67], ["upperTrigram", 9], ["lowerTrigram", 0],
    ["dateSum", 7.5], ["timeSum", Infinity], ["hourIndex", "1"], ["utcOffset", "+08:00"],
    ["dayBoundary", "23:00"], ["leapMonthPolicy", "NEXT_MONTH"],
  ])("M03 rejects malformed B04 value %s=%j", (field, value) => rejectTime(data => { data.calculationSteps[0].values[field as string] = value; }));
  it.each(["lunarYear", "lunarMonth", "lunarDay", "isLeapMonth", "movingLine"])("M03 rejects contradictory TIME_NUMBERS.%s", field => rejectTime(data => {
    data.calculationSteps[0].values[field] = field === "isLeapMonth" ? true : 3;
  }));
  it("M03 still checks CHANGE movingLine and MUTUAL line starts", () => {
    rejectTime(data => { data.calculationSteps[2].values.movingLine = 3; });
    rejectTime(data => { data.calculationSteps[1].values.lowerLineStart = 1; });
    rejectTime(data => { delete data.calculationSteps[1].values.upperLineStart; });
  });
  it.each([0, 1, 2, 3, 4, 5])("rejects a missing step at index %i", index => rejectTime(data => { data.calculationSteps.splice(index, 1); }));
  it.each([0, 1, 2, 3, 4, 5])("rejects an absent array slot at index %i without throwing", index => rejectTime(data => { delete data.calculationSteps[index]; }));
  it.each([3, 4, 5])("rejects duplicate/wrong M03 step code at index %i", index => rejectTime(data => { data.calculationSteps[index].code = "READING_BODY_USE" === data.calculationSteps[index].code ? "READING_PHASES" : "READING_BODY_USE"; }));
  it("rejects reordered M03 steps", () => rejectTime(data => {
    [data.calculationSteps[3], data.calculationSteps[4]] = [data.calculationSteps[4], data.calculationSteps[3]];
  }));
  it("rejects unexpected extra steps", () => rejectTime(data => { data.calculationSteps.push({ code: "EXTRA", message: "Unexpected", values: {} }); }));
  it.each([0, 1, 2, 3, 4, 5])("rejects malformed values at index %i", index => rejectTime(data => {
    Object.assign(data.calculationSteps[index], { values: null });
  }));
  it.each([
    [3, "movingLine"], [3, "bodySide"], [3, "bodyTrigram"], [3, "bodyElement"], [3, "useTrigram"], [3, "useElement"],
    [4, "initialRelation"], [4, "bodyMutualRelation"], [4, "useMutualRelation"], [4, "finalRelation"],
    [5, "status"], [5, "lunarMonth"], [5, "isLeapMonth"], [5, "season"], [5, "bodyStrength"], [5, "ruleBasis"],
  ] as const)("requires M03 step %i field %s", (index, field) => rejectTime(data => { delete data.calculationSteps[index].values[field]; }));
  it("rejects M03 step values that disagree with the validated reading", () => {
    rejectTime(data => { data.calculationSteps[3].values.bodySide = "LOWER"; });
    rejectTime(data => { data.calculationSteps[4].values.finalRelation = "SAME_ELEMENT"; });
    rejectTime(data => { data.calculationSteps[5].values.bodyStrength = "VIGOROUS"; });
    rejectTime(data => { data.detailedReading.season.lunarDate.day = 2; });
  });
  it("rejects explicit null or malformed detailedReading", () => {
    rejectTime(data => { Object.assign(data, { detailedReading: null }); });
    rejectTime(data => { Object.assign(data, { detailedReading: {} }); });
  });
  it("rejects malformed reading phases, sources and decisions", () => {
    rejectTime(data => { data.detailedReading.phases[0].kind = "FINAL_USE"; });
    rejectTime(data => { data.detailedReading.phases[0].sourceReferences[0].sha256 = "invalid"; });
    rejectTime(data => { data.detailedReading.calculationDecisions[0].limitation = ""; });
  });
  it("TIME cannot carry a missing-time season used by context-free LINES", () => rejectTime(data => {
    Object.assign(data.detailedReading, { season: structuredClone(m03Lines.data.detailedReading.season) });
  }));
  it("rejects M03 steps on legacy TIME without a validated reading", () => {
    const response = structuredClone(m03Time);
    delete (response.data as Record<string, unknown>).detailedReading;
    expect(isCalculationResponse(response)).toBe(false);
  });
  it("rejects a detailed TIME response containing only legacy steps", () => rejectTime(data => { data.calculationSteps.length = 3; }));
  it("accepts D04 LOC no-match without fabricating entries or failing the whole request", () => {
    expect(parseTerminal(d04NoLoc).status).toBe("COMPLETED");
    const wealth = d04NoLoc.data.categories.find(category => category.category === "WEALTH")!;
    expect(wealth.subreadings?.[0]).toMatchObject({ code: "LOC", status: "NO_SOURCE_MATCH", reason: "NO_PRINTED_INTERSECTION", entries: [] });
  });
  it("rejects a missing D04 subreading and inconsistent flattened entries", () => {
    const missing = structuredClone(d04Matched);
    missing.data.categories.find(category => category.category === "WEALTH")!.subreadings!.pop();
    expect(isCalculationResponse(missing)).toBe(false);
    const inconsistent = structuredClone(d04Matched);
    inconsistent.data.categories.find(category => category.category === "WEALTH")!.entries[0].content = "Not the captured content";
    expect(isCalculationResponse(inconsistent)).toBe(false);
  });
  it.each(["INVALID_INPUT", "SERVER_BUSY"])("keeps %s terminal responses as failures without progress", code => {
    const terminal = parseTerminal({ ...failed(), error: { ...failed().error, code } });
    const waiting = reduceCalculation(initialState, { kind: "begin", requestId, type: "TAM_THE" });
    const result = reduceCalculation(waiting, { kind: "terminal", response: terminal });
    expect(result.requestState).toBe("failed");
    expect(result.response?.error?.code).toBe(code);
  });
});

describe("v1.2 error compatibility", () => {
  it.each(["UNKNOWN_RULE", "EXECUTION_DISABLED", "RULE_STATE_UNAVAILABLE", "RULE_VERSION_MISMATCH", "SOURCE_UNVERIFIED", "MISSING_SOURCE_REFERENCE", "MISSING_SOURCE_REVIEW", "MISSING_DECISION_REFERENCE", "TEAM_DECISION_NOT_ALLOWED", "IMPLEMENTATION_UNAVAILABLE", "FUTURE_REASON"])("accepts known/future reason %s", reason => {
    const value = { ...failed(), error: { ...failed().error, reason } };
    expect(isCalculationEnvelope(value)).toBe(true);
    expect(isCalculationResponse(value)).toBe(true);
  });
  it("E03 accepts future nonempty codes without promoting failure to success", () => {
    const value = { ...failed(), error: { ...failed().error, code: "FUTURE_SERVER_CODE", reason: "FUTURE_REASON" } };
    expect(isCalculationEnvelope(value)).toBe(true);
    expect(isCalculationResponse(value)).toBe(true);
  });
  it.each(["", "  ", null, undefined, 1, false, {}])("E04 rejects invalid code %j", code => {
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, code } })).toBe(false);
  });
  it.each(["", "  ", undefined, 1, false, {}])("E04 rejects invalid reason %j", reason => {
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, reason } })).toBe(false);
  });
  it.each(["REQUEST_TIMEOUT", "DISCONNECTED", "INVALID_RESPONSE"])("keeps reserved Client-local code %s out of Server responses", code => {
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, code } })).toBe(false);
  });
  it.each([null, undefined, "bad-id", "", 17])("E09/E10 classifies ID %j for a notice, never a correlated envelope", requestId => {
    const value = { ...failed(), requestId };
    expect(isUncorrelatedServerFailure(value)).toBe(true);
    expect(isCalculationEnvelope(value)).toBe(false);
    expect(isCalculationResponse(value)).toBe(requestId === null);
  });
  it("allows the documented null ID/type failure only as an uncorrelated notice", () => {
    expect(isUncorrelatedServerFailure({ ...failed(), requestId: null, type: null })).toBe(true);
    expect(isUncorrelatedServerFailure(failed())).toBe(false);
  });
  it.each([
    { ...failed(), requestId: null, type: "OTHER" },
    { ...failed(), requestId: null, data: {} },
    { ...failed(), requestId: null, error: {} },
    { ...failed(), requestId: null, status: "COMPLETED" },
  ])("does not turn a malformed failure into a generic Server notice %#", value => {
    expect(isUncorrelatedServerFailure(value)).toBe(false);
  });
});
