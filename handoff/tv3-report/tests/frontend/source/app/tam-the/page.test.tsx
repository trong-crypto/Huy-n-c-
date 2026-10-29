import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import TamThePage from "./page";
import unavailable from "../../../../docs/examples/tam-the-unavailable.response.json";

type Socket = { connected: boolean; config: { onConnect: () => void; onWebSocketClose: () => void }; publish: Mock; callbacks: Map<string, (frame: { body: string }) => void> };
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
function mount(connected = true) {
  render(<TamThePage />);
  const socket = stomp.clients[0];
  if (connected) act(() => { socket.connected = true; socket.config.onConnect(); });
  return socket;
}
const date = () => screen.getByLabelText("Ngày sinh (YYYY-MM-DD)") as HTMLInputElement;
const time = () => screen.getByLabelText("Giờ sinh (HH:mm)") as HTMLInputElement;
const form = () => screen.getByRole("form", { name: "Thông tin sinh Tam Thế" });
const group = () => screen.getByRole("group", { name: "Nội dung muốn xem" });
const categoryNames = { CAREER: "Công danh", WEALTH: "Tài lộc", LOVE: "Tình duyên" };
function fill(birthDate = "2003-08-15", birthTime = "08:30") {
  fireEvent.change(date(), { target: { value: birthDate } });
  fireEvent.change(time(), { target: { value: birthTime } });
}
function selectCategories(selected: string[]) {
  for (const [value, name] of Object.entries(categoryNames)) if (!selected.includes(value)) fireEvent.click(within(group()).getByLabelText(name));
}
const sent = (socket: Socket) => JSON.parse(socket.publish.mock.calls.at(-1)![0].body);

describe("Tam The form through the existing STOMP hook", () => {
  it("starts with three checked categories and publishes the original default wire shape", () => {
    const socket = mount(); fill();
    expect(within(group()).getAllByRole("checkbox")).toHaveLength(3);
    within(group()).getAllByRole("checkbox").forEach(input => expect((input as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(socket.publish).toHaveBeenCalledTimes(1);
    expect(socket.publish.mock.calls[0][0].destination).toBe("/app/tam-the/calculate");
    expect(sent(socket)).toEqual({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i), type: "TAM_THE", payload: {
      birthDate: "2003-08-15", birthTime: "08:30", calendarType: "SOLAR", isLeapMonth: false,
    } });
  });
  it.each([["CAREER"], ["WEALTH"], ["LOVE"], ["CAREER", "WEALTH"], ["CAREER", "LOVE"], ["WEALTH", "LOVE"]])("publishes selected subset %j", (...selected) => {
    const socket = mount(); fill(); selectCategories(selected); fireEvent.submit(form());
    expect(sent(socket).payload.categories).toEqual(selected);
    expect(Object.keys(sent(socket).payload).sort()).toEqual(["birthDate", "birthTime", "calendarType", "categories", "isLeapMonth"]);
  });
  it("does not interpret all unchecked as all requested; labels toggle controls and focus the group error", () => {
    const socket = mount(); fill(); selectCategories([]); fireEvent.submit(form());
    expect(socket.publish).not.toHaveBeenCalled(); expect(document.activeElement).toBe(group());
    expect(group().getAttribute("aria-invalid")).toBe("true");
    expect(group().getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByRole("alert").id);
    fireEvent.click(within(group()).getByText("Công danh"));
    expect(screen.queryByRole("alert")).toBeNull(); fireEvent.submit(form());
    expect(sent(socket).payload.categories).toEqual(["CAREER"]);
  });
  it.each(["2025-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2003-8-15", "2003-08-15T08:30"])("rejects raw SOLAR date %s before publish", birthDate => {
    const socket = mount(); fill(birthDate); fireEvent.submit(form());
    expect(socket.publish).not.toHaveBeenCalled(); expect(document.activeElement).toBe(date());
    expect(date().getAttribute("aria-invalid")).toBe("true");
    expect(date().getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByRole("alert").id);
  });
  it("preserves a nominal lunar February 30 and its separate leap flag", () => {
    const socket = mount(); fireEvent.change(screen.getByLabelText("Loại lịch"), { target: { value: "LUNAR" } });
    fill("2025-02-30"); fireEvent.click(screen.getByLabelText("Tháng nhuận"));
    expect(document.getElementById("tamthe-date-hint")?.textContent).toContain("Server xác nhận");
    fireEvent.submit(form());
    expect(sent(socket).payload).toEqual({ birthDate: "2025-02-30", birthTime: "08:30", calendarType: "LUNAR", isLeapMonth: true });
  });
  it.each(["2026-00-01", "2026-13-01", "2026-01-00", "2026-01-31"])("rejects lunar basic range %s", birthDate => {
    const socket = mount(); fireEvent.change(screen.getByLabelText("Loại lịch"), { target: { value: "LUNAR" } });
    fill(birthDate); fireEvent.submit(form()); expect(socket.publish).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(date());
  });
  it("calendar switching resets leap selection without converting the entered date", () => {
    const socket = mount(); fill(); const calendar = screen.getByLabelText("Loại lịch");
    fireEvent.change(calendar, { target: { value: "LUNAR" } }); fireEvent.click(screen.getByLabelText("Tháng nhuận"));
    fireEvent.change(calendar, { target: { value: "SOLAR" } });
    expect(screen.queryByLabelText("Tháng nhuận")).toBeNull(); expect(date().value).toBe("2003-08-15");
    fireEvent.change(calendar, { target: { value: "LUNAR" } });
    expect((screen.getByLabelText("Tháng nhuận") as HTMLInputElement).checked).toBe(false);
    fireEvent.change(calendar, { target: { value: "SOLAR" } }); fireEvent.submit(form());
    expect(sent(socket).payload.isLeapMonth).toBe(false);
  });
  it.each(["24:00", "12:60", "1:30", "12:30:00", "12:30+07:00", "12:30Z"])("rejects DOM-manipulated time %s", birthTime => {
    const socket = mount(); fill(); time().setAttribute("type", "text");
    fireEvent.change(time(), { target: { value: birthTime } }); fireEvent.submit(form());
    expect(socket.publish).not.toHaveBeenCalled(); expect(document.activeElement).toBe(time());
    expect(time().getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByRole("alert").id);
  });
  it("rejects an injected calendar option rather than trusting a TypeScript cast", () => {
    const socket = mount(); fill(); const calendar = screen.getByLabelText("Loại lịch");
    const option = document.createElement("option"); option.value = "OTHER"; option.textContent = "Invalid test option"; calendar.appendChild(option);
    fireEvent.change(calendar, { target: { value: "OTHER" } }); fireEvent.submit(form());
    expect(socket.publish).not.toHaveBeenCalled(); expect(document.activeElement).toBe(calendar);
    expect(calendar.getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByRole("alert").id);
    fireEvent.change(calendar, { target: { value: "SOLAR" } }); expect(screen.queryByRole("alert")).toBeNull();
  });
  it("rejects an injected category value before publish", () => {
    const socket = mount(); fill(); const career = within(group()).getByLabelText("Công danh") as HTMLInputElement;
    fireEvent.click(career); career.value = "OTHER"; fireEvent.click(career); fireEvent.submit(form());
    expect(socket.publish).not.toHaveBeenCalled(); expect(group().getAttribute("aria-invalid")).toBe("true");
  });
  it("focuses the first invalid field and clears only corrected field errors", () => {
    const socket = mount(); selectCategories([]); fireEvent.submit(form());
    expect(socket.publish).not.toHaveBeenCalled(); expect(document.activeElement).toBe(date());
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    fireEvent.change(date(), { target: { value: "2025-02-30" } }); expect(screen.getAllByRole("alert")).toHaveLength(3);
    fireEvent.change(date(), { target: { value: "2024-02-29" } });
    expect(date().getAttribute("aria-invalid")).toBeNull(); expect(screen.getAllByRole("alert")).toHaveLength(2);
    fireEvent.submit(form()); expect(document.activeElement).toBe(time());
    fireEvent.change(time(), { target: { value: "00:00" } });
    expect(screen.getAllByRole("alert")).toHaveLength(1); expect(group().getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(within(group()).getByLabelText("Tình duyên")); expect(screen.queryByRole("alert")).toBeNull();
  });
  it("pending disables duplicate submit and editing while retaining all inputs", () => {
    const socket = mount(); fill(); selectCategories(["LOVE"]); fireEvent.submit(form()); fireEvent.submit(form());
    expect(socket.publish).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Đang chờ phản hồi…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(date().disabled).toBe(true); expect(time().disabled).toBe(true);
    within(group()).getAllByRole("checkbox").forEach(input => expect(input.matches(":disabled")).toBe(true));
    expect(date().value).toBe("2003-08-15"); expect(time().value).toBe("08:30");
    expect((within(group()).getByLabelText("Tình duyên") as HTMLInputElement).checked).toBe(true);
  });
  it("disconnected users may prepare inputs but cannot publish", () => {
    const socket = mount(false); fill(); selectCategories(["CAREER"]);
    expect(screen.getByText(/Đang kết nối tới Server/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Gửi yêu cầu" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(form()); expect(socket.publish).not.toHaveBeenCalled(); expect(date().disabled).toBe(false);
    act(() => { socket.config.onWebSocketClose(); });
    expect(screen.getByText(/Mất kết nối với Server/)).toBeTruthy(); expect(date().value).toBe("2003-08-15");
  });
  it("keeps a correlated real-shaped RULE_NOT_AVAILABLE response FAILED with no success renderer", () => {
    const socket = mount(); fill(); fireEvent.submit(form());
    const requestId = sent(socket).requestId;
    act(() => socket.callbacks.get("/user/queue/errors")!({ body: JSON.stringify({ ...unavailable, requestId }) }));
    expect(screen.getByRole("alert").textContent).toContain("Lỗi Server RULE_NOT_AVAILABLE");
    expect(screen.queryByText("Xử lý thành công")).toBeNull(); expect(screen.queryAllByRole("figure")).toHaveLength(0);
    expect((screen.getByRole("button", { name: "Gửi yêu cầu" }) as HTMLButtonElement).disabled).toBe(false);
    expect(date().value).toBe("2003-08-15"); expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores a foreign request, then times out without automatic resend", () => {
    const socket = mount(); fill(); fireEvent.submit(form());
    act(() => socket.callbacks.get("/user/queue/errors")!({ body: JSON.stringify({ ...unavailable, requestId: "550e8400-e29b-41d4-a716-999999999999" }) }));
    expect(screen.getByRole("button", { name: "Đang chờ phản hồi…" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.getByRole("alert").textContent).toContain("REQUEST_TIMEOUT");
    expect(socket.publish).toHaveBeenCalledTimes(1); expect(date().value).toBe("2003-08-15");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("disconnect settles pending and reconnect never resends the retained form", () => {
    const socket = mount(); fill(); fireEvent.submit(form());
    act(() => { socket.connected = false; socket.config.onWebSocketClose(); });
    expect(screen.getByRole("alert").textContent).toContain("DISCONNECTED");
    act(() => { socket.connected = true; socket.config.onConnect(); });
    expect(socket.publish).toHaveBeenCalledTimes(1); expect(date().value).toBe("2003-08-15");
    expect((screen.getByRole("button", { name: "Gửi yêu cầu" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
