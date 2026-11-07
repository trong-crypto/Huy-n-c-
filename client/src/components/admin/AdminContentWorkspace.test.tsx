import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import hexagramFixture from "../../../../docs/examples/hexagram-tinh.response.json";
import { AdminContentWorkspace } from "./AdminContentWorkspace";
import { adminModules, type ContentModule } from "./adminModules";

function open(id: ContentModule["id"]) {
  const module = adminModules.find(item => item.id === id);
  if (!module || module.kind !== "content") throw new Error(`Missing module ${id}`);
  return render(<AdminContentWorkspace module={module} />);
}

describe("Admin content preparation without a write API", () => {
  it("filters the current methods and prepares a local edit without persisting it", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    open("methods");
    fireEvent.change(screen.getByLabelText("Nhóm phương pháp"), { target: { value: "Mai Hoa" } });
    expect(screen.queryByRole("button", { name: /Tra cứu theo dữ kiện sinh/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Tìm phương pháp"), { target: { value: "object_count" } });
    fireEvent.click(screen.getByRole("button", { name: /Theo số vật/ }));
    expect(screen.getByRole("region", { name: "Chi tiết phương pháp" }).textContent).toContain("OBJECT_COUNT");
    fireEvent.change(screen.getByLabelText("Hiển thị đề xuất"), { target: { value: "hidden" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
    expect(screen.getByRole("region", { name: "Xem trước trên trang này" }).textContent).toContain("Hiển thị đề xuất: Ẩn");
    expect((screen.getByRole("button", { name: "Lưu bản nháp" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Tìm phương pháp"), { target: { value: "unmatched" } });
    expect(screen.getByText("Không có phương pháp phù hợp.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires source provenance and states that the source list is unavailable", () => {
    open("sources");
    expect(screen.getByText(/Chưa thể tải danh sách hoặc mở chi tiết nguồn/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Đề xuất" } });
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "Ghi chú cần đối chiếu" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
    expect(screen.getByRole("alert").textContent).toBe("Vui lòng ghi nguồn hoặc xuất xứ.");
    expect(document.activeElement).toBe(screen.getByLabelText("Nguồn hoặc xuất xứ"));
  });

  it("previews website text safely and keeps review and publication disabled", () => {
    open("website");
    fireEvent.click(screen.getByRole("button", { name: "Hướng dẫn sử dụng" }));
    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
    expect(screen.getByRole("alert").textContent).toContain("Vui lòng nhập nội dung");
    fireEvent.change(screen.getByLabelText("Nội dung"), { target: { value: "<b>Văn bản</b>" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
    const preview = screen.getByRole("region", { name: "Xem trước trên trang này" });
    expect(within(preview).getByText("<b>Văn bản</b>")).toBeTruthy();
    expect(preview.querySelector("b")).toBeNull();
    expect(within(preview).getByRole("status").textContent).toContain("Chưa lưu");
    screen.getByText("Xem bước xác nhận gửi duyệt hoặc công bố").parentElement?.setAttribute("open", "");
    for (const name of ["Xác nhận gửi duyệt", "Xác nhận công bố"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("uses validated public GETs for catalog and detail, and shows an empty search", async () => {
    const { interpretations: _interpretations, ...record } = hexagramFixture.data;
    const catalog = { ...hexagramFixture, data: { items: [record], page: 0, size: 64, totalElements: 1, totalPages: 1 } };
    const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url.includes("?") ? catalog : hexagramFixture)));
    vi.stubGlobal("fetch", fetch);
    open("readings");
    fireEvent.click(await screen.findByRole("button", { name: /Tỉnh H_KHAM_TON/ }));
    const details = await screen.findByRole("region", { name: "Chi tiết quẻ công khai" });
    expect(details.textContent).toContain("Mai Hoa Dịch Số");
    expect(details.textContent).toContain("Tên đã được đối chiếu");
    fireEvent.change(screen.getByLabelText("Tìm tên hoặc mã quẻ"), { target: { value: "missing" } });
    expect(screen.getByText("Không có quẻ phù hợp với từ khóa.")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map(([url, options]) => [url, options.method, options.credentials])).toEqual([
      [expect.stringContaining("/hexagrams?q=&page=0&size=64"), "GET", "omit"],
      [expect.stringContaining("/hexagrams/H_KHAM_TON"), "GET", "omit"],
    ]);
  });

  it("reports a malformed catalog response and retries without showing fake results", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json({})));
    vi.stubGlobal("fetch", fetch);
    open("readings");
    expect((await screen.findByRole("alert")).textContent).toContain("Phản hồi không đúng hợp đồng");
    expect(screen.queryByText("0 quẻ phù hợp")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByRole("alert");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
