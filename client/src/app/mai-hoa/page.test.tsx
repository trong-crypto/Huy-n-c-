import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import MaiHoaPage from "./page";
import TamThePage from "@/app/tam-the/page";
import request from "../../../../docs/examples/mai-hoa-lines.request.json";

type Socket = { connected: boolean; config: { onConnect: () => void }; publish: Mock; callbacks: Map<string, (frame: { body: string }) => void> };
const stomp = vi.hoisted(() => ({ clients: [] as Socket[] }));
vi.mock("@stomp/stompjs", () => ({
  Client: class {
    connected = false;
    activate = vi.fn();
    deactivate = vi.fn(() => Promise.resolve());
    callbacks = new Map<string, (frame: { body: string }) => void>();
    subscribe = vi.fn((destination: string, callback: (frame: { body: string }) => void) => {
      this.callbacks.set(destination, callback); return { unsubscribe: vi.fn() };
    });
    publish = vi.fn();
    constructor(public config: Socket["config"]) { stomp.clients.push(this); }
  },
}));

beforeEach(() => { stomp.clients.length = 0; vi.useFakeTimers(); });

function mount(Page = MaiHoaPage, connected = true) {
  const view = render(<Page />);
  const socket = stomp.clients[0];
  if (connected) act(() => { socket.connected = true; socket.config.onConnect(); });
  return { ...view, socket };
}
function method(value: string) {
  const names: Record<string, RegExp> = { TIME: /^Theo thời gian/, OBJECT_COUNT: /^Theo số vật/, LINES: /^Nhập sáu hào/ };
  fireEvent.click(screen.getByRole("radio", { name: names[value] }));
}
function published(socket: Socket) { return JSON.parse(socket.publish.mock.calls[0][0].body); }

describe("page integration through the existing useCalculation hook", () => {
  it.each(["", "2026-02-29T10:30", "2026-02-30T10:30", "2026-10-25T24:00", "2026-10-25T10:30:01", "broken"])("T15 rejects raw TIME %j before publish and focuses its associated error", datetime => {
    const { socket } = mount();
    const input = screen.getByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)");
    // Simulate DOM manipulation: the input boundary must not rely on native sanitization.
    input.setAttribute("type", "text");
    fireEvent.change(input, { target: { value: datetime } });
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(socket.publish).not.toHaveBeenCalled();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(input);
    const error = screen.getByRole("alert");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
  });
  it("clears TIME field feedback after correction and retains minute precision without year-range restrictions", () => {
    const { socket } = mount();
    const input = screen.getByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)");
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    fireEvent.change(input, { target: { value: "2100-01-01T00:00" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("step")).toBe("60");
    expect(input.getAttribute("min")).toBeNull(); expect(input.getAttribute("max")).toBeNull();
    expect(document.getElementById("maihoa-datetime-hint")?.textContent).toContain("không theo múi giờ của thiết bị");
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(published(socket).payload).toEqual({ method: "TIME", datetime: "2100-01-01T00:00:00+07:00", question: "" });
  });
  it.each([["1", "1"], ["999999", "12"]])("T16/T17/T21 publishes boundary %s/%s and blocks a duplicate while waiting", (count, hour) => {
    const { socket } = mount(); method("OBJECT_COUNT");
    fireEvent.change(screen.getByLabelText("Số vật đếm được"), { target: { value: count } });
    fireEvent.change(screen.getByLabelText("Giờ Chi"), { target: { value: hour } });
    const form = screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(socket.publish).toHaveBeenCalledTimes(1);
    expect(published(socket).payload).toEqual({ method: "OBJECT_COUNT", objectCount: Number(count), hourIndex: Number(hour), question: "" });
    expect((screen.getByRole("button", { name: "Đang chờ phản hồi…" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it.each(["0", "1000000", "1.5", "NaN", "Infinity", "abc", "-1", "0x10", "0b10", "0o10"])("T18–T20 rejects manipulated count %s", value => {
    const { socket } = mount(); method("OBJECT_COUNT");
    const input = screen.getByLabelText("Số vật đếm được"); input.setAttribute("type", "text");
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(socket.publish).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });
  it.each(["0", "13", "1.5", "-1", "0x1"])("T22 rejects manipulated hour %s", value => {
    const { socket } = mount(); method("OBJECT_COUNT");
    fireEvent.change(screen.getByLabelText("Số vật đếm được"), { target: { value: "12" } });
    const input = screen.getByLabelText("Giờ Chi");
    const option = document.createElement("option"); option.value = value; option.textContent = "Test invalid option"; input.appendChild(option);
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(socket.publish).not.toHaveBeenCalled(); expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
  it.each(["TIME", "OBJECT_COUNT"])("T23–T25 validates question length on %s before publishing", selectedMethod => {
    const { socket } = mount(); method(selectedMethod);
    if (selectedMethod === "TIME") fireEvent.change(screen.getByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)"), { target: { value: "2026-10-25T10:30" } });
    else fireEvent.change(screen.getByLabelText("Số vật đếm được"), { target: { value: "12" } });
    const input = screen.getByLabelText("Câu hỏi (tùy chọn)");
    fireEvent.change(input, { target: { value: "a".repeat(501) } });
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(socket.publish).not.toHaveBeenCalled(); expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
    expect((input as HTMLTextAreaElement).value).toHaveLength(501);
    fireEvent.change(input, { target: { value: "a".repeat(500) } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(published(socket).payload.question).toBe("a".repeat(500));
  });
  it("T33 keeps a real-shaped TIME unavailable failure outside the success renderer", () => {
    const { socket } = mount();
    fireEvent.change(screen.getByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)"), { target: { value: "2026-10-25T10:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    const requestId = published(socket).requestId;
    act(() => socket.callbacks.get("/user/queue/errors")!({ body: JSON.stringify({ requestId, type: "MAI_HOA", status: "FAILED", data: null, error: { code: "RULE_NOT_AVAILABLE", message: "Quy tắc hoặc dữ liệu chưa sẵn sàng để xử lý yêu cầu.", ruleCode: "MH-TIME", reason: "IMPLEMENTATION_UNAVAILABLE" } }) }));
    expect(screen.getByRole("alert").textContent).toContain("Lỗi Server RULE_NOT_AVAILABLE");
    expect(screen.queryByText("Xử lý thành công")).toBeNull(); expect(screen.queryAllByRole("figure")).toHaveLength(0);
    expect((screen.getByRole("button", { name: "Gửi yêu cầu" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("selects LINES and publishes the exact envelope/whitelist in bottom-up order", () => {
    const { socket } = mount();
    fireEvent.change(screen.getByLabelText("Câu hỏi (tùy chọn)"), { target: { value: "Must not leak into LINES" } });
    method("LINES");
    expect(screen.queryByLabelText("Câu hỏi (tùy chọn)")).toBeNull();
    expect(screen.queryByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)")).toBeNull();
    request.payload.linesBottomUp.forEach((yang, index) => {
      fireEvent.click(within(screen.getByRole("group", { name: `Hào ${index + 1}` })).getByRole("radio", { name: yang ? "Dương — nét liền" : "Âm — nét đứt" }));
    });
    fireEvent.change(screen.getByLabelText("Hào động"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(socket.publish).toHaveBeenCalledTimes(1);
    expect(socket.publish.mock.calls[0][0].destination).toBe("/app/mai-hoa/calculate");
    expect(published(socket)).toEqual({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i), type: "MAI_HOA", payload: request.payload });
    expect(Object.keys(published(socket).payload).sort()).toEqual(["linesBottomUp", "method", "movingLine"]);
    expect(JSON.stringify(published(socket))).not.toContain("question");
    expect((screen.getByRole("group", { name: "Phương pháp" }) as HTMLFieldSetElement).disabled).toBe(true);
    within(screen.getByRole("group", { name: "Phương pháp" })).getAllByRole("radio").forEach(input => expect(input.matches(":disabled")).toBe(true));
    expect(stomp.clients).toHaveLength(1); // No second Client for LINES.
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
    expect(screen.queryByRole("figure")).toBeNull(); // Full result presentation is the next checkpoint.
  });
  it("preserves TIME selection, offset serialization and optional question", () => {
    const { socket } = mount();
    expect((screen.getByRole("radio", { name: /^Theo thời gian/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)"), { target: { value: "2026-10-24T10:30" } });
    fireEvent.change(screen.getByLabelText("Câu hỏi (tùy chọn)"), { target: { value: "Test only" } });
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(published(socket).payload).toEqual({ method: "TIME", datetime: "2026-10-24T10:30:00+07:00", question: "Test only" });
  });
  it("preserves OBJECT_COUNT numeric fields and question", () => {
    const { socket } = mount();
    method("OBJECT_COUNT");
    fireEvent.change(screen.getByLabelText("Số vật đếm được"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Giờ Chi"), { target: { value: "8" } });
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(published(socket).payload).toEqual({ method: "OBJECT_COUNT", objectCount: 12, hourIndex: 8, question: "" });
  });
  it("keeps invalid OBJECT_COUNT from publishing", () => {
    const { socket } = mount();
    method("OBJECT_COUNT");
    fireEvent.change(screen.getByLabelText("Số vật đếm được"), { target: { value: "0" } });
    fireEvent.submit(screen.getByRole("form", { name: "Lập quẻ theo thời gian hoặc số vật" }));
    expect(socket.publish).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Số vật");
  });
  it("does not publish incomplete LINES", () => {
    const { socket } = mount();
    method("LINES");
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(socket.publish).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
  it("allows preparation but not submit while disconnected", () => {
    const { socket } = mount(MaiHoaPage, false);
    method("LINES");
    const first = within(screen.getByRole("group", { name: "Hào 6" })).getAllByRole("radio")[0] as HTMLInputElement;
    expect(first.disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Gửi yêu cầu" }) as HTMLButtonElement).disabled).toBe(true);
    expect(socket.publish).not.toHaveBeenCalled();
  });
  it("preserves Tam Thế payload and resetting leap month on SOLAR", () => {
    const { socket } = mount(TamThePage);
    fireEvent.change(screen.getByLabelText("Ngày sinh (YYYY-MM-DD)"), { target: { value: "2003-08-15" } });
    fireEvent.change(screen.getByLabelText("Giờ sinh (HH:mm)"), { target: { value: "08:30" } });
    fireEvent.change(screen.getByLabelText("Loại lịch"), { target: { value: "LUNAR" } });
    fireEvent.click(screen.getByLabelText("Tháng nhuận"));
    fireEvent.change(screen.getByLabelText("Loại lịch"), { target: { value: "SOLAR" } });
    expect(screen.queryByRole("checkbox", { name: "Tháng nhuận" })).toBeNull();
    fireEvent.submit(screen.getByRole("form", { name: "Thông tin sinh Tam Thế" }));
    expect(published(socket)).toMatchObject({ type: "TAM_THE", payload: { birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false } });
  });
  it("preserves Tam Thế invalid-input feedback", () => {
    const { socket } = mount(TamThePage);
    fireEvent.submit(screen.getByRole("form", { name: "Thông tin sinh Tam Thế" }));
    expect(socket.publish).not.toHaveBeenCalled();
    expect(document.getElementById("tamthe-date-error")?.textContent).toContain("YYYY-MM-DD");
    expect(screen.getByLabelText("Ngày sinh (YYYY-MM-DD)").getAttribute("aria-describedby")).toContain("tamthe-date-error");
  });
  it("preserves a LUNAR Tam Thế request with leap month", () => {
    const { socket } = mount(TamThePage);
    fireEvent.change(screen.getByLabelText("Ngày sinh (YYYY-MM-DD)"), { target: { value: "2003-08-15" } });
    fireEvent.change(screen.getByLabelText("Giờ sinh (HH:mm)"), { target: { value: "08:30" } });
    fireEvent.change(screen.getByLabelText("Loại lịch"), { target: { value: "LUNAR" } });
    fireEvent.click(screen.getByLabelText("Tháng nhuận"));
    fireEvent.submit(screen.getByRole("form", { name: "Thông tin sinh Tam Thế" }));
    expect(published(socket).payload).toEqual({ birthDate: "2003-08-15", birthTime: "08:30", calendarType: "LUNAR", isLeapMonth: true });
  });
});
