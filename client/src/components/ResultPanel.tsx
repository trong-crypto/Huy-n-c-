import type { CalculationResponse } from "@/types/contract";
import type { ConnectionState, RequestState } from "@/services/websocket/useCalculation";

type Props = {
  connection: ConnectionState;
  requestState: RequestState;
  response: CalculationResponse | null;
  localError: string | null;
};

export function ResultPanel({ connection, requestState, response, localError }: Props) {
  const completed = requestState === "completed" && response?.status === "COMPLETED";
  const serverFailed = requestState === "failed" && response?.status === "FAILED";
  return (
    <section aria-live="polite" className="rounded-2xl border border-emerald-950/10 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-emerald-950">Phản hồi</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connection === "connected" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
          {connection === "connected" ? "Đã kết nối" : connection === "connecting" ? "Đang kết nối" : "Mất kết nối"}
        </span>
      </div>
      {requestState === "waiting" && <p className="mt-5 text-slate-600">Đang chờ phản hồi...</p>}
      {localError && <p className="mt-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{localError}</p>}
      {response && (completed || serverFailed) && (
        <div className="mt-5">
          <p className={`font-semibold ${serverFailed ? "text-amber-800" : "text-emerald-800"}`}>
            {response.status === "FAILED" ? `Lỗi Server ${response.error.code}: ${response.error.message}` : "Xử lý thành công"}
          </p>
          <p className="mt-2 break-all text-xs text-slate-500">requestId: {response.requestId}</p>
          {completed && <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(response.data, null, 2)}</pre>}
        </div>
      )}
      {!localError && !response && requestState === "idle" && <p className="mt-5 text-slate-600">Gửi một yêu cầu để kiểm tra hợp đồng giao tiếp.</p>}
    </section>
  );
}

