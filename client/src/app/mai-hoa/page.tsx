"use client";

import { FormEvent, useState } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import { useCalculation } from "@/services/websocket/useCalculation";
import type { MaiHoaPayload } from "@/types/contract";

export default function MaiHoaPage() {
  const [datetime, setDatetime] = useState("");
  const [question, setQuestion] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const calculation = useCalculation();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!datetime) return setFormError("Vui lòng chọn thời điểm lập quẻ.");
    // datetime-local không mang múi giờ; biểu mẫu này nhập giờ Việt Nam theo hợp đồng.
    const payload: MaiHoaPayload = { method: "TIME", datetime: `${datetime}:00+07:00`, question };
    calculation.submit("MAI_HOA", payload);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Module 01</p>
      <h1 className="mt-3 text-4xl font-semibold text-emerald-950">Mai Hoa Dịch Số</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Phương pháp theo thời gian đã có trang sách đối chiếu, nhưng chưa hoàn tất kiểm thử và xử lý điểm mâu thuẫn của bản in. Khung hiện chỉ kiểm tra luồng gửi nhận.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-emerald-950/10 bg-white p-6 shadow-sm">
          <label className="block space-y-2 text-sm font-medium">Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)
            <input type="datetime-local" value={datetime} onChange={(event) => setDatetime(event.target.value)} required />
          </label>
          <label className="block space-y-2 text-sm font-medium">Câu hỏi (tùy chọn)
            <textarea rows={3} maxLength={500} value={question} onChange={(event) => setQuestion(event.target.value)} />
          </label>
          {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
          <button disabled={calculation.connection !== "connected" || calculation.requestState === "waiting"} className="w-full rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">Gửi yêu cầu</button>
        </form>
        <ResultPanel {...calculation} />
      </div>
    </main>
  );
}

