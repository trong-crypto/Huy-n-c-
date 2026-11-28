# Quy trình xử lý báo cáo V43

Giao diện và API dùng luồng Chờ xử lý → Đang xem xét → Kết luận. Các quyết định khóa/cảnh cáo giữ nguyên cơ chế V42; thay đổi này không hủy hay sửa các quyết định đã lưu.

1. Danh sách chỉ có tóm tắt. Chọn một báo cáo để tải chi tiết mới nhất từ server.
2. Báo cáo PENDING có nút “Bắt đầu xem xét”. Một lần bấm chuyển sang REVIEWING, ghi lại người bắt đầu và phiên bản. Chưa cho ra quyết định ở PENDING.
3. REVIEWING tự mở tin nhắn đối chiếu. Admin kiểm tra phản ánh, hội thoại hoặc lịch sử, chọn biện pháp, nhập lý do và xác nhận đã kiểm tra thông tin trước khi mở hộp xác nhận cuối. Đây là xác nhận chủ động của admin; hệ thống không tự kết luận nội dung vi phạm.
4. Ghi chú nội bộ nằm trong mục tùy chọn, lưu vào review_note và lịch sử riêng, không được dùng làm nội dung thông báo cho người dùng. Lý do quyết định vẫn lưu ở moderation_decisions và được gửi theo cơ chế V42.
5. Sau mỗi thao tác, chi tiết được tải lại tại chỗ với phiên bản mới. Bộ lọc danh sách vẫn được giữ khi quay về. Khi xung đột hoặc lỗi tải chi tiết, admin phải tải lại trước khi xử lý tiếp.
6. RESOLVED/DISMISSED chỉ hiện kết quả, lý do, người xử lý, thời điểm và hạn khóa nếu có. Không hiển thị biểu mẫu trạng thái hoặc xử phạt.
7. “Mở lại báo cáo” mở hộp nhập lý do bắt buộc. Xác nhận chuyển thẳng sang REVIEWING, lưu lý do và người thực hiện. Không cần chuyển về PENDING; không tự hủy cảnh cáo hoặc mở khóa. Thao tác mở khóa vẫn thực hiện riêng ở quản lý tài khoản.

## Hợp đồng API

- GET `/api/v1/admin/reports/{id}`: envelope data chứa các trường báo cáo, reporter_name, target_name, target_status, review_note; quyết định mới nhất decision_action, decision_reason, decision_at, decision_expires_at, decision_actor (null nếu chưa có); review_events gồm tối đa 30 sự kiện xem xét gần nhất.
- PUT `/api/v1/admin/reports/{id}`: `{status:"REVIEWING",note,expectedVersion}`. Note bắt buộc 1–2000 ký tự. Lưu trạng thái/ghi chú/phiên bản và consultation_report_reviews trong cùng giao dịch. Stale version trả VERSION_CONFLICT; bản ghi không tồn tại trả NOT_FOUND. Không dùng API này để đóng báo cáo hoặc chuyển về PENDING.
- POST `/api/v1/admin/reports/{id}/decisions`: giữ payload V42, nhưng chỉ chấp nhận báo cáo đang REVIEWING. Thử lại cùng requestId/nội dung vẫn idempotent. Pending hoặc báo cáo đã đóng trả INVALID_TRANSITION. Giữ kiểm tra quyền admin, Origin/CSRF và phiên bản như trước.

Migration V43 thêm review_note và consultation_report_reviews, không sửa V41/V42. Sao lưu huyenco trước khi migrate. Các lý do mở lại được lưu riêng nên không ghi đè lý do quyết định trước đó.
