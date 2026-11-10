import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultationPage from "@/app/tu-van/page";
import ConsultantWorkspacePage from "@/app/tu-van-vien/page";
import { ConsultationWorkspace } from "./ConsultationWorkspace";
import { draftLimit, validateChatDraft, type ChatAccess, type SubscribeToRoom } from "./chatState";

const authorized = {
  status: "authorized", accessKey: "test-session", connection: "connected",
  room: { id: "test-room", title: "Phòng kiểm thử", status: "active", history: [] },
  consultants: [], conversations: [],
} as const satisfies ChatAccess;

function source() {
  const subscriptions: { roomId: string; receive: (event: unknown) => void; close: ReturnType<typeof vi.fn> }[] = [];
  const subscribe: SubscribeToRoom = vi.fn((roomId, receive) => {
    const close = vi.fn();
    subscriptions.push({ roomId, receive, close });
    return close;
  });
  return { subscribe, subscriptions };
}

function isDisabled(name: string) {
  return (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;
}

describe("consultation workspace", () => {
  it.each([
    { Page: ConsultationPage, title: "Tư vấn trực tuyến", action: "Gửi yêu cầu tư vấn" },
    { Page: ConsultantWorkspacePage, title: "Không gian tư vấn viên", action: "Chấp nhận yêu cầu" },
  ])("renders $title with no send or network activity", ({ Page, title, action }) => {
    const fetch = vi.fn();
    const socket = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("WebSocket", socket);
    render(<Page />);
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Chat chưa sẵn sàng");
    expect((screen.getByLabelText("Tin nhắn") as HTMLTextAreaElement).disabled).toBe(true);
    expect(isDisabled(action)).toBe(true);
    expect(isDisabled("Gửi tin nhắn")).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
  });

  it("distinguishes loading, confirmed empty lists and an empty room", () => {
    const { rerender } = render(<ConsultationWorkspace audience="user" access={{ status: "loading" }} />);
    expect(screen.getByRole("status").textContent).toContain("Đang tải");
    rerender(<ConsultationWorkspace audience="user" access={authorized} />);
    expect(screen.getByText("Chưa có tư vấn viên trong danh sách.")).toBeTruthy();
    expect(screen.getByText("Chưa có cuộc trò chuyện.")).toBeTruthy();
    expect(screen.getByText("Cuộc trò chuyện chưa có tin nhắn.")).toBeTruthy();
  });

  it("shows the open room's current status while the conversation list is stale", () => {
    render(<ConsultationWorkspace audience="user" access={{ ...authorized,
      conversations: [{ ...authorized.room, status: "pending" }] }} />);
    const sidebar = screen.getByRole("complementary", { name: "Thông tin tư vấn" });
    expect(within(sidebar).getByText("Đang tư vấn")).toBeTruthy();
    expect(within(sidebar).queryByText("Chờ tư vấn viên")).toBeNull();
  });

  it("validates draft text without showing delivery or submitting", () => {
    render(<ConsultationWorkspace audience="user" access={authorized} />);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra bản nháp" }));
    expect(screen.getByRole("alert").textContent).toBe("Nhập nội dung tin nhắn.");
    const input = screen.getByLabelText("Tin nhắn");
    fireEvent.change(input, { target: { value: "  Chào bạn  " } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra bản nháp" }));
    expect(screen.getByText("Bản nháp hợp lệ · Chưa gửi.")).toBeTruthy();
    expect(isDisabled("Gửi tin nhắn")).toBe(true);
    expect(validateChatDraft("a".repeat(draftLimit))).toBeNull();
    expect(validateChatDraft("a".repeat(draftLimit + 1))).toContain("tối đa");
  });

  it("filters other rooms, rejects malformed events, and renders long text as text with duplicate IDs removed", () => {
    const { subscribe, subscriptions } = source();
    const text = "<b>nội dung</b>" + "a".repeat(1200);
    const message = { id: "m-1", roomId: "test-room", author: "Người thử", text };
    render(<ConsultationWorkspace audience="user" access={authorized} subscribe={subscribe} />);
    act(() => {
      subscriptions[0].receive({ ...message, roomId: "other-room", text: "Tin riêng sai phòng" });
      subscriptions[0].receive({ id: 5 });
      subscriptions[0].receive(message);
      subscriptions[0].receive(message);
    });
    const list = screen.getByRole("list", { name: "Tin nhắn trong cuộc trò chuyện" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(list.textContent).toContain(text);
    expect(list.querySelector("b")).toBeNull();
    expect(screen.queryByText("Tin riêng sai phòng")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("lỗi khi nhận");
  });

  it("cleans up on disconnect, reconnects without resending and retains the draft", () => {
    const { subscribe, subscriptions } = source();
    const retry = vi.fn();
    const { rerender, unmount } = render(<ConsultationWorkspace audience="consultant" access={authorized} subscribe={subscribe} retry={retry} />);
    fireEvent.change(screen.getByLabelText("Tin nhắn"), { target: { value: "bản nháp" } });
    rerender(<ConsultationWorkspace audience="consultant" access={{ ...authorized, connection: "disconnected", failure: "deliveryUnknown" }}
      subscribe={subscribe} retry={retry} />);
    expect(subscriptions[0].close).toHaveBeenCalledTimes(1);
    act(() => subscriptions[0].receive({ id: "late", roomId: "test-room", author: "Mẫu", text: "Tin đến muộn" }));
    expect(screen.queryByText("Tin đến muộn")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Chưa xác định máy chủ đã nhận");
    fireEvent.click(screen.getByRole("button", { name: "Thử kết nối lại" }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<ConsultationWorkspace audience="consultant" access={{ ...authorized, connection: "reconnecting" }} subscribe={subscribe} />);
    expect(subscriptions).toHaveLength(1);
    expect(screen.getByText("Đang kết nối lại.")).toBeTruthy();
    rerender(<ConsultationWorkspace audience="consultant" access={authorized} subscribe={subscribe} />);
    expect(subscriptions).toHaveLength(2);
    expect((screen.getByLabelText("Tin nhắn") as HTMLTextAreaElement).value).toBe("bản nháp");
    expect(isDisabled("Gửi tin nhắn")).toBe(true);
    unmount();
    expect(subscriptions[1].close).toHaveBeenCalledTimes(1);
  });

  it("clears old room data when switching rooms and tears down access on expiry or denial", () => {
    const { subscribe, subscriptions } = source();
    const withHistory = { ...authorized, room: { ...authorized.room, history: [{ id: "m", roomId: "test-room", author: "Mẫu", text: "Tin phòng cũ" }] } };
    const { rerender } = render(<ConsultationWorkspace audience="user" access={withHistory} subscribe={subscribe} />);
    expect(screen.getByText("Tin phòng cũ")).toBeTruthy();
    rerender(<ConsultationWorkspace audience="user" access={{ ...authorized, room: { ...authorized.room, id: "room-b" } }} subscribe={subscribe} />);
    expect(subscriptions[0].close).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Tin phòng cũ")).toBeNull();
    expect(subscriptions[1].roomId).toBe("room-b");
    rerender(<ConsultationWorkspace audience="user" access={{ status: "expired" }} subscribe={subscribe} />);
    expect(subscriptions[1].close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toContain("Phiên chat đã hết hạn");
    rerender(<ConsultationWorkspace audience="user" access={{ status: "forbidden" }} subscribe={subscribe} />);
    expect(screen.getByRole("alert").textContent).toContain("không có quyền");
    expect(subscriptions).toHaveLength(2);
    expect(isDisabled("Gửi tin nhắn")).toBe(true);
  });

  it("shows timeout and send failure without implying delivery", () => {
    render(<ConsultationWorkspace audience="user" access={{ ...authorized, connection: "unresponsive", failure: "sendFailed" }} />);
    expect(screen.getByText("Máy chủ chưa phản hồi.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Gửi tin nhắn thất bại.");
    expect(isDisabled("Thử kết nối lại")).toBe(true);
    expect(isDisabled("Gửi tin nhắn")).toBe(true);
  });

  it("uses Enter to send without interrupting newlines or IME composition", () => {
    const send = vi.fn();
    render(<ConsultationWorkspace audience="user" access={authorized}
      messaging={{ historyStatus: "ready", delivery: "idle", send }} />);
    const input = screen.getByLabelText("Tin nhắn");
    fireEvent.change(input, { target: { value: " Chào bạn\nMình muốn hỏi về quẻ. " } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send).toHaveBeenCalledExactlyOnceWith("Chào bạn\nMình muốn hỏi về quẻ.");
    expect(screen.queryByRole("list", { name: "Tin nhắn trong cuộc trò chuyện" })).toBeNull();
  });
});
