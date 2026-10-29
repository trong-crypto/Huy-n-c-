import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MaiHoaPage from "./page";
import linesRequest from "../../../../docs/examples/mai-hoa-lines.request.json";
import linesResponse from "../../../../docs/examples/mai-hoa-lines.response.json";
import objectRequest from "../../../../docs/examples/mai-hoa-object-count.request.json";
import objectResponse from "../../../../docs/examples/mai-hoa-object-count.response.json";
import timeRequest from "../../../../docs/examples/mai-hoa-time.request.json";
import timeResponse from "../../../../docs/examples/mai-hoa-time.response.json";

type Callback = (frame: { body: string }) => void;
const boundary = vi.hoisted(() => ({ callbacks: new Map<string, Callback>(), connected: false, onConnect: () => {}, publish: vi.fn() }));
vi.mock("@stomp/stompjs", () => ({ Client: class {
  get connected() { return boundary.connected; }
  constructor(config: { onConnect: () => void }) { boundary.onConnect = config.onConnect; }
  activate = vi.fn(); deactivate = vi.fn(() => Promise.resolve()); publish = boundary.publish;
  subscribe(destination: string, callback: Callback) { boundary.callbacks.set(destination, callback); return { unsubscribe: vi.fn() }; }
} }));
beforeEach(() => { boundary.callbacks.clear(); boundary.connected = false; vi.useFakeTimers(); });

describe("Mai Hoa page → existing hook/guard → premium result", () => {
  it.each([
    ["LINES", linesRequest.payload, linesResponse, "Ký tế"],
    ["OBJECT_COUNT", objectRequest.payload, objectResponse, "Dự"],
    ["TIME", timeRequest.payload, timeResponse, "Bác"],
  ] as const)("renders %s only after its correlated terminal response", (method, payload, fixture, name) => {
    render(<MaiHoaPage />);
    act(() => { boundary.connected = true; boundary.onConnect(); });
    fireEvent.click(screen.getByRole("radio", { name: method === "LINES" ? /^Nhập sáu hào/ : method === "TIME" ? /^Theo thời gian/ : /^Theo số vật/ }));
    if ("linesBottomUp" in payload) {
      payload.linesBottomUp.forEach((yang, index) => fireEvent.click(within(screen.getByRole("group", { name: `Hào ${index + 1}` })).getByRole("radio", { name: yang ? "Dương — nét liền" : "Âm — nét đứt" })));
      fireEvent.change(screen.getByLabelText("Hào động"), { target: { value: String(payload.movingLine) } });
    } else if ("objectCount" in payload) {
      fireEvent.change(screen.getByLabelText("Số vật đếm được"), { target: { value: String(payload.objectCount) } });
      fireEvent.change(screen.getByLabelText("Giờ Chi"), { target: { value: String(payload.hourIndex) } });
    } else {
      fireEvent.change(screen.getByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)"), { target: { value: payload.datetime.slice(0, 16) } });
      fireEvent.change(screen.getByLabelText("Câu hỏi (tùy chọn)"), { target: { value: payload.question } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(boundary.publish).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
    const requestId = JSON.parse(boundary.publish.mock.calls[0][0].body).requestId;
    if (method === "TIME") {
      expect(JSON.parse(boundary.publish.mock.calls[0][0].body).payload).toEqual(timeRequest.payload);
      act(() => boundary.callbacks.get("/user/queue/progress")!({ body: JSON.stringify({ requestId, type: "MAI_HOA", sequence: 1, step: "ACCEPTED", message: "Server đã nhận yêu cầu." }) }));
      expect(screen.queryByText("Xử lý thành công")).toBeNull();
      act(() => boundary.callbacks.get("/user/queue/results")!({ body: JSON.stringify({ ...fixture, requestId, type: "TAM_THE" }) }));
      expect(screen.queryAllByRole("figure")).toHaveLength(0);
    }
    act(() => boundary.callbacks.get("/user/queue/results")!({ body: JSON.stringify({ ...fixture, requestId: "550e8400-e29b-41d4-a716-446655440099" }) }));
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
    act(() => boundary.callbacks.get("/user/queue/results")!({ body: JSON.stringify({ ...fixture, requestId }) }));
    expect(screen.getAllByRole("figure")).toHaveLength(3);
    expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nguồn tham chiếu" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Các bước tính" })).toBeTruthy();
    if (method !== "LINES") expect(screen.getByRole("note")).toBeTruthy();
    if (method === "TIME") {
      expect(screen.getByRole("region", { name: "Ngày âm từ Server" }).textContent).toContain("01/01/2024");
      expect(vi.getTimerCount()).toBe(0);
    }
  });
  it("settles a matching malformed TIME terminal as failure, never as a partial result", () => {
    render(<MaiHoaPage />);
    act(() => { boundary.connected = true; boundary.onConnect(); });
    fireEvent.change(screen.getByLabelText("Thời điểm lập quẻ (giờ Việt Nam, UTC+07:00)"), { target: { value: "2024-02-10T00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    const requestId = JSON.parse(boundary.publish.mock.calls[0][0].body).requestId;
    const malformed = structuredClone(timeResponse); malformed.requestId = requestId; malformed.data.lunarDate.month = 13;
    act(() => boundary.callbacks.get("/user/queue/results")!({ body: JSON.stringify(malformed) }));
    expect(screen.getByRole("alert").textContent).toContain("không đúng hợp đồng");
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(boundary.publish).toHaveBeenCalledTimes(1);
  });
});
