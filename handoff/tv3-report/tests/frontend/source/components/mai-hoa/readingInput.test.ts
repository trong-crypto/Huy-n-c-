import { describe, expect, it } from "vitest";
import type { MaiHoaPayload } from "@/types/contract";
import { withReadingOptions } from "./maiHoaInput";

const time: MaiHoaPayload = { method: "TIME", datetime: "2024-02-10T00:00:00+07:00" };
const bases: MaiHoaPayload[] = [
  { method: "LINES", linesBottomUp: [true, false, true, false, true, false], movingLine: 2 },
  { method: "OBJECT_COUNT", objectCount: 12, hourIndex: 8 },
];

describe("I02 explicit reading request boundary", () => {
  it("omits reading in legacy mode, including stale options", () => {
    expect(withReadingOptions({ ...time, reading: { topic: "LOVE" } }, { enabled: false, topic: "LOVE", datetime: "2024-02-10T09:00" }))
      .toEqual({ ok: true, payload: time });
  });
  it.each(["GENERAL", "CAREER", "WEALTH", "LOVE"])("sends explicit TIME topic %s without duplicate context", topic => {
    expect(withReadingOptions(time, { enabled: true, topic, datetime: "not-used-by-TIME" }))
      .toEqual({ ok: true, payload: { ...time, reading: { topic } } });
  });
  it.each(bases)("keeps optional reading time absent for $method", payload => {
    expect(withReadingOptions(payload, { enabled: true, topic: "GENERAL", datetime: "" }))
      .toEqual({ ok: true, payload: { ...payload, reading: { topic: "GENERAL" } } });
  });
  it.each(bases)("normalizes explicit civil context for $method to UTC+07", payload => {
    expect(withReadingOptions(payload, { enabled: true, topic: "CAREER", datetime: "2024-02-10T09:30" }))
      .toEqual({ ok: true, payload: { ...payload, reading: { topic: "CAREER", context: { datetime: "2024-02-10T09:30:00+07:00" } } } });
  });
  it.each(["", "AUTO", "general"])("rejects non-explicit or unknown topic %j without inferring it from a question", topic => {
    expect(withReadingOptions({ ...time, question: "Tài lộc" }, { enabled: true, topic, datetime: "" }))
      .toEqual({ ok: false, field: "readingTopic", message: expect.any(String) });
  });
  it.each(["2026-02-29T10:00", "2024-02-10T24:00", "1899-12-31T23:59", "2100-01-01T00:00", "2024-02-10T09:00+07:00", "2024-02-10T09:00:01"])("rejects invalid/manipulated optional context %s", datetime => {
    expect(withReadingOptions(bases[0], { enabled: true, topic: "LOVE", datetime }))
      .toEqual({ ok: false, field: "readingDatetime", message: expect.any(String) });
  });
  it("does not mutate the supplied calculation or reading draft", () => {
    const payload = Object.freeze({ ...bases[0] });
    const selection = Object.freeze({ enabled: true, topic: "LOVE", datetime: "" });
    const before = JSON.stringify([payload, selection]);
    withReadingOptions(payload, selection);
    expect(JSON.stringify([payload, selection])).toBe(before);
    expect(payload).not.toHaveProperty("reading");
  });
});
