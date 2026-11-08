# Bàn giao quản lý tài khoản Admin

Phạm vi gồm ADM-02, ADM-03 và ADM-04. Admin xem danh sách, tìm theo định danh hoặc tên hiển thị, lọc theo vai trò và trạng thái, xem chi tiết rồi xác nhận khóa hoặc mở khóa. Vai trò chỉ đọc ở màn hình này. Thao tác đổi trạng thái áp dụng cho `USER` và `CONSULTANT`. Tài khoản `ADMIN` được bảo vệ khỏi thao tác khóa ở cả giao diện và Backend.

## Hợp đồng API

| Phương thức và đường dẫn | Đầu vào | Kết quả |
| --- | --- | --- |
| `GET /api/v1/admin/accounts` | `q` tối đa 100 ký tự, `role`, `status`, `page` từ 0, `size` từ 1 đến 50, mặc định 20 | `items, page, size, totalElements, totalPages`. Sắp xếp từ mới đến cũ theo ngày tạo và ID. |
| `GET /api/v1/admin/accounts/{id}` | UUID tài khoản | `account, lastStatusChange`. Thay đổi gần nhất là `null` nếu chưa từng đổi trạng thái. |
| `PUT /api/v1/admin/accounts/{id}/status` | JSON `{"expectedVersion":1,"status":"LOCKED"}` | Chi tiết sau khi đổi trạng thái, với phiên bản tăng 1. Mở khóa dùng `ACTIVE`. |

Trường tài khoản gồm `id, identifier, displayName, role, status, version, createdAt, canChangeStatus`. Thay đổi gần nhất gồm `actorId, previousStatus, status, revokedSessions, occurredAt`. Mọi phản hồi dùng `Cache-Control: no-store` và envelope `requestId, status, data, error`.

Cần cookie của cổng Admin. Phiên khách hàng hoặc phiên tư vấn viên không cấp quyền gọi API này. PUT cần Origin được cho phép, `X-HuyenCo-Request: 1` và `X-CSRF-Token` của phiên Admin. Các mã chính gồm `400 INVALID_INPUT`, `401 INVALID_SESSION`, `403 FORBIDDEN/CSRF_REJECTED`, `404 NOT_FOUND`, `409 VERSION_CONFLICT/INVALID_TRANSITION` và `503 DATABASE_UNAVAILABLE`. Khi có xung đột, tải lại chi tiết trước khi thao tác lần nữa.

## Dữ liệu và hiệu lực

V16 bổ sung phiên bản trạng thái và bảng `admin_account_status_events`. Khóa hàng tài khoản, cập nhật trạng thái, thu hồi các phiên còn hiệu lực và ghi nhật ký diễn ra trong cùng một giao dịch. Lệnh đăng nhập lấy khóa trên cùng hàng trước khi cấp phiên. Sau khi mở khóa, người dùng đăng nhập mới để tiếp tục xem lịch sử đã lưu. Các phiên đã bị thu hồi vẫn hết hiệu lực.

## Chạy ở môi trường TEST

- Dùng database riêng đã migrate và validate tới V16. Trên máy nghiệm thu dùng `huyenco_admin_accounts_test_20261108`, Backend tại `127.0.0.1:18111`, Client tại `127.0.0.1:18110`.
- Backend dùng profile `db`, các biến `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `AUTH_ENABLED=true`, khóa `AUTH_CSRF_KEY` và `ALLOWED_ORIGINS` chứa Origin của Client. Khi kiểm qua HTTP loopback, dùng `AUTH_SECURE_COOKIE=false`.
- Client đặt `HUYENCO_API_URL` tới Backend và `NEXT_PUBLIC_ADMIN_ACCOUNTS=1` trước khi build hoặc chạy dev. Bật `NEXT_PUBLIC_ACCOUNT_HISTORY=1` để đối chiếu quyền xem lịch sử. CMS có cờ riêng `NEXT_PUBLIC_METHOD_GUIDES`.
- Đăng nhập bằng tài khoản Admin TEST tại `/admin/login`, rồi mở `/admin/users`. Nếu cần tạo Admin cho lần kiểm này, đăng ký định danh `adm16-demo` tại `/dang-ky` bằng mật khẩu bạn tự đặt. Mở Query Tool của database TEST riêng và cấp quyền cho đúng tài khoản bằng câu lệnh dưới đây. Dùng tài khoản tổng hợp khác để thử khóa.

```sql
UPDATE accounts
SET role = 'ADMIN'
WHERE current_database() = 'huyenco_admin_accounts_test_20261108'
  AND identifier_normalized = 'adm16-demo'
  AND role = 'USER'
RETURNING identifier_normalized, role;
```

## Kết quả kiểm thử ngày 08/11/2026

- Flyway áp dụng V16 và validate thành công trên database riêng. Sau khi sao chép dữ liệu tri thức, database có 64 quẻ và chưa có tài khoản hay sự kiện trạng thái. Sau đó chỉ tạo tài khoản tổng hợp cho các ca kiểm.
- 56 kiểm thử Client và 8 kiểm thử Backend liên quan đạt. Build Next.js với cờ Admin, CMS và lịch sử thành công.
- Tích hợp qua Next.js, Spring Boot và PostgreSQL đạt 36 phản hồi HTTP và 1 kết quả STOMP. Kiểm tra quyền theo cổng đăng nhập, phân trang, lọc, Origin, CSRF và từ chối khóa Admin. Hai lệnh khóa cùng phiên bản cho một phản hồi `200` và một `409`.
- Một phiên tạo và lưu kết quả Mai Hoa thật, phiên thứ hai của cùng tài khoản đọc được bản ghi. Cả hai phiên nhận `401 LOGIN_REQUIRED` sau khi khóa. Mở khóa giữ lịch sử, yêu cầu đăng nhập mới và giữ nguyên trạng thái thu hồi của hai phiên cũ. Nhật ký PostgreSQL có đúng hai sự kiện cho ca khóa/mở khóa này.
- Trên Chrome, khách bị chặn ở `/admin/users`. Admin đăng nhập, tìm theo định danh, xem chi tiết, hủy xác nhận rồi khóa và mở khóa thành công. PostgreSQL xác nhận tài khoản trở lại `ACTIVE` với phiên bản 3.
