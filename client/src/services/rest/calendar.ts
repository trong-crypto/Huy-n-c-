import type { CalendarInput, CalendarResult, CanChiInput, CanChiResult } from "@/types/contract";
import { isCalendarResult, isCanChiResult } from "@/types/calendarValidation";
import { requestJson, RestError } from "./transport";

function assertRequestedDate(result: CalendarResult, input: CalendarInput) {
  const matches = input.calendarType === "SOLAR"
    ? result.solarDate === `${input.year}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")}`
    : result.lunarDate.year === input.year && result.lunarDate.month === input.month && result.lunarDate.day === input.day && result.lunarDate.isLeapMonth === input.isLeapMonth;
  if (!matches) throw new RestError("INVALID_RESPONSE");
}
export async function convertCalendar(input: CalendarInput, signal: AbortSignal) {
  const result = await requestJson("/calendar/convert", isCalendarResult, signal, input);
  assertRequestedDate(result, input); return result;
}
export async function calculateCanChi(input: CanChiInput, signal: AbortSignal): Promise<CanChiResult> {
  const result = await requestJson("/calendar/can-chi", isCanChiResult, signal, input);
  assertRequestedDate(result, input.date);
  if ((input.time === undefined) !== (result.hour === null)) throw new RestError("INVALID_RESPONSE");
  return result;
}
export type CalendarSubmission = { date: CalendarInput; time?: string };
export type CalendarOutput = CalendarResult | CanChiResult;
export function calendarErrorMessage(error: unknown): string {
  if (!(error instanceof RestError)) return "Không thể hoàn tất yêu cầu lịch. Vui lòng thử lại.";
  const messages: Record<string, string> = {
    INVALID_INPUT: "Đầu vào lịch không hợp lệ. Kiểm tra năm, tháng, ngày và loại lịch.",
    INVALID_DATE: "Ngày không hợp lệ, ngoài phạm vi hỗ trợ hoặc tháng nhuận âm không tồn tại. Vui lòng kiểm tra lại; không tự sửa ngày.",
    RULE_NOT_AVAILABLE: "Quy tắc lịch đã duyệt hiện chưa khả dụng. Không thay thế bằng công thức trên Client.",
    DATABASE_UNAVAILABLE: "Dịch vụ lịch tạm thời không truy cập được kho dữ liệu. Vui lòng thử lại sau.",
    INTERNAL_ERROR: "Server chưa thể xử lý yêu cầu lịch. Vui lòng thử lại sau.",
    INVALID_RESPONSE: "Phản hồi lịch không đúng hợp đồng. Không hiển thị kết quả chưa xác thực.",
    NETWORK_ERROR: "Không kết nối được dịch vụ lịch. Kiểm tra kết nối và thử lại.",
    REQUEST_TIMEOUT: "Yêu cầu lịch quá thời gian chờ. Vui lòng thử lại.",
  };
  return Object.hasOwn(messages, error.code) ? messages[error.code] : "Dịch vụ lịch trả về lỗi chưa được nhận diện. Yêu cầu chưa thành công.";
}
