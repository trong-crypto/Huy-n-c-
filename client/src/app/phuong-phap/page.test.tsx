import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import MethodCatalogPage from "./page";

const flags = vi.hoisted(() => ({ methodGuides: false }));
vi.mock("@/config/client", async importOriginal => {
  const actual = await importOriginal<typeof import("@/config/client")>();
  return { ...actual, CLIENT_CONFIG: { ...actual.CLIENT_CONFIG, get methodGuides() { return flags.methodGuides; } } };
});
afterEach(() => { flags.methodGuides = false; });


describe("public method catalog", () => {
  it("explains the input for each existing method and only links to current forms", () => {
    render(<MethodCatalogPage />);
    const maiHoa = screen.getByRole("region", { name: "Mai Hoa Dịch Số" });
    expect(within(maiHoa).getByText("Ngày và giờ lập quẻ theo giờ Việt Nam (UTC+07:00).")).toBeTruthy();
    expect(within(maiHoa).getByText("Số vật đếm được và giờ Chi.")).toBeTruthy();
    expect(within(maiHoa).getByText("Sáu hào từ dưới lên và một hào động.")).toBeTruthy();
    expect(within(maiHoa).getByText("Trượng xích chiêm")).toBeTruthy();
    const tamThe = screen.getByRole("region", { name: "Diễn Cầm Tam Thế" });
    expect(within(tamThe).getByText("Ngày sinh, giờ sinh, loại lịch và nội dung muốn xem.")).toBeTruthy();
    expect(screen.getAllByText("Có biểu mẫu")).toHaveLength(2);
    expect(within(maiHoa).getByRole("link").closest(".method-catalog-action")).toBeTruthy();
    expect(within(tamThe).getByRole("link").closest(".method-catalog-action")).toBeTruthy();
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/mai-hoa", "/tam-the"]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("links the home page to the catalog and keeps both existing entry points", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Xem danh mục phương pháp" }).getAttribute("href")).toBe("/phuong-phap");
    expect(screen.getByRole("link", { name: /^Khám phá Mai Hoa$/ }).getAttribute("href")).toBe("/mai-hoa");
    expect(screen.getByRole("link", { name: /^Tìm hiểu Tam Thế$/ }).getAttribute("href")).toBe("/tam-the");
  });
});

it("uses the published database catalog and never advertises hidden methods", async () => {
  flags.methodGuides = true;
  const entry = { method: { code: "TRUONG_XICH", group: "MAI_HOA", name: "Trượng xích từ danh mục",
    summary: "Mô tả đã sửa", state: "LISTED", version: 2, formPath: "/mai-hoa", guideSupported: false },
    introduction: "Giới thiệu", instructions: "Cách làm", requiredInput: "Số trượng và số thước" };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json({
    requestId: "550e8400-e29b-41d4-a716-446655440001", status: "COMPLETED", error: null,
    data: { items: url.endsWith("/methods") ? [entry] : [] },
  })));
  render(<MethodCatalogPage />);
  expect(await screen.findByText(entry.method.name)).toBeTruthy();
  expect(screen.getByText(entry.method.summary)).toBeTruthy();
  expect(screen.queryByText("Theo thời gian")).toBeNull();
  expect(screen.queryByRole("region", { name: "Diễn Cầm Tam Thế" })).toBeNull();
  expect(screen.getByRole("link", { name: "Mở biểu mẫu Mai Hoa" }).getAttribute("href")).toBe("/mai-hoa");
});
