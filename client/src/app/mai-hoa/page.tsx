"use client";

import { FormEvent, useRef, useState } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import { useCalculation } from "@/services/websocket/useCalculation";
import type { MaiHoaPayload } from "@/types/contract";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { FieldError, FormField, PrimaryButton, SectionCard, StatusBanner } from "@/components/ui/Controls";
import { LinesForm } from "@/components/mai-hoa/LinesForm";
import { CelestialArt } from "@/components/ui/CelestialArt";
import { buildObjectCountPayload, buildTimePayload, TIME_MIN_DATETIME, TIME_MAX_DATETIME, type InputField } from "@/components/mai-hoa/maiHoaInput";

const fieldIds: Record<InputField, string> = {
  datetime: "maihoa-datetime", objectCount: "maihoa-count", hourIndex: "maihoa-hour", question: "maihoa-question",
};

export default function MaiHoaPage() {
  const [method, setMethod] = useState<MaiHoaPayload["method"]>("TIME");
  const [datetime, setDatetime] = useState("");
  const [objectCount, setObjectCount] = useState("");
  const [hourIndex, setHourIndex] = useState("1");
  const [question, setQuestion] = useState("");
  const [formError, setFormError] = useState<{ field: InputField; message: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const calculation = useCalculation();

  function clearFieldError(field: InputField) {
    setFormError(current => current?.field === field ? null : current);
  }
  function fieldError(field: InputField) {
    return formError?.field === field ? <FieldError id={`${fieldIds[field]}-error`}>{formError.message}</FieldError> : null;
  }
  function describedBy(field: InputField) {
    return [field === "datetime" ? "maihoa-datetime-hint" : null, formError?.field === field ? `${fieldIds[field]}-error` : null].filter(Boolean).join(" ") || undefined;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (calculation.connection !== "connected" || calculation.requestState === "waiting") return;
    setFormError(null);
    if (method === "LINES") return; // LINES retains its own input boundary.
    const result = method === "TIME" ? buildTimePayload(datetime, question) : buildObjectCountPayload(objectCount, hourIndex, question);
    if (!result.ok) {
      setFormError(result);
      formRef.current?.querySelector<HTMLElement>(`#${fieldIds[result.field]}`)?.focus();
      return;
    }
    calculation.submit("MAI_HOA", result.payload);
  }

  return (
    <PageContainer className="maihoa-page">
      <PageHeader eyebrow="01 / MAI HOA DỊCH SỐ" title="Bắt đầu từ một quẻ.">
        <p>Chọn một phương pháp lập quẻ. Từ sáu hào Âm Dương đến thời gian và số vật, mỗi khởi đầu là một cách tiếp cận tri thức.</p>
      </PageHeader>
      <fieldset className="method-selector" disabled={calculation.requestState === "waiting"}>
        <legend className="eyebrow">Phương pháp</legend>
        {([
          { value: "TIME", title: "Theo thời gian", detail: "Thời điểm khởi quẻ", symbol: "◷" },
          { value: "OBJECT_COUNT", title: "Theo số vật đếm được", detail: "Số lượng & giờ Chi", symbol: "⋮" },
          { value: "LINES", title: "Nhập sáu hào (LINES)", detail: "Tự chọn Âm & Dương", symbol: "☷" },
        ] as const).map(item => <label key={item.value} className="method-option">
          <input type="radio" name="maihoa-method" value={item.value} checked={method === item.value}
            onChange={() => { setMethod(item.value); setFormError(null); }} />
          <span className="method-option-content"><span className="method-symbol" aria-hidden="true">{item.symbol}</span><span><strong>{item.title}</strong><span className="method-detail">{item.detail}</span></span><span className="method-check" aria-hidden="true">✓</span></span>
        </label>)}
      </fieldset>
      <div className="input-layout">
        <SectionCard title="Dữ liệu lập quẻ">
          {method === "LINES" ? <LinesForm onSubmit={payload => calculation.submit("MAI_HOA", payload)}
            disabled={calculation.connection !== "connected"} busy={calculation.requestState === "waiting"} /> : (
        <form ref={formRef} onSubmit={onSubmit} noValidate className="form-stack" aria-label="Lập quẻ theo thời gian hoặc số vật">
          {method === "TIME" ? (
            <FormField id="maihoa-datetime" label="Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)" hint="Ngày từ 1900-01-01 đến 2099-12-31 theo giờ Việt Nam (UTC+07:00), chính xác đến phút; không theo múi giờ của thiết bị.">
              <input id="maihoa-datetime" type="datetime-local" step={60} min={TIME_MIN_DATETIME} max={TIME_MAX_DATETIME} value={datetime}
                aria-invalid={formError?.field === "datetime" || undefined} aria-describedby={describedBy("datetime")}
                onChange={(event) => { setDatetime(event.target.value); clearFieldError("datetime"); }} required />
              {fieldError("datetime")}
            </FormField>
          ) : (
            <>
              <FormField id="maihoa-count" label="Số vật đếm được">
                <input id="maihoa-count" type="number" min={1} max={999999} step={1} value={objectCount}
                  aria-invalid={formError?.field === "objectCount" || undefined} aria-describedby={describedBy("objectCount")}
                  onChange={(event) => { setObjectCount(event.target.value); clearFieldError("objectCount"); }} required />
                {fieldError("objectCount")}
              </FormField>
              <FormField id="maihoa-hour" label="Giờ Chi">
                <select id="maihoa-hour" value={hourIndex}
                  aria-invalid={formError?.field === "hourIndex" || undefined} aria-describedby={describedBy("hourIndex")}
                  onChange={(event) => { setHourIndex(event.target.value); clearFieldError("hourIndex"); }}>
                  {["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"].map((name, index) => (
                    <option key={name} value={index + 1}>{name} ({index + 1})</option>
                  ))}
                </select>
                {fieldError("hourIndex")}
              </FormField>
            </>
          )}
          <FormField id="maihoa-question" label="Câu hỏi (tùy chọn)">
            <textarea id="maihoa-question" rows={3} maxLength={500} value={question}
              aria-invalid={formError?.field === "question" || undefined} aria-describedby={describedBy("question")}
              onChange={(event) => { setQuestion(event.target.value); clearFieldError("question"); }} />
            {fieldError("question")}
          </FormField>
          <PrimaryButton type="submit" disabled={calculation.connection !== "connected" || calculation.requestState === "waiting"}>{calculation.requestState === "waiting" ? "Đang chờ phản hồi…" : "Gửi yêu cầu"}</PrimaryButton>
        </form>)}
        </SectionCard>
        <aside className="input-guide" aria-label="Hướng dẫn lập quẻ">
          <div className="guide-art"><CelestialArt compact /></div>
          <p className="eyebrow">TRƯỚC KHI BẮT ĐẦU</p>
          <h2>Rõ đầu vào.<br />Giữ đúng căn cứ.</h2>
          <p>Với LINES, bạn chọn sáu hào và một hào động. Hào 1 nằm ở dưới, hào 6 nằm ở trên. Không cần nhập ngày giờ hay câu hỏi.</p>
          <StatusBanner>Server đã triển khai LINES, số vật và TIME. TIME dùng giờ Việt Nam UTC+07:00 cố định, kèm nguồn và quyết định nhóm. Để nhận kết quả cần kết nối Backend hoạt động và dữ liệu đã duyệt.</StatusBanner>
        </aside>
      </div>
      <div className="result-region"><ResultPanel {...calculation} /></div>
    </PageContainer>
  );
}

