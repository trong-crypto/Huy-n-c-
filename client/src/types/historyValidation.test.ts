import { describe, expect, it } from "vitest";
import list from "../../../docs/examples/history-list.response.json";
import detail from "../../../docs/examples/history-detail.response.json";
import deleted from "../../../docs/examples/history-deleted.response.json";
import tam from "../../../docs/examples/d04-wealth-no-loc.response.json";
import { isHistoryDeleted, isHistoryDetail, isHistoryItem, isHistoryPage, isSessionResult } from "./historyValidation";

describe("H01 runtime guards", () => {
  it("accepts approved list/detail/delete without mutating them", () => {
    const before = JSON.stringify([list, detail, deleted]);
    expect(isHistoryPage(list.data)).toBe(true); expect(isHistoryDetail(detail.data)).toBe(true); expect(isHistoryDeleted(deleted.data)).toBe(true);
    expect(JSON.stringify([list, detail, deleted])).toBe(before);
  });
  it("validates saved Tam The snapshots using the existing D04 guard", () => {
    expect(isHistoryDetail({ ...list.data.items[0], result: tam.data })).toBe(true);
  });
  it.each([{ id: "bad" }, { type: "CALENDAR" }, { title: " " }, { title: "x".repeat(101) }, { title: "bad\nname" }, { createdAt: "not-a-date" }, { ruleBasis: "UNKNOWN" }])("rejects malformed history item %#", patch => expect(isHistoryItem({ ...list.data.items[0], ...patch })).toBe(false));
  it.each([{ result: {} }, { type: "TAM_THE" }, { ruleBasis: "TEAM_DECISION" }, { result: { ...detail.data.result, movingLine: 7 } }])("rejects invalid/mismatched snapshot %#", patch => expect(isHistoryDetail({ ...detail.data, ...patch })).toBe(false));
  it.each([{ size: 101 }, { page: -1 }, { totalPages: 2 }, { totalElements: 1 }, { items: [list.data.items[0], list.data.items[0]] }])("rejects inconsistent history page %#", patch => expect(isHistoryPage({ ...list.data, ...patch })).toBe(false));
  it("accepts empty and out-of-range pages", () => {
    expect(isHistoryPage({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })).toBe(true);
    expect(isHistoryPage({ ...list.data, items: [], page: 2147483647 })).toBe(true);
  });
  it.each([{}, { deleted: false }, { deleted: "true" }, { deleted: true, other: true }])("rejects invalid delete confirmation %#", value => expect(isHistoryDeleted(value)).toBe(false));
  it("requires a valid expiry and exact server CSRF structure, not an owner or cookie", () => {
    const session = { expiresAt: "2099-01-01T00:00:00Z", csrfToken: "a".repeat(64) };
    expect(isSessionResult(session)).toBe(true); expect(isSessionResult({ ...session, ownerId: "fake" })).toBe(false);
    expect(isSessionResult({ ...session, expiresAt: "bad" })).toBe(false); expect(isSessionResult({ ...session, csrfToken: "short" })).toBe(false);
  });
});
