import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import list from "../../../../docs/examples/history-list.response.json";
import detail from "../../../../docs/examples/history-detail.response.json";
import missing from "../../../../docs/examples/history-not-found.response.json";
import deleted from "../../../../docs/examples/history-deleted.response.json";
import calculation from "../../../../docs/examples/mai-hoa-lines.response.json";
import tam from "../../../../docs/examples/d04-wealth-no-loc.response.json";
import type { CalculationResponse } from "@/types/contract";
import { isCalculationResponse } from "@/types/contractValidation";
import HistoryPage from "@/app/history/page";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { SessionProvider } from "@/services/session/SessionProvider";
import { ResultPanel } from "@/components/ResultPanel";

const csrf = "a".repeat(64);
function checkedCalculation(value: unknown) { if (!isCalculationResponse(value)) throw new Error("Invalid approved calculation fixture"); return value; }
const completedCalculation = checkedCalculation(calculation);
const session = { expiresAt: "2099-01-01T00:00:00Z", csrfToken: csrf };
const envelope = (data: unknown) => ({ requestId: list.requestId, status: "COMPLETED", data, error: null });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
let api: ReturnType<typeof vi.fn<typeof fetch>>;
let route: (url: URL, init?: RequestInit) => Promise<Response>;
beforeEach(() => {
  route = async (url, init) => {
    if (url.pathname.endsWith("/session")) return response(envelope(session));
    if (init?.method === "DELETE") return response(deleted);
    if (init?.method === "POST") return response(detail, 201);
    return response(url.pathname.endsWith("/history") ? list : detail);
  };
  api = vi.fn<typeof fetch>((url, init) => route(new URL(String(url), window.location.origin), init)); vi.stubGlobal("fetch", api);
});
const privateCalls = (method: string) => api.mock.calls.filter(([url, init]) => String(url).includes("/history") && init?.method === method);
function shell(children: React.ReactNode) { return render(<SessionProvider>{children}</SessionProvider>); }
function result(responseValue: CalculationResponse = completedCalculation, ownerRevision: number | null = 1) {
  return shell(<ResultPanel connection="connected" requestState={responseValue.status === "COMPLETED" ? "completed" : "failed"} response={responseValue} progress={[]} localError={null} historyOwnerRevision={ownerRevision} />);
}

describe("H01 save: deliberate user action only", () => {
  it("never auto-saves, sends only requestId/title and confirms after validated 201", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem"), log = vi.spyOn(console, "log");
    result(); const button = await screen.findByRole("button", { name: "Lưu kết quả" }); expect(privateCalls("POST")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Tiêu đề lịch sử (tùy chọn)"), { target: { value: "Quẻ đã chọn lưu" } }); fireEvent.click(button);
    expect(await screen.findByRole("link", { name: "Xem bản đã lưu" })).toBeTruthy();
    expect(JSON.parse(privateCalls("POST")[0][1]!.body as string)).toEqual({ calculationRequestId: calculation.requestId, title: "Quẻ đã chọn lưu" });
    expect(storage).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(document.body.textContent).not.toContain(csrf);
  });
  it("does not permit saving a result from another session generation", async () => {
    result(completedCalculation, null); await screen.findByText(/Kết quả này chưa được xác nhận thuộc phiên hiện tại/);
    expect(screen.queryByRole("button", { name: "Lưu kết quả" })).toBeNull(); expect(privateCalls("POST")).toHaveLength(0);
  });
  it("does not offer saving a failed or malformed calculation", async () => {
    result({ requestId: calculation.requestId, type: "MAI_HOA", status: "FAILED", data: null, error: { code: "INTERNAL_ERROR", message: "Error", ruleCode: null, reason: null } });
    await act(async () => {}); expect(screen.queryByRole("button", { name: "Lưu kết quả" })).toBeNull();
  });
  it("does not save or present success for malformed COMPLETED data", async () => {
    result({ ...calculation, data: {} } as unknown as CalculationResponse);
    await act(async () => {}); expect(screen.queryByRole("button", { name: "Lưu kết quả" })).toBeNull(); expect(privateCalls("POST")).toHaveLength(0);
  });
  it("rejects a valid 201 snapshot of a different calculation type", async () => {
    const original = route; route = (url, init) => init?.method === "POST" && url.pathname.endsWith("/history")
      ? Promise.resolve(response(envelope({ ...list.data.items[0], result: tam.data }), 201)) : original(url, init);
    result(); fireEvent.click(await screen.findByRole("button", { name: "Lưu kết quả" }));
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByRole("link", { name: "Xem bản đã lưu" })).toBeNull();
  });
  it("blocks duplicate save while pending, without optimistic success", async () => {
    let finish!: (value: Response) => void; const original = route;
    route = (url, init) => init?.method === "POST" && url.pathname.endsWith("/history") ? new Promise(yes => { finish = yes; }) : original(url, init);
    result(); await screen.findByRole("button", { name: "Lưu kết quả" });
    const form = screen.getByRole("form", { name: "Lưu kết quả" }); fireEvent.submit(form); fireEvent.submit(form);
    expect(privateCalls("POST")).toHaveLength(1); expect(screen.queryByText("Đã lưu thành công.")).toBeNull();
    await act(async () => finish(response(detail, 201))); expect(await screen.findByRole("link", { name: "Xem bản đã lưu" })).toBeTruthy();
  });
  it.each([[404, "NOT_FOUND"], [200, "INVALID_RESPONSE"], [403, "CSRF_REJECTED"], [401, "INVALID_SESSION"]] as const)("handles save %s/%s without success or retry", async (status, code) => {
    const original = route; route = (url, init) => init?.method === "POST" && url.pathname.endsWith("/history")
      ? Promise.resolve(response(status === 200 ? detail : { ...missing, error: { ...missing.error, code } }, status)) : original(url, init);
    result(); fireEvent.click(await screen.findByRole("button", { name: "Lưu kết quả" }));
    await waitFor(() => expect(document.body.textContent).toMatch(/không tìm thấy|không đúng hợp đồng|CSRF|Phiên không hợp lệ/i));
    expect(screen.queryByRole("link", { name: "Xem bản đã lưu" })).toBeNull(); expect(privateCalls("POST")).toHaveLength(1);
  });
});

describe("H01 history list and deletion", () => {
  it("loads official owner-filtered list only after session bootstrap", async () => {
    shell(<HistoryPage />); await screen.findByRole("link", { name: "Tra cứu Mai Hoa %_" });
    expect(String(api.mock.calls[0][0])).toContain("/session"); expect(String(api.mock.calls[1][0])).toContain("/history");
    expect(screen.getByRole("link", { name: "Luận giải Tam Thế" }).getAttribute("href")).toBe(`/history/${list.data.items[0].id}`);
  });
  it("passes title/type filters unchanged with page reset", async () => {
    shell(<HistoryPage />); await screen.findByRole("link", { name: "Tra cứu Mai Hoa %_" });
    fireEvent.change(screen.getByLabelText("Tìm theo tiêu đề"), { target: { value: "%_ có dấu" } }); fireEvent.change(screen.getByLabelText("Loại kết quả"), { target: { value: "MAI_HOA" } });
    fireEvent.submit(screen.getByRole("form", { name: "Tìm lịch sử" }));
    await waitFor(() => { const last = privateCalls("GET").at(-1)!; const params = new URL(String(last[0]), window.location.origin).searchParams; expect(Object.fromEntries(params)).toEqual({ q: "%_ có dấu", type: "MAI_HOA", page: "0", size: "20" }); });
  });
  it("shows empty history without fabricating examples", async () => {
    const original = route; route = (url, init) => url.pathname.endsWith("/history") ? Promise.resolve(response(envelope({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }))) : original(url, init);
    shell(<HistoryPage />); expect(await screen.findByText(/Phiên này chưa có lịch sử/)).toBeTruthy(); expect(screen.queryByRole("button", { name: /^Xóa / })).toBeNull();
  });
  it("supports delete cancel/confirm and does not claim success before HTTP confirmation", async () => {
    shell(<HistoryPage />); const trigger = await screen.findByRole("button", { name: "Xóa Tra cứu Mai Hoa %_" }); fireEvent.click(trigger);
    const dialog = screen.getByRole("alertdialog"); expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Hủy" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" })); expect(privateCalls("DELETE")).toHaveLength(0); expect(document.activeElement).toBe(trigger);
    let finish!: (value: Response) => void; const original = route; route = (url, init) => init?.method === "DELETE" ? new Promise(yes => { finish = yes; }) : original(url, init);
    fireEvent.click(trigger); const confirm = screen.getByRole("button", { name: "Xác nhận xóa" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(privateCalls("DELETE")).toHaveLength(1); expect(screen.queryByText("Server đã xác nhận xóa bản lịch sử.")).toBeNull();
    await act(async () => finish(response(deleted))); expect(await screen.findByText("Server đã xác nhận xóa bản lịch sử.")).toBeTruthy(); expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("retains data and reports delete failure", async () => {
    const original = route; route = (url, init) => init?.method === "DELETE" ? Promise.resolve(response({ ...missing, error: { ...missing.error, code: "DATABASE_UNAVAILABLE" } }, 503)) : original(url, init);
    shell(<HistoryPage />); fireEvent.click(await screen.findByRole("button", { name: "Xóa Tra cứu Mai Hoa %_" })); fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByRole("alertdialog")).toBeTruthy(); expect(screen.getByRole("link", { name: "Tra cứu Mai Hoa %_" })).toBeTruthy();
  });
  it("moves back a page when deleting its last item", async () => {
    let removed = false; const original = route;
    // Pagination metadata is synthetic; titles/types retain the canonical fixture values.
    const firstItems = Array.from({ length: 20 }, (_, i) => ({ ...list.data.items[i % 2], id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
    route = (url, init) => {
      if (init?.method === "DELETE") { removed = true; return Promise.resolve(response(deleted)); }
      if (url.pathname.endsWith("/history")) { const page = Number(url.searchParams.get("page")); return Promise.resolve(response(envelope({ items: page === 0 ? firstItems : [list.data.items[1]], page, size: 20, totalElements: removed ? 20 : 21, totalPages: removed ? 1 : 2 }))); }
      return original(url, init);
    };
    shell(<HistoryPage />); fireEvent.click(await screen.findByRole("button", { name: "Trang sau" }));
    await screen.findByText("21 bản lịch sử · Trang 2/2"); fireEvent.click(screen.getByRole("button", { name: "Xóa Tra cứu Mai Hoa %_" })); fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
    await screen.findByText("Server đã xác nhận xóa bản lịch sử."); await waitFor(() => expect(new URL(String(privateCalls("GET").at(-1)![0]), window.location.origin).searchParams.get("page")).toBe("0"));
  });
  it("hides private state immediately after INVALID_SESSION with no automatic rebootstrap", async () => {
    const original = route; let requests = 0;
    route = (url, init) => url.pathname.endsWith("/history") && ++requests > 1 ? Promise.resolve(response({ ...missing, error: { ...missing.error, code: "INVALID_SESSION" } }, 401)) : original(url, init);
    shell(<HistoryPage />); await screen.findByRole("link", { name: "Tra cứu Mai Hoa %_" });
    fireEvent.change(screen.getByLabelText("Tìm theo tiêu đề"), { target: { value: "new" } }); fireEvent.submit(screen.getByRole("form", { name: "Tìm lịch sử" }));
    await screen.findByText(/Phiên không hợp lệ hoặc đã hết hạn/); expect(screen.queryByRole("link", { name: "Tra cứu Mai Hoa %_" })).toBeNull();
    expect(api.mock.calls.filter(([url]) => String(url).endsWith("/session"))).toHaveLength(1);
  });
  it("ignores a stale list response after a new search", async () => {
    const original = route; let finish!: (value: Response) => void; let count = 0;
    route = (url, init) => { if (url.pathname.endsWith("/history")) { if (++count === 1) return new Promise(yes => { finish = yes; }); return Promise.resolve(response(envelope({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }))); } return original(url, init); };
    shell(<HistoryPage />); await screen.findByRole("form", { name: "Tìm lịch sử" });
    fireEvent.change(screen.getByLabelText("Tìm theo tiêu đề"), { target: { value: "none" } }); fireEvent.submit(screen.getByRole("form", { name: "Tìm lịch sử" }));
    await screen.findByText("Không có lịch sử phù hợp bộ lọc."); await act(async () => finish(response(list)));
    expect(screen.queryByRole("link", { name: "Tra cứu Mai Hoa %_" })).toBeNull();
  });
});

describe("H01 saved snapshot detail", () => {
  it("renders stored Mai Hoa and source metadata without a new calculation", async () => {
    shell(<HistoryDetailPanel id={detail.data.id} />); await screen.findByRole("heading", { name: detail.data.title, level: 1 });
    expect(screen.getAllByRole("figure")).toHaveLength(3); expect(screen.getByRole("heading", { name: "Nguồn tham chiếu" })).toBeTruthy();
    expect(api.mock.calls.every(([url]) => !String(url).includes("calculate"))).toBe(true);
  });
  it("renders the approved extended Tam The snapshot unchanged", async () => {
    const original = route; route = (url, init) => url.pathname.endsWith(list.data.items[0].id) ? Promise.resolve(response(envelope({ ...list.data.items[0], result: tam.data }))) : original(url, init);
    shell(<HistoryDetailPanel id={list.data.items[0].id} />); await screen.findByRole("region", { name: "Tiểu mục Lộc" });
    expect(screen.getByText(/Bản in không có giao điểm Lộc/)).toBeTruthy(); expect(screen.getByRole("region", { name: "Tiểu mục Sang hèn" })).toBeTruthy();
  });
  it.each([404, 401])("handles detail HTTP %s without disclosing another owner's existence", async status => {
    const original = route; route = (url, init) => url.pathname.includes("/history/") ? Promise.resolve(response({ ...missing, error: { ...missing.error, code: status === 401 ? "INVALID_SESSION" : "NOT_FOUND" } }, status)) : original(url, init);
    shell(<HistoryDetailPanel id={detail.data.id} />); await waitFor(() => expect(document.body.textContent).toMatch(/Không tìm thấy dữ liệu trong phiên|Phiên không hợp lệ/)); expect(screen.queryByRole("figure")).toBeNull();
  });
  it("rejects invalid history JSON instead of rendering a fake completed record", async () => {
    const original = route; route = (url, init) => url.pathname.includes("/history/") ? Promise.resolve(response(envelope({ ...detail.data, result: {} }))) : original(url, init);
    shell(<HistoryDetailPanel id={detail.data.id} />); expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByRole("figure")).toBeNull();
  });
});
