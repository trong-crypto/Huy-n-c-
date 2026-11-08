# Bàn giao quản lý vai trò tài khoản

ADM-05 và ADM-DATA-03 bổ sung đổi vai trò giữa `USER` và `CONSULTANT`. Tài khoản phải đang hoạt động. Khi cấp `CONSULTANT`, hồ sơ tương ứng phải có trạng thái `APPROVED` trong PostgreSQL. Khi thu hồi quyền tư vấn, vai trò trở về `USER` và quyết định duyệt hồ sơ được giữ để quản lý độc lập. Tài khoản `ADMIN` được bảo vệ, kể cả tài khoản đang thực hiện thao tác. Việc cấp và thu hồi quyền Admin theo quy trình riêng.

## Hợp đồng API cho TV1

`PUT /api/v1/admin/accounts/{id}/role` nhận UUID tài khoản và JSON `{"expectedVersion":3,"role":"CONSULTANT"}`. Để thu hồi quyền tư vấn, gửi `role:"USER"`. Dùng cùng Origin qua tuyến proxy tài khoản hiện có của Next.js, cookie phiên Admin, `X-HuyenCo-Request: 1` và `X-CSRF-Token` của phiên Admin.

HTTP 200 dùng envelope `requestId, status, data, error` với `status:"COMPLETED"`. Chi tiết trong `data` gồm:

- `account` với vai trò mới và `version` tăng 1. Trường `version` dùng chung cho đổi vai trò và khóa/mở khóa.
- `lastStatusChange` giữ sự kiện khóa/mở khóa gần nhất, nếu có.
- `lastRoleChange` gồm `actorId, previousRole, role, revokedSessions, occurredAt`. Trả `null` trước lần đổi đầu tiên.
- `allowedRoleChanges` chứa vai trò đích có thể chọn tại thời điểm đọc. Mảng rỗng khi không có thao tác khả dụng. Server kiểm tra lại khi ghi.

`GET /api/v1/admin/accounts/{id}` và phản hồi cập nhật trạng thái cũng trả hai trường mới `lastRoleChange` và `allowedRoleChanges`. Các trường hiện có giữ nguyên tên. Dùng dữ liệu mới từ phản hồi để cập nhật Client hoặc tải lại chi tiết sau xung đột. Tất cả phản hồi quản trị dùng `Cache-Control: no-store`.

| HTTP | Mã lỗi | Ý nghĩa |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | UUID, JSON, vai trò hoặc phiên bản sai định dạng. |
| 401 | `INVALID_SESSION` | Thiếu phiên Admin hợp lệ. |
| 403 | `FORBIDDEN`, `CSRF_REJECTED` | Thao tác chạm quyền Admin hoặc bị chặn bởi Origin/CSRF. |
| 404 | `NOT_FOUND` | Tài khoản đích không tồn tại. |
| 409 | `VERSION_CONFLICT` | Phiên bản đã thay đổi. Tải lại chi tiết trước khi thử lại. |
| 409 | `INVALID_TRANSITION`, `ACCOUNT_LOCKED`, `CONSULTANT_APPROVAL_REQUIRED` | Vai trò trùng, tài khoản bị khóa hoặc hồ sơ chưa được duyệt. |
| 503 | `DATABASE_UNAVAILABLE` | Kho tài khoản tạm thời không khả dụng. |

## Dữ liệu và phiên

V18 tạo `consultant_profiles` để xác nhận điều kiện cấp quyền và `admin_account_role_events` để ghi nhật ký. Đổi vai trò, tăng phiên bản, thu hồi phiên còn hiệu lực và ghi sự kiện diễn ra trong cùng một giao dịch. Người dùng phải đăng nhập lại để nhận vai trò mới. Lịch sử vẫn gắn với ID tài khoản. Tài khoản tư vấn viên đã tồn tại trước V18 có thể được hạ về USER, còn cấp lại quyền vẫn yêu cầu hồ sơ được duyệt.

ADM-06 sẽ bổ sung luồng hồ sơ và duyệt/từ chối. Các giao dịch ghi hồ sơ ở bước đó cần khóa hàng `accounts` trước hàng `consultant_profiles`, cùng thứ tự với thao tác cấp vai trò.

## Môi trường TEST

Backend tại `http://127.0.0.1:18114` kết nối database riêng `huyenco_admin_roles_test_20261108`. Chạy profile `db`, bật `AUTH_ENABLED` và migrate/validate tới V18. Dùng các biến môi trường DB, Auth và Origin theo tài liệu 58. Hồ sơ đã duyệt trong lượt kiểm là dữ liệu tổng hợp được tạo bằng SQL trên database TEST này.

### Kết quả ngày 08/11/2026

- Flyway migrate và validate V18 thành công. 14 kiểm thử hồi quy Backend đạt.
- Nghiệm thu với Backend thật đạt 44 yêu cầu HTTP và 1 lượt STOMP. Khách, phiên khách hàng, Origin sai và CSRF sai đều bị từ chối. Kiểm riêng việc tự đổi quyền, đổi quyền Admin khác, cấp quyền Admin và dữ liệu yêu cầu sai.
- Chỉ cấp quyền tư vấn sau khi hồ sơ được duyệt. Hồ sơ thiếu, đang chờ, bị từ chối hoặc tài khoản bị khóa đều bị chặn. Hai yêu cầu đổi quyền cùng phiên bản cho đúng một phản hồi 200 và một 409. Yêu cầu khóa dùng phiên bản cũ cũng nhận 409.
- PostgreSQL ghi đúng hai lần đổi vai trò. Lần cấp quyền thu hồi 2 phiên và lần thu hồi quyền tư vấn thu hồi 1 phiên. Người dùng đăng nhập lại nhận vai trò mới và vẫn đọc được bản ghi Mai Hoa đã lưu. Sự kiện khóa/mở khóa gần nhất tiếp tục xuất hiện trong chi tiết tài khoản.
