import { describe, expect, it, vi } from "vitest";
import list from "../../../../docs/examples/history-list.response.json";
import detail from "../../../../docs/examples/history-detail.response.json";
import removed from "../../../../docs/examples/history-deleted.response.json";
import missing from "../../../../docs/examples/history-not-found.response.json";
import request from "../../../../docs/examples/history-save.request.json";
import { bootstrapSession, deleteHistory, getHistory, historyQueryString, listHistory, saveHistory } from "./history";
import { RestError } from "./transport";

const csrf = "a".repeat(64); const signal = () => new AbortController().signal;
function respond(value: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } })));
}
describe("H01 cookie-aware REST, no live mutations", () => {
  it("bootstraps with exact empty JSON/custom header and same-origin cookie handling", async () => {
    const session = { expiresAt: "2099-01-01T00:00:00Z", csrfToken: csrf };
    respond({ ...list, data: session }); expect(await bootstrapSession(signal())).toEqual(session);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/session"), expect.objectContaining({ method: "POST", credentials: "same-origin", cache: "no-store", body: "{}", headers: { Accept: "application/json", "Content-Type": "application/json", "X-HuyenCo-Request": "1" } }));
  });
  it("preserves literal search and typed filtering with bounded pagination", async () => {
    const query = { q: "%_ có dấu", type: "MAI_HOA", page: 0, size: 20 };
    respond(list); await listHistory(query, signal());
    const params = new URLSearchParams(historyQueryString(query)); expect(params.get("q")).toBe(query.q); expect(params.get("type")).toBe("MAI_HOA");
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: "GET", credentials: "same-origin" }));
  });
  it.each([{ q: "x".repeat(101) }, { type: "UNKNOWN" }, { page: -1 }, { page: 2147483648 }, { size: 0 }, { size: 101 }])("rejects bad history query %#", patch => expect(() => historyQueryString({ q: "", type: "", page: 0, size: 20, ...patch })).toThrow(RestError));
  it("uses only canonical UUID and verifies returned record identity", async () => {
    respond(detail); expect(await getHistory(detail.data.id, signal())).toEqual(detail.data);
    await expect(getHistory(list.data.items[0].id, signal())).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(getHistory("../session", signal())).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("saves only the approved request fields with explicit CSRF; success requires 201", async () => {
    respond(detail, 201); expect(await saveHistory(request.calculationRequestId, request.title, csrf, signal())).toEqual(detail.data);
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    expect(JSON.parse(init.body as string)).toEqual(request);
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", headers: { "X-HuyenCo-Request": "1", "X-CSRF-Token": csrf } });
    respond(detail, 200); await expect(saveHistory(request.calculationRequestId, "", csrf, signal())).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("omits an optional title, no snapshot, owner, date or question fields", async () => {
    respond(detail, 201); await saveHistory(request.calculationRequestId, "", csrf, signal());
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ calculationRequestId: request.calculationRequestId });
  });
  it.each([" ", "x".repeat(101), "line\nbreak"])("rejects invalid title %j before sending", title => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(() => saveHistory(request.calculationRequestId, title, csrf, signal())).toThrow(RestError); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("validates delete 200/deleted=true and sends headers without a result body", async () => {
    respond(removed); await deleteHistory(detail.data.id, csrf, signal());
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(detail.data.id), expect.objectContaining({ method: "DELETE", credentials: "same-origin", headers: { Accept: "application/json", "X-HuyenCo-Request": "1", "X-CSRF-Token": csrf } }));
    expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty("body");
    respond({ ...removed, data: { deleted: false } }); await expect(deleteHistory(detail.data.id, csrf, signal())).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it.each([[401, "INVALID_SESSION"], [403, "CSRF_REJECTED"], [404, "NOT_FOUND"], [400, "INVALID_INPUT"], [503, "DATABASE_UNAVAILABLE"], [500, "INTERNAL_ERROR"]] as const)("decodes HTTP %s %s safely", async (status, code) => {
    respond({ ...missing, error: { ...missing.error, code } }, status); await expect(getHistory(detail.data.id, signal())).rejects.toMatchObject({ code });
  });
  it("does not accept a response page for another request", async () => {
    respond(list); await expect(listHistory({ q: "", type: "", page: 1, size: 20 }, signal())).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("never accepts missing CSRF for a mutation", () => {
    expect(() => saveHistory(request.calculationRequestId, "", "", signal())).toThrow(RestError);
  });
});
