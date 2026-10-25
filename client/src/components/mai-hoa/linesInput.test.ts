import { describe, expect, it } from "vitest";
import request from "../../../../docs/examples/mai-hoa-lines.request.json";
import { buildLinesPayload } from "./linesInput";

describe("LINES input boundary", () => {
  it.each([1, 6])("accepts movingLine %i and keeps bottom-up values", movingLine => {
    const result = buildLinesPayload(request.payload.linesBottomUp, movingLine);
    expect(result).toEqual({ ok: true, payload: { ...request.payload, movingLine } });
  });
  it.each([0, 5, 7])("rejects a line count of %i", count => {
    expect(buildLinesPayload(Array(count).fill(true), 1).ok).toBe(false);
  });
  it.each([null, undefined, "true", 1])("rejects non-boolean line %j", value => {
    expect(buildLinesPayload([true, false, true, false, true, value], 1).ok).toBe(false);
  });
  it("rejects sparse arrays with six slots", () => {
    expect(buildLinesPayload(new Array(6), 1).ok).toBe(false);
  });
  it.each([undefined, null, "", "1", 0, 7, -1, 1.5, NaN, Infinity])("rejects movingLine %j", value => {
    expect(buildLinesPayload(request.payload.linesBottomUp, value)).toEqual({ ok: false, errors: { movingLine: expect.any(String) } });
  });
  it("creates only the whitelist and a new array, without mutating the caller", () => {
    const input = Object.freeze([...request.payload.linesBottomUp]);
    const result = buildLinesPayload(input, 2);
    if (!result.ok) throw new Error("Expected valid input");
    expect(Object.keys(result.payload).sort()).toEqual(["linesBottomUp", "method", "movingLine"]);
    expect(result.payload).toEqual(request.payload);
    expect(result.payload.linesBottomUp).not.toBe(input);
    result.payload.linesBottomUp[0] = false;
    expect(input).toEqual(request.payload.linesBottomUp);
  });
});
