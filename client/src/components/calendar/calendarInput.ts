import type { CalendarInput, CanChiInput } from "@/types/contract";

export type CalendarDraft = { calendarType: string; year: string; month: string; day: string; isLeapMonth: boolean; time: string };
export type CalendarField = "calendarType" | "year" | "month" | "day" | "time";
export type CalendarErrors = Partial<Record<CalendarField, string>>;
export const emptyCalendarDraft = (): CalendarDraft => ({ calendarType: "SOLAR", year: "", month: "", day: "", isLeapMonth: false, time: "" });
export const validClock = (value: string) => value.length === 5 && /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);

// Basic Gregorian validity only, without Date/ZoneId or any lunar conversion algorithm.
export function validGregorianDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger) || month < 1 || month > 12 || day < 1) return false;
  const february = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return day <= [31, february, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function buildCalendarInput(draft: CalendarDraft): { ok: true; payload: CalendarInput } | { ok: false; errors: CalendarErrors } {
  const errors: CalendarErrors = {};
  const kind = draft.calendarType;
  if (kind !== "SOLAR" && kind !== "LUNAR") errors.calendarType = "Vui lòng chọn chiều đổi lịch.";
  const number = (value: string) => value !== "" && !/[^0-9]/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
  const year = number(draft.year), month = number(draft.month), day = number(draft.day);
  if (!Number.isInteger(year) || year < (kind === "LUNAR" ? 1899 : 1900) || year > 2099) errors.year = kind === "LUNAR"
    ? "Nhập năm âm nguyên từ 1899 đến 2099; Server xác nhận ngày Dương tương ứng trong phạm vi."
    : "Nhập năm Dương nguyên từ 1900 đến 2099.";
  if (!Number.isInteger(month) || month < 1 || month > 12) errors.month = "Nhập tháng nguyên từ 1 đến 12.";
  if (!Number.isInteger(day) || day < 1 || day > (kind === "LUNAR" ? 30 : 31)) errors.day = kind === "LUNAR" ? "Nhập ngày âm nguyên từ 1 đến 30; Server kiểm tra độ dài tháng." : "Nhập ngày nguyên từ 1 đến 31.";
  if (kind === "SOLAR" && Object.keys(errors).length === 0 && !validGregorianDate(year, month, day)) errors.day = "Ngày Dương không tồn tại trong tháng/năm đã nhập.";
  if (Object.keys(errors).length || (kind !== "SOLAR" && kind !== "LUNAR")) return { ok: false, errors };
  return { ok: true, payload: { calendarType: kind, year, month, day, isLeapMonth: kind === "LUNAR" && draft.isLeapMonth } };
}
export function buildCanChiInput(draft: CalendarDraft): { ok: true; payload: CanChiInput } | { ok: false; errors: CalendarErrors } {
  const date = buildCalendarInput(draft);
  const timeError = draft.time !== "" && !validClock(draft.time);
  if (!date.ok || timeError) return { ok: false, errors: { ...(!date.ok ? date.errors : {}), ...(timeError ? { time: "Giờ phải đúng HH:mm từ 00:00 đến 23:59, không có giây hoặc múi giờ." } : {}) } };
  return { ok: true, payload: { date: date.payload, ...(draft.time === "" ? {} : { time: draft.time }) } };
}
