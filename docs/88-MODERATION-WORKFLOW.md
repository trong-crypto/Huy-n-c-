# Xử lý báo cáo vi phạm (V42)

Từ V43, phần bắt đầu xem xét, ghi chú và mở lại báo cáo được thay bằng quy trình tại [89-REPORT-REVIEW-FLOW.md](89-REPORT-REVIEW-FLOW.md). Các biện pháp, thời hạn khóa và thông báo V42 bên dưới vẫn áp dụng.

Admin mở Báo cáo tư vấn, đối chiếu tin nhắn và lịch sử xử lý của tài khoản trước khi chọn biện pháp. Bốn quyết định cuối: cảnh cáo, khóa tạm thời 1/7/30 ngày, khóa không thời hạn, không đủ căn cứ. Lý do bắt buộc, có hộp xác nhận tác động trước khi áp dụng. Trạng thái xem xét chỉ gồm Chờ xử lý và Đang xem xét; không đóng báo cáo trực tiếp để bỏ qua quyết định.

Mỗi quyết định có UUID yêu cầu và phiên bản báo cáo. Thử lại cùng UUID/nội dung không xử phạt hoặc gửi thông báo thêm. Thay đổi nội dung với UUID cũ bị từ chối; phiên bản cũ phải tải lại. Báo cáo đóng cần được mở lại trước khi có quyết định mới. Mở lại không hủy quyết định cũ. Admin dùng chi tiết tài khoản để mở khóa nếu cần sửa một quyết định sai; lịch sử khóa và mở khóa vẫn được giữ.

Khóa tạm tính từ thời điểm server lưu quyết định. Tác vụ kiểm tra mỗi 15 giây (lần đầu sau 1 giây khi khởi động) tự mở tài khoản khi hết hạn, xóa thời hạn và lý do hiện hành, lưu sự kiện tự mở và thông báo. Không khôi phục phiên đã thu hồi; tài khoản phải đăng nhập lại. Khi chương trình tắt, việc mở khóa được thực hiện sau khi bật lại. Admin khóa không thời hạn ở quản lý tài khoản sẽ xóa thời hạn cũ, nên không bị tác vụ tự mở nhầm. Báo cáo mới không tự gia hạn/ghi đè tài khoản đang bị khóa.

Thông báo lưu trong database; cả người dùng và tư vấn viên có hộp “Thông báo admin”, cập nhật mỗi 30 giây và khi quay lại cửa sổ, có phân trang và đánh dấu đã đọc. Người báo cáo chỉ nhận kết quả chung, không nhận lý do nội bộ hoặc thông tin riêng của tài khoản khác. Bên bị xử phạt nhận biện pháp, lý do, thời hạn nếu có, email ddaotrondz2005@gmail.com; không nhận danh tính người báo cáo. Khi bị khóa, lý do/thời hạn được hiển thị qua thông báo khóa hoặc lúc đăng nhập đúng mật khẩu. Khi mở lại có thể đăng nhập và đọc lịch sử thông báo.

## API

Giữ cookie, Origin/CSRF và envelope hiện có. V42 thêm version của báo cáo, moderation_decisions, moderation_notifications, accounts.lock_until/lock_decision_id.

- POST `/api/v1/admin/reports/{id}/decisions`: `{requestId, expectedVersion, action, note, days}`. action WARNING / TEMP_LOCK / PERMANENT_LOCK / DISMISS. days 1,7,30 cho TEMP_LOCK; 0 cho các loại khác. Trả `{saved:true}`. Quyết định, khóa, thu hồi phiên, lịch sử và hai thông báo được lưu trong cùng giao dịch.
- PUT `/api/v1/admin/reports/{id}`: `{status,note,expectedVersion}`. Chỉ PENDING / REVIEWING, tăng version. REVIEWING bắt buộc note.
- GET `/api/v1/admin/accounts/{id}/moderation?page=0`: items, 20 mục/trang; có các quyết định, tự mở khóa, các lần khóa/mở khóa thủ công; không lặp lại sự kiện khóa do cùng quyết định.
- GET `/api/v1/chat/moderation-notifications?page=0`: items (id,title,body,created_at,read_at) của chính tài khoản, unread. Không trả report_id hay danh tính người báo cáo.
- PUT `/api/v1/chat/moderation-notifications/{id}/read`: chỉ cập nhật thông báo thuộc tài khoản đang đăng nhập; đọc lại không thay đổi thời điểm đã đọc.

Sao lưu trước khi migrate V42. Không sửa V41 hoặc các migration đã chạy. Cấu hình khởi chạy vẫn dùng database huyenco và Cloudflare như hướng dẫn 82.
