import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/dang-nhap/page";
import RegistrationPage from "@/app/dang-ky/page";

const enter = (label: string, value: string) => {
  const input = screen.getByLabelText(label, { exact: true }) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  return input;
};

describe("customer registration", () => {
  it("offers only public account fields and focuses the first missing field", () => {
    render(<RegistrationPage />);
    const form = screen.getByRole("form", { name: "Đăng ký" });
    expect(screen.getByRole("heading", { name: "Đăng ký tài khoản" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("href")).toBe("/dang-nhap");
    expect(Array.from(form.querySelectorAll("input, select")).map(field => field.id)).toEqual([
      "customer-auth-displayName", "customer-auth-identifier", "customer-auth-password", "customer-auth-confirmation",
    ]);

    fireEvent.click(within(form).getByRole("button", { name: "Đăng ký" }));
    expect(within(form).getAllByRole("alert")).toHaveLength(4);
    expect(document.activeElement).toBe(screen.getByLabelText("Tên hiển thị"));
    expect(screen.getByLabelText("Tên hiển thị").getAttribute("aria-invalid")).toBe("true");
  });

  it("rejects malformed email and focuses a mismatched confirmation", () => {
    render(<RegistrationPage />);
    const button = screen.getByRole("button", { name: "Đăng ký" });
    enter("Tên hiển thị", "Khách thử");
    const identifier = enter("Tài khoản hoặc email", "sample@");
    enter("Mật khẩu", "sample one");
    const confirmation = enter("Xác nhận mật khẩu", "sample two");

    fireEvent.click(button);
    expect(screen.getByText("Vui lòng nhập email đúng định dạng.")).toBeTruthy();
    expect(document.activeElement).toBe(identifier);
    enter("Tài khoản hoặc email", "sample@example.test");
    fireEvent.click(button);
    expect(screen.getByText("Mật khẩu xác nhận chưa trùng khớp.")).toBeTruthy();
    expect(document.activeElement).toBe(confirmation);
  });

  it.each([7, 129])("rejects a registration password of %i code points and keeps it editable", (length) => {
    render(<RegistrationPage />);
    enter("Tên hiển thị", "Khách thử");
    enter("Tài khoản hoặc email", "sample-user");
    const value = "🔑".repeat(length);
    const password = enter("Mật khẩu", value);
    const confirmation = enter("Xác nhận mật khẩu", value);

    fireEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(screen.getByRole("alert").textContent).toContain("8 đến 128");
    expect(document.activeElement).toBe(password);
    expect(password.value).toBe(value);
    expect(confirmation.value).toBe(value);
  });

  it.each([8, 128])("accepts a registration password of %i Unicode code points", (length) => {
    render(<RegistrationPage />);
    enter("Tên hiển thị", "Khách thử");
    enter("Tài khoản hoặc email", "sample-user");
    const value = "🔑".repeat(length);
    enter("Mật khẩu", value);
    enter("Xác nhận mật khẩu", value);

    fireEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("chưa được gửi");
  });

  it("can show or hide confirmation independently without submitting the form", () => {
    render(<RegistrationPage />);
    const password = enter("Mật khẩu", " value with spaces ");
    const confirmation = enter("Xác nhận mật khẩu", password.value);
    fireEvent.click(screen.getByRole("button", { name: "Hiện xác nhận mật khẩu" }));
    expect(confirmation.type).toBe("text");
    expect(password.type).toBe("password");
    expect(confirmation.value).toBe(password.value);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("customer login", () => {
  it("links to registration and rejects a blank identifier and missing password", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Đăng nhập", level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Đăng ký" }).getAttribute("href")).toBe("/dang-ky");
    const identifier = enter("Tài khoản hoặc email", "   ");
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(document.activeElement).toBe(identifier);
  });

  it("toggles password visibility without altering the password or validating registration length at login", () => {
    render(<LoginPage />);
    enter("Tài khoản hoặc email", "sample-user");
    const password = enter("Mật khẩu", " 001 ");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(password.type).toBe("text");
    expect(password.value).toBe(" 001 ");
    fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(password.type).toBe("password");
    expect(password.value).toBe(" 001 ");
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("chưa được gửi");
  });
});

describe.each([
  { label: "Đăng ký", Page: RegistrationPage },
  { label: "Đăng nhập", Page: LoginPage },
])("valid customer preview form ($label)", ({ label, Page }) => {
  it("reports the backend dependency without submitting, persisting or redirecting", () => {
    const fetchRequest = vi.spyOn(globalThis, "fetch");
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    const url = window.location.href;
    render(<Page />);
    const registering = label === "Đăng ký";
    if (registering) enter("Tên hiển thị", "Khách thử");
    enter("Tài khoản hoặc email", "sample-user");
    const password = enter("Mật khẩu", "sample password");
    const confirmation = registering ? enter("Xác nhận mật khẩu", password.value) : null;

    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByRole("status").textContent).toContain("chưa được gửi");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(password.value).toBe("");
    if (confirmation) expect(confirmation.value).toBe("");
    expect(fetchRequest).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
    expect(window.location.href).toBe(url);
  });
});
