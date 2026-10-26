import { describe, expect, it, vi } from "vitest";
import list from "../../../../docs/examples/hexagrams-list.response.json";
import detail from "../../../../docs/examples/hexagram-tinh.response.json";
import missing from "../../../../docs/examples/hexagram-not-found.response.json";
import { CLIENT_CONFIG } from "@/config/client";
import { getHexagram, hexagramQueryString, listHexagrams, LookupError, lookupErrorMessage, type HexagramQuery } from "./hexagrams";

const query: HexagramQuery = { q: "", upper: "", lower: "", page: 0, size: 2 };
function respond(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }));
}
describe("E02 GET transport", () => {
  it.each(["UNKNOWN_ERROR", "toString", "constructor", "__proto__"])("safely presents unknown error %s", code => {
    expect(lookupErrorMessage(new LookupError(code))).toBe("Dịch vụ chưa thể xử lý yêu cầu tra cứu. Vui lòng thử lại sau.");
  });
  it("reads the official bounded list using no cookies and the shared config", async () => {
    respond(list);
    expect(await listHexagrams(query, new AbortController().signal)).toEqual(list.data);
    expect(fetch).toHaveBeenCalledWith(`${CLIENT_CONFIG.apiBaseUrl}/hexagrams?q=&page=0&size=2`, expect.objectContaining({ method: "GET", credentials: "omit", cache: "no-store", signal: expect.any(AbortSignal) }));
  });
  it.each(["Bĩ", "Bí", "bi", "Càn", "Cấn", "can", "H_KHAM_TON", "H_", "%_"])("preserves Server search semantics for %s", q => {
    const params = new URLSearchParams(hexagramQueryString({ ...query, q }));
    expect(params.get("q")).toBe(q);
  });
  it("combines both trigram filters using distinct CAN/CAN2 IDs", () => {
    const params = new URLSearchParams(hexagramQueryString({ ...query, q: "  Cấn  ", upper: "CAN2", lower: "CAN", page: 2 }));
    expect(Object.fromEntries(params)).toEqual({ q: "  Cấn  ", upperTrigramCode: "CAN2", lowerTrigramCode: "CAN", page: "2", size: "2" });
  });
  it.each([{ q: "x".repeat(101) }, { upper: "can" }, { lower: "UNKNOWN" }, { page: -1 }, { page: 2147483648 }, { page: 1.1 }, { size: 0 }, { size: 101 }])("rejects unsafe query %#", patch => {
    expect(() => hexagramQueryString({ ...query, ...patch })).toThrow(LookupError);
  });
  it("loads by canonical code and verifies identity", async () => {
    respond(detail);
    expect(await getHexagram("H_KHAM_TON", new AbortController().signal)).toEqual(detail.data);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/hexagrams/H_KHAM_TON"), expect.anything());
    await expect(getHexagram("H_CAN_CAN", new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it.each(["Tỉnh", "../history", "h_kham_ton", "H_" + "X".repeat(65)])("rejects invalid code %s without a request", async code => {
    const mock = vi.fn(); vi.stubGlobal("fetch", mock);
    await expect(getHexagram(code, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(mock).not.toHaveBeenCalled();
  });
  it.each([["NOT_FOUND", 404], ["INVALID_INPUT", 400], ["DATABASE_UNAVAILABLE", 503], ["KNOWLEDGE_DATA_INCOMPLETE", 503], ["INTERNAL_ERROR", 500]] as const)("maps %s without printing raw server details", async (code, status) => {
    respond({ ...missing, error: { ...missing.error, code, message: "private server details" } }, status);
    await expect(getHexagram(detail.data.code, new AbortController().signal)).rejects.toMatchObject({ code });
    expect(lookupErrorMessage(new LookupError(code))).not.toContain("private server details");
  });
  it.each([[detail, 503], [missing, 200], [missing, 500], [{ ...detail, requestId: "invalid" }, 200]])("rejects HTTP/envelope mismatch %#", async (value, status) => {
    respond(value, status);
    await expect(getHexagram(detail.data.code, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("rejects a page for a different request", async () => {
    respond(list); await expect(listHexagrams({ ...query, page: 1 }, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("rejects invalid JSON and network failure clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError(); } }));
    await expect(getHexagram(detail.data.code, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(getHexagram(detail.data.code, new AbortController().signal)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
  it("times out and releases its timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))));
    const result = getHexagram(detail.data.code, new AbortController().signal);
    const rejected = expect(result).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(CLIENT_CONFIG.restTimeoutMs); await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("honors caller cancellation and cleans the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))));
    const controller = new AbortController(); const result = getHexagram(detail.data.code, controller.signal);
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    controller.abort(); await rejected; expect(vi.getTimerCount()).toBe(0);
  });
});
