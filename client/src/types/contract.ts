export type CalculationType = "MAI_HOA" | "TAM_THE";
export type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_DATE"
  | "INVALID_METHOD"
  | "RULE_NOT_AVAILABLE"
  | "SERVER_BUSY"
  | "INTERNAL_ERROR";

export type MaiHoaPayload =
  | { method: "TIME"; datetime: string; question?: string }
  | { method: "NUMBER"; numbers: [number, number]; question?: string };

export type TamThePayload = {
  birthDate: string;
  birthTime: string;
  calendarType: "SOLAR" | "LUNAR";
  isLeapMonth: boolean;
};

export type CalculationRequest = {
  requestId: string;
  type: CalculationType;
  payload: MaiHoaPayload | TamThePayload;
};

export type CalculationResponse = {
  requestId: string | null;
  type: CalculationType | null;
  status: "COMPLETED" | "FAILED";
  data: unknown | null;
  error: { code: ErrorCode; message: string; ruleCode: string | null } | null;
};

