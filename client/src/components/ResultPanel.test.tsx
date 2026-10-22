import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultPanel } from "@/components/ResultPanel";
import type { CalculationResponse } from "@/types/contract";

const success: CalculationResponse = { requestId: "550e8400-e29b-41d4-a716-446655440000", type: "MAI_HOA", status: "COMPLETED", data: false, error: null };

describe("ResultPanel state presentation", () => {
  it("shows waiting without claiming Server accepted the request", () => {
    render(<ResultPanel connection="connected" requestState="waiting" response={null} localError={null} />);
    expect(screen.getByText("Đang chờ phản hồi...")).toBeTruthy();
    expect(screen.queryByText(/Server đang xử lý/)).toBeNull();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });

  it("shows completed only for matching terminal state and success response", () => {
    render(<ResultPanel connection="connected" requestState="completed" response={success} localError={null} />);
    expect(screen.getByText("Xử lý thành công")).toBeTruthy();
    expect(screen.getByText("false")).toBeTruthy();
  });

  it("does not render a response as success in a failed request state", () => {
    render(<ResultPanel connection="connected" requestState="failed" response={success} localError="Lỗi giao thức phía Client" />);
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
    expect(screen.getByText("Lỗi giao thức phía Client")).toBeTruthy();
  });

  it("distinguishes Server failure from local failure", () => {
    render(<ResultPanel connection="connected" requestState="failed" response={{ ...success, status: "FAILED", data: null, error: { code: "SERVER_BUSY", message: "Quá tải.", ruleCode: null } }} localError={null} />);
    expect(screen.getByText("Lỗi Server SERVER_BUSY: Quá tải.")).toBeTruthy();
    expect(screen.queryByText("Xử lý thành công")).toBeNull();
  });

  it("keeps disconnected connection and local timeout message visible", () => {
    render(<ResultPanel connection="disconnected" requestState="timeout" response={null} localError="REQUEST_TIMEOUT: Quá thời gian chờ." />);
    expect(screen.getByText("Mất kết nối")).toBeTruthy();
    expect(screen.getByText(/REQUEST_TIMEOUT/)).toBeTruthy();
  });

  it("shows initial connecting and idle presentation", () => {
    render(<ResultPanel connection="connecting" requestState="idle" response={null} localError={null} />);
    expect(screen.getByText("Đang kết nối")).toBeTruthy();
    expect(screen.getByText(/Gửi một yêu cầu/)).toBeTruthy();
  });
});
