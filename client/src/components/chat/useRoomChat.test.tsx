import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { IMessage, StompConfig } from "@stomp/stompjs";
import { useRoomChat } from "./useRoomChat";

const sockets = vi.hoisted(() => ({ instances: [] as FakeSocket[] }));
vi.mock("@stomp/stompjs", () => ({
  Client: class {
    connected = false;
    receive?: (frame: IMessage) => void;
    publish = vi.fn();
    activate = vi.fn();
    deactivate = vi.fn(async () => { this.connected = false; });
    subscribe = vi.fn((_destination, receive) => { this.receive = receive; });
    constructor(public config: StompConfig) { sockets.instances.push(this); }
  },
}));
type FakeSocket = {
  config: StompConfig; connected: boolean; receive?: (frame: IMessage) => void;
  publish: ReturnType<typeof vi.fn>; deactivate: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn>;
};

const userId = "550e8400-e29b-41d4-a716-446655440001";
const consultantId = "550e8400-e29b-41d4-a716-446655440002";
const conversationId = "550e8400-e29b-41d4-a716-446655440003";
const otherId = "550e8400-e29b-41d4-a716-446655440004";
const expiresAt = "2099-11-09T03:00:00Z";
const session = { accountId: userId, role: "USER", expiresAt } as const;
const room = { conversationId, userId, consultantId, createdAt: "2026-11-09T03:00:00Z",
  status: "ACTIVE", startedAt: "2026-11-09T03:01:00Z", endedAt: null, endedByAccountId: null, endReason: null } as const;
const firstId = "550e8400-e29b-41d4-a716-446655440011";
const secondId = "550e8400-e29b-41d4-a716-446655440012";
const thirdId = "550e8400-e29b-41d4-a716-446655440013";
const sentId = "550e8400-e29b-41d4-a716-446655440014";
const csrfToken = "a".repeat(43);
const success = (data: unknown) => Response.json({ requestId: firstId, status: "COMPLETED", data, error: null });
const message = (messageId: string, sequence: string, text: string) => ({
  conversationId, messageId, sequence, text, senderAccountId: consultantId, createdAt: "2026-11-09T03:00:00Z",
});
const emit = (socket: FakeSocket, event: unknown) => socket.receive?.({ body: JSON.stringify(event) } as IMessage);
const connected = (socket: FakeSocket) => {
  socket.connected = true;
  socket.config.onConnect?.({} as IMessage);
  emit(socket, { type: "READY", conversationId });
};
const closed = (socket: FakeSocket) => {
  socket.connected = false;
  socket.config.onWebSocketClose?.({} as CloseEvent);
};

it("catches up with REST after reconnect without skipping earlier sequence or resending", async () => {
  sockets.instances.length = 0;
  const cursors: string[] = [];
  let backlog = [message(firstId, "1", "Tin đầu")];
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success(session);
    if (path.endsWith("/auth/session")) return success({ account: { id: userId, role: "USER", displayName: "User" }, expiresAt, csrfToken });
    const after = new URL(path, window.location.href).searchParams.get("afterSequence")!;
    cursors.push(after);
    const items = backlog.filter(item => BigInt(item.sequence) > BigInt(after));
    return success({ items, nextAfterSequence: items.at(-1)?.sequence ?? after, hasMore: false });
  }));
  const onAccessError = vi.fn();
  const { result } = renderHook(() => useRoomChat(session, room, onAccessError));
  await waitFor(() => expect(sockets.instances).toHaveLength(1));
  const first = sockets.instances[0];
  expect(first.config.connectHeaders).toEqual({ "X-CSRF-Token": csrfToken });
  act(() => connected(first));
  await waitFor(() => expect(result.current.messages.map(item => item.text)).toEqual(["Tin đầu"]));
  act(() => emit(first, { type: "MESSAGE", ...message(thirdId, "3", "Tin trực tiếp") }));
  act(() => result.current.messaging!.send("Bản nháp"));
  expect(first.publish.mock.calls[0][0]).toEqual({ destination: `/app/chat/rooms/${conversationId}/sync` });
  const publication = first.publish.mock.calls[1][0];
  expect(JSON.parse(publication.body).text).toBe("Bản nháp");
  act(() => closed(first));
  expect(result.current.messaging!.delivery).toBe("unknown");

  backlog = [...backlog, message(secondId, "2", "Tin bỏ lỡ"), message(thirdId, "3", "Tin trực tiếp")];
  act(() => result.current.retry());
  await waitFor(() => expect(sockets.instances).toHaveLength(2));
  const second = sockets.instances[1];
  act(() => connected(second));
  await waitFor(() => expect(result.current.messages.map(item => item.text))
    .toEqual(["Tin đầu", "Tin bỏ lỡ", "Tin trực tiếp"]));
  expect(cursors).toContain("1");
  expect(second.publish.mock.calls).toEqual([[{ destination: `/app/chat/rooms/${conversationId}/sync` }]]);
  act(() => {
    emit(first, { type: "MESSAGE", ...message(sentId, "4", "Socket cũ") });
    emit(second, { type: "MESSAGE", ...message(sentId, "4", "Phòng khác"), conversationId: otherId });
  });
  expect(result.current.messages).toHaveLength(3);
  act(() => result.current.messaging!.send("Bản nháp"));
  expect(second.publish).toHaveBeenCalledWith(publication);
  const { clientMessageId } = JSON.parse(publication.body);
  act(() => emit(second, { type: "ACK", conversationId, clientMessageId, messageId: sentId, sequence: "4", createdAt: room.createdAt }));
  expect(result.current.messaging!.acknowledgedId).toBe(clientMessageId);
  expect(result.current.messages.at(-1)?.text).toBe("Bản nháp");
});

it("clears chat data when the customer account changes and does not connect an ended room", async () => {
  sockets.instances.length = 0;
  let currentId = userId;
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ ...session, accountId: currentId });
    return success({ items: [message(firstId, "1", "Tin riêng")], nextAfterSequence: "1", hasMore: false });
  }));
  const ended = { ...room, status: "ENDED", endedAt: "2026-11-09T03:02:00Z", endedByAccountId: userId,
    endReason: "COMPLETED" } as const;
  const onAccessError = vi.fn();
  const { result } = renderHook(() => useRoomChat(session, ended, onAccessError));
  await waitFor(() => expect(result.current.messages).toHaveLength(1));
  currentId = otherId;
  act(() => result.current.retry());
  await waitFor(() => expect(onAccessError).toHaveBeenCalledWith("INVALID_SESSION"));
  expect(result.current.messages).toHaveLength(0);
  expect(sockets.instances).toHaveLength(0);
});
