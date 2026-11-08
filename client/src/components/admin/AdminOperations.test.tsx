import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminAuditLog } from "./AdminAuditLog";
import { AdminDirectory } from "./AdminDirectory";
import { AdminMetrics } from "./AdminMetrics";
import { adminModules } from "./adminModules";

const users = adminModules[0];
const consultants = adminModules.find(module => module.id === "consultants")!;
const records = [
  { id: "u-1", name: "Mẫu A", role: "USER", status: "ACTIVE", permissions: ["Xem hồ sơ"] },
  { id: "u-2", name: "Mẫu B", role: "ADMIN", status: "LOCKED" },
] as const;
const profiles = [
  { id: "c-1", name: "Tư vấn mẫu A", role: "CONSULTANT", status: "ACTIVE", profile: { summary: "Hồ sơ tổng hợp A", review: "PENDING" } },
  { id: "c-2", name: "Tư vấn mẫu B", role: "CONSULTANT", status: "LOCKED",
    profile: { summary: "Hồ sơ tổng hợp B", review: "REJECTED", rejectionReason: "Thiếu hồ sơ mẫu" } },
] as const;

describe("Admin Phase 4 presentations", () => {
  it("starts with unavailable metrics and distinguishes loading, empty and real zero", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { rerender } = render(<AdminMetrics />);
    expect(screen.getByRole("status").textContent).toContain("Chưa có dữ liệu Backend");
    expect(screen.getAllByText("—")).toHaveLength(4);
    rerender(<AdminMetrics state={{ status: "loading" }} />);
    expect(screen.getByRole("status").textContent).toContain("Đang tải");
    rerender(<AdminMetrics state={{ status: "ready", data: null }} />);
    expect(screen.getByRole("status").textContent).toContain("Chưa có chỉ số");
    rerender(<AdminMetrics state={{ status: "ready", data: { users: 0, calculations: 4, pendingContent: 1, consultants: 2,
      methods: [{ id: "time", name: "Theo thời điểm", count: 4 }],
      services: [{ id: "worker", name: "Xử lý quẻ", status: "Sẵn sàng" }] } }} />);
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByRole("row", { name: "Theo thời điểm 4" })).toBeTruthy();
    expect(screen.getByRole("row", { name: "Xử lý quẻ Sẵn sàng" })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles generic HTTP errors and does not keep metrics visible", () => {
    render(<AdminMetrics state={{ status: "error", httpStatus: 503 }} />);
    expect(screen.getByRole("alert").textContent).toContain("Không tải được dữ liệu quản trị");
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("filters, paginates and reads details from a supplied account snapshot", () => {
    render(<AdminDirectory module={users} state={{ status: "ready", data: { records, pageSize: 1 } }} />);
    expect(screen.getByRole("status").textContent).toBe("Trang 1/2");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    fireEvent.click(screen.getByRole("button", { name: /Mẫu B/ }));
    const detail = screen.getByRole("region", { name: "Chi tiết tài khoản" });
    expect(detail.textContent).toContain("Quản trị viên (ADMIN)");
    expect(detail.textContent).toContain("Bị khóa");
    expect(within(detail).queryByLabelText("Vai trò đề xuất")).toBeNull();
    fireEvent.change(screen.getByLabelText("Lọc theo vai trò"), { target: { value: "USER" } });
    expect(screen.getByRole("button", { name: /Mẫu A/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Mẫu B/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái tài khoản"), { target: { value: "LOCKED" } });
    expect(screen.getByRole("status").textContent).toContain("Không có kết quả");
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái tài khoản"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Tìm người dùng"), { target: { value: "Mẫu A" } });
    expect(screen.getByRole("button", { name: /Mẫu A/ })).toBeTruthy();
  });

  it("previews role and status without granting permissions, mutating data or making a request", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<AdminDirectory module={users} state={{ status: "ready", data: { records, canProposeRoleChange: true } }} />);
    const record = screen.getByRole("button", { name: /Mẫu A/ });
    fireEvent.click(record);
    fireEvent.click(screen.getByRole("button", { name: "Xem trước đề xuất" }));
    expect(screen.getByRole("alert").textContent).toContain("Chọn ít nhất một thay đổi");
    fireEvent.change(screen.getByLabelText("Trạng thái tài khoản đề xuất"), { target: { value: "LOCKED" } });
    fireEvent.change(screen.getByLabelText("Vai trò đề xuất"), { target: { value: "ADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước đề xuất" }));
    expect(screen.getByText("Vai trò đề xuất: Quản trị viên")).toBeTruthy();
    expect(screen.getByText("Trạng thái đề xuất: Bị khóa")).toBeTruthy();
    expect(record.textContent).toContain("Hoạt động · Người dùng");
    expect((screen.getByRole("button", { name: "Gửi thay đổi" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("filters consultant review status, validates a rejection proposal and shows existing reasons", () => {
    render(<AdminDirectory module={consultants} state={{ status: "ready", data: { records: profiles } }} />);
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái duyệt"), { target: { value: "PENDING" } });
    fireEvent.click(screen.getByRole("button", { name: /Tư vấn mẫu A/ }));
    fireEvent.change(screen.getByLabelText("Kết quả duyệt đề xuất"), { target: { value: "APPROVED" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước đề xuất" }));
    expect(screen.getByText("Kết quả duyệt đề xuất: Đã duyệt")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Kết quả duyệt đề xuất"), { target: { value: "REJECTED" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước đề xuất" }));
    expect(screen.getByRole("alert").textContent).toContain("Nhập lý do từ chối");
    expect(document.activeElement).toBe(screen.getByLabelText("Lý do từ chối đề xuất"));
    fireEvent.change(screen.getByLabelText("Lý do từ chối đề xuất"), { target: { value: "  Lý do mẫu  " } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước đề xuất" }));
    expect(screen.getByText("Lý do: Lý do mẫu")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái duyệt"), { target: { value: "REJECTED" } });
    fireEvent.click(screen.getByRole("button", { name: /Tư vấn mẫu B/ }));
    expect(screen.getByText("Thiếu hồ sơ mẫu")).toBeTruthy();
    expect(screen.queryByText("Lý do: Lý do mẫu")).toBeNull();
  });

  it("clears directory details on 401 or 403 and separates blocked from an empty response", () => {
    const { rerender } = render(<AdminDirectory module={users} />);
    expect(screen.getByRole("status").textContent).toContain("Chưa có dữ liệu Backend");
    expect(screen.queryByRole("form")).toBeNull();
    rerender(<AdminDirectory module={users} state={{ status: "ready", data: { records: [] } }} />);
    expect(screen.getByRole("status").textContent).toBe("Danh sách chưa có bản ghi.");
    rerender(<AdminDirectory module={users} state={{ status: "ready", data: { records } }} />);
    fireEvent.click(screen.getByRole("button", { name: /Mẫu A/ }));
    rerender(<AdminDirectory module={users} state={{ status: "error", httpStatus: 401 }} />);
    expect(screen.getByRole("alert").textContent).toContain("hết hạn");
    expect(screen.getByRole("link", { name: "Về trang đăng nhập quản trị" }).getAttribute("href")).toBe("/admin/login");
    expect(screen.queryByText("Mẫu A")).toBeNull();
    rerender(<AdminDirectory module={users} state={{ status: "error", httpStatus: 403 }} />);
    expect(screen.getByRole("alert").textContent).toContain("không có quyền");
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("leaves the audit log without rows until data is supplied", () => {
    const { rerender } = render(<AdminAuditLog />);
    expect(screen.getByRole("status").textContent).toContain("Chưa có dữ liệu Backend");
    expect(screen.queryByRole("table")).toBeNull();
    rerender(<AdminAuditLog state={{ status: "ready", data: [{ id: "log-1", timeLabel: "08:00", action: "Khóa", target: "Mẫu A", actorId: "admin-a", outcome: "Thành công" }] }} />);
    expect(screen.getByRole("row", { name: "08:00 Khóa Mẫu A admin-a Thành công" })).toBeTruthy();
  });
});
