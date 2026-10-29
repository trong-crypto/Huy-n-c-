import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultPanel } from "@/components/ResultPanel";
import type { CalculationResponse } from "@/types/contract";

import lines from "../../../docs/examples/mai-hoa-lines.response.json";
import objects from "../../../docs/examples/mai-hoa-object-count.response.json";
import timeFixture from "../../../docs/examples/mai-hoa-time.response.json";
import { isCalculationResponse } from "@/types/contractValidation";
function fixture(): CalculationResponse {
  if (!isCalculationResponse(lines)) throw new Error("Invalid business fixture");
  return lines;
}
const success = fixture();

describe("ResultPanel state presentation", () => {
  it("routes the canonical TIME terminal to three hexagrams with one warning and collapsed technical JSON", () => {
    if (!isCalculationResponse(timeFixture)) throw new Error("Invalid TIME fixture");
    render(<ResultPanel connection="connected" requestState="completed" response={timeFixture} progress={[]} localError={null} />);
    expect(screen.getAllByRole("figure")).toHaveLength(3);
    expect(screen.getAllByRole("note")).toHaveLength(1);
    expect(screen.getByRole("note").textContent).toContain("đã được chủ dự án duyệt");
    const technical = screen.getByText("Thông tin kỹ thuật", { selector: "summary" }).closest("details")!;
    expect(technical.open).toBe(false);
    expect(within(technical).getByText(`requestId: ${timeFixture.requestId}`)).toBeTruthy();
    const json = screen.getByText(/"method": "TIME"/);
    expect(json.closest("details")?.open).toBe(false);
    expect(technical.contains(json)).toBe(true);
    expect(screen.getByText("Xử lý thành công")).toBeTruthy();
  });
  it("rejects malformed TIME before rendering any success or lunar summary", () => {
    const malformed = { ...timeFixture, data: { ...timeFixture.data, lunarDate: null } } as unknown as CalculationResponse;
    render(<ResultPanel connection="connected" requestState="completed" response={malformed} progress={[]} localError={null} />);
    expect(screen.getByRole("alert").textContent).toContain("không đúng hợp đồng");
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "Ngày âm từ Server" })).toBeNull();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });
  it("keeps TIME FAILED in the error presentation without a result fallback", () => {
    render(<ResultPanel connection="connected" requestState="failed" progress={[]} localError={null}
      response={{ requestId: timeFixture.requestId, type: "MAI_HOA", status: "FAILED", data: null,
        error: { code: "INVALID_DATE", message: "Ngày ngoài phạm vi hỗ trợ.", ruleCode: null, reason: null } }} />);
    expect(screen.getByRole("alert").textContent).toContain("INVALID_DATE");
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });
  it("T27 announces only the latest progress and identifies its current step without making the history live", () => {
    const first = { requestId: success.requestId!, type: "MAI_HOA" as const, sequence: 1, step: "ACCEPTED" as const, message: "Server đã nhận yêu cầu." };
    const second = { ...first, sequence: 2, step: "VALIDATING" as const, message: "Đang kiểm tra đầu vào." };
    const props = { connection: "connected" as const, requestState: "waiting" as const, response: null, localError: null };
    const { rerender } = render(<ResultPanel {...props} progress={[first]} />);
    const announcement = screen.getByRole("status", { name: "Cập nhật yêu cầu" });
    expect(announcement.textContent).toBe("Bước 1: Server đã nhận yêu cầu.");
    rerender(<ResultPanel {...props} progress={[first, second]} />);
    expect(announcement.textContent).toBe("Bước 2: Đang kiểm tra đầu vào.");
    expect(announcement.textContent).not.toContain(first.message);
    const history = screen.getByRole("list", { name: "Tiến trình xử lý" });
    expect(history.getAttribute("aria-live")).toBe("off");
    expect(history.closest("section")?.hasAttribute("aria-live")).toBe(false);
    const items = within(history).getAllByRole("listitem");
    expect(items.map(item => item.getAttribute("aria-current"))).toEqual([null, "step"]);
    rerender(<ResultPanel connection="connected" requestState="completed" response={success} localError={null} progress={[first, second]} />);
    expect(announcement.textContent).toBe("Yêu cầu đã xử lý thành công.");
    expect(announcement.textContent).not.toContain("ruleVersion");
    expect(within(history).getAllByRole("listitem").every(item => !item.hasAttribute("aria-current"))).toBe(true);
  });
  it("LOOKUP is a current progress step, never a successful terminal", () => {
    render(<ResultPanel connection="connected" requestState="waiting" response={null} localError={null}
      progress={[{ requestId: success.requestId!, type: "MAI_HOA", sequence: 4, step: "LOOKUP", message: "Đang tra dữ liệu." }]} />);
    expect(screen.getByRole("status", { name: "Cập nhật yêu cầu" }).textContent).toBe("Bước 4: Đang tra dữ liệu.");
    expect(screen.getByText("Đang chờ phản hồi...")).toBeTruthy();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
    expect(screen.queryAllByRole("figure")).toHaveLength(0);
  });
  it("E07 renders a fixed generic error for unknown Server codes, escaping nothing into HTML", () => {
    render(<ResultPanel progress={[]} connection="connected" requestState="failed" localError={null}
      response={{ requestId: success.requestId, type: "MAI_HOA", status: "FAILED", data: null,
        error: { code: "<script>future</script>", message: "private echoed input", ruleCode: null, reason: "FUTURE" } }} />);
    expect(screen.getByText(/Lỗi Server: Server trả về lỗi chưa được Client nhận diện/)).toBeTruthy();
    expect(screen.queryByText("private echoed input")).toBeNull();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
  it("E08 preserves Server PROCESSING_TIMEOUT as a Server failure", () => {
    render(<ResultPanel progress={[]} connection="connected" requestState="failed" localError={null}
      response={{ requestId: success.requestId, type: "MAI_HOA", status: "FAILED", data: null,
        error: { code: "PROCESSING_TIMEOUT", message: "Hết thời gian xử lý.", ruleCode: null, reason: "FUTURE_REASON" } }} />);
    expect(screen.getByText("Lỗi Server PROCESSING_TIMEOUT: Hết thời gian xử lý.")).toBeTruthy();
    expect(screen.queryByText(/REQUEST_TIMEOUT/)).toBeNull();
  });
  it("E11 keeps the generic notice separate from a completed result", () => {
    render(<ResultPanel progress={[]} connection="connected" requestState="completed" response={success} localError={null} protocolNotice="Thông báo lỗi chung, chưa gắn với yêu cầu." />);
    expect(screen.getByRole("status", { name: "Thông báo giao thức chung" }).textContent).toBe("Thông báo lỗi chung, chưa gắn với yêu cầu.");
    expect(screen.getByText("Xử lý thành công")).toBeTruthy();
    expect(screen.getAllByRole("figure")).toHaveLength(3);
  });
  it("shows the team decision warning and actual progress with source metadata", () => {
    if (!isCalculationResponse(objects)) throw new Error("Invalid object-count fixture");
    render(<ResultPanel connection="connected" requestState="completed" response={objects} localError={null}
      progress={[{ requestId: objects.requestId, type: "MAI_HOA", sequence: 1, step: "ACCEPTED", message: "Server accepted" }]} />);
    expect(screen.getByText(/Kết quả tính theo quy ước nhóm/)).toBeTruthy();
    expect(screen.getByRole("list", { name: "Tiến trình xử lý" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Quyết định nhóm của phép tính" })).getByText("DEC-20261022-MH-OBJECT-COUNT")).toBeTruthy();
  });

  it("shows waiting without claiming Server accepted the request", () => {
    render(<ResultPanel progress={[]} connection="connected" requestState="waiting" response={null} localError={null} />);
    expect(screen.getByText("Đang chờ phản hồi...")).toBeTruthy();
    expect(screen.queryByText(/Server đang xử lý/)).toBeNull();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });

  it("shows completed only for matching terminal state and success response", () => {
    render(<ResultPanel progress={[]} connection="connected" requestState="completed" response={success} localError={null} />);
    expect(screen.getByText("Xử lý thành công")).toBeTruthy();
    expect(screen.getByText(/"name": "Ký tế"/)).toBeTruthy();
  });

  it("does not render a response as success in a failed request state", () => {
    render(<ResultPanel progress={[]} connection="connected" requestState="failed" response={success} localError="Lỗi giao thức phía Client" />);
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
    expect(screen.getByText("Lỗi giao thức phía Client")).toBeTruthy();
  });

  it("distinguishes Server failure from local failure", () => {
    render(<ResultPanel progress={[]} connection="connected" requestState="failed" response={{ ...success, status: "FAILED", data: null, error: { code: "SERVER_BUSY", message: "Quá tải.", ruleCode: null, reason: null } }} localError={null} />);
    expect(screen.getByText("Lỗi Server SERVER_BUSY: Quá tải.")).toBeTruthy();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });

  it("keeps disconnected connection and local timeout message visible", () => {
    render(<ResultPanel progress={[]} connection="disconnected" requestState="timeout" response={null} localError="REQUEST_TIMEOUT: Quá thời gian chờ." />);
    expect(screen.getByText("Mất kết nối")).toBeTruthy();
    expect(screen.getByText(/REQUEST_TIMEOUT/)).toBeTruthy();
  });

  it("shows initial connecting and idle presentation", () => {
    render(<ResultPanel progress={[]} connection="connecting" requestState="idle" response={null} localError={null} />);
    expect(screen.getByText("Đang kết nối")).toBeTruthy();
    expect(screen.getByText("Nhập thông tin và gửi yêu cầu để xem tiến trình cùng kết quả.")).toBeTruthy();
  });
});
