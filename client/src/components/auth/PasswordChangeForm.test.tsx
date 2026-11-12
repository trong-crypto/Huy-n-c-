import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordChangeForm, PasswordChangedNotice } from "./PasswordChangeForm";
import { changePassword, requestPasswordChange } from "@/services/rest/passwordChange";
import { RestError } from "@/services/rest/transport";

vi.mock("@/services/rest/passwordChange", () => ({ changePassword: vi.fn(), requestPasswordChange: vi.fn() }));

const labels = ["Mật khẩu hiện tại", "Mật khẩu mới", "Xác nhận mật khẩu mới"];
function form(realm: "customer" | "admin" = "customer") {
  return render(<PasswordChangeForm realm={realm} csrfToken="test-csrf" loginUrl={realm === "admin" ? "/admin/login" : "/dang-nhap"} />);
}
function fill(current: string, next: string, confirmation: string) {
  [current, next, confirmation].forEach((value, index) => {
    fireEvent.change(screen.getByLabelText(labels[index]), { target: { value } });
  });
}
const submit = () => fireEvent.submit(screen.getByRole("form", { name: "Đổi mật khẩu" }));
afterEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });

describe("password change form", () => {
  it("queues a customer request and clears the password fields", async () => {
    vi.mocked(requestPasswordChange).mockResolvedValueOnce({ status: "PENDING" });
    form();
    fill("old", "12345678", "12345678");
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu đổi mật khẩu" }));
    expect((await screen.findByRole("status")).textContent).toContain("Đã gửi yêu cầu");
    expect(requestPasswordChange).toHaveBeenCalledWith({ currentPassword: "old", newPassword: "12345678" }, "test-csrf", expect.any(AbortSignal));
    expect(changePassword).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Mật khẩu mới") as HTMLInputElement).value).toBe("");
  });

  it("explains that a request is already pending", async () => {
    vi.mocked(requestPasswordChange).mockRejectedValueOnce(new RestError("PASSWORD_REQUEST_PENDING"));
    form();
    fill("old", "12345678", "12345678");
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu đổi mật khẩu" }));
    expect((await screen.findByRole("alert")).textContent).toContain("đang chờ Admin");
  });

  it("keeps the approval request out of the admin's own password form", () => {
    form("admin");
    expect(screen.queryByRole("button", { name: "Gửi yêu cầu đổi mật khẩu" })).toBeNull();
  });

  it("toggles each password independently", () => {
    form();
    for (const label of labels) {
      const input = screen.getByLabelText(label);
      expect(input.getAttribute("type")).toBe("password");
      fireEvent.click(screen.getByRole("button", { name: `Hiện ${label.toLocaleLowerCase("vi")}` }));
      expect(input.getAttribute("type")).toBe("text");
      fireEvent.click(screen.getByRole("button", { name: `Ẩn ${label.toLocaleLowerCase("vi")}` }));
      expect(input.getAttribute("type")).toBe("password");
    }
  });

  it("rejects invalid Unicode lengths and mismatched confirmation", () => {
    form();
    for (const length of [7, 129]) {
      const password = "🔑".repeat(length);
      fill("current", password, password);
      submit();
      expect(screen.getByText(/Mật khẩu mới cần từ 8 đến 128/)).toBeTruthy();
    }
    fill("current", "password", "different");
    submit();
    expect(screen.getByText(/Mật khẩu xác nhận chưa trùng/)).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("submits exact values once, without confirmation, and explains a wrong current password", async () => {
    let reject!: (error: unknown) => void;
    vi.mocked(changePassword).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    form("admin");
    const newPassword = " 🔑🔑🔑🔑🔑🔑 ";
    fill(" old ", newPassword, newPassword);
    submit();
    submit();
    expect(changePassword).toHaveBeenCalledTimes(1);
    expect(changePassword).toHaveBeenCalledWith("admin", { currentPassword: " old ", newPassword },
      "test-csrf", expect.any(AbortSignal));
    expect((screen.getByRole("button", { name: "Đang lưu…" }).closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    reject(new RestError("INVALID_CREDENTIALS"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Mật khẩu hiện tại không đúng."));
  });

  it("asks for a new login when the session is invalid", async () => {
    vi.mocked(requestPasswordChange).mockRejectedValueOnce(new RestError("INVALID_SESSION"));
    form();
    fill("old", "12345678", "12345678");
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu đổi mật khẩu" }));
    expect((await screen.findByRole("link", { name: "Đăng nhập lại" })).getAttribute("href")).toBe("/dang-nhap");
    expect((screen.getByRole("button", { name: "Gửi yêu cầu đổi mật khẩu" }).closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
  });

  it("shows the login notice after a completed change", () => {
    window.history.replaceState({}, "", "/dang-nhap?passwordChanged=1");
    render(<PasswordChangedNotice />);
    expect(screen.getByRole("status").textContent).toContain("Đã đổi mật khẩu");
  });
});
