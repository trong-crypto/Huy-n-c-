import type { TamThePayload } from "@/types/contract";

export const TAM_THE_CATEGORIES = ["CAREER", "WEALTH", "LOVE"] as const;
export type TamTheField = "birthDate" | "birthTime" | "calendarType" | "isLeapMonth" | "categories" | "wealthMode";
export type TamTheInput = Readonly<{
  birthDate: string;
  birthTime: string;
  calendarType: string;
  isLeapMonth: boolean;
  categories: readonly string[];
  wealthMode?: string;
}>;
export type TamTheErrors = Partial<Record<TamTheField, string>>;
type InputResult = { ok: true; payload: TamThePayload } | { ok: false; errors: TamTheErrors };

// Validate civil input only. No conversion, current clock, lunar lookup or interpretation.
export function buildTamThePayload(input: TamTheInput): InputResult {
  const errors: TamTheErrors = {};
  const calendarType = input.calendarType === "SOLAR" ? "SOLAR" : input.calendarType === "LUNAR" ? "LUNAR" : null;
  if (calendarType === null) errors.calendarType = "Vui lòng chọn Dương lịch hoặc Âm lịch.";

  const date = typeof input.birthDate === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthDate) : null;
  if (!date || date[0] !== input.birthDate) {
    errors.birthDate = "Ngày sinh cần đúng dạng YYYY-MM-DD, không kèm giờ hoặc ký tự khác.";
  } else {
    const [year, month, day] = date.slice(1).map(Number);
    if (month < 1 || month > 12 || day < 1 || (calendarType === "LUNAR" && day > 30)) {
      errors.birthDate = calendarType === "LUNAR"
        ? "Ngày Âm lịch cần tháng từ 01 đến 12 và ngày từ 01 đến 30."
        : "Ngày sinh không tồn tại trong lịch Dương.";
    } else if (calendarType === "SOLAR") {
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (day > days[month - 1]) errors.birthDate = "Ngày sinh không tồn tại trong lịch Dương.";
    }
  }
  const time = typeof input.birthTime === "string" ? /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(input.birthTime) : null;
  if (!time || time[0] !== input.birthTime) errors.birthTime = "Giờ sinh cần HH:mm, giờ 00–23 và phút 00–59; không kèm giây hoặc múi giờ.";

  if (typeof input.isLeapMonth !== "boolean") errors.isLeapMonth = "Tháng nhuận cần là lựa chọn có hoặc không.";
  else if (calendarType === "SOLAR" && input.isLeapMonth) errors.isLeapMonth = "Dương lịch không dùng tháng nhuận. Vui lòng chọn lại loại lịch.";

  const categories = input.categories;
  if (!Array.isArray(categories) || categories.length < 1 || categories.length > 3
      || Array.from(categories).some(category => typeof category !== "string" || !TAM_THE_CATEGORIES.some(known => known === category))
      || new Set(categories).size !== categories.length) {
    errors.categories = "Vui lòng chọn từ 1 đến 3 mục Công danh, Tài lộc, Tình duyên, không trùng lặp.";
  }
  const wealthMode = input.wealthMode ?? "LEGACY";
  if (wealthMode !== "LEGACY" && wealthMode !== "EXTENDED") errors.wealthMode = "Vui lòng chọn chế độ Tài lộc Cơ bản hoặc Mở rộng.";
  else if (wealthMode === "EXTENDED" && (!Array.isArray(categories) || !categories.includes("WEALTH"))) {
    errors.wealthMode = "Chế độ mở rộng cần chọn mục Tài lộc. Hãy chọn Tài lộc hoặc chuyển về Cơ bản.";
  }
  if (Object.keys(errors).length > 0 || calendarType === null || typeof input.isLeapMonth !== "boolean") return { ok: false, errors };

  // Ordering is canonical only after rejecting malformed, duplicate or unknown selections.
  const ordered = TAM_THE_CATEGORIES.filter(category => categories.includes(category));
  return { ok: true, payload: {
    birthDate: input.birthDate, birthTime: input.birthTime, calendarType, isLeapMonth: input.isLeapMonth,
    ...(ordered.length === 3 ? {} : { categories: ordered }),
    ...(wealthMode === "EXTENDED" ? { wealthMode: "EXTENDED" as const } : {}),
  } };
}
