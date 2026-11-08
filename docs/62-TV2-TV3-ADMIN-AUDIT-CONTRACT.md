# Bàn giao nhật ký quản trị

ADM-07 và ADM-DATA-05 cung cấp API đọc chung cho các sự kiện đã lưu của CMS bài hướng dẫn, khóa/mở khóa tài khoản, đổi vai trò và hồ sơ tư vấn viên. V20 tạo view `admin_audit_events` trên các nguồn hiện có. Nhật ký đọc được cả các sự kiện đã có trước V20, cùng mã sự kiện ổn định giữa các lần tải.

## API cho TV1

`GET /api/v1/admin/audit` yêu cầu cookie phiên Admin. Gọi qua cùng Origin với `credentials: "same-origin"`. Khi request có Origin, Server đối chiếu danh sách cho phép. GET dùng `Cache-Control: no-store` và envelope `requestId, status, data, error`.

| Tham số tùy chọn | Ý nghĩa |
| --- | --- |
| `targetType` | `METHOD_GUIDE`, `ACCOUNT` hoặc `CONSULTANT_PROFILE`. |
| `targetId` | UUID tài khoản cho hai nhóm tài khoản/hồ sơ. Mã `TIME`, `OBJECT_COUNT`, `LINES` hoặc `TAM_THE` cho bài hướng dẫn. |
| `action` | CMS dùng `CREATE`, `SAVE_DRAFT`, `SUBMIT_REVIEW`, `RETURN_TO_DRAFT`, `PUBLISH`, `SHOW`, `HIDE`. Tài khoản dùng `LOCK_ACCOUNT`, `UNLOCK_ACCOUNT`, `CHANGE_ROLE`. Hồ sơ dùng `SUBMIT_PROFILE`, `APPROVE_PROFILE`, `REJECT_PROFILE`. |
| `actorId` | UUID người thực hiện. |
| `from`, `to` | Thời điểm ISO 8601 có offset, chính xác đến microgiây. Lấy từ `from` trở đi và trước `to`. Nếu có cả hai thì `from < to`. Bỏ cả hai để đọc theo toàn bộ dữ liệu đang lưu. |
| `page`, `size` | Trang bắt đầu từ 0. Kích thước mặc định 20, tối đa 50. |

Dùng `URLSearchParams` khi truyền offset có dấu `+`. Các bộ lọc kết hợp theo điều kiện AND. Kết quả mới nhất trước, khi trùng thời điểm thì so theo ID sự kiện. Khi có bản ghi mới giữa hai lần tải trang, tải lại từ trang đầu nếu cần đồng bộ danh sách.

HTTP 200 trả `status: "COMPLETED"` và `data: {items, page, size, totalElements, totalPages}`. Ví dụ một phần tử của `items`.

```json
{
  "id": "account-role:550e8400-e29b-41d4-a716-446655440002:4",
  "occurredAt": "2026-11-08T05:46:00.123456Z",
  "actorId": "550e8400-e29b-41d4-a716-446655440003",
  "targetType": "ACCOUNT",
  "targetId": "550e8400-e29b-41d4-a716-446655440002",
  "action": "CHANGE_ROLE",
  "outcome": "COMPLETED",
  "version": 4,
  "previousValue": "USER",
  "newValue": "CONSULTANT",
  "revokedSessions": 1
}
```

`outcome` phản ánh thao tác đã được ghi thành công. Ví dụ, từ chối hồ sơ là `action: "REJECT_PROFILE"` với `outcome: "COMPLETED"`. Giá trị trước/sau và số phiên bị thu hồi trả `null` khi không áp dụng hoặc nguồn cũ thiếu dữ kiện. Dùng cặp `targetType/targetId` để nối tới trang chi tiết tương ứng. Hiển thị `occurredAt` theo múi giờ người dùng.

| HTTP | Mã lỗi |
| --- | --- |
| 400 | `INVALID_INPUT` |
| 401 | `INVALID_SESSION` |
| 403 | `CSRF_REJECTED` nếu Origin không hợp lệ |
| 503 | `DATABASE_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` |

## Phạm vi dữ liệu và lưu giữ

Chỉ đọc các thao tác đã được ghi trong bảng nguồn. Yêu cầu bị chặn, thao tác thất bại, đăng nhập và thay đổi thủ công ngoài quy trình ứng dụng nằm ngoài phạm vi. Feed dùng UUID để đối chiếu người thực hiện và đối tượng. Nội dung bài, ghi chú, lý do duyệt hoặc từ chối và thông tin xác thực được giữ ngoài feed.

Giai đoạn này giữ sự kiện theo vòng đời của các bảng nguồn và bản sao lưu PostgreSQL. View không sao chép bản ghi và không có cơ chế tự xóa theo thời hạn. Chính sách lưu giữ có thời hạn cần quyết định vận hành riêng trước khi đưa vào môi trường dùng thật.

## TEST và đối chiếu

Backend `http://127.0.0.1:18116` dùng database TEST riêng `huyenco_admin_audit_test_20261108`. Migrate/validate tới V20, chạy profile `db`, bật Auth và cấu hình Origin theo tài liệu 58. TV1 thêm tuyến chuyển tiếp `/api/v1/admin/audit` từ Client.

```sql
SELECT target_type, action, count(*)
FROM admin_audit_events
GROUP BY target_type, action
ORDER BY target_type, action;
```

### Kết quả ngày 08/11/2026

- Flyway migrate và validate V20 trên bản sao TEST V19. View đọc được 9 sự kiện đã có trước V20.
- 14 kiểm thử hồi quy Backend và 48 yêu cầu HTTP đạt. Tạo 10 sự kiện qua API CMS, tài khoản và hồ sơ. Một yêu cầu đổi vai trò xung đột không tạo sự kiện.
- Kiểm quyền Admin, cookie khách hàng và tư vấn viên, Origin, tham số lặp và giới hạn thời gian. Bốn trang khớp thứ tự và ID truy vấn PostgreSQL. Tổng sự kiện khớp tổng trên các bảng nguồn.
- JSON chỉ trả trường trong hợp đồng. Kiểm bằng dữ liệu tổng hợp chứa chuỗi đánh dấu trong tên hiển thị, tiêu đề, nội dung, ghi chú, phần giới thiệu và lý do để xác nhận các trường này không xuất hiện.
