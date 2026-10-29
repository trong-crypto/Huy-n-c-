import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HexagramDetail } from "@/types/contract";
import fixture from "../../../../docs/examples/hexagram-tinh.response.json";
import { getHexagram, LookupError } from "@/services/rest/hexagrams";
import { HexagramDetailPanel } from "./HexagramDetailPanel";

vi.mock("@/services/rest/hexagrams", async importOriginal => {
  const original = await importOriginal<typeof import("@/services/rest/hexagrams")>();
  return { ...original, getHexagram: vi.fn() };
});
const api = vi.mocked(getHexagram); const detail = fixture.data as HexagramDetail;
beforeEach(() => { api.mockReset(); api.mockResolvedValue(detail); });
describe("Phase 5 verified hexagram detail", () => {
  it("uses canonical code and renders asymmetric six lines bottom-up as six-to-one on screen", async () => {
    render(<HexagramDetailPanel code={detail.code} />);
    expect(screen.getByRole("status").textContent).toContain("Đang tải");
    expect(await screen.findByRole("heading", { name: "Tỉnh", level: 1 })).toBeTruthy();
    expect(api).toHaveBeenCalledWith("H_KHAM_TON", expect.any(AbortSignal));
    const rows = within(screen.getByRole("list", { name: "Sáu hào của Quẻ tra cứu" })).getAllByRole("listitem");
    expect(rows.map(row => row.getAttribute("data-line-number"))).toEqual(["6", "5", "4", "3", "2", "1"]);
    expect(rows.map(row => row.textContent)).toEqual(["Hào 6 — Âm", "Hào 5 — Dương", "Hào 4 — Âm", "Hào 3 — Dương", "Hào 2 — Dương", "Hào 1 — Âm"]);
    expect(screen.getByText(/Khảm/)).toBeTruthy(); expect(screen.getByText(/Tốn/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "← Về danh sách quẻ" }).getAttribute("href")).toBe("/hexagrams");
    expect(screen.queryByText("↔ Hào động")).toBeNull();
  });
  it("preserves exact approved gloss, printed label discrepancy, note and distinct name/gloss sources", async () => {
    render(<HexagramDetailPanel code={detail.code} />); await screen.findByText("Giếng nước", { exact: true });
    expect(screen.getByText("Ích", { exact: true })).toBeTruthy();
    expect(screen.getByText("Nghĩa tên đã được đối chiếu")).toBeTruthy();
    const summary = screen.getByText("Ghi chú xác minh nghĩa tên", { exact: true }); fireEvent.click(summary);
    expect(summary.closest("details")?.textContent).toContain(detail.interpretations[0].verificationNote);
    expect(screen.getByText("Nguồn tên quẻ", { exact: true })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nguồn của nghĩa tên" })).toBeTruthy();
    expect(screen.getAllByText("278", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("271", { exact: true }).length).toBeGreaterThan(0);
  });
  it("does not invent a meaning when the Server has no published interpretation", async () => {
    api.mockResolvedValue({ ...detail, interpretations: [] }); render(<HexagramDetailPanel code={detail.code} />);
    expect(await screen.findByText(/Server chưa cung cấp nghĩa tên đã được xác minh/)).toBeTruthy();
    expect(screen.queryByText("Giếng nước")).toBeNull();
  });
  it.each(["DRAFT", "SOURCE_LOCATED", "SOURCE_AMBIGUOUS", "BLOCKED_SOURCE_CONFLICT"] as const)("marks %s names honestly without promoting the figure's name", async verificationStatus => {
    api.mockResolvedValue({ ...detail, verificationStatus, interpretations: [] }); render(<HexagramDetailPanel code={detail.code} />);
    await screen.findByRole("heading", { name: "Tỉnh", level: 1 });
    expect(screen.getByText(/Bản chép phục vụ đối chiếu nguồn/)).toBeTruthy();
    expect(screen.getByText("Chưa có tên đã duyệt")).toBeTruthy();
    expect(screen.queryByText("Tên quẻ đã được đối chiếu")).toBeNull();
  });
  it("labels structural names independently of status", async () => {
    api.mockResolvedValue({ ...detail, nameKind: "STRUCTURAL_LABEL", interpretations: [] }); render(<HexagramDetailPanel code={detail.code} />);
    expect(await screen.findByText(/Nhãn cấu trúc từ nguồn/)).toBeTruthy(); expect(screen.getByText("Chưa có tên đã duyệt")).toBeTruthy();
  });
  it.each(["NOT_FOUND", "INVALID_INPUT", "DATABASE_UNAVAILABLE", "KNOWLEDGE_DATA_INCOMPLETE", "INVALID_RESPONSE"])("handles %s without partial detail", async code => {
    api.mockRejectedValue(new LookupError(code)); render(<HexagramDetailPanel code="H_KHAM_TON" />);
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByRole("figure")).toBeNull();
    expect(screen.getByRole("link", { name: "← Về danh sách quẻ" })).toBeTruthy();
  });
  it("keeps newer detail when an older code request finishes late", async () => {
    let resolve!: (detail: HexagramDetail) => void;
    api.mockReturnValueOnce(new Promise(yes => { resolve = yes; })).mockResolvedValueOnce(detail);
    const { rerender } = render(<HexagramDetailPanel code="H_CAN_CAN" />); const signal = api.mock.calls[0][1];
    rerender(<HexagramDetailPanel code={detail.code} />); await screen.findByRole("heading", { name: "Tỉnh", level: 1 });
    await act(async () => resolve({ ...detail, name: "Old result" }));
    expect(signal.aborted).toBe(true); expect(screen.queryByText("Old result")).toBeNull();
  });
});
