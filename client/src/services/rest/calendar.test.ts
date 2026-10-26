import { describe, expect, it, vi } from "vitest";
import calendar from "../../../../docs/examples/calendar-convert.response.json";
import calendarInput from "../../../../docs/examples/calendar-convert.request.json";
import canChi from "../../../../docs/examples/calendar-can-chi.response.json";
import canChiInput from "../../../../docs/examples/calendar-can-chi.request.json";
import invalid from "../../../../docs/examples/calendar-invalid-date.response.json";
import type { CalendarInput, CanChiInput } from "@/types/contract";
import { CLIENT_CONFIG } from "@/config/client";
import { calendarErrorMessage, calculateCanChi, convertCalendar } from "./calendar";
import { RestError } from "./transport";

const date = calendarInput as CalendarInput; const timed = canChiInput as CanChiInput;
function response(body: unknown, status = 200, contentType = "application/json; charset=utf-8") {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status < 400, status, headers: new Headers({ "Content-Type": contentType }), json: async () => body }));
}
describe("C01 read-only POST using shared Phase 5 transport", () => {
  it("sends real numeric CalendarInput as JSON, no cookie/history/CSRF", async () => {
    response(calendar); expect(await convertCalendar(date, new AbortController().signal)).toEqual(calendar.data);
    expect(fetch).toHaveBeenCalledWith(`${CLIENT_CONFIG.apiBaseUrl}/calendar/convert`, expect.objectContaining({ method: "POST", credentials: "omit", cache: "no-store", body: JSON.stringify(date), headers: { Accept: "application/json", "Content-Type": "application/json" } }));
  });
  it("accepts the reverse of the approved fixture with the exact lunar leap flag", async () => {
    response(calendar); const lunar: CalendarInput = { calendarType: "LUNAR", ...calendar.data.lunarDate };
    expect(await convertCalendar(lunar, new AbortController().signal)).toEqual(calendar.data);
  });
  it("uses the canonical 23:59 Can Chi request/response unchanged", async () => {
    response(canChi); expect(await calculateCanChi(timed, new AbortController().signal)).toEqual(canChi.data);
    expect(fetch).toHaveBeenCalledWith(`${CLIENT_CONFIG.apiBaseUrl}/calendar/can-chi`, expect.objectContaining({ body: JSON.stringify(timed) }));
  });
  it("does not inject time when omitted and validates hour=null", async () => {
    response({ ...canChi, data: { ...canChi.data, hour: null } }); await calculateCanChi({ date: timed.date }, new AbortController().signal);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ date: timed.date });
  });
  it("rejects hour presence mismatches and a response for a different submitted date", async () => {
    response(canChi); await expect(calculateCanChi({ date: timed.date }, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    response({ ...canChi, data: { ...canChi.data, hour: null } }); await expect(calculateCanChi(timed, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    response(calendar); await expect(convertCalendar({ ...date, day: 2 }, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it.each([[400, "INVALID_DATE"], [400, "INVALID_INPUT"], [422, "RULE_NOT_AVAILABLE"], [503, "DATABASE_UNAVAILABLE"], [500, "INTERNAL_ERROR"]] as const)("decodes HTTP %s %s without rendering raw internal messages", async (status, code) => {
    const error = { ...invalid.error, code, message: "Internal details must not be displayed", ruleCode: code === "RULE_NOT_AVAILABLE" ? "LUNAR-CONVERSION" : null };
    response({ ...invalid, error }, status);
    const result = convertCalendar(date, new AbortController().signal);
    await expect(result).rejects.toMatchObject({ code, apiError: error });
    expect(calendarErrorMessage(new RestError(code, error))).not.toContain(error.message);
  });
  it.each([["text/html", calendar, 200], ["", calendar, 200], ["application/json", calendar, 503], ["application/json", invalid, 200], ["application/json", invalid, 422], ["application/json", { ...calendar, data: {} }, 200]] as const)("rejects MIME/status/body mismatch %#", async (mime, body, status) => {
    response(body, status, mime); await expect(convertCalendar(date, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("does not trust invalid JSON", async () => {
    response(calendar); vi.mocked(fetch).mockResolvedValue(new Response("{invalid-json", { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(convertCalendar(date, new AbortController().signal)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("reports a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError())); await expect(convertCalendar(date, new AbortController().signal)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
  it("times out POST and clears the deadline", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_yes, no) => options.signal.addEventListener("abort", () => no(new DOMException("Aborted", "AbortError"))))));
    const request = expect(convertCalendar(date, new AbortController().signal)).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(CLIENT_CONFIG.restTimeoutMs); await request; expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["constructor", "UNKNOWN_ERROR", "__proto__"])("handles unknown error %s safely", code => expect(calendarErrorMessage(new RestError(code))).toContain("lỗi chưa được nhận diện"));
});
