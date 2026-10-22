"use client";

import { FormEvent, useState } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import { useCalculation } from "@/services/websocket/useCalculation";
import type { TamThePayload } from "@/types/contract";

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
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Module 02</p>
      <h1 className="mt-3 text-4xl font-semibold text-emerald-950">Diễn Cầm Tam Thế</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Nhập dữ liệu sinh để kiểm tra luồng giao tiếp. Bảng tra và lời luận giải sẽ chỉ mở sau khi đối chiếu đúng ấn bản sách.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-emerald-950/10 bg-white p-6 shadow-sm">
          <label className="block space-y-2 text-sm font-medium">Ngày sinh (YYYY-MM-DD)
            <input type="text" inputMode="numeric" placeholder="2003-08-15" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required />
          </label>
          <label className="block space-y-2 text-sm font-medium">Giờ sinh (HH:mm)
            <input type="time" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} required />
          </label>
          <label className="block space-y-2 text-sm font-medium">Loại lịch
            <select value={calendarType} onChange={(event) => { setCalendarType(event.target.value as "SOLAR" | "LUNAR"); setIsLeapMonth(false); }}>
              <option value="SOLAR">Dương lịch</option>
              <option value="LUNAR">Âm lịch</option>
            </select>
          </label>
          {calendarType === "LUNAR" && (
            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={isLeapMonth} onChange={(event) => setIsLeapMonth(event.target.checked)} className="h-4 w-4" />
              Tháng nhuận
            </label>
          )}
          {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
          <button disabled={calculation.connection !== "connected" || calculation.requestState === "waiting"} className="w-full rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">Gửi yêu cầu</button>
        </form>
        <ResultPanel {...calculation} />
      </div>
    </main>
  );
}
