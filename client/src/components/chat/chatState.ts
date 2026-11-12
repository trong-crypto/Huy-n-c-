export const chatRoutes = { user: "/tu-van", consultant: "/tu-van-vien" } as const;

export type ChatAudience = keyof typeof chatRoutes;
export type ChatConnection = "connecting" | "connected" | "disconnected" | "reconnecting" | "unresponsive" | "unavailable";
export type ChatMessage = { id: string; roomId: string; author: string; text: string; createdAt?: string };
export type ChatMessaging = {
  historyStatus: "idle" | "loading" | "ready" | "error";
  delivery: "idle" | "waiting" | "unknown";
  acknowledgedId?: string;
  pendingId?: string;
  notice?: string;
  send: (text: string, messageId?: string) => void;
  notifyTyping?: () => void;
};
export type ChatRoom = {
  id: string;
  title: string;
  status: "pending" | "active" | "ended";
  history: readonly ChatMessage[];
  ending?: string;
  peerPresent?: boolean;
  peerTyping?: boolean;
  peerOnline?: boolean;
};

// View model shared by the REST workspace and the message panel.
export type ChatAccess =
  | { status: "blocked" | "loading" | "expired" | "forbidden" | "error" }
  | { status: "authorized"; accessKey: string; connection: ChatConnection; room: ChatRoom | null;
      failure?: "sendFailed" | "deliveryUnknown";
      consultants?: readonly { id: string; name: string; profile?: string; availability?: string }[];
      conversations?: readonly { id: string; title: string; status: ChatRoom["status"] }[] };

export type SubscribeToRoom = (roomId: string, receive: (event: unknown) => void) => () => void;

export const roomStatusLabels = {
  pending: "Chờ tư vấn viên",
  active: "Đang tư vấn",
  ended: "Đã kết thúc",
};

export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const validTextFields = ["id", "roomId", "author", "text"].every(key => {
    const field = record[key];
    return Object.hasOwn(record, key) && typeof field === "string" && field.trim().length > 0;
  });
  return validTextFields && (record.createdAt === undefined || typeof record.createdAt === "string"
    && Number.isFinite(Date.parse(record.createdAt)));
}

export const draftLimit = 2000;

export function validateChatDraft(value: string): string | null {
  const text = value.trim();
  if (!text) return "Nhập nội dung tin nhắn.";
  if (text.length > draftLimit) return `Bản nháp tối đa ${draftLimit} ký tự.`;
  return null;
}
