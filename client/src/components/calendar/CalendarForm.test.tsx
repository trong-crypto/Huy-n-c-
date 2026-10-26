import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import calendar from "../../../../docs/examples/calendar-convert.response.json";
import canChi from "../../../../docs/examples/calendar-can-chi.response.json";
import type { CalendarResult, CanChiResult } from "@/types/contract";
import { convertCalendar, calculateCanChi } from "@/services/rest/calendar";
import { RestError } from "@/services/rest/transport";
import { CalendarForm } from "./CalendarForm";
import CalendarPage from "@/app/calendar/page";

vi.mock("@/services/rest/calendar", async importOriginal => {
  const original = await importOriginal<typeof import("@/services/rest/calendar")>();
  return { ...original, convertCalendar: vi.fn(), calculateCanChi: vi.fn() };
});
const convert = vi.mocked(convertCalendar), calculate = vi.mocked(calculateCanChi);
beforeEach(() => { convert.mockReset().mockResolvedValue(calendar.data as CalendarResult); calculate.mockReset().mockResolvedValue(canChi.data as CanChiResult); });
function fill(year = "2000", month = "1", day = "1", scope: Pick<typeof screen, "getByLabelText"> = screen) {
  [year, month, day].forEach((value, index) => fireEvent.change(scope.getByLabelText(new RegExp(`^${["Năm", "Tháng", "Ngày"][index]} .*bắt buộc`)), { target: { value } }));
}
function defer<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

describe("Phase 6 independent calendar forms", () => {
  it("starts idle and sends the actual SOLAR fixture with numeric fields", async () => {
    render(<CalendarForm kind="convert" />); expect(screen.getByRole("status").textContent).toBe("Chưa gửi yêu cầu.");
    fill(); fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" }));
    await screen.findByRole("region", { name: "Kết quả đổi lịch" });
    expect(convert).toHaveBeenCalledWith({ calendarType: "SOLAR", year: 2000, month: 1, day: 1, isLeapMonth: false }, expect.any(AbortSignal));
    expect(screen.getByText("2000-01-01", { exact: true })).toBeTruthy();
    expect(screen.getByText("25/11/1999", { exact: true })).toBeTruthy();
  });
  it("reverses the fixture using lunar numbers without browser Date conversion", async () => {
    render(<CalendarForm kind="convert" />);
    fireEvent.change(screen.getByLabelText("Chiều đổi lịch"), { target: { value: "LUNAR" } }); fill("1999", "11", "25");
    fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" }));
    await screen.findByRole("region", { name: "Kết quả đổi lịch" });
    expect(convert).toHaveBeenCalledWith({ calendarType: "LUNAR", year: 1999, month: 11, day: 25, isLeapMonth: false }, expect.anything());
  });
  it("exposes leap only for lunar and sends the explicit flag; solar switch clears it", async () => {
    convert.mockReturnValue(new Promise(() => {})); render(<CalendarForm kind="convert" />);
    expect(screen.queryByRole("checkbox", { name: "Tháng âm nhuận" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Chiều đổi lịch"), { target: { value: "LUNAR" } }); fill("2023", "2", "1");
    fireEvent.click(screen.getByLabelText("Tháng âm nhuận")); fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" }));
    expect(convert).toHaveBeenLastCalledWith({ calendarType: "LUNAR", year: 2023, month: 2, day: 1, isLeapMonth: true }, expect.anything());
    const signal = convert.mock.calls[0][1]; fireEvent.change(screen.getByLabelText("Chiều đổi lịch"), { target: { value: "SOLAR" } });
    expect(signal.aborted).toBe(true); expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" })); expect(convert).toHaveBeenLastCalledWith(expect.objectContaining({ calendarType: "SOLAR", isLeapMonth: false }), expect.anything());
    fireEvent.change(screen.getByLabelText("Chiều đổi lịch"), { target: { value: "LUNAR" } });
    expect((screen.getByLabelText("Tháng âm nhuận") as HTMLInputElement).checked).toBe(false);
  });
  it("focuses the first required field and associates its accessible error", () => {
    render(<CalendarForm kind="convert" />); fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" }));
    const year = screen.getByLabelText("Năm Dương (bắt buộc)");
    expect(document.activeElement).toBe(year); expect(year.getAttribute("aria-invalid")).toBe("true");
    expect(year.getAttribute("aria-describedby")).toContain("calendar-convert-year-error"); expect(convert).not.toHaveBeenCalled();
  });
  it("rejects an impossible Gregorian day locally, with focus on day", () => {
    render(<CalendarForm kind="convert" />); fill("1900", "2", "29"); fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Ngày Dương (bắt buộc)")); expect(convert).not.toHaveBeenCalled();
  });
  it("delegates lunar leap validity and partial 1899 range to the Server error", async () => {
    convert.mockRejectedValue(new RestError("INVALID_DATE")); render(<CalendarForm kind="convert" />);
    fireEvent.change(screen.getByLabelText("Chiều đổi lịch"), { target: { value: "LUNAR" } }); fill("1899", "2", "30");
    fireEvent.click(screen.getByLabelText("Tháng âm nhuận")); fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("tháng nhuận âm không tồn tại"));
    expect(convert).toHaveBeenCalled(); expect(screen.queryByRole("region", { name: "Kết quả đổi lịch" })).toBeNull();
  });
  it("ignores an old response after edits and prevents duplicate pending submissions", async () => {
    const old = defer<CalendarResult>(), current = defer<CalendarResult>(); convert.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    render(<CalendarForm kind="convert" />); fill(); const form = screen.getByRole("form", { name: "Đổi lịch Âm–Dương" }); fireEvent.submit(form); fireEvent.submit(form);
    expect(convert).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Đang chờ phản hồi…" }).hasAttribute("disabled")).toBe(true);
    const signal = convert.mock.calls[0][1]; fireEvent.change(screen.getByLabelText("Ngày Dương (bắt buộc)"), { target: { value: "2" } });
    expect(signal.aborted).toBe(true); fireEvent.submit(form);
    await act(async () => current.reject(new RestError("DATABASE_UNAVAILABLE"))); await act(async () => old.resolve(calendar.data as CalendarResult));
    expect(screen.getByRole("alert").textContent).toContain("DATABASE_UNAVAILABLE"); expect(screen.queryByRole("region", { name: "Kết quả đổi lịch" })).toBeNull();
  });
  it("clears a completed result immediately on edit without automatic resubmit", async () => {
    render(<CalendarForm kind="convert" />); fill(); fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" })); await screen.findByRole("region", { name: "Kết quả đổi lịch" });
    fireEvent.change(screen.getByLabelText("Năm Dương (bắt buộc)"), { target: { value: "2001" } });
    expect(screen.queryByRole("region", { name: "Kết quả đổi lịch" })).toBeNull(); expect(convert).toHaveBeenCalledTimes(1); expect(screen.getByRole("status").textContent).toBe("Chưa gửi yêu cầu.");
  });
  it("aborts unmount and ignores a late rejection", async () => {
    const old = defer<CalendarResult>(); convert.mockReturnValue(old.promise); const { unmount } = render(<CalendarForm kind="convert" />);
    fill(); fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" })); const signal = convert.mock.calls[0][1]; unmount();
    expect(signal.aborted).toBe(true); await act(async () => old.reject(new Error("late")));
  });
  it("omits optional time and presents hour=null honestly", async () => {
    calculate.mockResolvedValue({ ...canChi.data, hour: null } as CanChiResult); render(<CalendarForm kind="can-chi" />);
    fill("2024", "2", "10"); fireEvent.click(screen.getByRole("button", { name: "Xem Can Chi" }));
    await screen.findByRole("region", { name: "Kết quả Can Chi" });
    expect(calculate).toHaveBeenCalledWith({ date: { calendarType: "SOLAR", year: 2024, month: 2, day: 10, isLeapMonth: false } }, expect.anything());
    expect(screen.getByText(/Chưa xét Can Chi giờ vì không cung cấp giờ/)).toBeTruthy();
  });
  it("renders the real 23:59 fixture with Vietnamese labels, distinct Tý/Tỵ display mapping", async () => {
    render(<CalendarForm kind="can-chi" />); fill("2024", "2", "10"); fireEvent.change(screen.getByLabelText("Giờ (tùy chọn, HH:mm)"), { target: { value: "23:59" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem Can Chi" })); await screen.findByRole("region", { name: "Kết quả Can Chi" });
    expect(calculate).toHaveBeenCalledWith(expect.objectContaining({ time: "23:59" }), expect.anything());
    expect(screen.getAllByText("Giáp Thìn", { exact: true })).toHaveLength(2); expect(screen.getByText("Bính Dần", { exact: true })).toBeTruthy(); expect(screen.getByText("Giáp Tý", { exact: true })).toBeTruthy();
  });
  it.each(["24:00", "08:30:00"])("rejects invalid time %s and focuses it", time => {
    render(<CalendarForm kind="can-chi" />); fill(); const field = screen.getByLabelText("Giờ (tùy chọn, HH:mm)"); fireEvent.change(field, { target: { value: time } });
    fireEvent.click(screen.getByRole("button", { name: "Xem Can Chi" })); expect(document.activeElement).toBe(field); expect(calculate).not.toHaveBeenCalled();
  });
  it.each(["INVALID_INPUT", "RULE_NOT_AVAILABLE", "DATABASE_UNAVAILABLE", "INTERNAL_ERROR", "REQUEST_TIMEOUT", "NETWORK_ERROR", "INVALID_RESPONSE"])("shows %s without stale completed output", async code => {
    convert.mockRejectedValue(new RestError(code)); render(<CalendarForm kind="convert" />); fill(); fireEvent.click(screen.getByRole("button", { name: "Đổi lịch" }));
    expect((await screen.findByRole("alert")).textContent).toContain(code); expect(screen.queryByRole("region", { name: "Kết quả đổi lịch" })).toBeNull();
  });
  it("keeps both forms independent and presents the real convention limits", async () => {
    render(<CalendarPage />); const convertForm = within(screen.getByRole("form", { name: "Đổi lịch Âm–Dương" })); const canForm = within(screen.getByRole("form", { name: "Tra cứu Can Chi" }));
    fill("2000", "1", "1", convertForm); fireEvent.click(convertForm.getByRole("button", { name: "Đổi lịch" }));
    await screen.findByRole("region", { name: "Kết quả đổi lịch" }); expect(calculate).not.toHaveBeenCalled();
    expect(canForm.getByLabelText("Năm Dương (bắt buộc)")).toHaveProperty("value", "");
    expect(screen.getByText(/Không phải Bát Tự/)).toBeTruthy(); expect(screen.getByText(/23:xx vẫn dùng Can/)).toBeTruthy();
  });
});
