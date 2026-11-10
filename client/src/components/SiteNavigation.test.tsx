import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteNavigation } from "./SiteNavigation";
const route = vi.hoisted(() => ({ value: "/mai-hoa" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.value }));

describe("shared navigation", () => {
  it.each(["/mai-hoa", "/tam-the", "/", "/phuong-phap", "/hexagrams", "/hexagrams/H_KHAM_TON", "/calendar", "/history", "/history/905b2f9f-c230-4887-9369-7b5500964f59", "/tu-van", "/tu-van/hoi-ai", "/tu-van-vien", "/dang-nhap", "/dang-ky"])("marks only the active module for %s", pathname => {
    route.value = pathname;
    render(<SiteNavigation />);
    expect(screen.getByRole("link", { name: "Trang chủ" }).getAttribute("aria-current")).toBe(pathname === "/" ? "page" : null);
    expect(screen.getByRole("link", { name: "Phương pháp" }).getAttribute("aria-current")).toBe(["/phuong-phap", "/mai-hoa", "/tam-the"].includes(pathname) ? "page" : null);
    expect(screen.getByRole("link", { name: "Huyền Cơ — Trang chủ" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Tra cứu quẻ" }).getAttribute("aria-current")).toBe(pathname.startsWith("/hexagrams") ? "page" : null);
    expect(screen.getByRole("link", { name: "Lịch Âm – Dương" }).getAttribute("aria-current")).toBe(pathname === "/calendar" ? "page" : null);
    expect(screen.getByRole("link", { name: "Lịch sử" }).getAttribute("aria-current")).toBe(pathname.startsWith("/history") ? "page" : null);
    expect(screen.getByRole("link", { name: "Tư vấn" }).getAttribute("aria-current")).toBe(["/tu-van", "/tu-van/hoi-ai", "/tu-van-vien"].includes(pathname) ? "page" : null);
    expect(screen.getByRole("link", { name: "Đăng nhập" }).getAttribute("aria-current")).toBe(pathname === "/dang-nhap" ? "page" : null);
    expect(screen.getByRole("link", { name: "Đăng ký" }).getAttribute("aria-current")).toBe(pathname === "/dang-ky" ? "page" : null);
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["#main-content", "/", "/", "/phuong-phap", "/hexagrams", "/calendar", "/history", "/tu-van", "/dang-nhap", "/dang-ky"]);
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeTruthy();
  });
});
