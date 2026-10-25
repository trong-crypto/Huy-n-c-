import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import MaiHoaPage from "./page";
import TamThePage from "@/app/tam-the/page";
import request from "../../../../docs/examples/mai-hoa-lines.request.json";

type Socket = { connected: boolean; config: { onConnect: () => void }; publish: Mock };
const stomp = vi.hoisted(() => ({ clients: [] as Socket[] }));
vi.mock("@stomp/stompjs", () => ({
  Client: class {
    connected = false;
    activate = vi.fn();
    deactivate = vi.fn(() => Promise.resolve());
    subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
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
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.submit(screen.getByRole("form", { name: "Thông tin sinh Tam Thế" }));
    expect(published(socket)).toMatchObject({ type: "TAM_THE", payload: { birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false } });
  });
  it("preserves Tam Thế invalid-input feedback", () => {
    const { socket } = mount(TamThePage);
    fireEvent.submit(screen.getByRole("form", { name: "Thông tin sinh Tam Thế" }));
    expect(socket.publish).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("YYYY-MM-DD");
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
