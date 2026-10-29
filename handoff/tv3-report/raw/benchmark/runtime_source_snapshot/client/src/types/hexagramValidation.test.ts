import { describe, expect, it } from "vitest";
import list from "../../../docs/examples/hexagrams-list.response.json";
import detail from "../../../docs/examples/hexagram-tinh.response.json";
import missing from "../../../docs/examples/hexagram-not-found.response.json";
import { isHexagramDetail, isHexagramPage, isHexagramRecord, isLookupResponse } from "./hexagramValidation";

describe("E02 REST runtime boundary", () => {
  it("accepts official list/detail/error envelopes without mutating fixtures", () => {
    const before = JSON.stringify([list, detail, missing]);
    expect(isLookupResponse(list, isHexagramPage)).toBe(true);
    expect(isLookupResponse(detail, isHexagramDetail)).toBe(true);
    expect(isLookupResponse(missing, isHexagramDetail)).toBe(true);
    expect(JSON.stringify([list, detail, missing])).toBe(before);
  });
  it.each([null, {}, { ...list, requestId: "bad" }, { ...list, error: missing.error }, { ...missing, data: detail.data }, { ...missing, error: { code: "NOT_FOUND" } }])("rejects malformed envelope %#", value => {
    expect(isLookupResponse(value, isHexagramPage)).toBe(false);
  });
  it.each([
    { ...list.data, page: -1 }, { ...list.data, size: 101 }, { ...list.data, totalPages: 33 },
    { ...list.data, totalElements: 65 }, { ...list.data, items: [list.data.items[0], list.data.items[0]] },
    { ...list.data, items: [] }, { ...list.data, page: 1.2 },
  ])("rejects invalid/inconsistent pagination %#", value => expect(isHexagramPage(value)).toBe(false));
  it("accepts empty results and a valid out-of-range page", () => {
    expect(isHexagramPage({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })).toBe(true);
    expect(isHexagramPage({ ...list.data, items: [], page: 2147483647 })).toBe(true);
  });
  it.each([
    { ...detail.data, code: "H_CAN_TON" }, { ...detail.data, linesBottomUp: [true] },
    { ...detail.data, linesBottomUp: [0, 1, 0, 1, 0, 1] }, { ...detail.data, upperTrigramCode: "CAN3" },
    { ...detail.data, verificationStatus: "APPROVED" }, { ...detail.data, sourceReferences: [] },
  ])("rejects invalid identity/structure/provenance %#", value => expect(isHexagramRecord(value)).toBe(false));
  it("permits honestly marked unverified names and absent unpublished glosses", () => {
    expect(isHexagramDetail({ ...detail.data, verificationStatus: "SOURCE_AMBIGUOUS", interpretations: [] })).toBe(true);
  });
  it.each([
    { ...detail.data.interpretations[0], verificationStatus: "DRAFT" },
    { ...detail.data.interpretations[0], category: "PREDICTION" },
    { ...detail.data.interpretations[0], sourceReferences: [] },
    { ...detail.data.interpretations[0], sourceOrder: 0 },
    { ...detail.data.interpretations[0], verificationNote: "" },
  ])("rejects unpublished/malformed interpretation %#", value => expect(isHexagramDetail({ ...detail.data, interpretations: [value] })).toBe(false));
});
