import type { Page, SourceReference, SourceStatus } from "@/types/contract";
import { isRecord } from "@/types/contractValidation";
import { isSourceReference } from "@/types/hexagramValidation";
import { isUuid } from "@/types/historyValidation";
import { adminOptions, methodGuideError } from "./methodGuides";
import { requestJson, RestError } from "./transport";

export const sourceKinds = { BOOK_PAGE: "Trang sách", EXTERNAL_ALGORITHM: "Thuật toán bên ngoài" } as const;
export type SourceKind = keyof typeof sourceKinds;
export type SourceEntry = { kind: SourceKind; id: string; reference: SourceReference };
type Book = { author: string | null; publisher: string | null; publicationYear: number | null; pdfPageCount: number | null };
type Rule = { code: string; module: "MAI_HOA" | "TAM_THE" | "CALENDAR"; version: string; status: SourceStatus };
type Interpretation = { category: string; status: SourceStatus; count: number };
type Detail = { entry: SourceEntry; book: Book | null; rules: Rule[]; interpretations: Interpretation[] };
export const bookFields = { AUTHOR: "Tác giả", PUBLISHER: "Nhà xuất bản" } as const;
export type BookField = keyof typeof bookFields;
type ProposalText = { proposal: string; reason: string };
export type SourceProposalInput = ProposalText &
  ({ bookField: BookField; bookValue: string } | { bookField?: never; bookValue?: never });
export type SourceProposal = ProposalText & { kind: SourceKind; id: string; version: number;
  bookChange: { field: BookField; value: string } | null;
  sourceSnapshot: { entry: SourceEntry; book: Book | null }; createdBy: string; createdAt: string };
export type SourceApplication = { version: number; revision: number; bookId: string; bookTitle: string; edition: string;
  field: BookField; beforeValue: string | null; afterValue: string; currentValue: string | null; stale: boolean;
  applied: { actorId: string; occurredAt: string } | null };
type ReviewEvent = { sequence: number; revision: number; action: "SUBMIT" | "RETURN" | "APPROVE";
  actorId: string; occurredAt: string; note: string | null };
type ProposalWorkflow = { version: number; draftVersion: number; status: "DRAFT" | "PENDING_REVIEW" | "APPROVED";
  approvedVersion: number | null; lastEvent: ReviewEvent | null };
export type SourceProposalState = { revision: SourceProposal; workflow: ProposalWorkflow } | null;
export type SourceProposalReviewAction = "submit-review" | "return-to-draft" | "approve";
export const sourceStatuses: Record<SourceStatus, string> = { DRAFT: "Bản nháp", SOURCE_LOCATED: "Đã xác định vị trí",
  SOURCE_AMBIGUOUS: "Cần đối chiếu thêm", BLOCKED_SOURCE_CONFLICT: "Có mâu thuẫn", VERIFIED: "Đã đối chiếu" };

const base = "/admin/sources";
const size = 20;
const text = (value: unknown): value is string => typeof value === "string";
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const positive = (value: unknown): value is number => integer(value) && value > 0;
const status = (value: unknown): value is SourceStatus => text(value) && Object.hasOwn(sourceStatuses, value);
const optionalText = (value: unknown) => value === null || text(value);
const isBookField = (value: unknown): value is BookField => text(value) && Object.hasOwn(bookFields, value);
const isEntry = (value: unknown): value is SourceEntry => isRecord(value) && text(value.kind)
  && Object.hasOwn(sourceKinds, value.kind) && text(value.id) && isSourceReference(value.reference)
  && (value.kind === "BOOK_PAGE" ? /^[1-9][0-9]{0,18}$/.test(value.id) && positive(value.reference.pdfPage)
    && value.reference.url === null : /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value.id)
    && value.reference.pdfPage === null && value.reference.printedPage === null && text(value.reference.url));
const isBook = (v: unknown): v is Book => isRecord(v) && optionalText(v.author) && optionalText(v.publisher)
  && (v.publicationYear === null || integer(v.publicationYear)) && (v.pdfPageCount === null || positive(v.pdfPageCount));
const isRule = (v: unknown): v is Rule => isRecord(v) && text(v.code) && text(v.version)
  && (v.module === "MAI_HOA" || v.module === "TAM_THE" || v.module === "CALENDAR") && status(v.status);
const isInterpretation = (v: unknown): v is Interpretation => isRecord(v) && text(v.category) && status(v.status) && positive(v.count);
const isDetail = (v: unknown): v is Detail => isRecord(v) && isEntry(v.entry)
  && (v.entry.kind === "BOOK_PAGE" ? isBook(v.book) : v.book === null)
  && Array.isArray(v.rules) && v.rules.every(isRule) && Array.isArray(v.interpretations) && v.interpretations.every(isInterpretation);
const isPage = (v: unknown): v is Page<SourceEntry> => isRecord(v) && integer(v.page) && v.page >= 0 && v.size === size
  && integer(v.totalElements) && v.totalElements >= 0 && v.totalPages === Math.ceil(v.totalElements / size)
  && Array.isArray(v.items) && v.items.every(isEntry)
  && v.items.length === Math.max(0, Math.min(size, v.totalElements - v.page * size))
  && new Set(v.items.map(item => `${item.kind}:${item.id}`)).size === v.items.length;
const isProposal = (v: unknown): v is SourceProposal => isRecord(v) && positive(v.version)
  && text(v.proposal) && text(v.reason) && isUuid(v.createdBy) && text(v.createdAt) && Number.isFinite(Date.parse(v.createdAt))
  && isRecord(v.sourceSnapshot) && isEntry(v.sourceSnapshot.entry)
  && v.kind === v.sourceSnapshot.entry.kind && v.id === v.sourceSnapshot.entry.id
  && (v.bookChange === null || v.kind === "BOOK_PAGE" && isRecord(v.bookChange)
    && isBookField(v.bookChange.field) && text(v.bookChange.value))
  && (v.kind === "BOOK_PAGE" ? isBook(v.sourceSnapshot.book) : v.sourceSnapshot.book === null);
const isApplication = (v: unknown): v is SourceApplication => isRecord(v) && positive(v.version) && positive(v.revision)
  && text(v.bookId) && text(v.bookTitle) && text(v.edition) && isBookField(v.field)
  && optionalText(v.beforeValue) && text(v.afterValue) && optionalText(v.currentValue) && typeof v.stale === "boolean"
  && (v.applied === null || !v.stale && isRecord(v.applied) && isUuid(v.applied.actorId)
    && text(v.applied.occurredAt) && Number.isFinite(Date.parse(v.applied.occurredAt)));
const isReviewEvent = (v: unknown): v is ReviewEvent => isRecord(v) && positive(v.sequence) && positive(v.revision)
  && isUuid(v.actorId) && text(v.occurredAt) && Number.isFinite(Date.parse(v.occurredAt))
  && (v.action === "SUBMIT" ? v.note === null : (v.action === "RETURN" || v.action === "APPROVE") && text(v.note));
function isProposalWorkflow(v: unknown): v is ProposalWorkflow {
  return isRecord(v) && positive(v.version) && positive(v.draftVersion)
    && (v.approvedVersion === null || positive(v.approvedVersion) && v.approvedVersion <= v.draftVersion)
    && (v.lastEvent === null || isReviewEvent(v.lastEvent) && v.lastEvent.revision <= v.draftVersion)
    && v.version === v.draftVersion + (v.lastEvent?.sequence ?? 0)
    && (v.lastEvent?.revision !== v.draftVersion || v.lastEvent.action === "RETURN" ? v.status === "DRAFT"
      : v.lastEvent.action === "SUBMIT" ? v.status === "PENDING_REVIEW"
        : v.status === "APPROVED" && v.approvedVersion === v.draftVersion);
}

const sourcePath = ({ kind, id }: SourceEntry) => `${base}/${kind}/${encodeURIComponent(id)}`;

export async function listAdminSources(query: string, kind: SourceKind | "", page: number, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query, page: String(page), size: String(size) });
  if (kind) params.set("kind", kind);
  const result = await requestJson(`${base}?${params}`, isPage, signal, undefined, adminOptions());
  if (result.page !== page || kind && result.items.some(item => item.kind !== kind)) throw new RestError("INVALID_RESPONSE");
  return result;
}

export async function readAdminSource(entry: SourceEntry, signal: AbortSignal) {
  const detail = await requestJson(sourcePath(entry), isDetail, signal, undefined, adminOptions());
  if (detail.entry.kind !== entry.kind || detail.entry.id !== entry.id) throw new RestError("INVALID_RESPONSE");
  return detail;
}

export async function readSourceProposal(entry: SourceEntry, signal: AbortSignal): Promise<SourceProposalState> {
  const path = `${sourcePath(entry)}/proposal`;
  let workflow;
  try {
    workflow = await requestJson(`${path}/workflow`, isProposalWorkflow, signal, undefined, adminOptions());
  } catch (error) {
    if (error instanceof RestError && error.code === "NOT_FOUND") return null;
    throw error;
  }
  const revision = await requestJson(`${path}/revisions/${workflow.draftVersion}`, isProposal, signal, undefined, adminOptions());
  if (revision.kind !== entry.kind || revision.id !== entry.id || revision.version !== workflow.draftVersion) {
    throw new RestError("INVALID_RESPONSE");
  }
  return { revision, workflow };
}

export async function saveSourceProposal(entry: SourceEntry, version: number | undefined,
    input: SourceProposalInput, csrf: string, signal: AbortSignal) {
  const path = `${sourcePath(entry)}/proposal`;
  const draft = version === undefined
    ? await requestJson(path, isProposal, signal, input, { ...adminOptions(csrf), successStatus: 201 })
    : await requestJson(path, isProposal, signal, { ...input, expectedVersion: version }, { ...adminOptions(csrf), method: "PUT" });
  if (draft.kind !== entry.kind || draft.id !== entry.id || draft.version !== (version ?? 0) + 1) {
    throw new RestError("INVALID_RESPONSE");
  }
  return draft;
}

export async function reviewSourceProposal(entry: SourceEntry, version: number, action: SourceProposalReviewAction,
    note: string, csrf: string, signal: AbortSignal) {
  const workflow = await requestJson(`${sourcePath(entry)}/proposal/workflow/${action}`, isProposalWorkflow, signal,
    { expectedVersion: version, ...(action === "submit-review" ? {} : { note }) }, adminOptions(csrf));
  const statuses = { "submit-review": "PENDING_REVIEW", "return-to-draft": "DRAFT", approve: "APPROVED" } as const;
  if (workflow.version !== version + 1 || workflow.status !== statuses[action]) throw new RestError("INVALID_RESPONSE");
}

export async function requestSourceApplication(entry: SourceEntry, state: NonNullable<SourceProposalState>,
    signal: AbortSignal, csrf?: string) {
  const { revision, workflow } = state;
  const change = revision.bookChange;
  if (!change) throw new RestError("INVALID_RESPONSE");
  const result = await requestJson(`${sourcePath(entry)}/proposal/workflow/application`, isApplication, signal,
    csrf === undefined ? undefined : { expectedVersion: workflow.version }, adminOptions(csrf));
  const previous = change.field === "AUTHOR" ? revision.sourceSnapshot.book?.author : revision.sourceSnapshot.book?.publisher;
  if (result.version !== workflow.version || result.revision !== revision.version
    || result.bookId !== entry.reference.sourceId || result.field !== change.field
    || result.beforeValue !== previous || result.afterValue !== change.value
    || csrf !== undefined && (!result.applied || result.currentValue !== result.afterValue)) {
    throw new RestError("INVALID_RESPONSE");
  }
  return result;
}

export function sourceCatalogError(error: unknown) {
  const messages: Record<string, string> = {
    INVALID_INPUT: "Kiểm tra từ khóa, loại nguồn hoặc số trang rồi thử lại.",
    INVALID_RESPONSE: "Phản hồi danh mục nguồn không đúng hợp đồng.",
    NOT_FOUND: "Không tìm thấy dữ liệu nguồn.",
    DATABASE_UNAVAILABLE: "Kho dữ liệu nguồn tạm thời không truy cập được.",
    SOURCE_PROPOSAL_EXISTS: "Mục nguồn đã có đề xuất. Hãy tải phiên bản mới.",
    VERSION_CONFLICT: "Một Admin khác đã cập nhật đề xuất. Hãy tải phiên bản mới.",
    INVALID_TRANSITION: "Trạng thái hiện tại không cho phép thao tác. Hãy tải phiên bản mới.",
    SOURCE_CHANGED: "Nguồn đã thay đổi. Hãy đối chiếu và gửi duyệt một phiên bản mới.",
    SOURCE_ALREADY_APPLIED: "Phiên bản này đã được áp dụng. Hãy tải phiên bản mới.",
    FORBIDDEN: "Người soạn phiên bản này không thể tự phê duyệt.",
  };
  return error instanceof RestError && Object.hasOwn(messages, error.code) ? messages[error.code] : methodGuideError(error);
}
