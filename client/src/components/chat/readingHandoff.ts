import { draftLimit } from "./chatState";
import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";

const storageKey = "huyenco.consultation-reading";
export type ReadingHandoff = {
  accountId: string;
  text: string;
  messageId: string;
  conversationId?: string;
  request?: { id: string; consultantId: string };
};

export function readingMessage(text: string) {
  const clean = text.replaceAll("\0", "").trim();
  const suffix = "\n… (đã rút gọn để gửi qua chat)";
  return clean.length <= draftLimit ? clean
    : clean.slice(0, draftLimit - suffix.length).replace(/[\uD800-\uDBFF]$/, "").trimEnd() + suffix;
}

export function readReadingHandoff(accountId: string): ReadingHandoff | undefined {
  try {
    const draft: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (!isRecord(draft) || draft.accountId !== accountId || !isUuid(draft.messageId)
      || typeof draft.text !== "string" || !draft.text.trim() || draft.text.length > draftLimit
      || draft.conversationId !== undefined && !isUuid(draft.conversationId)
      || draft.request !== undefined && (!isRecord(draft.request) || !isUuid(draft.request.id)
        || !isUuid(draft.request.consultantId))) return;
    return draft as ReadingHandoff;
  } catch { return undefined; }
}

export function storeReadingHandoff(draft: ReadingHandoff) {
  sessionStorage.setItem(storageKey, JSON.stringify(draft));
}

export function clearReadingHandoff(draft: ReadingHandoff) {
  try {
    if (readReadingHandoff(draft.accountId)?.messageId === draft.messageId) sessionStorage.removeItem(storageKey);
  } catch { /* The browser can disable storage after navigation. */ }
}
