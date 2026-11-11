import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminLoginPage from "@/app/admin/login/page";
import AdminWorkspaceLayout from "@/app/admin/(workspace)/layout";
import AdminDashboardPage from "@/app/admin/(workspace)/page";
import { AdminSessionGate } from "./AdminSessionGate";

const adminSocket = vi.hoisted(() => vi.fn());
vi.mock("@/services/websocket/useAuthenticatedSocket", () => ({
  useAuthenticatedSocket: adminSocket,
}));

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
    expect(within(sidebar).getAllByRole("link")).toHaveLength(8);
    expect(within(sidebar).getByRole("link", { name: "Quản lý nội dung website" }).getAttribute("href")).toBe("/admin/website");
    expect(within(sidebar).getByRole("link", { name: "Quản lý người dùng" }).getAttribute("href")).toBe("/admin/users");
    expect(within(sidebar).getByRole("link", { name: "Nhật ký quản trị" }).getAttribute("href")).toBe("/admin/audit");
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/admin/login");
    expect((screen.getByRole("button", { name: "Đăng xuất" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "Phiên quản trị" }).textContent).toContain("Đang chờ Backend");
  });
});
