import { describe, expect, it, vi } from "vitest";
import { buildObjectCountPayload, buildTimePayload } from "./maiHoaInput";

describe("TIME civil input boundary", () => {
  it.each([
    "2026-10-25T10:30", "2024-02-29T10:30", "2000-02-29T00:00",
    "2026-10-25T23:59", "2026-10-26T00:00",
    "2026-10-25T22:59", "2026-10-25T23:00",
    "2026-10-26T00:59", "2026-10-26T01:00",
    "1900-01-01T00:00", "2099-12-31T23:59",
  ])("T01/T02/T09/T11–T13 preserves %s with explicit Vietnam offset", datetime => {
    expect(buildTimePayload(datetime, "")).toEqual({ ok: true, payload: { method: "TIME", datetime: `${datetime}:00+07:00`, question: "" } });
  });
  it.each(["1899-12-31T23:59", "2100-01-01T00:00", "0001-01-01T00:00", "9999-12-31T23:59"])("rejects local UTC+7 input outside the approved C01 range: %s", datetime => {
    expect(buildTimePayload(datetime)).toEqual({ ok: false, field: "datetime", message: expect.stringContaining("1900-01-01 đến 2099-12-31") });
  });
  it.each([
    "2026-02-29T10:30", "2026-02-30T10:30", "1900-02-29T10:30", "2100-02-29T10:30",
    "2026-00-01T10:30", "2026-13-01T10:30", "2026-04-31T10:30",
    "2026-01-00T10:30", "2026-01-32T10:30", "0000-01-01T10:30",
    "2026-10-25T24:00", "2026-10-25T10:60",
    "", "not-a-date", "2026-10-25", "2026-1-01T10:30", "2026-10-25 10:30", " 2026-10-25T10:30", "2026-10-25T10:30\n",
  ])("T03–T08 rejects invalid input %j without normalization", datetime => {
    expect(buildTimePayload(datetime)).toEqual({ ok: false, field: "datetime", message: expect.any(String) });
  });
  it.each(["2026-10-25T10:30:00", "2026-10-25T10:30:15", "2026-10-25T10:30:00.123", "2026-10-25T10:30Z", "2026-10-25T10:30+07:00"])("T14 rejects unsupported precision/offset %s", datetime => {
    const result = buildTimePayload(datetime);
    expect(result).toEqual({ ok: false, field: "datetime", message: expect.stringContaining("chính xác đến phút") });
  });
  it.each(["UTC", "America/New_York", "Asia/Tokyo"])("T10 output is independent of device timezone %s", timezone => {
    vi.stubEnv("TZ", timezone);
    const parse = vi.spyOn(Date, "parse");
    const iso = vi.spyOn(Date.prototype, "toISOString");
    try {
      expect(buildTimePayload("2026-10-25T23:59")).toEqual({ ok: true, payload: { method: "TIME", datetime: "2026-10-25T23:59:00+07:00" } });
      expect(parse).not.toHaveBeenCalled();
      expect(iso).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); parse.mockRestore(); iso.mockRestore(); }
  });
});

describe("OBJECT_COUNT input boundary", () => {
  it.each([["1", "1"], ["999999", "12"], ["12", "8"], ["1e2", "1e1"], ["1.0", "1.0"]])("T16/T17/T21 accepts %s objects/hour %s with the existing wire shape", (count, hour) => {
    expect(buildObjectCountPayload(count, hour, "")).toEqual({ ok: true, payload: { method: "OBJECT_COUNT", objectCount: Number(count), hourIndex: Number(hour), question: "" } });
  });
  it.each(["0", "1000000", "1.5", "NaN", "Infinity", "-Infinity", "abc", "", "-1", "0x10", "0b10", "0o10", "1\n", " 1", "1_000"])("T18–T20 rejects objectCount %j", count => {
    expect(buildObjectCountPayload(count, "1")).toEqual({ ok: false, field: "objectCount", message: expect.any(String) });
  });
  it.each(["0", "13", "1.5", "NaN", "Infinity", "", "-1", "-Infinity", "0x1", "0b1", "0o1", "1\n", " 1"])("T22 rejects hourIndex %j", hour => {
    expect(buildObjectCountPayload("12", hour)).toEqual({ ok: false, field: "hourIndex", message: expect.any(String) });
  });
});

describe("question boundary shared by TIME and OBJECT_COUNT", () => {
  const builders = [
    (question?: string) => buildTimePayload("2026-10-25T10:30", question),
    (question?: string) => buildObjectCountPayload("12", "8", question),
  ];
  it.each(builders.map((build, index) => [index, build] as const))("T23/T24 preserves omitted, empty, normal and 500-character questions (builder %s)", (_index, build) => {
    for (const question of [undefined, "", "Câu hỏi thử nghiệm", "a".repeat(500)]) {
      const result = build(question);
      if (!result.ok) throw new Error(result.message);
      expect(Object.hasOwn(result.payload, "question")).toBe(question !== undefined);
      expect(result.payload.question).toBe(question);
    }
  });
  it.each(builders.map((build, index) => [index, build] as const))("T25 rejects 501 characters rather than truncating (builder %s)", (_index, build) => {
    expect(build("a".repeat(501))).toEqual({ ok: false, field: "question", message: expect.stringContaining("500") });
  });
});
