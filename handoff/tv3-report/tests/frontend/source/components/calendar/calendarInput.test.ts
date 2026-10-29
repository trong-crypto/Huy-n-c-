import { describe, expect, it } from "vitest";
import fixture from "../../../../docs/examples/calendar-convert.request.json";
import { buildCalendarInput, buildCanChiInput, emptyCalendarDraft, validGregorianDate, type CalendarDraft } from "./calendarInput";

const base: CalendarDraft = { ...emptyCalendarDraft(), year: String(fixture.year), month: String(fixture.month), day: String(fixture.day) };
describe("C01 civil input without lunar calculation", () => {
  it("sends all required numeric fields and forces SOLAR leap false", () => {
    expect(buildCalendarInput({ ...base, isLeapMonth: true })).toEqual({ ok: true, payload: fixture });
  });
  it.each([false, true])("preserves explicit lunar leap flag %s", isLeapMonth => {
    expect(buildCalendarInput({ ...base, calendarType: "LUNAR", isLeapMonth })).toEqual({ ok: true, payload: { ...fixture, calendarType: "LUNAR", isLeapMonth } });
  });
  it.each([["1900", "1", "1"], ["2099", "12", "31"], ["2000", "2", "29"], ["2024", "2", "29"]])("accepts Gregorian boundary/leap %s-%s-%s", (year, month, day) => {
    expect(buildCalendarInput({ ...base, year, month, day }).ok).toBe(true);
  });
  it.each([["1900", "2", "29"], ["2023", "2", "29"], ["2024", "4", "31"]])("rejects impossible Gregorian %s-%s-%s", (year, month, day) => {
    expect(buildCalendarInput({ ...base, year, month, day })).toEqual({ ok: false, errors: { day: expect.any(String) } });
  });
  it.each(["year", "month", "day"] as const)("requires %s", field => {
    const result = buildCalendarInput({ ...base, [field]: "" }); expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[field]).toBeTruthy();
  });
  it.each(["1.5", "1e1", "0x10", " 1", "-1", "Infinity", "NaN", "1\n"])("rejects non-integer/coerced input %j", month => {
    expect(buildCalendarInput({ ...base, month }).ok).toBe(false);
  });
  it.each(["1899", "2100"])("rejects SOLAR year %s", year => expect(buildCalendarInput({ ...base, year }).ok).toBe(false));
  it.each(["1899", "2099"])("defers final LUNAR %s validity/range to Server", year => {
    expect(buildCalendarInput({ ...base, calendarType: "LUNAR", year, month: "12", day: "30", isLeapMonth: true }).ok).toBe(true);
  });
  it("does not infer lunar month lengths or reject lunar February 30 from Gregorian rules", () => {
    expect(buildCalendarInput({ ...base, calendarType: "LUNAR", year: "2023", month: "2", day: "30" }).ok).toBe(true);
    expect(buildCalendarInput({ ...base, calendarType: "LUNAR", day: "31" }).ok).toBe(false);
  });
  it("omits time entirely when blank", () => {
    expect(buildCanChiInput(base)).toEqual({ ok: true, payload: { date: fixture } });
  });
  it.each(["00:00", "23:59", "08:30"])("sends explicit minute time %s unchanged", time => {
    expect(buildCanChiInput({ ...base, time })).toEqual({ ok: true, payload: { date: fixture, time } });
  });
  it.each(["24:00", "23:60", "8:30", "08:30:00", "08:30+07:00", " 08:30", "08:30\n"])("rejects invalid time %j", time => {
    expect(buildCanChiInput({ ...base, time })).toEqual({ ok: false, errors: { time: expect.any(String) } });
  });
  it("does not mutate a draft or fill a date/time from the device", () => {
    const draft = Object.freeze(emptyCalendarDraft()); buildCanChiInput(draft); expect(draft).toEqual(emptyCalendarDraft());
  });
  it("validates only Gregorian existence", () => {
    expect(validGregorianDate(2000, 2, 29)).toBe(true); expect(validGregorianDate(1900, 2, 29)).toBe(false); expect(validGregorianDate(2024, 0, 1)).toBe(false);
  });
});
