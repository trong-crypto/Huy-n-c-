import { describe, expect, it } from "vitest";
import { isCalculationResponse, isCalculationEnvelope } from "@/types/contractValidation";

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

  it("rejects a new or Client-local Server error code", () => {
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
describe("complete business response validation", () => {
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
    expect(isCalculationResponse({ ...failed(), error: { ...failed().error, reason: "invented" } })).toBe(false);
  });
  it("rejects Mai Hoa data labeled as Tam The", () => {
    expect(isCalculationResponse({ ...lines, type: "TAM_THE" })).toBe(false);
  });
});
