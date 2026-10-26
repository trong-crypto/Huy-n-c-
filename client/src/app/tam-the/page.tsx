"use client";

import { FormEvent, useRef, useState } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import { useCalculation } from "@/services/websocket/useCalculation";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { FieldError, FormField, PrimaryButton, SectionCard, StatusBanner } from "@/components/ui/Controls";
import { TamTheArt } from "@/components/ui/TamTheArt";
import { buildTamThePayload, TAM_THE_CATEGORIES, type TamTheErrors, type TamTheField, type TamTheInput } from "@/components/tam-the/tamTheInput";

const fieldIds: Record<TamTheField, string> = {
  birthDate: "tamthe-date", birthTime: "tamthe-time", calendarType: "tamthe-calendar", isLeapMonth: "tamthe-leap", categories: "tamthe-categories", wealthMode: "tamthe-wealth-mode",
};
const categoryLabels = { CAREER: "Công danh", WEALTH: "Tài lộc", LOVE: "Tình duyên" };

export default function TamThePage() {
  const [input, setInput] = useState<TamTheInput>({ birthDate: "", birthTime: "", calendarType: "SOLAR", isLeapMonth: false, categories: [...TAM_THE_CATEGORIES], wealthMode: "LEGACY" });
  const [errors, setErrors] = useState<TamTheErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const calculation = useCalculation();
  const waiting = calculation.requestState === "waiting";

  function edit(patch: Partial<TamTheInput>, affected: TamTheField[]) {
    const next = { ...input, ...patch };
    setInput(next);
    const validation = buildTamThePayload(next);
    setErrors(current => {
      const updated = { ...current };
      for (const field of affected) {
        if (validation.ok || !validation.errors[field]) delete updated[field];
        else if (current[field]) updated[field] = validation.errors[field];
      }
      return updated;
    });
  }
  function error(field: TamTheField) {
    return errors[field] ? <FieldError id={`${fieldIds[field]}-error`}>{errors[field]}</FieldError> : null;
  }
  function describedBy(field: TamTheField) {
    return [`${fieldIds[field]}-hint`, errors[field] ? `${fieldIds[field]}-error` : null,
      field === "calendarType" && input.calendarType !== "LUNAR" && errors.isLeapMonth ? "tamthe-leap-error" : null].filter(Boolean).join(" ");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (calculation.connection !== "connected" || waiting) return;
    const result = buildTamThePayload(input);
    if (!result.ok) {
      setErrors(result.errors);
      const first = (Object.keys(fieldIds) as TamTheField[]).find(field => result.errors[field]);
      if (first) {
        const id = first === "isLeapMonth" && input.calendarType !== "LUNAR" ? fieldIds.calendarType : fieldIds[first];
        formRef.current?.querySelector<HTMLElement>(`#${id}`)?.focus();
      }
      return;
    }
    setErrors({});
    calculation.submit("TAM_THE", result.payload);
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="02 / DIỄN CẦM TAM THẾ" title="Một khởi đầu, ba chiều thời gian.">
        <p>Chọn Công danh, Tài lộc, Tình duyên theo bảng nguồn đã đối chiếu. Tài lộc mở rộng trình bày riêng Lộc, Sang hèn và Điền sản.</p>
      </PageHeader>
      <div className="input-layout">
        <SectionCard title="Thông tin đầu vào">
        <form ref={formRef} onSubmit={onSubmit} noValidate className="form-stack" aria-label="Thông tin sinh Tam Thế">
          <FormField id="tamthe-date" label="Ngày sinh (YYYY-MM-DD)" hint={input.calendarType === "LUNAR"
            ? "Nhập ngày Âm lịch, không đổi sang Dương lịch. Server xác nhận ngày thực tế và tháng nhuận."
            : "Nhập ngày Dương lịch theo dạng YYYY-MM-DD."}>
            <input id="tamthe-date" type="text" placeholder="2003-08-15" value={input.birthDate} disabled={waiting}
              aria-invalid={!!errors.birthDate || undefined} aria-describedby={describedBy("birthDate")}
              onChange={event => edit({ birthDate: event.target.value }, ["birthDate"])} required />
            {error("birthDate")}
          </FormField>
          <FormField id="tamthe-time" label="Giờ sinh (HH:mm)" hint="Giờ Việt Nam (UTC+07:00), chính xác đến phút; không đổi theo múi giờ thiết bị.">
            <input id="tamthe-time" type="time" step={60} value={input.birthTime} disabled={waiting}
              aria-invalid={!!errors.birthTime || undefined} aria-describedby={describedBy("birthTime")}
              onChange={event => edit({ birthTime: event.target.value }, ["birthTime"])} required />
            {error("birthTime")}
          </FormField>
          <FormField id="tamthe-calendar" label="Loại lịch" hint="Đổi loại lịch không tự chuyển đổi ngày đã nhập.">
            <select id="tamthe-calendar" value={input.calendarType} disabled={waiting}
              aria-invalid={!!errors.calendarType || (input.calendarType !== "LUNAR" && !!errors.isLeapMonth) || undefined} aria-describedby={describedBy("calendarType")}
              onChange={event => edit({ calendarType: event.target.value, isLeapMonth: false }, ["calendarType", "isLeapMonth", "birthDate"])}>
              <option value="SOLAR">Dương lịch</option>
              <option value="LUNAR">Âm lịch</option>
            </select>
            {error("calendarType")}
            {input.calendarType !== "LUNAR" && error("isLeapMonth")}
          </FormField>
          {input.calendarType === "LUNAR" && (
            <div className="form-field">
              <label className="checkbox-field">
                <input id="tamthe-leap" type="checkbox" checked={input.isLeapMonth} disabled={waiting}
                  aria-invalid={!!errors.isLeapMonth || undefined} aria-describedby={describedBy("isLeapMonth")}
                  onChange={event => edit({ isLeapMonth: event.target.checked }, ["isLeapMonth"])} />Tháng nhuận
              </label>
              <p id="tamthe-leap-hint" className="field-hint">Chỉ đánh dấu nếu tháng sinh Âm lịch là tháng nhuận; Server kiểm tra tính hợp lệ.</p>
              {error("isLeapMonth")}
            </div>
          )}
          <fieldset id="tamthe-categories" tabIndex={-1} className="form-field m-0 min-w-0 border-0 p-0" disabled={waiting}
            aria-invalid={!!errors.categories || undefined} aria-describedby={describedBy("categories")}>
            <legend className="text-sm font-semibold">Nội dung muốn xem</legend>
            <p id="tamthe-categories-hint" className="field-hint">Chọn ít nhất một mục. Chọn cả ba để yêu cầu đầy đủ.</p>
            {TAM_THE_CATEGORIES.map(category => <label className="checkbox-field" key={category}>
              <input type="checkbox" value={category} checked={input.categories.includes(category)}
                aria-invalid={!!errors.categories || undefined} aria-describedby={describedBy("categories")}
                onChange={event => edit({ categories: event.target.checked ? [...input.categories, event.target.value] : input.categories.filter(value => value !== event.target.value) }, ["categories", "wealthMode"])} />
              {categoryLabels[category]}
            </label>)}
            {error("categories")}
          </fieldset>
          <FormField id="tamthe-wealth-mode" label="Chế độ Tài lộc" hint="Mở rộng cần chọn Tài lộc. Công danh và Tình duyên tiếp tục dùng bảng tra tương ứng; không thay đổi cách chuyển lịch.">
            <select id="tamthe-wealth-mode" value={input.wealthMode} disabled={waiting}
              aria-invalid={!!errors.wealthMode || undefined} aria-describedby={describedBy("wealthMode")}
              onChange={event => edit({ wealthMode: event.target.value }, ["wealthMode"])}>
              <option value="LEGACY">Cơ bản</option>
              <option value="EXTENDED">Mở rộng — Lộc, Sang hèn, Điền sản</option>
            </select>
            {error("wealthMode")}
          </FormField>
          {calculation.connection !== "connected" && <p id="tamthe-connection" className="field-hint">{calculation.connection === "connecting" ? "Đang kết nối tới Server. Bạn có thể chuẩn bị thông tin; chỉ gửi khi đã kết nối." : "Mất kết nối với Server. Thông tin vẫn được giữ trên trang; chưa thể gửi yêu cầu."}</p>}
          <PrimaryButton type="submit" disabled={calculation.connection !== "connected" || waiting}
            aria-describedby={calculation.connection !== "connected" ? "tamthe-connection" : undefined}>{waiting ? "Đang chờ phản hồi…" : "Gửi yêu cầu"}</PrimaryButton>
        </form>
        </SectionCard>
        <aside className="input-guide" aria-label="Lưu ý Tam Thế">
          <TamTheArt />
          <p className="eyebrow">ĐỐI CHIẾU NGUỒN</p>
          <h2>Không luận giải<br />khi chưa đủ dữ liệu.</h2>
          <p>Chọn đúng loại lịch của ngày sinh. Với lịch âm, tháng nhuận được đánh dấu riêng; Client không tự chuyển lịch hoặc tính lời luận.</p>
          <StatusBanner>Công danh, Tài lộc và Tình duyên đã có bảng tra trên Server V12. Cơ bản giữ cách tra cũ; Mở rộng cho phép hiển thị Sang hèn và Điền sản ngay cả khi Lộc không có giao điểm trong bản in.</StatusBanner>
          <p>Các liên kết nhãn và tham chiếu biên tập vẫn là quyết định nhóm. Xem nguồn và giới hạn áp dụng của từng mục trong kết quả.</p>
        </aside>
      </div>
      <div className="result-region"><ResultPanel {...calculation} /></div>
    </PageContainer>
  );
}
