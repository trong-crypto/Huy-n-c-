import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteNavigation } from "./SiteNavigation";
const route = vi.hoisted(() => ({ value: "/mai-hoa" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.value }));

describe("shared navigation", () => {
  it.each(["/mai-hoa", "/tam-the", "/"])("marks only the active module for %s", pathname => {
    route.value = pathname;
    render(<SiteNavigation />);
    expect(screen.getByRole("link", { name: "Mai Hoa" }).getAttribute("aria-current")).toBe(pathname === "/mai-hoa" ? "page" : null);
    expect(screen.getByRole("link", { name: "Tam Thế" }).getAttribute("aria-current")).toBe(pathname === "/tam-the" ? "page" : null);
    expect(screen.getByRole("link", { name: "Trang chủ" }).getAttribute("aria-current")).toBe(pathname === "/" ? "page" : null);
    expect(screen.getByRole("link", { name: "Huyền Cơ — Trang chủ" }).getAttribute("href")).toBe("/");
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["#main-content", "/", "/", "/mai-hoa", "/tam-the"]);
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeTruthy();
  });
});
