import type { SourceReference } from "@/types/contract";
import { isRecord } from "@/types/contractValidation";
import { isHexagramCode, isSourceReference } from "@/types/hexagramValidation";
import { isUuid } from "@/types/historyValidation";
import { adminOptions, methodGuideError } from "./methodGuides";
import { requestJson, RestError } from "./transport";

export type GlossInput = { content: string; sourceSectionId: string };
export type GlossAction = { action: "submit-review" } | { action: "return-to-draft"; reason: string }
  | { action: "publish"; printedSourceLabel: string; verificationNote: string };
type SourceLink = { sectionId: string; reference: SourceReference };
type GlossCatalogDetail = { hexagram: { code: string }; nameSource: SourceLink | null;
  nameGloss: { source: SourceLink | null } | null };
type RevisionSource = { bookId: string; title: string; edition: string; section: string;
  printedPage: string; pdfPage: number; sha256: string };
type GlossRevision = GlossInput & { hexagramCode: string; version: number; source: RevisionSource; createdBy: string };
type WorkflowEvent = { sequence: number; revision: number; action: "SUBMIT" | "RETURN" | "PUBLISH";
  reason: string | null };
type VisibilityEvent = { sequence: number; revision: number; action: "HIDE" | "SHOW" };
export type GlossWorkflow = { version: number; draftVersion: number; status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
  publishedVersion: number | null; lastEvent: WorkflowEvent | null; visible: boolean; lastVisibilityEvent: VisibilityEvent | null };
export type GlossState = { detail: GlossCatalogDetail; revision: GlossRevision | null; workflow: GlossWorkflow | null };

const text = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const nullableText = (v: unknown) => v === null || text(v);
const positive = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const sectionId = (v: unknown): v is string => typeof v === "string" && /^[1-9][0-9]{0,18}$/.test(v);
const isLink = (v: unknown): v is SourceLink => isRecord(v) && sectionId(v.sectionId) && isSourceReference(v.reference);
const isDetail = (v: unknown): v is GlossCatalogDetail => isRecord(v) && isRecord(v.hexagram) && isHexagramCode(v.hexagram.code)
  && (v.nameSource === null || isLink(v.nameSource))
  && (v.nameGloss === null || isRecord(v.nameGloss) && v.nameGloss.category === "NAME_GLOSS"
    && (v.nameGloss.source === null || isLink(v.nameGloss.source)));
const isRevision = (v: unknown): v is GlossRevision => isRecord(v) && isHexagramCode(v.hexagramCode)
  && v.category === "NAME_GLOSS" && v.status === "DRAFT" && positive(v.version) && isUuid(v.createdBy)
  && text(v.content) && sectionId(v.sourceSectionId) && isRecord(v.source)
  && [v.source.bookId, v.source.title, v.source.edition, v.source.section, v.source.printedPage].every(text)
  && positive(v.source.pdfPage) && typeof v.source.sha256 === "string" && /^[0-9a-f]{64}$/i.test(v.source.sha256);
const isEvent = (v: unknown): v is WorkflowEvent => isRecord(v) && positive(v.sequence) && positive(v.revision)
  && (v.action === "SUBMIT" || v.action === "RETURN" || v.action === "PUBLISH") && nullableText(v.reason);
const isVisibilityEvent = (v: unknown): v is VisibilityEvent => isRecord(v) && positive(v.sequence) && positive(v.revision)
  && (v.action === "HIDE" || v.action === "SHOW");
function isWorkflow(v: unknown): v is GlossWorkflow {
  return isRecord(v) && positive(v.version) && positive(v.draftVersion)
    && (v.publishedVersion === null || positive(v.publishedVersion) && v.publishedVersion <= v.draftVersion)
    && (v.lastEvent === null || isEvent(v.lastEvent) && v.lastEvent.revision <= v.draftVersion)
    && (v.lastVisibilityEvent === null || isVisibilityEvent(v.lastVisibilityEvent)
      && v.publishedVersion !== null && v.lastVisibilityEvent.revision <= v.publishedVersion)
    && v.visible === (v.publishedVersion !== null && v.lastVisibilityEvent?.action !== "HIDE")
    && v.version === v.draftVersion + Math.max(v.lastEvent?.sequence ?? 0, v.lastVisibilityEvent?.sequence ?? 0)
    && (v.lastEvent?.revision !== v.draftVersion || v.lastEvent.action === "RETURN" ? v.status === "DRAFT"
      : v.lastEvent.action === "SUBMIT" ? v.status === "PENDING_REVIEW"
        : v.status === "PUBLISHED" && v.publishedVersion === v.draftVersion);
}

function detailPath(code: string) {
  if (!isHexagramCode(code)) throw new RestError("INVALID_INPUT");
  return `/admin/hexagrams/${code}`;
}

export async function readGloss(code: string, signal: AbortSignal): Promise<GlossState> {
  const path = detailPath(code);
  const options = adminOptions();
  const detail = await requestJson(path, isDetail, signal, undefined, options);
  if (detail.hexagram.code !== code) throw new RestError("INVALID_RESPONSE");
  let workflow;
  try {
    workflow = await requestJson(`${path}/gloss-draft/workflow`, isWorkflow, signal, undefined, options);
  } catch (error) {
    if (error instanceof RestError && error.code === "NOT_FOUND") return { detail, revision: null, workflow: null };
    throw error;
  }
  const revision = await requestJson(`${path}/gloss-draft/revisions/${workflow.draftVersion}`, isRevision, signal, undefined, options);
  if (revision.hexagramCode !== code || revision.version !== workflow.draftVersion) throw new RestError("INVALID_RESPONSE");
  return { detail, revision, workflow };
}

export async function saveGloss(code: string, version: number | undefined, input: GlossInput, csrf: string, signal: AbortSignal) {
  const path = `${detailPath(code)}/gloss-draft`;
  const revision = version === undefined
    ? await requestJson(path, isRevision, signal, input, { ...adminOptions(csrf), successStatus: 201 })
    : await requestJson(path, isRevision, signal, { ...input, expectedVersion: version }, { ...adminOptions(csrf), method: "PUT" });
  if (revision.hexagramCode !== code || revision.version !== (version ?? 0) + 1) throw new RestError("INVALID_RESPONSE");
}

export async function reviewGloss(code: string, version: number, command: GlossAction, csrf: string, signal: AbortSignal) {
  const { action, ...fields } = command;
  const workflow = await requestJson(`${detailPath(code)}/gloss-draft/workflow/${action}`, isWorkflow,
    signal, { expectedVersion: version, ...fields }, adminOptions(csrf));
  const status = { "submit-review": "PENDING_REVIEW", "return-to-draft": "DRAFT", publish: "PUBLISHED" } as const;
  if (workflow.status !== status[action] || workflow.version !== version + 1) throw new RestError("INVALID_RESPONSE");
}

export async function setGlossVisibility(code: string, version: number, visible: boolean, csrf: string, signal: AbortSignal) {
  const workflow = await requestJson(`${detailPath(code)}/gloss-draft/workflow/visibility`, isWorkflow,
    signal, { expectedVersion: version, visible }, { ...adminOptions(csrf), method: "PUT" });
  if (workflow.version !== version + 1 || workflow.visible !== visible ||
    workflow.lastVisibilityEvent?.action !== (visible ? "SHOW" : "HIDE")) throw new RestError("INVALID_RESPONSE");
}

export function glossError(error: unknown) {
  const messages: Record<string, string> = {
    GLOSS_DRAFT_EXISTS: "Quẻ đã có bản nháp. Hãy tải phiên bản mới.",
    VERSION_CONFLICT: "Một Admin khác đã cập nhật nghĩa tên. Hãy tải phiên bản mới.",
    INVALID_TRANSITION: "Trạng thái hiện tại không cho phép thao tác. Hãy tải lại để kiểm tra.",
    INVALID_SOURCE: "Trang nguồn đã chọn thiếu thông tin đối chiếu.",
    INVALID_INPUT: "Kiểm tra nội dung, trang nguồn và độ dài các trường.",
    FORBIDDEN: "Người soạn phiên bản này không thể tự công bố.",
  };
  return error instanceof RestError && Object.hasOwn(messages, error.code) ? messages[error.code] : methodGuideError(error);
}
