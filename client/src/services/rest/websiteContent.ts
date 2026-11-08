import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";
import { adminOptions, isEvent, isPage, type GuideDraft, type GuideEvent, type Page } from "./methodGuides";
import { requestJson, RestError } from "./transport";

export const websiteSections = [
  { code: "INTRODUCTION", title: "Giới thiệu", body: "" },
  { code: "USAGE_GUIDE", title: "Hướng dẫn sử dụng", body: "" },
] as const;
type SectionCode = typeof websiteSections[number]["code"];
type Text = { revision: number; title: string; body: string };
type Published = Text & { publishedAt: string };
type Working = Text & { createdBy: string; editorNote: string | null };
type Section = { sectionCode: SectionCode; version: number } & (
  { status: "EMPTY"; working: null; published: null }
  | { status: "DRAFT" | "PENDING_REVIEW"; working: Working; published: Published | null }
  | { status: "PUBLISHED"; working: null; published: Published }
);
type PublicSection = Published & { sectionCode: SectionCode };

const sectionCode = (value: unknown): value is SectionCode => websiteSections.some(item => item.code === value);
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const isText = (value: unknown): value is Text => isRecord(value) && integer(value.revision) && value.revision > 0
  && typeof value.title === "string" && typeof value.body === "string";
const isPublished = (value: unknown): value is Published => isRecord(value)
  && typeof value.publishedAt === "string" && Number.isFinite(Date.parse(value.publishedAt)) && isText(value);
const isWorking = (value: unknown): value is Working => isRecord(value) && isUuid(value.createdBy)
  && (value.editorNote === null || typeof value.editorNote === "string") && isText(value);
const isPublicSection = (value: unknown): value is PublicSection => isRecord(value) && sectionCode(value.sectionCode) && isPublished(value);
function isSection(value: unknown): value is Section {
  if (!isRecord(value) || !sectionCode(value.sectionCode) || !integer(value.version)) return false;
  if (value.status === "EMPTY") return value.version === 0 && value.working === null && value.published === null;
  if (value.published !== null && (!isPublished(value.published) || value.published.revision > value.version)) return false;
  if (value.status === "PUBLISHED") return value.working === null && value.published !== null;
  return (value.status === "DRAFT" || value.status === "PENDING_REVIEW") && isWorking(value.working)
    && value.working.revision <= value.version && value.working.revision > (value.published?.revision ?? 0);
}

const path = (code: SectionCode) => `/admin/website-content/${code}`;
function matching(code: SectionCode) {
  return (value: unknown): value is Section => isSection(value) && value.sectionCode === code;
}
async function read(code: SectionCode, signal: AbortSignal) {
  const item = await requestJson(path(code), matching(code), signal, undefined, adminOptions());
  return item.status === "EMPTY" ? null : item;
}
async function save(code: SectionCode, version: number, draft: GuideDraft, csrf: string, signal: AbortSignal) {
  const item = await requestJson(`${path(code)}/draft`, matching(code), signal,
    { ...draft, expectedVersion: version }, { ...adminOptions(csrf), method: "PUT" });
  if (item.status !== "DRAFT" || item.version !== version + 1) throw new RestError("INVALID_RESPONSE");
  return item;
}
const reviewStatus = { "submit-review": "PENDING_REVIEW", "return-to-draft": "DRAFT", publish: "PUBLISHED" } as const;
async function review(code: SectionCode, version: number, action: keyof typeof reviewStatus,
    reason: string | undefined, csrf: string, signal: AbortSignal) {
  const item = await requestJson(`${path(code)}/${action}`, matching(code), signal,
    { expectedVersion: version, ...(reason === undefined ? {} : { reason }) }, adminOptions(csrf));
  if (item.status !== reviewStatus[action] || item.version !== version + 1) throw new RestError("INVALID_RESPONSE");
  return item;
}
function events(code: SectionCode, page: number, signal: AbortSignal) {
  return requestJson(`${path(code)}/events?page=${page}`, (value): value is Page<GuideEvent> =>
    isPage(value, isEvent) && value.page === page, signal, undefined, adminOptions());
}
export const websiteEditorApi = { read, save, review, events,
  create: (code: SectionCode, draft: GuideDraft, csrf: string, signal: AbortSignal) => save(code, 0, draft, csrf, signal) };

export function readPublishedWebsite(signal: AbortSignal) {
  return requestJson("/website-content", (value): value is { items: PublicSection[] } =>
    isRecord(value) && Array.isArray(value.items) && value.items.every(isPublicSection)
      && new Set(value.items.map(item => item.sectionCode)).size === value.items.length, signal);
}
