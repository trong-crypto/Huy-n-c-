import { describe, expect, it } from "vitest";
import request from "../../../../docs/examples/d04-wealth-matched.request.json";
import { buildTamThePayload, type TamTheInput } from "./tamTheInput";

const base: TamTheInput = { ...request.payload, categories: request.payload.categories, wealthMode: "LEGACY" };
describe("I02 Tam The wealth input boundary", () => {
  it("omits explicit LEGACY from the backward-compatible payload", () => {
    const { wealthMode, ...legacy } = request.payload;
    void wealthMode;
    expect(buildTamThePayload(base)).toEqual({ ok: true, payload: legacy });
  });
  it("produces the exact canonical EXTENDED request payload", () => {
    expect(buildTamThePayload({ ...base, wealthMode: "EXTENDED" })).toEqual({ ok: true, payload: request.payload });
  });
  it.each(["UNKNOWN", "extended", ""])("rejects manipulated mode %j", wealthMode => {
    expect(buildTamThePayload({ ...base, wealthMode })).toEqual({ ok: false, errors: { wealthMode: expect.any(String) } });
  });
  it("requires WEALTH in extended mode instead of adding a category silently", () => {
    expect(buildTamThePayload({ ...base, categories: ["CAREER", "LOVE"], wealthMode: "EXTENDED" }))
      .toEqual({ ok: false, errors: { wealthMode: expect.any(String) } });
  });
  it("does not mutate the user's selected categories or original input", () => {
    const input = Object.freeze({ ...base, wealthMode: "EXTENDED", categories: Object.freeze(["WEALTH"]) });
    const original = JSON.stringify(input);
    buildTamThePayload(input);
    expect(JSON.stringify(input)).toBe(original);
  });
});
