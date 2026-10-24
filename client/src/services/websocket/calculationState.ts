import { isCalculationResponse } from "@/types/contractValidation";
import type { CalculationResponse, CalculationType, ProgressEvent } from "@/types/contract";

export const CLIENT_TIMEOUT_MS = 15_000;
export type RequestState = "idle" | "waiting" | "completed" | "timeout" | "failed";
export type CalculationState = {
  requestId: string | null; type: CalculationType | null; requestState: RequestState;
  response: CalculationResponse | null; progress: ProgressEvent[]; localError: string | null;
};
export const initialState: CalculationState = {
  requestId: null, type: null, requestState: "idle", response: null, progress: [], localError: null,
};
export type Action =
  | { kind: "begin"; requestId: string; type: CalculationType }
  | { kind: "progress"; event: ProgressEvent }
  | { kind: "terminal"; response: CalculationResponse }
  | { kind: "timeout"; requestId: string }
  | { kind: "disconnect" }
  | { kind: "error"; message: string };

const steps = ["ACCEPTED", "VALIDATING", "CALCULATING", "LOOKUP"] as const;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const typeIsKnown = (type: unknown) => type === "MAI_HOA" || type === "TAM_THE";

export function parseProgress(value: unknown): ProgressEvent {
  if (!record(value) || typeof value.requestId !== "string" || !typeIsKnown(value.type)
      || typeof value.sequence !== "number" || !Number.isInteger(value.sequence) || value.sequence < 1
      || !steps.includes(value.step as typeof steps[number]) || typeof value.message !== "string") {
    throw new Error("Invalid progress frame");
  }
  return value as ProgressEvent;
}

export function parseTerminal(value: unknown): CalculationResponse {
  if (!isCalculationResponse(value)) throw new Error("Invalid terminal response");
  return value;
}

export function reduceCalculation(state: CalculationState, action: Action): CalculationState {
  if (action.kind === "begin") {
    if (state.requestState === "waiting") return state;
    return { ...initialState, requestId: action.requestId, type: action.type, requestState: "waiting", progress: [] };
  }
  if (action.kind === "error") {
    return { ...state, requestId: null, requestState: "failed", response: null, localError: action.message };
  }
  if (state.requestState !== "waiting") return state;
  if (action.kind === "progress") {
    const event = action.event;
    if (event.requestId !== state.requestId || event.type !== state.type) return state;
    const last = state.progress.at(-1)?.sequence ?? 0;
    if (event.sequence <= last) return state; // Duplicate/old progress never moves the UI backwards.
    if (event.sequence !== last + 1 || event.step !== steps[last]) {
      return { ...state, requestId: null, requestState: "failed", localError: "INVALID_RESPONSE: Thứ tự tiến trình không hợp lệ." };
    }
    return { ...state, progress: [...state.progress, event] };
  }
  if (action.kind === "terminal") {
    if (action.response.requestId !== state.requestId || action.response.type !== state.type) return state;
    return { ...state, requestId: null, requestState: action.response.status === "COMPLETED" ? "completed" : "failed", response: action.response, localError: null };
  }
  if (action.kind === "timeout") {
    if (action.requestId !== state.requestId) return state;
    return { ...state, requestId: null, requestState: "timeout", localError: "REQUEST_TIMEOUT: Yêu cầu quá thời gian chờ 15 giây." };
  }
  return { ...state, requestId: null, requestState: "failed", localError: "DISCONNECTED: Kết nối bị ngắt. Bạn có thể chủ động gửi lại sau khi kết nối phục hồi." };
}
