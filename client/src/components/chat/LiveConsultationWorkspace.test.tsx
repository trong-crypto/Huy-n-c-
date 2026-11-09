import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ConsultationPage from "@/app/tu-van/page";
import ConsultantWorkspacePage from "@/app/tu-van-vien/page";

vi.mock("@/config/client", async importOriginal => {
  const actual = await importOriginal<typeof import("@/config/client")>();
  return { ...actual, CLIENT_CONFIG: { ...actual.CLIENT_CONFIG, accountHistory: true, apiBaseUrl: "/api/v1" } };
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

it("loads the user directory, retries C3 with one UUID, and opens the saved room through C5", async () => {
  const writes: { body: { consultantId: string; requestId: string }; options: RequestInit }[] = [];
  const socket = vi.fn();
  vi.stubGlobal("WebSocket", socket);
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: userId, role: "USER", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: userId, role: "USER", displayName: "Người dùng" }, expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/consultants?")) return success(page([consultant]));
    if (path.includes("/chat/conversations?")) return success(page(writes.length ? [room] : []));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return success(room);
    if (path.endsWith("/chat/conversations") && options.method === "POST") {
      writes.push({ body: JSON.parse(String(options.body)), options });
      return writes.length === 1 ? failure("DATABASE_UNAVAILABLE", 503) : success(room);
    }
    throw new Error(`Unexpected request ${path}`);
  }));

  render(<ConsultationPage />);
  fireEvent.click(await screen.findByRole("radio", { name: consultant.displayName }));
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu tư vấn" }));
  await screen.findByRole("alert", { name: "" });
  expect(screen.getByText("Chưa xác nhận được yêu cầu. Bạn có thể bấm gửi lại.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu tư vấn" }));
  const panel = within(screen.getByRole("region", { name: "Khung trò chuyện" }));
  expect(await panel.findByText("Chờ tư vấn viên")).toBeTruthy();
  expect(await screen.findByRole("button", { name: /^Tư vấn viên An ·/ })).toBeTruthy();
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual({ consultantId, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i) });
  expect(writes[0].body).toEqual(writes[1].body);
  expect(writes[1].options).toMatchObject({ credentials: "same-origin", cache: "no-store", headers: {
    "X-HuyenCo-Request": "1", "X-CSRF-Token": csrfToken,
  } });
  expect((panel.getByRole("button", { name: "Gửi tin nhắn" }) as HTMLButtonElement).disabled).toBe(true);
  expect(socket).not.toHaveBeenCalled();
});

it("opens assigned rooms for a consultant and removes room data after session revocation", async () => {
  let revoked = false;
  const fetch = vi.fn(async (path: string) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: consultantId, role: "CONSULTANT", expiresAt: expiresAt() });
    if (path.includes("/chat/conversations?")) return success(page([room]));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return revoked ? failure("INVALID_SESSION", 401) : success(room);
    throw new Error(`Unexpected request ${path}`);
  });
  vi.stubGlobal("fetch", fetch);
  render(<ConsultantWorkspacePage />);
  fireEvent.click(await screen.findByRole("button", { name: /^Hội thoại ·/ }));
  const panel = within(screen.getByRole("region", { name: "Khung trò chuyện" }));
  await panel.findByText("Chờ tư vấn viên");
  revoked = true;
  fireEvent.click(panel.getByRole("button", { name: "Tải lại phòng" }));
  expect(await screen.findByRole("link", { name: "Đăng nhập để tiếp tục" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Hội thoại ·/ })).toBeNull();
  expect(fetch.mock.calls.some(([path]) => path.includes("/chat/consultants"))).toBe(false);
});

it("blocks the wrong role before loading any room data", async () => {
  const fetch = vi.fn(async () => success({ accountId: userId, role: "USER", expiresAt: expiresAt() }));
  vi.stubGlobal("fetch", fetch);
  render(<ConsultantWorkspacePage />);
  await screen.findByText("Bạn không có quyền mở cuộc trò chuyện này.");
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
});

it("lets a consultant accept a pending room and end the active room using the customer CSRF token", async () => {
  const startedAt = "2026-11-09T03:01:00Z";
  const endedAt = "2026-11-09T03:02:00Z";
  const writes: string[] = [];
  let current = { ...room, startedAt: null as string | null, endedAt: null as string | null,
    endedByAccountId: null as string | null, endReason: null as string | null };
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: consultantId, role: "CONSULTANT", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: consultantId, role: "CONSULTANT", displayName: "Tư vấn viên" },
      expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/conversations?")) return success(page([current]));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return success(current);
    if (path.endsWith(`/chat/conversations/${conversationId}/transition`)) {
      expect(options).toMatchObject({ method: "POST", credentials: "same-origin", headers: {
        "X-HuyenCo-Request": "1", "X-CSRF-Token": csrfToken,
      } });
      const { action } = JSON.parse(String(options.body));
      writes.push(action);
      current = action === "ACCEPT" ? { ...current, status: "ACTIVE", startedAt }
        : { ...current, status: "ENDED", endedAt, endReason: "COMPLETED", endedByAccountId: consultantId };
      return success(current);
    }
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
  vi.stubGlobal("fetch", vi.fn(async (path: string, options: RequestInit) => {
    if (path.endsWith("/auth/chat/session")) return success({ accountId: userId, role: "USER", expiresAt: expiresAt() });
    if (path.endsWith("/auth/session")) return success({ account: { id: userId, role: "USER", displayName: "Người dùng" },
      expiresAt: expiresAt(), csrfToken });
    if (path.includes("/chat/consultants?")) return success(page([]));
    if (path.includes("/chat/conversations?")) return success(page([current]));
    if (path.endsWith(`/chat/conversations/${conversationId}`)) return success(current);
    if (path.endsWith(`/chat/conversations/${conversationId}/transition`)) {
      expect(JSON.parse(String(options.body))).toEqual({ action: "CANCEL" });
      current = { ...current, status: "ACTIVE" };
      return failure("INVALID_TRANSITION", 409);
    }
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
