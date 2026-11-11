import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteNavigation } from "./SiteNavigation";

const state = vi.hoisted(() => ({
  enabled: true, pathname: "/history", historyReady: false, replace: vi.fn(), invalidate: vi.fn(),
  socket: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("@/config/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/client")>();
  return { CLIENT_CONFIG: { ...actual.CLIENT_CONFIG, get accountHistory() { return state.enabled; } } };
});
vi.mock("@/services/session/SessionProvider", () => ({
  useSession: () => state.historyReady ? { status: "ready", invalidate: state.invalidate } : null,
}));
vi.mock("@/services/websocket/useAuthenticatedSocket", () => ({
  useAuthenticatedSocket: state.socket,
}));

const id = "905b2f9f-c230-4887-9369-7b5500964f59";
const csrfToken = "a".repeat(43);
function session(name = "Khách A", role = "USER", expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  return Response.json({ requestId: id, status: "COMPLETED", data: { account: { id, displayName: name, role }, expiresAt, csrfToken }, error: null });
}
function invalidSession() {
  return Response.json({ requestId: id, status: "FAILED", data: null,
    error: { code: "INVALID_SESSION", message: "Phiên không hợp lệ.", ruleCode: null, reason: null } }, { status: 401 });
}
function useFetchMock() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("customer navigation session", () => {
  beforeEach(() => { state.enabled = true; state.pathname = "/history"; state.historyReady = false; state.socket.mockClear(); });

  it("renders guest links and makes no Auth request when the feature is off", () => {
    const fetch = useFetchMock();
    state.enabled = false;
    render(<SiteNavigation />);
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng ký" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Đăng xuất" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a neutral server render and handles a 401 as guest", async () => {
    const fetch = useFetchMock().mockResolvedValueOnce(invalidSession());
    const html = renderToString(<SiteNavigation />);
    expect(html).toContain("Đang kiểm tra phiên");
    expect(html).not.toContain("Đăng nhập");
    expect(fetch).not.toHaveBeenCalled();

    render(<SiteNavigation />);
    expect(await screen.findByRole("link", { name: "Đăng nhập" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng ký" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Đăng xuất" })).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/v1/auth/session", expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" }));
  });

  it.each([["Khách A", "USER"], ["Tư vấn B", "CONSULTANT"]])("shows only the verified identity %s across public navigation", async (name, role) => {
    const fetch = useFetchMock().mockResolvedValueOnce(session(name, role));
    const view = render(<SiteNavigation />);
    expect(await screen.findByText(name)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Đăng nhập" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Đăng ký" })).toBeNull();
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lịch sử" }).getAttribute("href")).toBe("/history");
    state.pathname = "/tam-the";
    view.rerender(<SiteNavigation />);
    expect(screen.getByText(name)).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("removes stale names after a failed recheck and can retry the GET", async () => {
    const fetch = useFetchMock().mockResolvedValueOnce(session()).mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(session("Khách B"));
    render(<SiteNavigation />);
    await screen.findByText("Khách A");
    fireEvent.focus(window);
    expect(screen.queryByText("Khách A")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Khách B")).toBeTruthy();
    expect(fetch.mock.calls.every(([, options]) => options?.method === "GET")).toBe(true);
  });

  it("rejects an ADMIN identity on the public customer header", async () => {
    useFetchMock().mockResolvedValueOnce(session("Tên quản trị", "ADMIN"));
    render(<SiteNavigation />);
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeTruthy();
    expect(screen.queryByText("Tên quản trị")).toBeNull();
  });

  it("ignores an already expired response and clears an open private history view", async () => {
    state.historyReady = true;
    useFetchMock().mockResolvedValueOnce(session("Tên hết hạn", "USER", "2000-01-01T00:00:00Z"));
    render(<SiteNavigation />);
    expect(await screen.findByRole("link", { name: "Đăng nhập" })).toBeTruthy();
    expect(screen.queryByText("Tên hết hạn")).toBeNull();
    await waitFor(() => expect(state.invalidate).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_SESSION" })));
  });

  it("clears the account and private history as soon as the session socket reports revocation", async () => {
    state.historyReady = true;
    const fetch = useFetchMock().mockResolvedValueOnce(session());
    render(<SiteNavigation />);
    await screen.findByText("Khách A");
    const socket = state.socket.mock.lastCall?.[0];
    expect(socket.endpoint).toBe("account");
    act(() => socket.onAccessError("INVALID_SESSION"));
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toBeTruthy();
    expect(screen.queryByText("Khách A")).toBeNull();
    expect(state.invalidate).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_SESSION" }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("revalidates a displayed account when its session expires", async () => {
    vi.useFakeTimers();
    try {
      const expiry = new Date(Date.now() + 5_000).toISOString();
      const fetch = useFetchMock().mockResolvedValueOnce(session("Khách A", "USER", expiry))
        .mockResolvedValueOnce(invalidSession());
      render(<SiteNavigation />);
      await act(async () => {});
      expect(screen.getByText("Khách A")).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Khách A")).toBeNull();
      expect(screen.getByRole("link", { name: "Đăng nhập" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([204, 401])("clears the header and private view after logout HTTP %s", async status => {
    state.historyReady = true;
    const fetch = useFetchMock().mockResolvedValueOnce(session());
    let finish!: (response: Response) => void;
    fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<SiteNavigation />);
    fireEvent.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    const pending = screen.getByRole<HTMLButtonElement>("button", { name: "Đang đăng xuất…" });
    expect(pending.disabled).toBe(true);
    fireEvent.click(pending);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith("/api/v1/auth/logout", expect.objectContaining({
      method: "POST", credentials: "same-origin", body: "{}",
      headers: expect.objectContaining({ "X-CSRF-Token": csrfToken, "X-HuyenCo-Request": "1" }),
    }));
    await act(async () => { finish(status === 204 ? new Response(null, { status }) : invalidSession()); });
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toBeTruthy();
    expect(screen.queryByText("Khách A")).toBeNull();
    expect(state.invalidate).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_SESSION" }));
    expect(state.replace).toHaveBeenCalledWith("/dang-nhap");
  });

  it("rechecks session without retrying a failed logout mutation", async () => {
    const fetch = useFetchMock().mockResolvedValueOnce(session()).mockRejectedValueOnce(new TypeError("offline"))
      .mockRejectedValueOnce(new TypeError("offline"));
    render(<SiteNavigation />);
    fireEvent.click(await screen.findByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeTruthy();
    expect(screen.queryByText("Khách A")).toBeNull();
    expect(fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
    expect(state.replace).not.toHaveBeenCalled();
  });
});
