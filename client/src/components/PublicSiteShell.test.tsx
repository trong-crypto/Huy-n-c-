import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PublicSiteShell } from "./PublicSiteShell";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("@/services/session/SessionProvider", () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => <div data-testid="public-session">{children}</div>,
}));

describe("Public session layout boundary", () => {
  it.each(["/admin", "/admin/login"])("omits the public session and navigation on %s", pathname => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    render(<PublicSiteShell><main>Admin page</main></PublicSiteShell>);
    expect(screen.getByText("Admin page")).toBeTruthy();
    expect(screen.queryByTestId("public-session")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Điều hướng chính" })).toBeNull();
  });

  it("keeps the history route in the existing public session and shell", () => {
    vi.mocked(usePathname).mockReturnValue("/history");
    render(<PublicSiteShell><main>History page</main></PublicSiteShell>);
    expect(screen.getByTestId("public-session").textContent).toContain("History page");
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Điều hướng cuối trang" })).toBeTruthy();
  });

  it.each(["/tu-van", "/tu-van-vien"])("keeps chat route %s separate from the anonymous history session", pathname => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    render(<PublicSiteShell><main>Chat workspace</main></PublicSiteShell>);
    expect(screen.getByRole("main").textContent).toBe("Chat workspace");
    expect(screen.queryByTestId("public-session")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeTruthy();
  });

  it.each(["/dang-nhap", "/dang-ky"])("keeps %s in the public shell without bootstrapping H01", pathname => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    render(<PublicSiteShell><main>Customer account form</main></PublicSiteShell>);
    expect(screen.getByRole("main").textContent).toBe("Customer account form");
    expect(screen.queryByTestId("public-session")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Điều hướng cuối trang" })).toBeTruthy();
  });
});
