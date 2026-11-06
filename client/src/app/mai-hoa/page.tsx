"use client";

import { FormEvent, useRef, useState } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import { useCalculation } from "@/services/websocket/useCalculation";
import { SessionNotice } from "@/services/session/SessionProvider";
import type { MaiHoaPayload } from "@/types/contract";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { FieldError, FormField, PrimaryButton, SectionCard, StatusBanner } from "@/components/ui/Controls";
import { LinesForm } from "@/components/mai-hoa/LinesForm";
import { CelestialArt } from "@/components/ui/CelestialArt";
import { buildObjectCountPayload, buildTimePayload, withReadingOptions, TIME_MIN_DATETIME, TIME_MAX_DATETIME, type InputField, type ReadingSelection, type ReadingInputError } from "@/components/mai-hoa/maiHoaInput";
import { ReadingOptionsFields, readingFieldIds } from "@/components/mai-hoa/ReadingOptionsFields";

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
  const readingRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<ReadingSelection>({ enabled: false, topic: "", datetime: "" });
  const [readingError, setReadingError] = useState<ReadingInputError | null>(null);
  const calculation = useCalculation();
  const waiting = calculation.requestState === "waiting";

  function submitPayload(payload: MaiHoaPayload) {
    if (calculation.connection !== "connected" || calculation.requestState === "waiting") return;
    const result = withReadingOptions(payload, reading);
    if (!result.ok) {
      setReadingError(result);
      readingRef.current?.querySelector<HTMLElement>(`#${readingFieldIds[result.field]}`)?.focus();
      return;
    }
    setReadingError(null);
    calculation.submit("MAI_HOA", result.payload);
  }
  const readingFields = <div ref={readingRef}><ReadingOptionsFields method={method} value={reading} error={readingError}
    onChange={value => { setReading(value); setReadingError(null); }} disabled={calculation.requestState === "waiting"} /></div>;

  function clearFieldError(field: InputField) {
    setFormError(current => current?.field === field ? null : current);
  }
  function fieldError(field: InputField) {
    return formError?.field === field ? <FieldError id={`${fieldIds[field]}-error`}>{formError.message}</FieldError> : null;
  }
  function describedBy(field: InputField) {
    return [field === "datetime" || field === "question" ? `${fieldIds[field]}-hint` : null, formError?.field === field ? `${fieldIds[field]}-error` : null].filter(Boolean).join(" ") || undefined;
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
    submitPayload(result.payload);
  }

  return (
    <PageContainer className="maihoa-page">
      <PageHeader eyebrow="01 / MAI HOA DỊCH SỐ" title="Bắt đầu từ một quẻ.">
        <p>Lập quẻ để tìm hiểu Mai Hoa Dịch Số và đối chiếu lời luận có nguồn. Kết quả dựa trên dữ kiện lập quẻ và chủ đề bạn chọn.</p>
      </PageHeader>
      <fieldset className="method-selector" disabled={calculation.requestState === "waiting"}>
        <legend className="eyebrow">Phương pháp</legend>
        {([
          { value: "TIME", title: "Theo thời gian", detail: "Thời điểm khởi quẻ", symbol: "◷" },
          { value: "OBJECT_COUNT", title: "Theo số vật đếm được", detail: "Số lượng & giờ Chi", symbol: "⋮" },
          { value: "LINES", title: "Nhập sáu hào (LINES)", detail: "Tự chọn Âm & Dương", symbol: "☷" },
        ] as const).map(item => <label key={item.value} className="method-option">
          <input type="radio" name="maihoa-method" value={item.value} checked={method === item.value}
            onChange={() => { setMethod(item.value); setFormError(null); setReadingError(null); }} />
          <span className="method-option-content"><span className="method-symbol" aria-hidden="true">{item.symbol}</span><span><strong>{item.title}</strong><span className="method-detail">{item.detail}</span></span><span className="method-check" aria-hidden="true">✓</span></span>
        </label>)}
      </fieldset>
      <div className="input-layout">
        <SectionCard title="Dữ liệu lập quẻ">
          {method === "LINES" ? <LinesForm onSubmit={submitPayload}
            disabled={calculation.connection !== "connected"} busy={calculation.requestState === "waiting"}>{readingFields}</LinesForm> : (
        <form ref={formRef} onSubmit={onSubmit} noValidate className="form-stack" aria-label="Lập quẻ theo thời gian hoặc số vật">
          {readingFields}
          {method === "TIME" ? (
            <FormField id="maihoa-datetime" label="Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)" hint="Ngày từ 1900-01-01 đến 2099-12-31 theo giờ Việt Nam (UTC+07:00), chính xác đến phút; không theo múi giờ của thiết bị.">
              <input id="maihoa-datetime" type="datetime-local" step={60} min={TIME_MIN_DATETIME} max={TIME_MAX_DATETIME} value={datetime} disabled={waiting}
                aria-invalid={formError?.field === "datetime" || undefined} aria-describedby={describedBy("datetime")}
                onChange={(event) => { setDatetime(event.target.value); clearFieldError("datetime"); }} required />
              {fieldError("datetime")}
            </FormField>
          ) : (
            <>
              <FormField id="maihoa-count" label="Số vật đếm được">
                <input id="maihoa-count" type="number" min={1} max={999999} step={1} value={objectCount} disabled={waiting}
                  aria-invalid={formError?.field === "objectCount" || undefined} aria-describedby={describedBy("objectCount")}
                  onChange={(event) => { setObjectCount(event.target.value); clearFieldError("objectCount"); }} required />
                {fieldError("objectCount")}
              </FormField>
              <FormField id="maihoa-hour" label="Giờ Chi">
                <select id="maihoa-hour" value={hourIndex} disabled={waiting}
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
          <FormField id="maihoa-question" label="Ghi chú tình huống (tùy chọn)" hint="Mô tả bối cảnh để tiện theo dõi. Hệ thống không phân tích ghi chú để trả lời riêng hay thay đổi kết quả lập quẻ. Tối đa 500 ký tự.">
            <textarea id="maihoa-question" rows={3} maxLength={500} value={question} disabled={waiting}
              aria-invalid={formError?.field === "question" || undefined} aria-describedby={describedBy("question")}
              onChange={(event) => { setQuestion(event.target.value); clearFieldError("question"); }} />
            {fieldError("question")}
          </FormField>
          {calculation.connection !== "connected" && <p id="maihoa-connection" className="field-hint">{calculation.connection === "connecting" ? "Đang kết nối tới Server. Bạn có thể chuẩn bị dữ kiện trong lúc chờ." : "Mất kết nối với Server. Dữ kiện vẫn được giữ trên trang."}</p>}
          <PrimaryButton type="submit" disabled={calculation.connection !== "connected" || waiting}
            aria-describedby={calculation.connection !== "connected" ? "maihoa-connection" : undefined}>{waiting ? "Đang chờ phản hồi…" : "Gửi yêu cầu"}</PrimaryButton>
        </form>)}
          {calculation.connection === "disconnected" && <SessionNotice />}
          {calculation.requestState !== "idle" && <a className="secondary-button calculation-shortcut" href="#ket-qua">Đến tiến trình và kết quả ↓</a>}
        </SectionCard>
        <aside className="input-guide" aria-label="Hướng dẫn lập quẻ">
          <div className="guide-art"><CelestialArt compact /></div>
          <p className="eyebrow">TRƯỚC KHI BẮT ĐẦU</p>
          <h2>Rõ đầu vào.<br />Giữ đúng căn cứ.</h2>
          <p>Chọn thời gian, số vật hoặc nhập sáu hào để lập quẻ. Với sáu hào, hào 1 nằm ở dưới và hào 6 ở trên; bạn chọn thêm một hào động.</p>
          <StatusBanner>Kết quả giúp bạn tìm hiểu cấu trúc quẻ và lời luận theo chủ đề đã chọn. Bạn có thể mở mục Tra cứu quẻ để xem nghĩa tên và nguồn tham chiếu.</StatusBanner>
          <p>Ghi chú tình huống là phần tùy chọn. Lời luận được tra theo quy tắc có sẵn, không phải câu trả lời riêng cho nội dung ghi chú hay dự báo một sự kiện cụ thể.</p>
        </aside>
      </div>
      <div id="ket-qua" tabIndex={-1} className="result-region"><ResultPanel {...calculation} /></div>
    </PageContainer>
  );
}

