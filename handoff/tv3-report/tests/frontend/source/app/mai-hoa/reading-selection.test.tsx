import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MaiHoaPage from "./page";
import TamThePage from "@/app/tam-the/page";
import lines from "../../../../docs/examples/mai-hoa-lines.request.json";
import objects from "../../../../docs/examples/mai-hoa-object-count.request.json";
import time from "../../../../docs/examples/mai-hoa-time.request.json";
import extended from "../../../../docs/examples/d04-wealth-matched.request.json";

const state = vi.hoisted(() => ({ connection: "connected", requestState: "idle", progress: [], response: null, localError: null, protocolNotice: null, submit: vi.fn() }));
vi.mock("@/services/websocket/useCalculation", () => ({ useCalculation: () => state }));
beforeEach(() => { state.connection = "connected"; state.requestState = "idle"; state.submit.mockClear(); });

function method(value: "TIME" | "OBJECT_COUNT" | "LINES") {
  fireEvent.click(screen.getByRole("radio", { name: value === "TIME" ? /^Theo thời gian/ : value === "OBJECT_COUNT" ? /^Theo số vật/ : /^Nhập sáu hào/ }));
}
function detail(topic = "") {
  fireEvent.click(screen.getByRole("radio", { name: "Luận giải chi tiết" }));
  if (topic) fireEvent.change(screen.getByLabelText("Chủ đề luận giải"), { target: { value: topic } });
}
function fillLines() {
  lines.payload.linesBottomUp.forEach((yang, index) => fireEvent.click(within(screen.getByRole("group", { name: `Hào ${index + 1}` }))
    .getByRole("radio", { name: yang ? "Dương — nét liền" : "Âm — nét đứt" })));
}
function fill(method: "TIME" | "OBJECT_COUNT" | "LINES") {
  if (method === "TIME") fireEvent.change(screen.getByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)"), { target: { value: time.payload.datetime.slice(0, 16) } });
  else if (method === "OBJECT_COUNT") {
    fireEvent.change(screen.getByLabelText("Số vật đếm được"), { target: { value: String(objects.payload.objectCount) } });
    fireEvent.change(screen.getByLabelText("Giờ Chi"), { target: { value: String(objects.payload.hourIndex) } });
  } else {
    fillLines(); fireEvent.change(screen.getByLabelText("Hào động"), { target: { value: String(lines.payload.movingLine) } });
  }
}
function submit() { fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" })); }
function sent() { return state.submit.mock.calls.at(-1)!; }

describe("I02 reading selection in actual Mai Hoa forms", () => {
  it("keeps legacy as default and omits reading after switching detailed mode off", () => {
    render(<MaiHoaPage />); fill("TIME"); detail("LOVE");
    fireEvent.click(screen.getByRole("radio", { name: "Chỉ lập quẻ" })); submit();
    expect(sent()).toEqual(["MAI_HOA", { method: "TIME", datetime: time.payload.datetime, question: "" }]);
    expect(sent()[1]).not.toHaveProperty("reading");
  });
  it.each(["GENERAL", "CAREER", "WEALTH", "LOVE"])("requires and sends explicit topic %s", topic => {
    render(<MaiHoaPage />); fill("TIME"); detail(topic); submit();
    expect(sent()[1].reading).toEqual({ topic });
    expect(sent()[1].reading).not.toHaveProperty("context");
  });
  it("does not infer missing topic from a free-text question and focuses the error", () => {
    render(<MaiHoaPage />); fill("TIME"); detail();
    fireEvent.change(screen.getByLabelText("Câu hỏi (tùy chọn)"), { target: { value: "Tài lộc" } }); submit();
    expect(state.submit).not.toHaveBeenCalled();
    const topic = screen.getByLabelText("Chủ đề luận giải");
    expect(document.activeElement).toBe(topic);
    expect(topic.getAttribute("aria-invalid")).toBe("true");
    expect(topic.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
  });
  it.each(["LINES", "OBJECT_COUNT"] as const)("supports detailed %s without inventing reading time", value => {
    render(<MaiHoaPage />); method(value); detail("GENERAL"); fill(value); submit();
    expect(sent()[0]).toBe("MAI_HOA");
    expect(sent()[1].method).toBe(value);
    expect(sent()[1].reading).toEqual({ topic: "GENERAL" });
    expect(sent()[1].reading).not.toHaveProperty("context");
    if (value === "LINES") expect(sent()[1].linesBottomUp).toEqual(lines.payload.linesBottomUp);
  });
  it.each(["LINES", "OBJECT_COUNT"] as const)("normalizes optional time for detailed %s", value => {
    render(<MaiHoaPage />); method(value); detail("CAREER"); fill(value);
    fireEvent.change(screen.getByLabelText("Thời điểm luận (tùy chọn, UTC+07:00)"), { target: { value: "2024-02-10T09:00" } }); submit();
    expect(sent()[1].reading).toEqual({ topic: "CAREER", context: { datetime: "2024-02-10T09:00:00+07:00" } });
  });
  it("never sends stale optional context when changing from OBJECT_COUNT to TIME", () => {
    render(<MaiHoaPage />); method("OBJECT_COUNT"); detail("LOVE");
    fireEvent.change(screen.getByLabelText("Thời điểm luận (tùy chọn, UTC+07:00)"), { target: { value: "2024-02-10T09:00" } });
    method("TIME"); fill("TIME");
    expect(screen.queryByLabelText("Thời điểm luận (tùy chọn, UTC+07:00)")).toBeNull(); submit();
    expect(sent()[1].reading).toEqual({ topic: "LOVE" });
    expect(sent()[1].datetime).toBe(time.payload.datetime);
  });
  it("rejects invalid optional context without publish and focuses its associated error", () => {
    render(<MaiHoaPage />); method("OBJECT_COUNT"); detail("GENERAL"); fill("OBJECT_COUNT");
    const context = screen.getByLabelText("Thời điểm luận (tùy chọn, UTC+07:00)");
    context.setAttribute("type", "text"); fireEvent.change(context, { target: { value: "2026-02-29T09:00" } }); submit();
    expect(state.submit).not.toHaveBeenCalled(); expect(document.activeElement).toBe(context);
    expect(context.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
  });
  it("retains LINES validation/focus before checking reading topic", () => {
    render(<MaiHoaPage />); method("LINES"); detail(); submit();
    expect(document.activeElement).toBe(within(screen.getByRole("group", { name: "Hào 6" })).getByRole("radio", { name: "Âm — nét đứt" }));
    fillLines(); submit(); expect(document.activeElement).toBe(screen.getByLabelText("Hào động"));
    fireEvent.change(screen.getByLabelText("Hào động"), { target: { value: "2" } }); submit();
    expect(document.activeElement).toBe(screen.getByLabelText("Chủ đề luận giải"));
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("disables reading edits and rejects submit while waiting", () => {
    state.requestState = "waiting"; render(<MaiHoaPage />);
    expect(screen.getByRole("radio", { name: "Luận giải chi tiết" }).matches(":disabled")).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(state.submit).not.toHaveBeenCalled();
  });
});

function fillTamThe() {
  fireEvent.change(screen.getByLabelText("Ngày sinh (YYYY-MM-DD)"), { target: { value: extended.payload.birthDate } });
  fireEvent.change(screen.getByLabelText("Giờ sinh (HH:mm)"), { target: { value: extended.payload.birthTime } });
  fireEvent.change(screen.getByLabelText("Loại lịch"), { target: { value: extended.payload.calendarType } });
}
describe("I02 explicit Tam The wealth mode", () => {
  it("defaults to basic and preserves the legacy payload shape", () => {
    render(<TamThePage />); fillTamThe(); submit();
    expect(sent()).toEqual(["TAM_THE", { birthDate: extended.payload.birthDate, birthTime: extended.payload.birthTime, calendarType: "LUNAR", isLeapMonth: false }]);
    expect(sent()[1]).not.toHaveProperty("wealthMode");
  });
  it("adds EXTENDED without changing all-category/calendar/leap-month input", () => {
    render(<TamThePage />); fillTamThe();
    fireEvent.change(screen.getByLabelText("Chế độ Tài lộc"), { target: { value: "EXTENDED" } }); submit();
    expect(sent()[1]).toEqual({ birthDate: extended.payload.birthDate, birthTime: extended.payload.birthTime, calendarType: "LUNAR", isLeapMonth: false, wealthMode: "EXTENDED" });
  });
  it("supports the real WEALTH-only request fixture", () => {
    render(<TamThePage />); fillTamThe();
    const categories = within(screen.getByRole("group", { name: "Nội dung muốn xem" }));
    fireEvent.click(categories.getByLabelText("Công danh")); fireEvent.click(categories.getByLabelText("Tình duyên"));
    fireEvent.change(screen.getByLabelText("Chế độ Tài lộc"), { target: { value: "EXTENDED" } }); submit();
    expect(sent()).toEqual(["TAM_THE", extended.payload]);
  });
  it("does not silently downgrade EXTENDED when WEALTH is unchecked", () => {
    render(<TamThePage />); fillTamThe();
    const mode = screen.getByLabelText("Chế độ Tài lộc"); fireEvent.change(mode, { target: { value: "EXTENDED" } });
    fireEvent.click(within(screen.getByRole("group", { name: "Nội dung muốn xem" })).getByLabelText("Tài lộc")); submit();
    expect(state.submit).not.toHaveBeenCalled(); expect(document.activeElement).toBe(mode);
    expect(screen.getByRole("alert").textContent).toContain("cần chọn mục Tài lộc");
    fireEvent.click(within(screen.getByRole("group", { name: "Nội dung muốn xem" })).getByLabelText("Tài lộc"));
    expect(screen.queryByRole("alert")).toBeNull(); submit(); expect(sent()[1].wealthMode).toBe("EXTENDED");
  });
  it("restores the omitted legacy flag when the user chooses basic again", () => {
    render(<TamThePage />); fillTamThe();
    fireEvent.change(screen.getByLabelText("Chế độ Tài lộc"), { target: { value: "EXTENDED" } });
    fireEvent.change(screen.getByLabelText("Chế độ Tài lộc"), { target: { value: "LEGACY" } }); submit();
    expect(sent()[1]).not.toHaveProperty("wealthMode");
  });
  it("keeps the mode disabled while waiting and removes obsolete unavailable-module guidance", () => {
    state.requestState = "waiting"; render(<TamThePage />);
    expect((screen.getByLabelText("Chế độ Tài lộc") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByText(/Module luận giải Tam Thế chưa hoàn thành/)).toBeNull();
    expect(screen.getByText(/Công danh, Tài lộc và Tình duyên đã có bảng tra/)).toBeTruthy();
  });
});
