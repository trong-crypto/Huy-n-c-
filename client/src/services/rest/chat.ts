import type { Page } from "@/types/contract";
import { isRecord } from "@/types/contractValidation";
import { isUuid } from "@/types/historyValidation";
import { isChatTime as time, isRoomMessage, type ChatSession, type Consultant, type Conversation,
  type ConversationAction, type ConversationTransition, type CreateConversationRequest, type MessagePage,
  type TransitionRequest } from "@/types/chatContract";
import { customerOptions, readCustomerSession } from "./customerAuth";
import { requestJson, RestError } from "./transport";

const outcome = {
  ACCEPT: { status: "ACTIVE", endReason: null },
  DECLINE: { status: "ENDED", endReason: "DECLINED" },
  CANCEL: { status: "ENDED", endReason: "CANCELLED" },
  END: { status: "ENDED", endReason: "COMPLETED" },
} as const;

const conversations = "/chat/conversations";
const pageSize = 20;
const isSession = (value: unknown): value is ChatSession => isRecord(value) && isUuid(value.accountId)
  && (value.role === "USER" || value.role === "CONSULTANT") && time(value.expiresAt);
const isConsultant = (value: unknown): value is Consultant => isRecord(value) && isUuid(value.consultantId)
  && typeof value.displayName === "string" && (value.summary === null || typeof value.summary === "string");
const isConversation = (value: unknown): value is Conversation => isRecord(value) && isUuid(value.conversationId)
  && isUuid(value.userId) && isUuid(value.consultantId) && time(value.createdAt)
  && (value.startedAt === null || time(value.startedAt)) && (value.endedAt === null || time(value.endedAt))
  && (value.endedByAccountId === null || value.endedByAccountId === value.userId || value.endedByAccountId === value.consultantId)
  && (value.status === "PENDING" || value.status === "ACTIVE" || value.status === "ENDED")
  && (value.endReason === null || value.endReason === "DECLINED" || value.endReason === "CANCELLED" || value.endReason === "COMPLETED");

export function ownRoom(value: unknown, session: ChatSession): value is Conversation {
  return isConversation(value) && (session.role === "USER" ? value.userId : value.consultantId) === session.accountId;
}

function list<T>(path: string, page: number, item: (value: unknown) => value is T, signal: AbortSignal) {
  const isPage = (value: unknown): value is Page<T> => isRecord(value) && value.page === page && value.size === pageSize
    && typeof value.totalElements === "number" && Number.isSafeInteger(value.totalElements) && value.totalElements >= 0
    && value.totalPages === Math.ceil(value.totalElements / pageSize)
    && Array.isArray(value.items) && value.items.every(item)
    && value.items.length === Math.max(0, Math.min(pageSize, value.totalElements - page * pageSize));
  return requestJson(`${path}?page=${page}&size=${pageSize}`, isPage, signal, undefined, customerOptions());
}

export function readChatSession(signal: AbortSignal) {
  return requestJson("/auth/chat/session", isSession, signal, undefined, customerOptions());
}

export function listChatConsultants(page: number, signal: AbortSignal) {
  return list("/chat/consultants", page, isConsultant, signal);
}

export function listConversations(session: ChatSession, page: number, signal: AbortSignal) {
  return list(conversations, page, (value): value is Conversation => ownRoom(value, session), signal);
}

export function readConversation(session: ChatSession, id: string, signal: AbortSignal) {
  const guard = (value: unknown): value is Conversation => ownRoom(value, session) && value.conversationId === id;
  return requestJson(`${conversations}/${encodeURIComponent(id)}`, guard, signal, undefined, customerOptions());
}

export function readRoomMessages(room: Conversation, after: string, signal: AbortSignal) {
  const size = 50;
  const guard = (value: unknown): value is MessagePage => {
    if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > size
      || typeof value.hasMore !== "boolean" || value.hasMore && value.items.length !== size) return false;
    let previous = after;
    for (const item of value.items) {
      if (!isRoomMessage(item, room) || BigInt(item.sequence) <= BigInt(previous)) return false;
      previous = item.sequence;
    }
    return value.nextAfterSequence === previous;
  };
  return requestJson(`${conversations}/${encodeURIComponent(room.conversationId)}/messages?afterSequence=${after}&size=${size}`,
    guard, signal, undefined, customerOptions());
}

export async function readChatCsrf(session: ChatSession, signal: AbortSignal) {
  const current = await readChatSession(signal);
  if (current.accountId !== session.accountId || current.role !== session.role) throw new RestError("INVALID_SESSION");
  const { account, csrfToken } = await readCustomerSession(signal);
  if (account.id !== session.accountId || account.role !== session.role) throw new RestError("INVALID_SESSION");
  return csrfToken;
}

async function writeOptions(session: ChatSession, signal: AbortSignal) {
  const { account, csrfToken } = await readCustomerSession(signal);
  if (account.id !== session.accountId || account.role !== session.role) throw new RestError("INVALID_SESSION");
  const options = customerOptions();
  return { ...options, headers: { ...options.headers, "X-CSRF-Token": csrfToken } };
}

export async function createConversation(session: ChatSession, consultantId: string, requestId: string, signal: AbortSignal) {
  const guard = (value: unknown): value is Conversation => ownRoom(value, session) && value.consultantId === consultantId;
  const body: CreateConversationRequest = { requestId, consultantId };
  return requestJson(conversations, guard, signal, body, {
    ...await writeOptions(session, signal), successStatus: [200, 201],
  });
}

export async function transitionConversation(session: ChatSession, id: string, action: ConversationAction, signal: AbortSignal) {
  const expected = outcome[action];
  const guard = (value: unknown): value is ConversationTransition => isRecord(value) && value.conversationId === id
    && value.status === expected.status && value.endReason === expected.endReason
    && (action === "ACCEPT" || action === "END" ? time(value.startedAt) : value.startedAt === null)
    && (action === "ACCEPT" ? value.endedAt === null && value.endedByAccountId === null
      : time(value.endedAt) && value.endedByAccountId === session.accountId);
  const body: TransitionRequest = { action };
  return requestJson(`${conversations}/${encodeURIComponent(id)}/transition`, guard, signal, body, await writeOptions(session, signal));
}
