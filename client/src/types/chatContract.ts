import { isRecord } from "./contractValidation";
import { isUuid } from "./historyValidation";

export type ChatSession = { accountId: string; role: "USER" | "CONSULTANT"; expiresAt: string };
export type Consultant = { consultantId: string; displayName: string; summary: string | null };
export type ConversationAction = "ACCEPT" | "DECLINE" | "CANCEL" | "END";
export type ConversationTransition = {
  conversationId: string;
  status: "PENDING" | "ACTIVE" | "ENDED";
  startedAt: string | null;
  endedAt: string | null;
  endReason: "DECLINED" | "CANCELLED" | "COMPLETED" | null;
  endedByAccountId: string | null;
};
export type Conversation = ConversationTransition & { userId: string; consultantId: string; createdAt: string };
export type CreateConversationRequest = { requestId: string; consultantId: string };
export type TransitionRequest = { action: ConversationAction };

export type RoomMessage = {
  conversationId: string; messageId: string; senderAccountId: string;
  sequence: string; text: string; createdAt: string;
};
export type MessagePage = { items: RoomMessage[]; nextAfterSequence: string; hasMore: boolean };
export type ChatSend = { clientMessageId: string; text: string };
export type ChatAck = Pick<RoomMessage, "conversationId" | "messageId" | "sequence" | "createdAt">
  & { type: "ACK"; clientMessageId: string };
export type ChatIncoming = RoomMessage & { type: "MESSAGE" };
const sendErrorCodes = ["INVALID_INPUT", "ROOM_NOT_ACTIVE", "MESSAGE_ID_CONFLICT", "MESSAGE_EXPIRED",
  "SERVER_BUSY", "DATABASE_UNAVAILABLE", "NOT_FOUND"] as const;
type SendErrorCode = (typeof sendErrorCodes)[number];
export type ChatSendError = { type: "ERROR"; conversationId: string; clientMessageId: string | null; code: SendErrorCode };

export const isChatTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

export function isChatSequence(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value)
    && BigInt(value) <= BigInt("9223372036854775807");
}

export function isRoomMessage(value: unknown, room: Conversation): value is RoomMessage {
  return isRecord(value) && value.conversationId === room.conversationId && isUuid(value.messageId)
    && (value.senderAccountId === room.userId || value.senderAccountId === room.consultantId)
    && isChatSequence(value.sequence) && value.sequence !== "0" && typeof value.text === "string"
    && value.text.trim().length > 0 && value.text.length <= 2000 && isChatTime(value.createdAt);
}

function isSendErrorCode(value: unknown): value is SendErrorCode {
  return sendErrorCodes.some(code => code === value);
}

export function readChatEvent(value: unknown, room: Conversation): ChatAck | ChatIncoming | ChatSendError | null {
  if (!isRecord(value) || value.conversationId !== room.conversationId) return null;
  if (value.type === "MESSAGE" && isRoomMessage(value, room)) return { ...value, type: "MESSAGE" };
  if (value.type === "ACK" && isUuid(value.clientMessageId) && isUuid(value.messageId)
    && isChatSequence(value.sequence) && value.sequence !== "0" && isChatTime(value.createdAt)) {
    return { type: "ACK", conversationId: room.conversationId, clientMessageId: value.clientMessageId,
      messageId: value.messageId, sequence: value.sequence, createdAt: value.createdAt };
  }
  if (value.type === "ERROR" && (value.clientMessageId === null || isUuid(value.clientMessageId))
    && isSendErrorCode(value.code)) {
    return { type: "ERROR", conversationId: room.conversationId, clientMessageId: value.clientMessageId, code: value.code };
  }
  return null;
}
