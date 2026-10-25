import { describe, expect, it, vi } from "vitest";
import { buildTamThePayload, TAM_THE_CATEGORIES, type TamTheField, type TamTheInput } from "./tamTheInput";

const draft: TamTheInput = { birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false, categories: TAM_THE_CATEGORIES };
function reject(patch: Record<string, unknown>, field: TamTheField) {
  const result = buildTamThePayload({ ...draft, ...patch } as TamTheInput);
  expect(result.ok).toBe(false);
  expect("payload" in result).toBe(false);
  if (result.ok) throw new Error("Invalid input returned a payload");
  expect(result.errors[field]).toEqual(expect.any(String));
}

describe("Tam The SOLAR civil date", () => {
  it.each(["2003-08-15", "2024-02-29", "2000-02-29", "1899-12-31", "2100-01-01", "0001-01-01", "9999-12-31"])("accepts %s without imposing a business year range", birthDate => {
    expect(buildTamThePayload({ ...draft, birthDate })).toEqual({ ok: true, payload: { birthDate, birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false } });
  });
  it.each([
    "2025-02-29", "1900-02-29", "2100-02-29", "2026-02-30", "2026-04-31", "2026-06-31",
    "2026-00-01", "2026-13-01", "2026-01-00", "2026-01-32", "", "bad-date",
    "026-01-01", "10000-01-01", "-001-01-01", "2026-1-01", "2026/01/01",
    " 2026-01-01", "2026-01-01 ", "2026-01-01\n", "2026-01-01\r\n",
    "2026-01-01T12:30", "2026-01-01T12:30:00", "2026-01-01+07:00", "2026-01-01Z",
  ])("rejects %j without normalization", birthDate => reject({ birthDate }, "birthDate"));
  it.each([null, undefined, 20030815, false, { toString: () => "2003-08-15" }])("does not coerce raw date %j", birthDate => reject({ birthDate }, "birthDate"));
});

describe("Tam The LUNAR syntactic input, not a calendar calculation", () => {
  it.each([false, true])("preserves nominal February 30 and leap=%s without Gregorian validation", isLeapMonth => {
    expect(buildTamThePayload({ ...draft, calendarType: "LUNAR", birthDate: "2025-02-30", isLeapMonth })).toEqual({ ok: true, payload: {
      birthDate: "2025-02-30", birthTime: "08:30", calendarType: "LUNAR", isLeapMonth,
    } });
  });
  it.each(["2026-00-01", "2026-13-01", "2026-01-00", "2026-01-31", "2026-2-01", "2026-01-01\n", "2026-01-01T00:00"])("rejects lunar format/range %j", birthDate => reject({ calendarType: "LUNAR", birthDate }, "birthDate"));
});

describe("Tam The minute time and raw enum/boolean boundaries", () => {
  it.each(["00:00", "12:30", "23:59"])("preserves %s exactly, without an offset", birthTime => {
    const result = buildTamThePayload({ ...draft, birthTime });
    expect(result.ok && result.payload.birthTime).toBe(birthTime);
  });
  it.each(["", "24:00", "12:60", "1:30", "12:3", "-1:30", "12:30:00", "12:30:00.1", "12:30+07:00", "12:30Z", "12:30\n", " 12:30", null, 1230])("rejects raw time %j", birthTime => reject({ birthTime }, "birthTime"));
  it.each(["", "OTHER", "solar", "LUNAR\n", null, 1])("rejects calendar type %j", calendarType => reject({ calendarType }, "calendarType"));
  it.each(["false", "true", 0, 1, null, undefined])("rejects non-boolean leap flag %j", isLeapMonth => reject({ isLeapMonth }, "isLeapMonth"));
  it("rejects a manipulated SOLAR true flag rather than silently normalizing it", () => reject({ isLeapMonth: true }, "isLeapMonth"));
  it.each(["UTC", "America/New_York", "Asia/Tokyo"])("has no device timezone dependency in %s", timezone => {
    vi.stubEnv("TZ", timezone);
    const parse = vi.spyOn(Date, "parse"), iso = vi.spyOn(Date.prototype, "toISOString");
    try {
      for (const calendarType of ["SOLAR", "LUNAR"]) {
        const result = buildTamThePayload({ ...draft, calendarType, birthTime: "23:59" });
        expect(result.ok && result.payload.birthDate).toBe(draft.birthDate);
        expect(result.ok && result.payload.birthTime).toBe("23:59");
      }
      expect(parse).not.toHaveBeenCalled(); expect(iso).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); parse.mockRestore(); iso.mockRestore(); }
  });
});

describe("Tam The categories and payload whitelist", () => {
  it.each([
    ["CAREER"], ["WEALTH"], ["LOVE"], ["CAREER", "WEALTH"], ["CAREER", "LOVE"], ["WEALTH", "LOVE"],
    ["WEALTH", "CAREER"], ["LOVE", "CAREER"], ["LOVE", "WEALTH"],
  ])("serializes a validated subset in stable wire order: %j", (...categories) => {
    const frozen = Object.freeze([...categories]);
    const result = buildTamThePayload({ ...draft, categories: frozen });
    expect(result.ok && result.payload.categories).toEqual(TAM_THE_CATEGORIES.filter(value => categories.includes(value)));
    expect(frozen).toEqual(categories);
  });
  it.each([
    ["CAREER", "WEALTH", "LOVE"], ["LOVE", "CAREER", "WEALTH"], ["WEALTH", "LOVE", "CAREER"],
  ])("omits categories when all three are explicitly selected: %j", (...categories) => {
    const result = buildTamThePayload({ ...draft, categories });
    if (!result.ok) throw new Error("Expected valid default selection");
    expect(Object.keys(result.payload).sort()).toEqual(["birthDate", "birthTime", "calendarType", "isLeapMonth"]);
  });
  it.each([
    [], ["CAREER", "CAREER"], ["OTHER"], ["CAREER", "OTHER"], ["career"], ["LOVE\n"],
    ["CAREER", "WEALTH", "LOVE", "OTHER"], [1], [true], [null], [undefined], Array(1), Object.assign(Array(2), { 0: "CAREER" }), [{ toString: () => "CAREER" }],
    null, undefined, "CAREER", {},
  ].map(categories => [categories]))("rejects malformed selection %j without filtering or treating it as default", categories => reject({ categories }, "categories"));
  it("creates a fresh payload with only approved fields, never arbitrary raw form properties", () => {
    const result = buildTamThePayload({ ...draft, categories: ["CAREER"], question: "PRIVATE", ownerId: "PRIVATE", ruleBasis: "SOURCE_VERIFIED" } as TamTheInput);
    if (!result.ok) throw new Error("Expected valid fields");
    expect(result.payload).toEqual({ birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false, categories: ["CAREER"] });
  });
  it("reports all fields without echoing personal raw values", () => {
    const result = buildTamThePayload({ birthDate: "PRIVATE_DATE", birthTime: "PRIVATE_TIME", calendarType: "OTHER", isLeapMonth: "false", categories: [] } as unknown as TamTheInput);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected errors");
    expect(Object.keys(result.errors).sort()).toEqual(["birthDate", "birthTime", "calendarType", "categories", "isLeapMonth"]);
    expect(JSON.stringify(result.errors)).not.toMatch(/PRIVATE_DATE|PRIVATE_TIME/);
  });
});
