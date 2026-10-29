import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HexagramRecord, Page } from "@/types/contract";
import { listHexagrams, LookupError } from "@/services/rest/hexagrams";
import list from "../../../../docs/examples/hexagrams-list.response.json";
import HexagramsPage from "./page";

// The approved fixture uses size=2. Exercise the same component at that bounded size.
vi.mock("@/config/client", async importOriginal => {
  const original = await importOriginal<typeof import("@/config/client")>();
  return { CLIENT_CONFIG: { ...original.CLIENT_CONFIG, hexagramPageSize: 2 } };
});
vi.mock("@/services/rest/hexagrams", async importOriginal => {
  const original = await importOriginal<typeof import("@/services/rest/hexagrams")>();
  return { ...original, listHexagrams: vi.fn() };
});
const api = vi.mocked(listHexagrams);
const page = list.data as Page<HexagramRecord>;
beforeEach(() => { api.mockReset(); api.mockResolvedValue(page); });
const submit = () => fireEvent.submit(screen.getByRole("form", { name: "Tìm và lọc quẻ" }));
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

describe("Phase 5 hexagram search page", () => {
  it("loads a bounded canonical page, exposes named controls and code-based links", async () => {
    render(<HexagramsPage />);
    expect(screen.getByRole("status").textContent).toContain("Đang tải");
    expect(await screen.findByRole("link", { name: "Đại súc" })).toBeTruthy();
    expect(api).toHaveBeenCalledWith({ q: "", upper: "", lower: "", page: 0, size: 2 }, expect.any(AbortSignal));
    expect(screen.getByRole("link", { name: "Cấn" }).getAttribute("href")).toBe("/hexagrams/H_CAN2_CAN2");
    expect(screen.getByLabelText("Tên hoặc mã quẻ").getAttribute("aria-describedby")).toContain("hexagram-search-hint");
    expect(screen.getByLabelText("Thượng quái")).toBeTruthy(); expect(screen.getByLabelText("Hạ quái")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trang trước" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Trang 1" }).getAttribute("aria-current")).toBe("page");
  });
  it.each(["Bĩ", "Bí", "bi", "Càn", "can", "H_KHAM_TON"])("submits %s unchanged to Server and resets page", async q => {
    render(<HexagramsPage />); await screen.findByRole("link", { name: "Cấn" });
    fireEvent.change(screen.getByLabelText("Tên hoặc mã quẻ"), { target: { value: q } }); submit();
    await waitFor(() => expect(api).toHaveBeenLastCalledWith({ q, upper: "", lower: "", page: 0, size: 2 }, expect.any(AbortSignal)));
  });
  it.each([["CAN2", ""], ["", "CAN"], ["CAN2", "CAN"]])("supports upper=%s lower=%s with combined search", async (upper, lower) => {
    render(<HexagramsPage />); await screen.findByRole("link", { name: "Cấn" });
    fireEvent.change(screen.getByLabelText("Tên hoặc mã quẻ"), { target: { value: "H_" } });
    fireEvent.change(screen.getByLabelText("Thượng quái"), { target: { value: upper } });
    fireEvent.change(screen.getByLabelText("Hạ quái"), { target: { value: lower } }); submit();
    await waitFor(() => expect(api).toHaveBeenLastCalledWith({ q: "H_", upper, lower, page: 0, size: 2 }, expect.any(AbortSignal)));
  });
  it("supports numbered/next/previous pagination, retaining applied filters rather than unsent drafts", async () => {
    api.mockImplementation(async query => ({ ...page, page: query.page }));
    render(<HexagramsPage />); await screen.findByRole("link", { name: "Cấn" });
    fireEvent.change(screen.getByLabelText("Tên hoặc mã quẻ"), { target: { value: "Cấn" } });
    fireEvent.click(screen.getByRole("button", { name: "Trang 2" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Trang 2" }).getAttribute("aria-current")).toBe("page"));
    expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ q: "", page: 1 }), expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()));
    await screen.findByRole("button", { name: "Trang trước" }); fireEvent.click(screen.getByRole("button", { name: "Trang trước" }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.anything()));
    await screen.findByRole("button", { name: "Trang 1" }); submit();
    await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ q: "Cấn", page: 0 }), expect.anything()));
  });
  it("shows an empty state without fabricating records", async () => {
    api.mockResolvedValue({ items: [], page: 0, size: 2, totalElements: 0, totalPages: 0 }); render(<HexagramsPage />);
    expect(await screen.findByText(/Không có quẻ phù hợp/)).toBeTruthy(); expect(screen.queryByRole("navigation", { name: "Phân trang quẻ" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Cấn" })).toBeNull();
  });
  it("does not let an older request replace newer results, even if abort is ignored", async () => {
    const old = deferred<Page<HexagramRecord>>(); const current = deferred<Page<HexagramRecord>>();
    api.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    render(<HexagramsPage />); const oldSignal = api.mock.calls[0][1];
    fireEvent.change(screen.getByLabelText("Tên hoặc mã quẻ"), { target: { value: "new" } }); submit();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => current.resolve({ ...page, items: [], totalElements: 0, totalPages: 0 }));
    expect(screen.getByText(/Không có quẻ phù hợp/)).toBeTruthy();
    await act(async () => old.resolve(page));
    expect(screen.queryByRole("link", { name: "Cấn" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("0 quẻ phù hợp");
  });
  it("ignores a late error from an old search", async () => {
    const old = deferred<Page<HexagramRecord>>(); api.mockReturnValueOnce(old.promise).mockResolvedValue(page);
    render(<HexagramsPage />); fireEvent.change(screen.getByLabelText("Tên hoặc mã quẻ"), { target: { value: "Cấn" } }); submit();
    await screen.findByRole("link", { name: "Cấn" }); await act(async () => old.reject(new LookupError("DATABASE_UNAVAILABLE")));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("clears filters and returns to page zero", async () => {
    render(<HexagramsPage />); await screen.findByRole("link", { name: "Cấn" });
    fireEvent.change(screen.getByLabelText("Thượng quái"), { target: { value: "CAN2" } }); submit();
    await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ upper: "CAN2" }), expect.anything()));
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith({ q: "", upper: "", lower: "", page: 0, size: 2 }, expect.anything()));
    expect((screen.getByLabelText("Thượng quái") as HTMLSelectElement).value).toBe("");
  });
  it("rejects an overlong manipulated input and focuses its associated error", async () => {
    render(<HexagramsPage />); await screen.findByRole("link", { name: "Cấn" });
    const input = screen.getByLabelText("Tên hoặc mã quẻ"); fireEvent.change(input, { target: { value: "x".repeat(101) } }); submit();
    expect(api).toHaveBeenCalledTimes(1); expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
  });
  it.each(["INVALID_INPUT", "DATABASE_UNAVAILABLE", "KNOWLEDGE_DATA_INCOMPLETE", "REQUEST_TIMEOUT", "NETWORK_ERROR", "INVALID_RESPONSE"])("presents %s and permits explicit retry", async code => {
    api.mockRejectedValueOnce(new LookupError(code)).mockResolvedValueOnce(page); render(<HexagramsPage />);
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByRole("link", { name: "Cấn" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" })); expect(await screen.findByRole("link", { name: "Cấn" })).toBeTruthy();
  });
  it("aborts in-flight GET on unmount", () => {
    api.mockReturnValue(new Promise(() => {})); const { unmount } = render(<HexagramsPage />);
    const signal = api.mock.calls[0][1]; unmount(); expect(signal.aborted).toBe(true);
  });
});
