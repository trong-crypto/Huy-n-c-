import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminLoginPage from "@/app/admin/login/page";
import AdminWorkspaceLayout from "@/app/admin/(workspace)/layout";
import AdminDashboardPage from "@/app/admin/(workspace)/page";
import { AdminSessionGate } from "./AdminSessionGate";
import { AccountDirectoryLive } from "./AccountDirectoryLive";

const adminSocket = vi.hoisted(() => vi.fn());
vi.mock("@/services/websocket/useAuthenticatedSocket", () => ({
  useAuthenticatedSocket: adminSocket,
}));

it("shows account details in a side panel and toggles the consultant action in the same row", async () => {
  const adminId = "905b2f9f-c230-4887-9369-7b5500964f59";
  const id = "550e8400-e29b-41d4-a716-446655440001";
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  let account = { id, identifier: "demo-user", displayName: "Người dùng mẫu", role: "USER", status: "ACTIVE",
    version: 1, createdAt: "2026-11-09T03:00:00Z", canChangeStatus: true };
  const writes: object[] = [];
  vi.stubGlobal("fetch", vi.fn(async (path: string, options?: RequestInit) => {
    if (path.endsWith("/role")) {
      const body = JSON.parse(String(options?.body));
      writes.push(body);
      account = { ...account, role: body.role, version: account.version + 1 };
    }
    const data = path.endsWith("/auth/admin/session")
      ? { account: { id: adminId, displayName: "Admin", role: "ADMIN" }, expiresAt, csrfToken: "a".repeat(43) }
      : path.includes("/accounts?")
        ? { items: [account], page: 0, size: 20, totalElements: 1, totalPages: 1 }
        : { account, lastStatusChange: null, phoneNumber: "0900000000" };
    return Response.json({ requestId: id, status: "COMPLETED", error: null, data });
  }));
  render(<AdminSessionGate><AccountDirectoryLive /></AdminSessionGate>);
  fireEvent.click(await screen.findByRole("button", { name: "Người dùng mẫu" }));
  const side = screen.getByRole("complementary", { name: "Chi tiết tài khoản" });
  expect(await within(side).findByText("demo-user")).toBeTruthy();
  expect(within(side).getByText("0900000000")).toBeTruthy();
  fireEvent.click(within(side).getByRole("button", { name: "Đóng" }));
  expect(screen.queryByRole("complementary", { name: "Chi tiết tài khoản" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cấp lên thành tư vấn viên" }));
  fireEvent.click(await screen.findByRole("button", { name: "Xác nhận đổi vai trò" }));
  fireEvent.click(await screen.findByRole("button", { name: "Thu hồi quyền tư vấn viên" }));
  fireEvent.click(await screen.findByRole("button", { name: "Xác nhận đổi vai trò" }));
  expect(await screen.findByRole("button", { name: "Cấp lên thành tư vấn viên" })).toBeTruthy();
  expect(writes).toEqual([{ expectedVersion: 1, role: "CONSULTANT", approveProfile: true }, { expectedVersion: 2, role: "USER" }]);
});

it("filters and approves pending password requests in the account drawer", async () => {
  const id = "550e8400-e29b-41d4-a716-446655440001";
  const requestId = "550e8400-e29b-41d4-a716-446655440002";
  const account = { id, identifier: "demo-user", displayName: "Người dùng mẫu", role: "USER", status: "ACTIVE",
    version: 1, createdAt: "2026-11-09T03:00:00Z", canChangeStatus: true };
  const csrfToken = "a".repeat(43);
  const fetch = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.endsWith("/auth/admin/password/requests")) {
      expect(options?.body).toBe(JSON.stringify({ accountId: id, requestId, decision: "APPROVE" }));
      return new Response(null, { status: 204 });
    }
    const data = path.endsWith("/auth/admin/session")
      ? { account: { id, displayName: "Admin", role: "ADMIN" }, expiresAt: new Date(Date.now() + 60_000).toISOString(), csrfToken }
      : path.includes("/accounts?")
        ? { items: [account], page: 0, size: 20, totalElements: 1, totalPages: 1 }
        : { account, lastStatusChange: null, passwordRequest: { id: requestId, requestedAt: account.createdAt } };
    return Response.json({ requestId: id, status: "COMPLETED", error: null, data });
  });
  vi.stubGlobal("fetch", fetch);
  render(<AdminSessionGate><AccountDirectoryLive /></AdminSessionGate>);
  fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu đổi mật khẩu đang chờ" }));
  fireEvent.click(await screen.findByRole("button", { name: "Người dùng mẫu" }));
  fireEvent.click(await screen.findByRole("button", { name: "Duyệt đổi mật khẩu" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt yêu cầu" }));
  expect(await screen.findByText(/Đã duyệt yêu cầu/)).toBeTruthy();
  expect(fetch.mock.calls.some(([path]) => path.includes("passwordRequest=pending"))).toBe(true);
});

it("shows a review notification to an authenticated admin and clears the workspace after revocation", async () => {
  const id = "905b2f9f-c230-4887-9369-7b5500964f59";
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    requestId: id, status: "COMPLETED", error: null,
    data: { account: { id, displayName: "Admin TEST", role: "ADMIN" },
      expiresAt: new Date(Date.now() + 60_000).toISOString(), csrfToken: "a".repeat(43) },
  })));
  render(<AdminSessionGate><h2>Nội dung quản trị thử</h2></AdminSessionGate>);
  await screen.findByRole("heading", { name: "Nội dung quản trị thử" });
  const socket = adminSocket.mock.lastCall?.[0];
  expect(socket).toMatchObject({ endpoint: "admin", destination: "/queue/admin/reviews" });
  act(() => socket.onMessage(JSON.stringify({ type: "REVIEW_PENDING", area: "SOURCE" })));
  const notices = screen.getByRole("complementary", { name: "Thông báo chờ duyệt" });
  expect(within(notices).getByRole("link", { name: "Dữ liệu nguồn" }).getAttribute("href")).toBe("/admin/sources");
  act(() => socket.onAccessError("INVALID_SESSION"));
  expect(screen.getByRole("heading", { name: "Cần đăng nhập quản trị" })).toBeTruthy();
  expect(screen.queryByText("Nội dung quản trị thử")).toBeNull();
});

describe("Admin foundation while authentication is unavailable", () => {
  it("focuses the first missing field and describes each validation error", () => {
    render(<AdminLoginPage />);
    const account = screen.getByLabelText("Tài khoản");
    const password = screen.getByLabelText("Mật khẩu");
    const submit = screen.getByRole("button", { name: "Đăng nhập" });

    fireEvent.change(account, { target: { value: "   " } });
    fireEvent.click(submit);
    expect(document.activeElement).toBe(account);
    expect(account.getAttribute("aria-describedby")).toBe("admin-account-error");
    expect(password.getAttribute("aria-describedby")).toBe("admin-password-error");

    fireEvent.change(account, { target: { value: "sample" } });
    fireEvent.click(submit);
    expect(document.activeElement).toBe(password);
    expect(account.hasAttribute("aria-invalid")).toBe(false);
    expect(password.getAttribute("aria-invalid")).toBe("true");
  });

  it("validates sample fields without sending them or creating an authenticated state", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const store = vi.spyOn(Storage.prototype, "setItem");
    render(<AdminLoginPage />);
    const form = screen.getByRole("form", { name: "Biểu mẫu đăng nhập quản trị" }) as HTMLFormElement;
    const password = screen.getByLabelText("Mật khẩu") as HTMLInputElement;
    fireEvent.change(screen.getByLabelText("Tài khoản"), { target: { value: "sample" } });
    fireEvent.change(password, { target: { value: "sample-password" } });
    expect([...new FormData(form)]).toEqual([]);

    fireEvent.submit(form);
    expect(screen.getByRole("status").textContent).toContain("Đăng nhập đang chờ tích hợp Backend");
    expect(password.value).toBe("");
    expect(fetch).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Đăng nhập quản trị" })).toBeTruthy();
  });

  it("exposes the management module links while keeping authentication unavailable", () => {
    render(<AdminWorkspaceLayout><AdminDashboardPage /></AdminWorkspaceLayout>);
    const sidebar = screen.getByRole("navigation", { name: "Điều hướng quản trị" });
    const overview = within(sidebar).getByRole("link", { name: "Tổng quan" });
    expect(overview.getAttribute("href")).toBe("/admin");
    expect(overview.getAttribute("aria-current")).toBe("page");
    expect(within(sidebar).getAllByRole("link")).toHaveLength(6);
    expect(screen.queryByRole("link", { name: /Quản lý nội dung website|Quản lý tư vấn viên/ })).toBeNull();
    expect(within(sidebar).getByRole("link", { name: "Quản lý người dùng" }).getAttribute("href")).toBe("/admin/users");
    expect(within(sidebar).getByRole("link", { name: "Nhật ký quản trị" }).getAttribute("href")).toBe("/admin/audit");
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/admin/login");
    expect((screen.getByRole("button", { name: "Đăng xuất" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "Phiên quản trị" }).textContent).toContain("Đang chờ Backend");
  });
});
