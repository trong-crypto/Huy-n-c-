import type { CalculationResponse, ProgressEvent } from "@/types/contract";
import type { RequestState } from "@/services/websocket/calculationState";

type Props = {
  connection: "connecting" | "connected" | "disconnected";
  requestState: RequestState;
  progress: ProgressEvent[];
  response: CalculationResponse | null;
  localError: string | null;
};

export function ResultPanel({ connection, requestState, response, progress, localError }: Props) {
  return (
    <section aria-live="polite" className="rounded-2xl border border-emerald-950/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-emerald-950">Phản hồi</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connection === "connected" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
          {connection === "connected" ? "Đã kết nối" : connection === "connecting" ? "Đang kết nối" : "Mất kết nối"}
        </span>
      </div>
      {requestState === "waiting" && <p className="mt-5 text-slate-600">Server đang xử lý yêu cầu…</p>}
      {progress.length > 0 && (
        <ol aria-label="Tiến trình xử lý" className="mt-5 space-y-2 text-sm text-slate-700">
          {progress.map((event, index) => (
            <li key={event.sequence} className={`rounded-lg px-3 py-2 ${requestState === "waiting" && index === progress.length - 1 ? "bg-emerald-50 text-emerald-900" : "bg-slate-50"}`}>
              <span className="mr-2 font-semibold">{event.sequence}.</span>{event.message}
            </li>
          ))}
        </ol>
      )}
      {localError && <p className="mt-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{localError}</p>}
      {response && (
        <div className="mt-5">
          <p className={`font-semibold ${response.status === "FAILED" ? "text-amber-800" : "text-emerald-800"}`}>
            {response.status === "FAILED" ? `${response.error?.code}: ${response.error?.message}` : "Xử lý thành công"}
          </p>
          <p className="mt-2 break-all text-xs text-slate-500">requestId: {response.requestId}</p>
          {response.status === "COMPLETED" && response.data.ruleBasis === "TEAM_DECISION" && (
            <p className="mt-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              Kết quả tính theo quy ước nhóm. Bản in có điểm chưa được xác minh; xem nguồn và quyết định kèm theo.
            </p>
          )}
          {response.data !== null && <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(response.data, null, 2)}</pre>}
        </div>
      )}
      {!localError && !response && requestState === "idle" && <p className="mt-5 text-slate-600">Gửi một yêu cầu để kiểm tra hợp đồng giao tiếp.</p>}
    </section>
  );
}

