import type { MaiHoaPayload } from "@/types/contract";

export type InputField = "datetime" | "objectCount" | "hourIndex" | "question";
type InputError = { ok: false; field: InputField; message: string };
type InputResult<T> = { ok: true; payload: T } | InputError;
type TimePayload = Extract<MaiHoaPayload, { method: "TIME" }>;
type ObjectCountPayload = Extract<MaiHoaPayload, { method: "OBJECT_COUNT" }>;

export const TIME_MIN_DATETIME = "1900-01-01T00:00";
export const TIME_MAX_DATETIME = "2099-12-31T23:59";

function questionError(question: string | undefined): InputError | null {
  return question !== undefined && question.length > 500
    ? { ok: false, field: "question", message: "Câu hỏi chỉ được tối đa 500 ký tự. Vui lòng rút ngắn nội dung trước khi gửi." }
    : null;
}

// Civil Gregorian input only. No device timezone, clock, lunar date or hour-branch calculation.
export function buildTimePayload(datetime: string, question?: string): InputResult<TimePayload> {
  if (datetime === "") return { ok: false, field: "datetime", message: "Vui lòng chọn thời điểm lập quẻ." };
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(datetime);
  if (!parts || parts[0] !== datetime) return { ok: false, field: "datetime", message: "Ngày giờ cần đúng dạng YYYY-MM-DDTHH:mm, chính xác đến phút; không kèm giây hoặc múi giờ." };
  const [year, month, day, hour, minute] = parts.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]) {
    return { ok: false, field: "datetime", message: "Ngày không tồn tại trong lịch Dương. Vui lòng kiểm tra ngày, tháng và năm." };
  }
  if (hour > 23 || minute > 59) {
    return { ok: false, field: "datetime", message: "Giờ cần từ 00 đến 23 và phút từ 00 đến 59." };
  }
  // This UI accepts fixed UTC+7 civil input, not arbitrary offset API timestamps.
  if (datetime < TIME_MIN_DATETIME || datetime > TIME_MAX_DATETIME) {
    return { ok: false, field: "datetime", message: "Ngày lập quẻ cần trong khoảng 1900-01-01 đến 2099-12-31 theo giờ Việt Nam (UTC+07:00)." };
  }
  const error = questionError(question);
  if (error) return error;
  return { ok: true, payload: { method: "TIME", datetime: `${datetime}:00+07:00`, ...(question === undefined ? {} : { question }) } };
}

function isDecimalInput(value: string): boolean {
  // Keep decimal/exponent inputs, but reject Number() coercion of hex, binary or whitespace.
  const match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.exec(value);
  return match !== null && match[0] === value;
}

export function buildObjectCountPayload(objectCount: string, hourIndex: string, question?: string): InputResult<ObjectCountPayload> {
  const count = Number(objectCount), hour = Number(hourIndex);
  if (!isDecimalInput(objectCount) || !Number.isInteger(count) || count < 1 || count > 999_999) {
    return { ok: false, field: "objectCount", message: "Số vật phải là số nguyên từ 1 đến 999999." };
  }
  if (!isDecimalInput(hourIndex) || !Number.isInteger(hour) || hour < 1 || hour > 12) {
    return { ok: false, field: "hourIndex", message: "Giờ Chi phải từ Tý (1) đến Hợi (12)." };
  }
  const error = questionError(question);
  if (error) return error;
  return { ok: true, payload: { method: "OBJECT_COUNT", objectCount: count, hourIndex: hour, ...(question === undefined ? {} : { question }) } };
}
