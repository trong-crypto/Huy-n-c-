# Bàn giao quản lý hồ sơ tư vấn viên

ADM-06 và ADM-DATA-04 cung cấp luồng Admin tạo hồ sơ cho một tài khoản đã có, tìm kiếm, xem chi tiết, duyệt hoặc từ chối. Mỗi tài khoản `USER` hoặc `CONSULTANT` có tối đa một hồ sơ. Tài khoản `ADMIN` nằm ngoài danh sách hồ sơ.

## Hợp đồng API cho TV1

Gọi cùng Origin qua proxy Client với cookie phiên Admin. Khi ghi, gửi thêm `X-HuyenCo-Request: 1` và `X-CSRF-Token` của phiên Admin. Mọi phản hồi dùng `Cache-Control: no-store` và envelope `requestId, status, data, error`.

| Phương thức và đường dẫn | Đầu vào | Kết quả |
| --- | --- | --- |
| `GET /api/v1/admin/consultants` | `q` tìm một phần tên hiển thị, tối đa 100 ký tự. `accountStatus`, `reviewStatus`, `page` từ 0, `size` từ 1 đến 50, mặc định 20 | `200`, trang `items, page, size, totalElements, totalPages`. Hồ sơ mới nhất trước, hồ sơ cũ thiếu ngày gửi ở cuối. |
| `GET /api/v1/admin/consultants/{id}` | UUID tài khoản | `200`, chi tiết hồ sơ. |
| `POST /api/v1/admin/consultants` | JSON `{"accountId":"550e8400-e29b-41d4-a716-446655440002","summary":"Giới thiệu ứng viên"}` | `201`, hồ sơ `PENDING_REVIEW`, phiên bản 1. |
| `PUT /api/v1/admin/consultants/{id}/review` | JSON `{"expectedVersion":1,"decision":"APPROVED"}` hoặc `{"expectedVersion":1,"decision":"REJECTED","reason":"Cần bổ sung giới thiệu"}` | `200`, chi tiết và phiên bản hồ sơ tăng 1. |

Mỗi mục danh sách và trường `profile` trong chi tiết đều có `accountId, displayName, role, accountStatus, reviewStatus, version, submittedAt`. Chi tiết có thêm `summary, submittedBy, reviewedBy, reviewedAt, rejectionReason` ở cùng cấp với `profile`. Hiển thị phần giới thiệu và lý do dưới dạng văn bản. Các thời điểm trả ISO 8601 UTC. Hồ sơ từ V18 có thể thiếu giới thiệu, thông tin gửi hoặc lý do từ chối, khi đó trường tương ứng trả `null`.

- `accountStatus` nhận `ACTIVE` hoặc `LOCKED`. `reviewStatus` nhận `PENDING_REVIEW`, `APPROVED` hoặc `REJECTED`. TV1 ánh xạ trạng thái xem trước `PENDING` sang `PENDING_REVIEW`.
- `summary` và lý do từ chối dài 1–500 ký tự sau khi bỏ khoảng trắng hai đầu. Gửi `reason` chỉ khi từ chối.
- Chỉ hồ sơ `PENDING_REVIEW` được xử lý. Khi có xung đột phiên bản, tải lại chi tiết. Phiên bản hồ sơ dùng cho thao tác duyệt. Phiên bản tài khoản ở ADM-05 dùng cho thao tác đổi vai trò hoặc khóa/mở khóa.
- Duyệt hồ sơ chỉ xác nhận điều kiện cấp quyền. Admin dùng API ADM-05 để cấp vai trò `CONSULTANT` cho tài khoản đang hoạt động. API hồ sơ giữ nguyên vai trò, trạng thái tài khoản và các phiên hiện có. Admin có thể xử lý hồ sơ của tài khoản bị khóa, còn cấp vai trò đợi mở khóa.

| HTTP | Mã lỗi |
| --- | --- |
| 400 | `INVALID_INPUT` |
| 401 | `INVALID_SESSION` |
| 403 | `FORBIDDEN`, `CSRF_REJECTED` |
| 404 | `NOT_FOUND` |
| 409 | `PROFILE_EXISTS`, `VERSION_CONFLICT`, `INVALID_TRANSITION` |
| 503 | `DATABASE_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` |

## PostgreSQL và môi trường TEST

V19 bổ sung phần giới thiệu, phiên bản, người và thời điểm gửi, lý do từ chối. Các giao dịch ghi khóa hàng tài khoản trước hàng hồ sơ, cùng thứ tự với ADM-05. Kết quả duyệt lưu người duyệt và thời điểm duyệt từ V18. Mỗi hồ sơ chờ duyệt nhận tối đa một quyết định.

Backend TEST tại `http://127.0.0.1:18115` dùng database riêng `huyenco_consultant_review_test_20261108`. Migrate và validate tới V19, bật profile `db` và Auth theo tài liệu 58. TV1 cần chuyển tiếp `/api/v1/admin/consultants/:path*` và dùng tài khoản Admin TEST. Có thể đăng ký tài khoản USER tổng hợp rồi tạo hồ sơ bằng API để kiểm.

### Kết quả ngày 08/11/2026

- Flyway áp dụng và validate V19. Hồ sơ bị từ chối từ V18 vẫn đọc được với lý do `null`.
- 14 kiểm thử hồi quy Backend và 55 yêu cầu HTTP trên PostgreSQL TEST đạt. Đã kiểm phiên Admin, CSRF, Origin, tìm kiếm, lọc kết hợp và phân trang.
- Hai lệnh tạo đồng thời trả `201/409`; hai lệnh duyệt cùng phiên bản trả `200/409`. SQL xác nhận đúng ba hồ sơ được xử lý và có người duyệt.
- Hồ sơ của tài khoản bị khóa được từ chối và đọc lại đúng lý do. Sau khi duyệt hồ sơ của tài khoản khác, người dùng vẫn giữ vai trò USER và phiên đang dùng. Sau thao tác ADM-05, vai trò đổi sang CONSULTANT và phiên cũ hết hiệu lực.
