"use client";

import { FormEvent, useState } from "react";
import { ResultPanel } from "@/components/ResultPanel";
import { useCalculation } from "@/services/websocket/useCalculation";
import type { MaiHoaPayload } from "@/types/contract";

export default function MaiHoaPage() {
  const [method, setMethod] = useState<"TIME" | "OBJECT_COUNT">("TIME");
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
    } else {
      const count = Number(objectCount);
      const hour = Number(hourIndex);
      if (!Number.isInteger(count) || count < 1 || count > 999_999) {
        return setFormError("Số vật phải là số nguyên từ 1 đến 999999.");
      }
      if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
        return setFormError("Giờ Chi phải từ Tý (1) đến Hợi (12).");
      }
      payload = { method: "OBJECT_COUNT", objectCount: count, hourIndex: hour, question };
    }
    calculation.submit("MAI_HOA", payload);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Module 01</p>
      <h1 className="mt-3 text-4xl font-semibold text-emerald-950">Mai Hoa Dịch Số</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Chọn lập quẻ theo thời gian hoặc số vật. Nhóm đã chốt cách tính hào động, nhưng Server chỉ trả kết quả thật sau khi lịch và quy tắc sách được kiểm thử.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-emerald-950/10 bg-white p-6 shadow-sm">
          <label className="block space-y-2 text-sm font-medium">Phương pháp
            <select value={method} onChange={(event) => setMethod(event.target.value as "TIME" | "OBJECT_COUNT")}>
              <option value="TIME">Theo thời gian</option>
              <option value="OBJECT_COUNT">Theo số vật đếm được</option>
            </select>
          </label>
          {method === "TIME" ? (
            <label className="block space-y-2 text-sm font-medium">Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)
              <input type="datetime-local" value={datetime} onChange={(event) => setDatetime(event.target.value)} required />
            </label>
          ) : (
            <>
              <label className="block space-y-2 text-sm font-medium">Số vật đếm được
                <input type="number" min={1} max={999999} step={1} value={objectCount} onChange={(event) => setObjectCount(event.target.value)} required />
              </label>
              <label className="block space-y-2 text-sm font-medium">Giờ Chi
                <select value={hourIndex} onChange={(event) => setHourIndex(event.target.value)}>
                  {["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"].map((name, index) => (
                    <option key={name} value={index + 1}>{name} ({index + 1})</option>
                  ))}
                </select>
              </label>
            </>
          )}
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

