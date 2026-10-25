"use client";

import { FormEvent, useState } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import { useCalculation } from "@/services/websocket/useCalculation";
import type { TamThePayload } from "@/types/contract";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { FieldError, FormField, PrimaryButton, SectionCard, StatusBanner } from "@/components/ui/Controls";
import { TamTheArt } from "@/components/ui/TamTheArt";

export default function TamThePage() {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [calendarType, setCalendarType] = useState<"SOLAR" | "LUNAR">("SOLAR");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const calculation = useCalculation();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{2}:\d{2}$/.test(birthTime)) {
      setFormError("Ngày sinh cần YYYY-MM-DD và giờ sinh cần HH:mm.");
      return;
    }
    setFormError(null);
    const payload: TamThePayload = { birthDate, birthTime, calendarType, isLeapMonth: calendarType === "LUNAR" && isLeapMonth };
    calculation.submit("TAM_THE", payload);
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="02 / DIỄN CẦM TAM THẾ" title="Một khởi đầu, ba chiều thời gian.">
        <p>Nhập ngày giờ sinh và loại lịch để gửi yêu cầu. Bảng tra và lời luận giải chỉ được mở sau khi dữ liệu nguồn và module đã sẵn sàng.</p>
      </PageHeader>
      <div className="input-layout">
        <SectionCard title="Thông tin đầu vào">
        <form onSubmit={onSubmit} className="form-stack" aria-label="Thông tin sinh Tam Thế">
          <FormField id="tamthe-date" label="Ngày sinh (YYYY-MM-DD)">
            <input id="tamthe-date" type="text" inputMode="numeric" placeholder="2003-08-15" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required />
          </FormField>
          <FormField id="tamthe-time" label="Giờ sinh (HH:mm)">
            <input id="tamthe-time" type="time" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} required />
          </FormField>
          <FormField id="tamthe-calendar" label="Loại lịch">
            <select id="tamthe-calendar" value={calendarType} onChange={(event) => { setCalendarType(event.target.value as "SOLAR" | "LUNAR"); setIsLeapMonth(false); }}>
              <option value="SOLAR">Dương lịch</option>
              <option value="LUNAR">Âm lịch</option>
            </select>
          </FormField>
          {calendarType === "LUNAR" && (
            <label className="checkbox-field">
              <input type="checkbox" checked={isLeapMonth} onChange={(event) => setIsLeapMonth(event.target.checked)} />
              Tháng nhuận
            </label>
          )}
          {formError && <FieldError id="tamthe-error">{formError}</FieldError>}
          <PrimaryButton type="submit" disabled={calculation.connection !== "connected" || calculation.requestState === "waiting"}>Gửi yêu cầu</PrimaryButton>
        </form>
        </SectionCard>
        <aside className="input-guide" aria-label="Lưu ý Tam Thế">
          <TamTheArt />
          <p className="eyebrow">ĐỐI CHIẾU NGUỒN</p>
          <h2>Không luận giải<br />khi chưa đủ dữ liệu.</h2>
          <p>Chọn đúng loại lịch của ngày sinh. Với lịch âm, tháng nhuận được đánh dấu riêng; Client không tự chuyển lịch hoặc tính lời luận.</p>
          <StatusBanner tone="warning">Module luận giải Tam Thế chưa hoàn thành. Dữ liệu hành mệnh đã được đối chiếu không đồng nghĩa các mục công danh, tài lộc và tình duyên đã sẵn sàng.</StatusBanner>
        </aside>
      </div>
      <div className="result-region"><ResultPanel {...calculation} /></div>
    </PageContainer>
  );
}
