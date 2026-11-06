import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import MethodCatalogPage from "./page";

describe("public method catalog", () => {
  it("explains the input for each existing method and only links to current forms", () => {
    render(<MethodCatalogPage />);
    const maiHoa = screen.getByRole("region", { name: "Mai Hoa Dịch Số" });
    expect(within(maiHoa).getByText("Ngày và giờ lập quẻ theo giờ Việt Nam (UTC+07:00).")).toBeTruthy();
    expect(within(maiHoa).getByText("Số vật đếm được và giờ Chi.")).toBeTruthy();
    expect(within(maiHoa).getByText("Sáu hào từ dưới lên và một hào động.")).toBeTruthy();
    const tamThe = screen.getByRole("region", { name: "Diễn Cầm Tam Thế" });
    expect(within(tamThe).getByText("Ngày sinh, giờ sinh, loại lịch và nội dung muốn xem.")).toBeTruthy();
    expect(screen.getAllByText("Có biểu mẫu")).toHaveLength(2);
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
