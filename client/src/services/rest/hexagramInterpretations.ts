import { isRecord } from "@/types/contractValidation";
import { isHexagramCode } from "@/types/hexagramValidation";
import { isUuid } from "@/types/historyValidation";
import { adminOptions } from "./methodGuides";
import { requestJson, RestError } from "./transport";

export type InterpretationPoem = { title: string; body: string; author: string; source?: string };

export type InterpretationContent = {
  overview: string; image: string; original: string; paraphrase: string; lines: string[]; application: string;
  poem?: InterpretationPoem | null;
};
export type InterpretationSource = {
  id: string; title: string; author: string | null; edition: string; locator: string; url: string;
  reuseNote: string; reviewStatus: "SOURCE_LOCATED" | "VERIFIED";
};
type Status = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
export type WorkflowAction = "SUBMIT" | "RETURN" | "PUBLISH";
type Document = { version: number; content: InterpretationContent; sources: InterpretationSource[] };
export type InterpretationRevision = Document & { createdBy: string; createdAt: string };
export type InterpretationPublication = Document & { status: "PUBLISHED"; publishedAt: string };
type PublicReading = { code: string; publication: InterpretationPublication | null };
export type InterpretationState = {
  code: string; version: number; status: Status; latest: InterpretationRevision | null;
  publishedVersion: number | null; revisions: number[]; sources: InterpretationSource[]; reviewNote: string | null;
};

const positive = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const text = (v: unknown) => typeof v === "string";
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
function isSource(v: unknown): v is InterpretationSource {
  return isRecord(v) && [v.id, v.title, v.edition, v.locator, v.url, v.reuseNote].every(text)
    && (v.author === null || text(v.author)) && (v.reviewStatus === "SOURCE_LOCATED" || v.reviewStatus === "VERIFIED");
}
function isPoem(v: unknown): v is InterpretationPoem {
  return isRecord(v) && [v.title, v.body, v.author].every(part => text(part) && part.trim().length > 0)
    && (v.source === undefined || text(v.source));
}

function isDocument(v: unknown): v is Document {
  return isRecord(v) && positive(v.version) && isRecord(v.content)
    && (v.content.poem == null || isPoem(v.content.poem))
    && [v.content.overview, v.content.image, v.content.original, v.content.paraphrase, v.content.application].every(text)
    && Array.isArray(v.content.lines) && v.content.lines.length === 6 && v.content.lines.every(text)
    && Array.isArray(v.sources) && v.sources.length > 0 && v.sources.every(isSource);
}
function isRevision(v: unknown): v is InterpretationRevision {
  return isRecord(v) && isUuid(v.createdBy) && date(v.createdAt) && isDocument(v);
}
function isPublication(v: unknown): v is InterpretationPublication {
  return isRecord(v) && v.status === "PUBLISHED" && date(v.publishedAt) && isDocument(v)
    && v.sources.every(source => source.reviewStatus === "VERIFIED");
}
function isPublicReading(v: unknown): v is PublicReading {
  return isRecord(v) && isHexagramCode(v.code) && (v.publication === null || isPublication(v.publication));
}
function isState(v: unknown): v is InterpretationState {
  return isRecord(v) && isHexagramCode(v.code) && (v.version === 0 || positive(v.version))
    && (v.status === "DRAFT" || v.status === "PENDING_REVIEW" || v.status === "PUBLISHED")
    && (v.latest === null || isRevision(v.latest)) && (v.publishedVersion === null || positive(v.publishedVersion))
    && Array.isArray(v.revisions) && v.revisions.every(positive) && Array.isArray(v.sources) && v.sources.every(isSource)
    && (v.reviewNote === null || text(v.reviewNote));
}
function path(code: string, admin = false) {
  if (!isHexagramCode(code)) throw new RestError("INVALID_INPUT");
  return `${admin ? "/admin" : ""}/hexagrams/${code}/interpretation`;
}
function matching<T extends { code: string }>(data: T, code: string): T {
  if (data.code !== code) throw new RestError("INVALID_RESPONSE");
  return data;
}

export async function getPublishedInterpretation(code: string, signal: AbortSignal) {
  return matching(await requestJson(path(code), isPublicReading, signal), code);
}
export async function getInterpretationState(code: string, signal: AbortSignal) {
  return matching(await requestJson(path(code, true), isState, signal, undefined, adminOptions()), code);
}
export async function getInterpretationRevision(code: string, version: number, signal: AbortSignal) {
  const revision = await requestJson(`${path(code, true)}/revisions/${version}`, isRevision, signal, undefined, adminOptions());
  if (revision.version !== version) throw new RestError("INVALID_RESPONSE");
  return revision;
}
export async function saveInterpretation(code: string, expectedVersion: number, content: InterpretationContent,
  sourceIds: string[], csrf: string, signal: AbortSignal) {
  return matching(await requestJson(path(code, true), isState, signal, { expectedVersion, content, sourceIds },
    { ...adminOptions(csrf), method: "PUT" }), code);
}
export async function reviewInterpretation(code: string, expectedVersion: number, action: WorkflowAction, reviewNote: string,
  csrf: string, signal: AbortSignal) {
  const body = action === "SUBMIT" ? { expectedVersion, action } : { expectedVersion, action, reviewNote };
  return matching(await requestJson(`${path(code, true)}/workflow`, isState, signal, body, adminOptions(csrf)), code);
}
