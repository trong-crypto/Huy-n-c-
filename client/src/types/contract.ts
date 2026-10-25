export const CONTRACT_VERSION = "1.2" as const;
export type CalculationType = "MAI_HOA" | "TAM_THE";
export type SourceStatus = "DRAFT" | "SOURCE_LOCATED" | "SOURCE_AMBIGUOUS" | "BLOCKED_SOURCE_CONFLICT" | "VERIFIED";
export type ExecutionPolicy = "DISABLED" | "SOURCE_VERIFIED" | "TEAM_DECISION";
export type RuleBasis = "SOURCE_VERIFIED" | "TEAM_DECISION";
export type SixLines = [boolean, boolean, boolean, boolean, boolean, boolean];
export type TamTheCategory = "CAREER" | "WEALTH" | "LOVE";
export type ErrorCode =
  | "INVALID_INPUT" | "INVALID_DATE" | "INVALID_METHOD" | "RULE_NOT_AVAILABLE"
  | "SERVER_BUSY" | "PROCESSING_TIMEOUT" | "DATABASE_UNAVAILABLE" | "KNOWLEDGE_DATA_INCOMPLETE" | "INTERNAL_ERROR"
  | "NOT_FOUND" | "INVALID_SESSION" | "CSRF_REJECTED";
export type RuleUnavailableReason =
  | "UNKNOWN_RULE" | "EXECUTION_DISABLED" | "RULE_STATE_UNAVAILABLE" | "RULE_VERSION_MISMATCH"
  | "SOURCE_UNVERIFIED" | "MISSING_SOURCE_REFERENCE" | "MISSING_SOURCE_REVIEW"
  | "MISSING_DECISION_REFERENCE" | "TEAM_DECISION_NOT_ALLOWED" | "IMPLEMENTATION_UNAVAILABLE" | "LOOKUP_NOT_AVAILABLE";

export type SourceReference = {
  sourceId: string;
  title: string;
  version: string;
  section: string;
  printedPage: string | null;
  pdfPage: number | null;
  sha256: string | null;
  url: string | null;
};
export type DecisionReference = { decisionId: string; decidedAt: string; document: string; description: string };
export type RuleEvidence = {
  ruleCode: string;
  ruleVersion: string;
  executionPolicy: Exclude<ExecutionPolicy, "DISABLED">;
  ruleBasis: RuleBasis;
  sourceStatus: SourceStatus;
  sourceReferences: SourceReference[];
  decisionReferences: DecisionReference[];
};
export type ResultEvidence = {
  ruleVersion: string;
  ruleBasis: RuleBasis;
  sourceStatus: SourceStatus;
  rules: RuleEvidence[];
  sourceReferences: SourceReference[];
  decisionReferences: DecisionReference[];
};
export type LunarDate = { year: number; month: number; day: number; isLeapMonth: boolean };
export type MaiHoaPayload =
  | { method: "TIME"; datetime: string; question?: string }
  | { method: "OBJECT_COUNT"; objectCount: number; hourIndex: number; question?: string }
  | { method: "LINES"; linesBottomUp: SixLines; movingLine: number };
export type TamThePayload = {
  birthDate: string;
  birthTime: string;
  calendarType: "SOLAR" | "LUNAR";
  isLeapMonth: boolean;
  /** Omitted means all three; a missing requested category fails the whole request. */
  categories?: TamTheCategory[];
};
export type CalculationRequest =
  | { requestId: string; type: "MAI_HOA"; payload: MaiHoaPayload }
  | { requestId: string; type: "TAM_THE"; payload: TamThePayload };
export type CalculationStep = { code: string; message: string; values: Record<string, string | number | boolean | boolean[]> };
export type HexagramView = { code: string | null; linesBottomUp: SixLines } & (
  | { nameStatus: "VERIFIED"; name: string | null }
  | { nameStatus: Exclude<SourceStatus, "VERIFIED"> | null; name: null }
);
export type MaiHoaResult = ResultEvidence & {
  method: MaiHoaPayload["method"];
  primaryHexagram: HexagramView;
  mutualHexagram: HexagramView;
  changedHexagram: HexagramView;
  movingLine: number;
  lunarDate: LunarDate | null;
  calculationSteps: CalculationStep[];
};
export type InterpretationEntry = { resultCode: string; title: string; content: string; sourceReferences: SourceReference[] };
export type TamTheResult = Omit<ResultEvidence, "ruleBasis" | "sourceStatus"> & {
  ruleBasis: "SOURCE_VERIFIED";
  sourceStatus: "VERIFIED";
  categories: { category: TamTheCategory; entries: InterpretationEntry[] }[];
};
export type ApiError = { code: ErrorCode; message: string; ruleCode: string | null; reason: RuleUnavailableReason | null };
export type CalculationResponse =
  | { requestId: string; type: "MAI_HOA"; status: "COMPLETED"; data: MaiHoaResult; error: null }
  | { requestId: string; type: "TAM_THE"; status: "COMPLETED"; data: TamTheResult; error: null }
  | { requestId: string | null; type: CalculationType | null; status: "FAILED"; data: null; error: ApiError };
export type ProgressEvent = {
  requestId: string;
  type: CalculationType;
  sequence: number;
  step: "ACCEPTED" | "VALIDATING" | "CALCULATING" | "LOOKUP";
  message: string;
};

// Storage probe implemented in A02; authorization does not assert feature implementation.
export type KnowledgeReadiness = {
  status: "READY" | "NOT_READY";
  scope: "KNOWLEDGE_STORAGE";
  database: "UP" | "UNAVAILABLE" | "DISABLED";
  schema: "READY" | "NOT_READY" | "NOT_CHECKED" | "INVALID_DATA";
  seed: "READY" | "NOT_READY" | "NOT_CHECKED";
  businessFeaturesReady: boolean;
  counts: Record<string, number>;
  rules: { ruleCode: string; executionPolicy: ExecutionPolicy; sourceStatus: SourceStatus | "MISSING";
    calculationAuthorized: boolean; reason: RuleUnavailableReason | null }[];
  pending: string[];
};

// Calendar C01, hexagram lookup E02 and anonymous session/history H01 are implemented.
export type RestResponse<T> = { requestId: string; status: "COMPLETED"; data: T; error: null }
  | { requestId: string; status: "FAILED"; data: null; error: ApiError };
export type Page<T> = { items: T[]; page: number; size: number; totalElements: number; totalPages: number };
export type HexagramRecord = Omit<HexagramView, "nameStatus"> & {
  code: string;
  name: string;
  nameKind: "STRUCTURAL_LABEL" | "CANONICAL_TITLE";
  verificationStatus: SourceStatus;
  upperTrigramCode: string;
  lowerTrigramCode: string;
  sourceReferences: SourceReference[];
};
export type HexagramNameGloss = InterpretationEntry & {
  resultCode: "NAME_GLOSS";
  category: "NAME_GLOSS";
  verificationStatus: "VERIFIED";
  sourceOrder: number;
  printedSourceLabel: string;
  verificationNote: string;
};
export type HexagramDetail = HexagramRecord & { interpretations: HexagramNameGloss[] };
export type CalendarInput = { calendarType: "SOLAR" | "LUNAR"; year: number; month: number; day: number; isLeapMonth: boolean };
export type CalendarResult = ResultEvidence & {
  solarDate: string;
  lunarDate: LunarDate;
  timezone: "Asia/Ho_Chi_Minh";
};
export type CanChiInput = { date: CalendarInput; time?: string };
export type CanChiResult = CalendarResult & {
  year: { stem: string; branch: string };
  month: { stem: string; branch: string };
  day: { stem: string; branch: string };
  hour: { stem: string; branch: string } | null;
};
export type HistorySaveRequest = { calculationRequestId: string; title?: string };
export type SessionResult = { expiresAt: string; csrfToken: string };
export type HistoryDeleteResult = { deleted: true };
export type HistoryItem = { id: string; type: CalculationType; title: string; createdAt: string; ruleBasis: RuleBasis };
export type HistoryDetail = HistoryItem & { result: MaiHoaResult | TamTheResult };
