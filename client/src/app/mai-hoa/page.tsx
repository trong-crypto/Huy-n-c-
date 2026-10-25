"use client";

import { FormEvent, useState } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import { useCalculation } from "@/services/websocket/useCalculation";
import type { MaiHoaPayload } from "@/types/contract";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { FieldError, FormField, PrimaryButton, SectionCard, StatusBanner } from "@/components/ui/Controls";
import { LinesForm } from "@/components/mai-hoa/LinesForm";
import { CelestialArt } from "@/components/ui/CelestialArt";

export default function MaiHoaPage() {
  const [method, setMethod] = useState<MaiHoaPayload["method"]>("TIME");
  const [datetime, setDatetime] = useState("");
  const [objectCount, setObjectCount] = useState("");
  const [hourIndex, setHourIndex] = useState("1");
  const [question, setQuestion] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const calculation = useCalculation();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    let payload: MaiHoaPayload;
    if (method === "TIME") {
      if (!datetime) return setFormError("Vui lòng chọn thời điểm lập quẻ.");
      // datetime-local không mang múi giờ; biểu mẫu này nhập giờ Việt Nam theo hợp đồng.
      payload = { method: "TIME", datetime: `${datetime}:00+07:00`, question };
    } else if (method === "OBJECT_COUNT") {
      const count = Number(objectCount);
      const hour = Number(hourIndex);
      if (!Number.isInteger(count) || count < 1 || count > 999_999) {
        return setFormError("Số vật phải là số nguyên từ 1 đến 999999.");
      }
      if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
        return setFormError("Giờ Chi phải từ Tý (1) đến Hợi (12).");
      }
      payload = { method: "OBJECT_COUNT", objectCount: count, hourIndex: hour, question };
    } else return; // LINES owns its validation and explicit payload whitelist.
    calculation.submit("MAI_HOA", payload);
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
        <form onSubmit={onSubmit} className="form-stack" aria-label="Lập quẻ theo thời gian hoặc số vật">
          {method === "TIME" ? (
            <FormField id="maihoa-datetime" label="Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)">
              <input id="maihoa-datetime" type="datetime-local" value={datetime} onChange={(event) => setDatetime(event.target.value)} required />
            </FormField>
          ) : (
            <>
              <FormField id="maihoa-count" label="Số vật đếm được">
                <input id="maihoa-count" type="number" min={1} max={999999} step={1} value={objectCount} onChange={(event) => setObjectCount(event.target.value)} required />
              </FormField>
              <FormField id="maihoa-hour" label="Giờ Chi">
                <select id="maihoa-hour" value={hourIndex} onChange={(event) => setHourIndex(event.target.value)}>
                  {["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"].map((name, index) => (
                    <option key={name} value={index + 1}>{name} ({index + 1})</option>
                  ))}
                </select>
              </FormField>
            </>
          )}
          <FormField id="maihoa-question" label="Câu hỏi (tùy chọn)">
            <textarea id="maihoa-question" rows={3} maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} />
          </FormField>
          {formError && <FieldError id="maihoa-error">{formError}</FieldError>}
          <PrimaryButton type="submit" disabled={calculation.connection !== "connected" || calculation.requestState === "waiting"}>Gửi yêu cầu</PrimaryButton>
        </form>)}
        </SectionCard>
        <aside className="input-guide" aria-label="Hướng dẫn lập quẻ">
          <div className="guide-art"><CelestialArt compact /></div>
          <p className="eyebrow">TRƯỚC KHI BẮT ĐẦU</p>
          <h2>Rõ đầu vào.<br />Giữ đúng căn cứ.</h2>
          <p>Với LINES, bạn chọn sáu hào và một hào động. Hào 1 nằm ở dưới, hào 6 nằm ở trên. Không cần nhập ngày giờ hay câu hỏi.</p>
          <StatusBanner>LINES và số vật có luồng tính ở Server. Phương pháp thời gian còn chờ module lịch; khi chưa sẵn sàng, Server trả lỗi thay vì kết quả giả.</StatusBanner>
        </aside>
      </div>
      <div className="result-region"><ResultPanel {...calculation} /></div>
    </PageContainer>
  );
}

