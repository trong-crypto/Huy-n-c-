import { describe, expect, it } from "vitest";
import calendar from "../../../docs/examples/calendar-convert.response.json";
import canChi from "../../../docs/examples/calendar-can-chi.response.json";
import invalid from "../../../docs/examples/calendar-invalid-date.response.json";
import { isCalendarResult, isCanChiResult } from "./calendarValidation";
import { isLookupResponse } from "./hexagramValidation";

describe("C01 strict runtime decoding", () => {
  it("accepts real calendar/Can Chi/error fixtures without modifying them", () => {
    const before = JSON.stringify([calendar, canChi, invalid]);
    expect(isLookupResponse(calendar, isCalendarResult)).toBe(true);
    expect(isLookupResponse(canChi, isCanChiResult)).toBe(true);
    expect(isLookupResponse(invalid, isCalendarResult)).toBe(true);
    expect(JSON.stringify([calendar, canChi, invalid])).toBe(before);
  });
  it.each([
    { solarDate: "1900-02-29" }, { solarDate: "2024-02-30" }, { solarDate: "1899-12-31" }, { solarDate: "2100-01-01" },
    { solarDate: "2024-2-10" }, { solarDate: "2024-02-10T00:00:00Z" }, { timezone: "UTC" },
    { lunarDate: { year: 2024, month: 1, day: "1", isLeapMonth: false } },
    { lunarDate: { year: 1898, month: 1, day: 1, isLeapMonth: false } },
    { lunarDate: { year: 2024, month: 13, day: 1, isLeapMonth: false } },
    { lunarDate: { year: 2024, month: 1, day: 31, isLeapMonth: false } },
    { lunarDate: { year: 2024, month: 1, day: 1 } },
    { ruleBasis: "VERIFIED" }, { sourceStatus: "UNKNOWN" }, { rules: [] }, { sourceReferences: [] },
    { rules: [{ ...calendar.data.rules[0], executionPolicy: "DISABLED" }] },
    { decisionReferences: [{ decisionId: "missing-fields" }] },
    { sourceReferences: [{ ...calendar.data.sourceReferences[0], pdfPage: "1" }] },
  ])("rejects invalid calendar/evidence field %#", patch => expect(isCalendarResult({ ...calendar.data, ...patch })).toBe(false));
  it("accepts lunar year 1899 without recomputing its solar mapping", () => {
    expect(isCalendarResult({ ...calendar.data, solarDate: "1900-01-01", lunarDate: { year: 1899, month: 12, day: 1, isLeapMonth: false } })).toBe(true);
  });
  it("keeps hour=null valid and TY/TI distinct", () => {
    expect(isCanChiResult({ ...canChi.data, hour: null })).toBe(true);
    expect(isCanChiResult({ ...canChi.data, hour: { stem: "GIAP", branch: "TI" } })).toBe(true);
  });
  it.each([{ hour: undefined }, { hour: {} }, { year: null }, { month: { stem: "giap", branch: "THIN" } }, { day: { stem: "GIAP", branch: "UNKNOWN" } }, { hour: { stem: "constructor", branch: "TY" } }])("rejects malformed Can Chi pair %#", patch => expect(isCanChiResult({ ...canChi.data, ...patch })).toBe(false));
  it.each([{ requestId: "invalid" }, { requestId: calendar.requestId + "\n" }, { error: invalid.error }, { status: "RUNNING" }, { data: null }])("rejects invalid REST envelope %#", patch => expect(isLookupResponse({ ...calendar, ...patch }, isCalendarResult)).toBe(false));
});
