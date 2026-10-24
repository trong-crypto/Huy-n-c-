import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultPanel } from "@/components/ResultPanel";
import type { CalculationResponse } from "@/types/contract";

import lines from "../../../docs/examples/mai-hoa-lines.response.json";
import objects from "../../../docs/examples/mai-hoa-object-count.response.json";
import { isCalculationResponse } from "@/types/contractValidation";
function fixture(): CalculationResponse {
  if (!isCalculationResponse(lines)) throw new Error("Invalid business fixture");
  return lines;
}
const success = fixture();

describe("ResultPanel state presentation", () => {
  it("shows the team decision warning and actual progress with source metadata", () => {
    if (!isCalculationResponse(objects)) throw new Error("Invalid object-count fixture");
    render(<ResultPanel connection="connected" requestState="completed" response={objects} localError={null}
      progress={[{ requestId: objects.requestId, type: "MAI_HOA", sequence: 1, step: "ACCEPTED", message: "Server accepted" }]} />);
    expect(screen.getByText(/Kết quả tính theo quy ước nhóm/)).toBeTruthy();
    expect(screen.getByRole("list", { name: "Tiến trình xử lý" })).toBeTruthy();
    expect(screen.getByText(/DEC-20261022-MH-OBJECT-COUNT/)).toBeTruthy();
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
    expect(screen.getByText(/Gửi một yêu cầu/)).toBeTruthy();
  });
});
