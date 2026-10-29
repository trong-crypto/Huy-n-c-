import type { InterpretationEntry, SourceReference, SourceStatus } from "./contract";

export type ReadingTopic = "GENERAL" | "CAREER" | "WEALTH" | "LOVE";
export type ReadingOptions = { topic: ReadingTopic; context?: { datetime: string } };
export type TimeReadingOptions = { topic: ReadingTopic; context?: never };
export type ReadingDecision = {
  decisionId: string; purpose: "CALCULATION" | "EDITORIAL_LINK"; ruleBasis: "TEAM_DECISION";
  sourceStatus: Exclude<SourceStatus, "DRAFT">; policy: string; description: string; limitation: string;
  sourceReferences: SourceReference[];
};
export type TrigramRole = {
  side: "UPPER" | "LOWER";
  trigramCode: "CAN" | "DOAI" | "LY" | "CHAN" | "TON" | "KHAM" | "CAN2" | "KHON";
  element: "KIM" | "MOC" | "THUY" | "HOA" | "THO";
};
export type ReadingRelation = "SAME_ELEMENT" | "USE_GENERATES_BODY" | "BODY_GENERATES_USE"
  | "BODY_CONTROLS_USE" | "USE_CONTROLS_BODY";
export type ReadingPhase = {
  kind: "INITIAL_USE" | "MIDDLE_BODY_MUTUAL" | "MIDDLE_USE_MUTUAL" | "FINAL_USE";
  comparator: TrigramRole; relation: ReadingRelation; templateCode: string; content: string;
  textKind: "EDITORIAL_PARAPHRASE"; ruleBasis: "SOURCE_VERIFIED"; sourceStatus: "VERIFIED";
  sourceReferences: SourceReference[];
};
export type SeasonReading = {
  status: "NOT_EVALUATED"; reason: "MISSING_READING_TIME";
  datetime: null; lunarDate: null; season: null; bodyStrength: null; sourceReferences: [];
} | {
  status: "EVALUATED"; reason: null; datetime: string;
  lunarDate: { year: number; month: number; day: number; isLeapMonth: boolean };
  season: "SPRING" | "SUMMER" | "AUTUMN" | "WINTER" | "EARTH_MONTH";
  bodyStrength: "VIGOROUS" | "WEAK" | "UNCLASSIFIED"; sourceReferences: SourceReference[];
};
export type DetailedReading = {
  schemaVersion: "1.0"; bundleId: string; topic: ReadingTopic; textKind: "EDITORIAL_PARAPHRASE";
  body: TrigramRole; use: TrigramRole; phases: ReadingPhase[]; season: SeasonReading;
  summary: string; calculationDecisions: ReadingDecision[]; sourceReferences: SourceReference[];
};
export type WealthSubreadingCode = "LOC" | "SANG_HEN" | "DIEN_SAN";
export type WealthSubreading = {
  code: WealthSubreadingCode; ruleCode: string; lookupKey: string;
  sourceReferences: SourceReference[]; decisionReferences: ReadingDecision[];
} & ({ status: "MATCHED"; entries: InterpretationEntry[]; reason: null }
  | { code: "LOC"; status: "NO_SOURCE_MATCH"; entries: []; reason: "NO_PRINTED_INTERSECTION" });
export type ExtendedWealthMetadata = {
  coverageMode: "EXTENDED"; bundleId: string; editorialDecisions: ReadingDecision[];
} | { coverageMode?: "LEGACY"; bundleId?: never; editorialDecisions?: never };
