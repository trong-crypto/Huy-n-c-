import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ChatNotificationsProvider, useChatNotifications } from "./ChatNotifications";

const socket = vi.hoisted(() => ({ receive: (_body: string) => {} }));
vi.mock("@/services/websocket/useAuthenticatedSocket", () => ({
  useAuthenticatedSocket: (options: { onMessage: (body: string) => void }) => { socket.receive = options.onMessage; },
}));
vi.mock("@/services/rest/chat", () => ({
  readChatSession: async () => ({ accountId: "550e8400-e29b-41d4-a716-446655440001", role: "USER", expiresAt: "2099-01-01T00:00:00Z" }),
  readChatCsrf: vi.fn(),
}));

function Indicator() {
  const { unreadConversations } = useChatNotifications();
  return <span data-testid="unread">{unreadConversations.size}</span>;
}

it("notifies the user and marks the conversation when a consultant declines", async () => {
  render(<ChatNotificationsProvider><Indicator /></ChatNotificationsProvider>);
  const roomId = "550e8400-e29b-41d4-a716-446655440002";
  await act(async () => {});
  act(() => socket.receive(JSON.stringify({ type: "ROOM_CHANGED", conversationId: roomId,
    status: "ENDED", endReason: "DECLINED" })));
  await waitFor(() => expect(screen.getByTestId("unread").textContent).toBe("1"));
  expect(screen.getByRole("link", { name: /Tư vấn viên đã từ chối/ }).getAttribute("href"))
    .toBe(`/tu-van?conversation=${roomId}`);
});
