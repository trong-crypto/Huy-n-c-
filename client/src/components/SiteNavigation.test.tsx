import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteNavigation } from "./SiteNavigation";
const route = vi.hoisted(() => ({ value: "/mai-hoa" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.value }));

describe("shared navigation", () => {
  it.each(["/mai-hoa", "/tam-the", "/", "/hexagrams", "/hexagrams/H_KHAM_TON", "/calendar", "/history", "/history/905b2f9f-c230-4887-9369-7b5500964f59"])("marks only the active module for %s", pathname => {
    route.value = pathname;
    render(<SiteNavigation />);
    expect(screen.getByRole("link", { name: "Mai Hoa" }).getAttribute("aria-current")).toBe(pathname === "/mai-hoa" ? "page" : null);
    expect(screen.getByRole("link", { name: "Tam Thế" }).getAttribute("aria-current")).toBe(pathname === "/tam-the" ? "page" : null);
    expect(screen.getByRole("link", { name: "Trang chủ" }).getAttribute("aria-current")).toBe(pathname === "/" ? "page" : null);
    expect(screen.getByRole("link", { name: "Huyền Cơ — Trang chủ" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Tra cứu quẻ" }).getAttribute("aria-current")).toBe(pathname.startsWith("/hexagrams") ? "page" : null);
    expect(screen.getByRole("link", { name: "Lịch Âm – Dương" }).getAttribute("aria-current")).toBe(pathname === "/calendar" ? "page" : null);
    expect(screen.getByRole("link", { name: "Lịch sử" }).getAttribute("aria-current")).toBe(pathname.startsWith("/history") ? "page" : null);
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["#main-content", "/", "/", "/mai-hoa", "/tam-the", "/hexagrams", "/calendar", "/history"]);
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeTruthy();
  });
});
