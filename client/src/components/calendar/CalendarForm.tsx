"use client";
import { useRef, useState, type FormEvent } from "react";
import { FieldError, FormField, PrimaryButton, SectionCard } from "@/components/ui/Controls";
import { buildCalendarInput, buildCanChiInput, emptyCalendarDraft, type CalendarDraft, type CalendarErrors, type CalendarField } from "./calendarInput";
import { useCalendarRequest } from "@/services/rest/useCalendarRequest";
import { calendarErrorMessage } from "@/services/rest/calendar";
import { RestError } from "@/services/rest/transport";
import { CalendarResultView } from "./CalendarResultView";

export function CalendarForm({ kind }: { kind: "convert" | "can-chi" }) {
  const [draft, setDraft] = useState<CalendarDraft>(emptyCalendarDraft);
  const [errors, setErrors] = useState<CalendarErrors>({});
  const ref = useRef<HTMLFormElement>(null);
  const request = useCalendarRequest(kind);
  const prefix = `calendar-${kind}`;
  const title = kind === "convert" ? "Đổi lịch Âm–Dương" : "Tra cứu Can Chi";
  function edit(patch: Partial<CalendarDraft>) {
    request.clear(); setErrors({});
    setDraft(current => ({ ...current, ...patch, ...(patch.calendarType === "SOLAR" ? { isLeapMonth: false } : {}) }));
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (request.status === "loading") return;
    const result = kind === "convert" ? buildCalendarInput(draft) : buildCanChiInput(draft);
    if (!result.ok) {
      request.clear(); setErrors(result.errors);
      const first = (["calendarType", "year", "month", "day", "time"] as const).find(field => result.errors[field]);
      if (first) ref.current?.querySelector<HTMLElement>(`#${prefix}-${first}`)?.focus();
      return;
    }
    setErrors({});
    request.submit("date" in result.payload ? result.payload : { date: result.payload });
  }
  const described = (field: CalendarField) => `${prefix}-${field}-hint${errors[field] ? ` ${prefix}-${field}-error` : ""}`;
  return <SectionCard title={title}>
    <form ref={ref} onSubmit={submit} noValidate className="form-stack" aria-label={title}>
      <FormField id={`${prefix}-calendarType`} label={kind === "convert" ? "Chiều đổi lịch" : "Loại ngày đầu vào"} hint="Đổi loại lịch không tự chuyển đổi các số đã nhập; kết quả cũ được xóa.">
        <select id={`${prefix}-calendarType`} value={draft.calendarType} aria-invalid={!!errors.calendarType || undefined} aria-describedby={described("calendarType")}
          onChange={event => edit({ calendarType: event.target.value })}>
          <option value="SOLAR">{kind === "convert" ? "Dương lịch → Âm lịch" : "Dương lịch"}</option>
          <option value="LUNAR">{kind === "convert" ? "Âm lịch → Dương lịch" : "Âm lịch"}</option>
        </select>
        {errors.calendarType && <FieldError id={`${prefix}-calendarType-error`}>{errors.calendarType}</FieldError>}
      </FormField>
      <div className="calendar-date-inputs">{(["year", "month", "day"] as const).map((field, index) => <FormField key={field} id={`${prefix}-${field}`}
        label={`${["Năm", "Tháng", "Ngày"][index]} ${draft.calendarType === "LUNAR" ? "Âm" : "Dương"} (bắt buộc)`}
        hint={field === "year" ? draft.calendarType === "LUNAR" ? "1899–2099; Server kiểm tra phạm vi Dương tương ứng." : "1900–2099." : field === "month" ? "Số nguyên 1–12." : draft.calendarType === "LUNAR" ? "1–30; Server kiểm tra tháng đủ/thiếu." : "Ngày hợp lệ trong tháng Dương."}>
        <input id={`${prefix}-${field}`} type="text" inputMode="numeric" required autoComplete="off" value={draft[field]}
          aria-invalid={!!errors[field] || undefined} aria-describedby={described(field)}
          onChange={event => edit({ [field]: event.target.value })} />
        {errors[field] && <FieldError id={`${prefix}-${field}-error`}>{errors[field]}</FieldError>}
      </FormField>)}</div>
      {draft.calendarType === "LUNAR" && <label className="checkbox-field"><input type="checkbox" checked={draft.isLeapMonth}
        onChange={event => edit({ isLeapMonth: event.target.checked })} />Tháng âm nhuận</label>}
      {kind === "can-chi" && <FormField id={`${prefix}-time`} label="Giờ (tùy chọn, HH:mm)" hint="Giờ Việt Nam UTC+07:00, 00:00–23:59. Để trống để không xét Can Chi giờ; không tự lấy giờ máy.">
        <input id={`${prefix}-time`} type="text" inputMode="text" placeholder="HH:mm" value={draft.time} autoComplete="off" maxLength={5}
          aria-invalid={!!errors.time || undefined} aria-describedby={described("time")} onChange={event => edit({ time: event.target.value })} />
        {errors.time && <FieldError id={`${prefix}-time-error`}>{errors.time}</FieldError>}
      </FormField>}
      <p className="field-hint">Thay đổi đầu vào sẽ hủy yêu cầu đang chờ và xóa kết quả cũ. Không tự gửi lại.</p>
      <PrimaryButton type="submit" disabled={request.status === "loading"}>{request.status === "loading" ? "Đang chờ phản hồi…" : kind === "convert" ? "Đổi lịch" : "Xem Can Chi"}</PrimaryButton>
    </form>
    <div className="calendar-feedback" aria-busy={request.status === "loading"}>
      <p role="status" aria-live="polite" aria-atomic="true">{request.status === "idle" ? "Chưa gửi yêu cầu." : request.status === "loading" ? "Đang chờ kết quả từ Server…" : request.status === "completed" ? "Yêu cầu lịch đã hoàn tất." : "Yêu cầu lịch chưa thành công."}</p>
      {request.status === "failed" && <div className="response-error" role="alert">
        <p>{calendarErrorMessage(request.error)}</p>{request.error instanceof RestError && <p className="calendar-error-code">Mã lỗi: <code>{request.error.code}</code>
          {request.error.apiError?.ruleCode === "LUNAR-CONVERSION" && <span> · Quy tắc LUNAR-CONVERSION</span>}</p>}
      </div>}
      {request.status === "completed" && <CalendarResultView data={request.data} input={request.input} />}
    </div>
  </SectionCard>;
}
