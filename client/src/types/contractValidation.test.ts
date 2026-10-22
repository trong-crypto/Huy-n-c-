import { describe, expect, it } from "vitest";
import { isCalculationResponse } from "@/types/contractValidation";

// Envelope fixtures only: these are not verified business results.
const requestId = "550e8400-e29b-41d4-a716-446655440000";
const completed = () => ({ requestId, type: "MAI_HOA", status: "COMPLETED", data: { fixtureOnly: true }, error: null });
const failed = () => ({ requestId, type: "TAM_THE", status: "FAILED", data: null, error: { code: "RULE_NOT_AVAILABLE", message: "Chưa kiểm chứng.", ruleCode: "TEST-FIXTURE" } });

describe("isCalculationResponse", () => {
  it("accepts a valid COMPLETED envelope", () => {
    expect(isCalculationResponse(completed())).toBe(true);
  });

  it("accepts a valid FAILED envelope", () => {
    expect(isCalculationResponse(failed())).toBe(true);
  });

  it.each([false, 0, "", [], { arbitrary: "opaque" }].map((data) => [data]))("keeps non-null success data opaque: %j", (data) => {
    expect(isCalculationResponse({ ...completed(), data })).toBe(true);
  });

  it.each(["INVALID_INPUT", "INVALID_DATE", "INVALID_METHOD", "RULE_NOT_AVAILABLE", "SERVER_BUSY", "INTERNAL_ERROR"])("accepts existing Server code %s", (code) => {
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, code } })).toBe(true);
  });

  it.each([null, "TEST-FIXTURE"])("accepts ruleCode %j", (ruleCode) => {
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, ruleCode } })).toBe(true);
  });

  it("allows harmless extra fields without interpreting business data", () => {
    expect(isCalculationResponse({ ...completed(), futureMetadata: 1 })).toBe(true);
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, futureMetadata: 1 } })).toBe(true);
  });

  it.each(["requestId", "type", "status", "data", "error"])("rejects missing envelope field %s", (field) => {
    const value: Record<string, unknown> = completed();
    delete value[field];
    expect(isCalculationResponse(value)).toBe(false);
  });

  it.each([null, undefined, "", "not-a-uuid", 123])("rejects invalid requestId %j", (value) => {
    expect(isCalculationResponse({ ...completed(), requestId: value })).toBe(false);
  });

  it.each([null, "OTHER", 1])("rejects invalid type %j", (type) => {
    expect(isCalculationResponse({ ...completed(), type })).toBe(false);
  });

  it.each([null, "WAITING", "done", 1])("rejects invalid status %j", (status) => {
    expect(isCalculationResponse({ ...completed(), status })).toBe(false);
  });

  it("rejects COMPLETED with non-null error", () => {
    expect(isCalculationResponse({ ...completed(), error: failed().error })).toBe(false);
  });

  it.each([null, undefined])("rejects null or missing COMPLETED data: %j", (data) => {
    expect(isCalculationResponse({ ...completed(), data })).toBe(false);
  });

  it.each([false, 0, {}, []].map((data) => [data]))("rejects FAILED with non-null data: %j", (data) => {
    expect(isCalculationResponse({ ...failed(), data })).toBe(false);
  });

  it.each([null, undefined, "error", [], {}].map((error) => [error]))("rejects invalid FAILED error: %j", (error) => {
    expect(isCalculationResponse({ ...failed(), error })).toBe(false);
  });

  it("rejects a new or Client-local Server error code", () => {
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, code: "REQUEST_TIMEOUT" } })).toBe(false);
  });

  it.each(["code", "message", "ruleCode"])("rejects missing Server error field %s", (field) => {
    const error: Record<string, unknown> = { ...failed().error };
    delete error[field];
    expect(isCalculationResponse({ ...failed(), error })).toBe(false);
  });

  it.each([false, 123, {}])("rejects invalid ruleCode type: %j", (ruleCode) => {
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, ruleCode } })).toBe(false);
  });

  it("rejects non-string error message", () => {
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, message: null } })).toBe(false);
  });

  it.each([null, undefined, false, 0, "text", []].map((value) => [value]))("rejects non-object root: %j", (value) => {
    expect(isCalculationResponse(value)).toBe(false);
  });
});
