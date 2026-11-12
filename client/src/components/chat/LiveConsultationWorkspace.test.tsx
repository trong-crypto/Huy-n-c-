import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ConsultationPage from "@/app/tu-van/page";
import ConsultantWorkspacePage from "@/app/tu-van-vien/page";
import { ChatNotificationsProvider } from "./ChatNotifications";
import { readReadingHandoff, storeReadingHandoff } from "./readingHandoff";

vi.mock("@/config/client", async importOriginal => {
  const actual = await importOriginal<typeof import("@/config/client")>();
  return { ...actual, CLIENT_CONFIG: { ...actual.CLIENT_CONFIG, accountHistory: true, apiBaseUrl: "/api/v1" } };
});

const stomp = vi.hoisted(() => ({
  publish: vi.fn(),
  subscriptions: new Map<string, Set<(frame: { body: string }) => void>>(),
  connect: vi.fn(),
  errors: new Set<(frame: { headers: { message: string } }) => void>(),
}));
vi.mock("@stomp/stompjs", () => ({
  Client: class {
    connected = false;
    private readonly subscriptions = new Map<string, (frame: { body: string }) => void>();
    constructor(private options: {
      onConnect: () => void; onStompError: (frame: { headers: { message: string } }) => void; connectHeaders: Record<string, string>;
    }) {}
    activate() {
      this.connected = true;
      stomp.connect(this.options.connectHeaders);
      stomp.errors.add(this.options.onStompError);
      this.options.onConnect();
    }
    deactivate() {
      this.connected = false;
      stomp.errors.delete(this.options.onStompError);
      for (const [destination, receive] of this.subscriptions) {
        const listeners = stomp.subscriptions.get(destination);
        listeners?.delete(receive);
        if (!listeners?.size) stomp.subscriptions.delete(destination);
      }
    }
    subscribe(destination: string, receive: (frame: { body: string }) => void) {
      this.subscriptions.set(destination, receive);
      const listeners = stomp.subscriptions.get(destination) ?? new Set();
      listeners.add(receive);
      stomp.subscriptions.set(destination, listeners);
    }
    publish(command: { destination: string; body?: string }) {
      if (command.body === JSON.stringify({ action: "SYNC" })) this.subscriptions.get(workspaceQueue)?.({ body: JSON.stringify({ type: "READY" }) });
      else if (command.destination.endsWith("/sync")) {
        const conversationId = command.destination.split("/").at(-2);
        this.subscriptions.get(`/user/queue/chat/rooms/${conversationId}`)?.({
          body: JSON.stringify({ type: "READY", conversationId }),
        });
      } else stomp.publish(command);
    }
  },
}));
const workspaceQueue = "/user/queue/chat/workspace";
function emit(value: object, destination = workspaceQueue) {
  for (const receive of stomp.subscriptions.get(destination) ?? []) receive({ body: JSON.stringify(value) });
}
beforeEach(() => {
  stomp.publish.mockReset();
  stomp.connect.mockClear();
  stomp.subscriptions.clear();
  stomp.errors.clear();
  sessionStorage.clear();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

const userId = "550e8400-e29b-41d4-a716-446655440003";
const consultantId = "550e8400-e29b-41d4-a716-446655440001";
const conversationId = "550e8400-e29b-41d4-a716-446655440002";
const requestId = "550e8400-e29b-41d4-a716-446655440010";
const csrfToken = "a".repeat(43);
const expiresAt = () => new Date(Date.now() + 60_000).toISOString();
const room = { conversationId, userId, consultantId, createdAt: "2026-11-09T03:00:00Z", status: "PENDING",
  startedAt: null, endedAt: null, endReason: null, endedByAccountId: null };
const consultant = { consultantId, displayName: "Tư vấn viên An", summary: "Mai Hoa" };

const page = (items: unknown[], index = 0, total = items.length) =>
  ({ items, page: index, size: 20, totalElements: total, totalPages: Math.ceil(total / 20) });
const success = (data: unknown, status = 200) => Response.json({ requestId, status: "COMPLETED", data, error: null }, { status });
const failure = (code: string, status: number) => Response.json({ requestId, status: "FAILED", data: null,
  error: { code, message: code, ruleCode: null, reason: null } }, { status });

it("binds a reading to the requested room, restores it after reload and sends it only after acceptance", async () => {
  const text = "Diễn Cầm Tam Thế\n\nTình duyên";
  const messageId = "550e8400-e29b-41d4-a716-446655440011";
  const otherRoomId = "550e8400-e29b-41d4-a716-446655440099";
  let current = { ...room, startedAt: null as string | null };
  let created = false;
  storeReadingHandoff({ accountId: userId, text, messageId });
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: userId, role: "USER", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: userId, role: "USER", displayName: "Khách" }, expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/consultants?")) return success(page([consultant]));
    if (path.includes("/chat/conversations?")) return success(page(created ? [current, { ...room, conversationId: otherRoomId }] : []));
    if (path.endsWith(conversationId)) return success(current);
    if (path.endsWith(otherRoomId)) return success({ ...room, conversationId: otherRoomId });
    if (path.includes("/messages?")) return success({ items: [], nextAfterSequence: "0", hasMore: false });
    throw new Error(`Unexpected request ${path}`);
  }));
  stomp.publish.mockImplementation(({ destination, body }) => {
    const payload = JSON.parse(body);
    if (payload.action === "CREATE") {
      created = true;
      emit({ type: "ACK", requestId: payload.requestId, conversation: room });
    }
    if (destination.endsWith("/send")) {
      expect(payload).toEqual({ clientMessageId: messageId, text });
      emit({ type: "ACK", conversationId, clientMessageId: messageId, messageId: requestId, sequence: "1", createdAt: room.createdAt },
        `/user/queue/chat/rooms/${conversationId}`);
    }
  });
  const view = render(<ConsultationPage />);
  fireEvent.click(await screen.findByRole("radio", { name: consultant.displayName }));
  const sendRequest = screen.getByRole<HTMLButtonElement>("button", { name: "Gửi yêu cầu tư vấn" });
  await waitFor(() => expect(sendRequest.disabled).toBe(false));
  fireEvent.click(sendRequest);
  await screen.findByText(/Lá số sẽ sẵn sàng/);
  expect(screen.queryByRole("button", { name: "Gửi lá số" })).toBeNull();
  expect(readReadingHandoff(userId)?.conversationId).toBe(conversationId);
  expect(readReadingHandoff(consultantId)).toBeUndefined();
  view.unmount();
  render(<ChatNotificationsProvider><ConsultationPage /></ChatNotificationsProvider>);
  await screen.findByText(/Lá số sẽ sẵn sàng/);
  fireEvent.click(await screen.findByRole("button", { name: /550e8400/ , pressed: false }));
  expect(screen.queryByText(/Lá số sẽ sẵn sàng/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Gửi lá số" })).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: /550e8400/, pressed: false }));
  await screen.findByText(/Lá số sẽ sẵn sàng/);
  current = { ...current, status: "ACTIVE", startedAt: "2026-11-09T03:01:00Z" };
  await waitFor(() => expect(stomp.subscriptions.get(workspaceQueue)?.size).toBe(2));
  act(() => emit({ type: "ROOM_CHANGED", conversationId, status: "ACTIVE" }));
  expect(screen.getByRole("link", { name: /tư vấn viên đã chấp nhận yêu cầu/ }).getAttribute("href")).toBe("/tu-van");
  const sendReading = await screen.findByRole<HTMLButtonElement>("button", { name: "Gửi lá số" });
  await waitFor(() => expect(sendReading.disabled).toBe(false));
  expect(stomp.publish.mock.calls.some(([frame]) => frame.destination.endsWith("/send"))).toBe(false);
  fireEvent.click(sendReading);
  await waitFor(() => expect(readReadingHandoff(userId)).toBeUndefined());
  expect(screen.queryByRole("button", { name: "Gửi lá số" })).toBeNull();
});

it("loads the user directory, retries C3 with one UUID, and opens the saved room through C5", async () => {
  const writes: { consultantId: string; requestId: string }[] = [];
  stomp.publish.mockImplementation(({ destination, body }) => {
    expect(destination).toBe("/app/chat/workspace");
    const command = JSON.parse(body);
    writes.push(command);
    emit(writes.length === 1 ? { type: "ERROR", requestId: command.requestId, code: "DATABASE_UNAVAILABLE" }
      : { type: "ACK", requestId: command.requestId, conversation: room });
  });
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: userId, role: "USER", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: userId, role: "USER", displayName: "Người dùng" }, expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/consultants?")) return success(page([consultant]));
    if (path.includes("/chat/conversations?")) return success(page(writes.length ? [room] : []));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return success(room);
    throw new Error(`Unexpected request ${path}`);
  }));

  render(<ConsultationPage />);
  fireEvent.click(await screen.findByRole("radio", { name: consultant.displayName }));
  expect(screen.queryByRole("link", { name: /Mở không gian tư vấn viên/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Hỏi AI" }).getAttribute("href")).toBe("/tu-van/hoi-ai");
  await waitFor(() => expect(stomp.subscriptions.has(workspaceQueue)).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu tư vấn" }));
  await screen.findByRole("alert", { name: "" });
  expect(screen.getByText("Chưa xác nhận được yêu cầu. Bạn có thể bấm gửi lại.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu tư vấn" }));
  const panel = within(screen.getByRole("region", { name: "Khung trò chuyện" }));
  expect(await panel.findByText("Chờ tư vấn viên")).toBeTruthy();
  expect(await screen.findByRole("button", { name: /^Tư vấn viên An ·/ })).toBeTruthy();
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual({ action: "CREATE", consultantId, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i) });
  expect(writes[0]).toEqual(writes[1]);
  expect(stomp.connect).toHaveBeenCalledWith({ "X-CSRF-Token": csrfToken });
  expect((panel.getByRole("button", { name: "Gửi tin nhắn" }) as HTMLButtonElement).disabled).toBe(true);
});

it("pushes new assigned rooms to a consultant and clears their data on session revocation", async () => {
  let assigned = false;
  const fetch = vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: consultantId, role: "CONSULTANT", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: consultantId, role: "CONSULTANT", displayName: "Tư vấn viên" },
      expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/conversations?")) return success(page(assigned ? [room] : []));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return success(room);
    throw new Error(`Unexpected request ${path}`);
  });
  vi.stubGlobal("fetch", fetch);
  render(<ChatNotificationsProvider><ConsultantWorkspacePage /></ChatNotificationsProvider>);
  await screen.findByText("Chưa có cuộc trò chuyện.");
  await waitFor(() => expect(stomp.subscriptions.get(workspaceQueue)?.size).toBe(2));
  assigned = true;
  act(() => emit({ type: "ROOM_CREATED", conversationId, status: "PENDING" }));
  expect(screen.getByRole("link", { name: "Bạn có yêu cầu tư vấn mới." }).getAttribute("href")).toBe("/tu-van-vien");
  const unread = await screen.findByRole("button", { name: /Có tin nhắn chưa đọc/ });
  fireEvent.click(unread);
  expect(screen.queryByText("Bạn có yêu cầu tư vấn mới.")).toBeNull();
  expect(screen.queryByLabelText("Có tin nhắn chưa đọc")).toBeNull();
  const panel = within(screen.getByRole("region", { name: "Khung trò chuyện" }));
  await panel.findByText("Chờ tư vấn viên");
  act(() => { for (const error of [...stomp.errors]) error({ headers: { message: "INVALID_SESSION" } }); });
  expect(await screen.findByRole("link", { name: "Đăng nhập để tiếp tục" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Hội thoại ·/ })).toBeNull();
  expect(fetch.mock.calls.some(([path]) => path.includes("/chat/consultants"))).toBe(false);
});

it.each([
  { Page: ConsultationPage, accountId: userId, role: "USER" },
  { Page: ConsultantWorkspacePage, accountId: consultantId, role: "CONSULTANT" },
])("does not show a large message alert for $role while the room is closed", async ({ Page, accountId, role }) => {
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId, role, expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: accountId, role, displayName: "Demo" },
      expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/consultants?")) return success(page([]));
    if (path.includes("/chat/conversations?")) return success(page([]));
    if (path.endsWith(conversationId)) return success(room);
    throw new Error(`Unexpected request ${path}`);
  }));
  render(<Page />);
  await waitFor(() => expect(stomp.subscriptions.has(workspaceQueue)).toBe(true));
  const roomQueue = `/user/queue/chat/rooms/${conversationId}`;
  expect(stomp.subscriptions.has(roomQueue)).toBe(false);
  act(() => {
    emit({ type: "MESSAGE_RECEIVED", conversationId });
    emit({ type: "MESSAGE_RECEIVED", conversationId });
  });
  expect(screen.queryByRole("region", { name: "Thông báo tư vấn" })).toBeNull();
  expect(screen.getByText("Chọn một cuộc trò chuyện trong danh sách để bắt đầu.")).toBeTruthy();
});

it("blocks the wrong role before loading any room data", async () => {
  const fetch = vi.fn(async () => success({ accountId: userId, role: "USER", expiresAt: expiresAt() }));
  vi.stubGlobal("fetch", fetch);
  render(<ConsultantWorkspacePage />);
  await screen.findByText("Bạn không có quyền mở cuộc trò chuyện này.");
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
});

it("shows the consultant workspace link only after the server confirms a consultant session", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => success({ accountId: consultantId, role: "CONSULTANT", expiresAt: expiresAt() })));
  render(<ConsultationPage />);
  expect(screen.queryByRole("link", { name: /Mở không gian tư vấn viên/ })).toBeNull();
  const link = await screen.findByRole("link", { name: /Mở không gian tư vấn viên/ });
  expect(link.getAttribute("href")).toBe("/tu-van-vien");
});

it("lets a consultant accept a pending room and end the active room using the customer CSRF token", async () => {
  const startedAt = "2026-11-09T03:01:00Z";
  const endedAt = "2026-11-09T03:02:00Z";
  const writes: string[] = [];
  let current = { ...room, startedAt: null as string | null, endedAt: null as string | null,
    endedByAccountId: null as string | null, endReason: null as string | null };
  stomp.publish.mockImplementation(({ body }) => {
    const { action, requestId: id } = JSON.parse(body);
    if (!id) return;
    writes.push(action);
    current = action === "ACCEPT" ? { ...current, status: "ACTIVE", startedAt }
      : { ...current, status: "ENDED", endedAt, endReason: "COMPLETED", endedByAccountId: consultantId };
    emit({ type: "ACK", requestId: id, conversation: current });
  });
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: consultantId, role: "CONSULTANT", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: consultantId, role: "CONSULTANT", displayName: "Tư vấn viên" },
      expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/conversations?")) return success(page([current]));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return success(current);
    throw new Error(`Unexpected request ${path}`);
  }));
  render(<ConsultantWorkspacePage />);
  fireEvent.click(await screen.findByRole("button", { name: /^Hội thoại ·/ }));
  const panel = within(screen.getByRole("region", { name: "Khung trò chuyện" }));
  expect(await panel.findByRole("button", { name: "Từ chối yêu cầu" })).toBeTruthy();
  expect(panel.queryByRole("button", { name: "Hủy yêu cầu" })).toBeNull();
  fireEvent.click(panel.getByRole("button", { name: "Chấp nhận yêu cầu" }));
  await panel.findByText("Đang tư vấn");
  fireEvent.click(panel.getByRole("button", { name: "Kết thúc cuộc trò chuyện" }));
  expect(await panel.findByText("Phiên tư vấn đã kết thúc.")).toBeTruthy();
  expect(panel.queryByRole("button", { name: "Kết thúc cuộc trò chuyện" })).toBeNull();
  expect(writes).toEqual(["ACCEPT", "END"]);
});

it("refreshes the user room after a conflicting cancel and offers only active-room actions", async () => {
  let current = { ...room };
  stomp.publish.mockImplementation(({ body }) => {
    const { action, requestId: id } = JSON.parse(body);
    if (!id) return;
    expect(action).toBe("CANCEL");
    current = { ...current, status: "ACTIVE" };
    emit({ type: "ERROR", requestId: id, code: "INVALID_TRANSITION" });
  });
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: userId, role: "USER", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: userId, role: "USER", displayName: "Người dùng" },
      expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/consultants?")) return success(page([]));
    if (path.includes("/chat/conversations?")) return success(page([current]));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return success(current);
    throw new Error(`Unexpected request ${path}`);
  }));
  render(<ConsultationPage />);
  fireEvent.click(await screen.findByRole("button", { name: /^Hội thoại ·/ }));
  const panel = within(screen.getByRole("region", { name: "Khung trò chuyện" }));
  fireEvent.click(await panel.findByRole("button", { name: "Hủy yêu cầu" }));
  expect(await panel.findByText(/Trạng thái hội thoại đã thay đổi/)).toBeTruthy();
  expect(await panel.findByRole("button", { name: "Kết thúc cuộc trò chuyện" })).toBeTruthy();
  expect(panel.queryByRole("button", { name: "Hủy yêu cầu" })).toBeNull();
});

it("shows room presence and typing and updates the selected room when the other participant ends it", async () => {
  let current = { ...room, status: "ACTIVE", startedAt: "2026-11-09T03:01:00Z" as string | null,
    endedAt: null as string | null, endedByAccountId: null as string | null, endReason: null as string | null };
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: userId, role: "USER", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: userId, role: "USER", displayName: "Người dùng" },
      expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/consultants?")) return success(page([]));
    if (path.includes("/chat/conversations?")) return success(page([current]));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return success(current);
    if (path.includes("/messages?")) return success({ items: [], nextAfterSequence: "0", hasMore: false });
    throw new Error(`Unexpected request ${path}`);
  }));
  render(<ConsultationPage />);
  fireEvent.click(await screen.findByRole("button", { name: /^Hội thoại ·/ }));
  const panel = within(screen.getByRole("region", { name: "Khung trò chuyện" }));
  await panel.findByText("Đang tư vấn");
  await waitFor(() => expect(stomp.publish).toHaveBeenCalledWith(expect.objectContaining({
    body: JSON.stringify({ action: "PRESENCE", conversationId }),
  })));
  act(() => emit({ type: "TYPING", conversationId: consultantId }));
  expect(panel.queryByText("Người bên kia đang nhập tin nhắn…")).toBeNull();
  act(() => {
    emit({ type: "PEER_ONLINE", conversationId, online: true });
    emit({ type: "TYPING", conversationId });
  });
  expect(panel.getByText("Người bên kia đang trực tuyến.")).toBeTruthy();
  expect(panel.getByText("Người bên kia đang nhập tin nhắn…")).toBeTruthy();
  fireEvent.change(panel.getByRole("textbox", { name: "Tin nhắn" }), { target: { value: "Chào bạn" } });
  expect(stomp.publish).toHaveBeenCalledWith(expect.objectContaining({
    body: JSON.stringify({ action: "TYPING", conversationId }),
  }));
  current = { ...current, status: "ENDED", endedAt: "2026-11-09T03:02:00Z",
    endedByAccountId: consultantId, endReason: "COMPLETED" };
  act(() => emit({ type: "ROOM_CHANGED", conversationId }));
  expect(await panel.findByText("Phiên tư vấn đã kết thúc.")).toBeTruthy();
  expect(panel.queryByText("Người bên kia đang nhập tin nhắn…")).toBeNull();
});
