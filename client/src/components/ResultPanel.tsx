import type { CalculationResponse, ProgressEvent } from "@/types/contract";
import type { ConnectionState, RequestState } from "@/services/websocket/useCalculation";
import { isCalculationResponse, isKnownServerErrorCode } from "@/types/contractValidation";
import { MaiHoaResultView } from "@/components/results/MaiHoaResultView";

type Props = {
  connection: ConnectionState;
  requestState: RequestState;
  progress: ProgressEvent[];
  response: CalculationResponse | null;
  localError: string | null;
  protocolNotice?: string | null;
};

export function ResultPanel({ connection, requestState, response, progress, localError, protocolNotice }: Props) {
  const validResponse = response !== null && isCalculationResponse(response);
  const completed = requestState === "completed" && response?.status === "COMPLETED" && validResponse;
  const invalidResult = requestState === "completed" && response?.status === "COMPLETED" && !validResponse;
  const hexagramResult = completed && response.type === "MAI_HOA" && ["LINES", "OBJECT_COUNT", "TIME"].includes(response.data.method);
  const serverFailed = requestState === "failed" && response?.status === "FAILED";
  const latestProgress = progress.at(-1);
  const announcement = requestState === "waiting"
    ? latestProgress ? `Bước ${latestProgress.sequence}: ${latestProgress.message}` : "Đang chờ phản hồi cho yêu cầu."
    : invalidResult ? "Phản hồi không hợp lệ. Không thể hiển thị kết quả."
      : completed ? "Yêu cầu đã xử lý thành công."
        : requestState === "timeout" ? "Yêu cầu quá thời gian chờ."
          : requestState === "failed" ? "Yêu cầu đã kết thúc với lỗi." : "";
  return (
    <section className="section-card response-panel">
      <p className="sr-only" role="status" aria-label="Cập nhật yêu cầu" aria-live="polite" aria-atomic="true">{announcement}</p>
      <div className="response-heading">
        <h2>Phản hồi</h2>
        <span className={`connection-badge${connection === "connected" ? " connection-badge--connected" : ""}`}>
          {connection === "connected" ? "Đã kết nối" : connection === "connecting" ? "Đang kết nối" : "Mất kết nối"}
        </span>
      </div>
      {protocolNotice && <aside className="response-warning" role="status" aria-label="Thông báo giao thức chung">{protocolNotice}</aside>}
      {requestState === "waiting" && <p className="response-copy">Đang chờ phản hồi...</p>}
      {progress.length > 0 && (
        <ol aria-label="Tiến trình xử lý" aria-live="off" className="response-progress">
          {progress.map((event, index) => (
            <li key={event.sequence} aria-current={requestState === "waiting" && index === progress.length - 1 ? "step" : undefined}
              className={requestState === "waiting" && index === progress.length - 1 ? "is-current" : undefined}>
              <span className="mr-2 font-semibold">{event.sequence}.</span>{event.message}
            </li>
          ))}
        </ol>
      )}
      {localError && <p className="response-error" role="alert">{localError}</p>}
      {invalidResult && <p className="response-error" role="alert">Lỗi giao thức phía Client: Dữ liệu kết quả không đúng hợp đồng. Không thể hiển thị quẻ.</p>}
      {response && (completed || serverFailed) && (
        <div className="response-result">
          <p role={serverFailed ? "alert" : undefined} className={`response-result-status${serverFailed ? " response-result-status--failed" : ""}`}>
            {response.status === "FAILED" ? isKnownServerErrorCode(response.error.code)
              ? `Lỗi Server ${response.error.code}: ${response.error.message}`
              : "Lỗi Server: Server trả về lỗi chưa được Client nhận diện. Yêu cầu này chưa hoàn tất thành công."
              : "Xử lý thành công"}
          </p>
          {!hexagramResult && <p className="response-request-id">requestId: {response.requestId}</p>}
          {!hexagramResult && completed && response.status === "COMPLETED" && response.data.ruleBasis === "TEAM_DECISION" && (
            <p className="response-warning">
              Kết quả tính theo quy ước nhóm. Bản in có điểm chưa được xác minh; xem nguồn và quyết định kèm theo.
            </p>
          )}
          {hexagramResult && response.type === "MAI_HOA" && response.status === "COMPLETED" ? <>
            <MaiHoaResultView data={response.data} />
            <details className="result-technical"><summary>Thông tin kỹ thuật</summary>
              <p className="response-request-id">requestId: {response.requestId}</p>
              <p className="field-hint">Phiên bản bộ quy tắc: {response.data.ruleVersion}</p>
              <details><summary>Xem JSON phản hồi</summary><pre className="response-json">{JSON.stringify(response.data, null, 2)}</pre></details>
            </details>
          </> : completed && <pre className="response-json">{JSON.stringify(response.data, null, 2)}</pre>}
        </div>
      )}
      {!localError && !response && requestState === "idle" && <p className="response-copy">Gửi một yêu cầu để kiểm tra hợp đồng giao tiếp.</p>}
    </section>
  );
}

