# Bàn giao thống kê Dashboard Admin

Phạm vi TV2 và TV3 gồm ADM-01 và ADM-DATA-02. TV1 dùng hợp đồng dưới đây để tích hợp Dashboard.

## Đọc thống kê

`GET /api/v1/admin/metrics?date=YYYY-MM-DD` lấy một ngày theo múi giờ `Asia/Ho_Chi_Minh`. Bỏ `date` để lấy ngày hiện tại. Ngày tương lai, ngày sai và query trùng hoặc dư bị từ chối.

Gọi qua cùng Origin của Client với cookie phiên Admin và `credentials: "same-origin"`. TV1 cấu hình Next.js chuyển tiếp đường dẫn này tới Backend. Dùng phiên từ `POST /api/v1/auth/admin/login`. GET chỉ đọc và không cần token CSRF. Backend kiểm tra Origin nếu request có gửi. Phản hồi dùng `Cache-Control: no-store`.

Ví dụ HTTP 200.

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "status": "COMPLETED",
  "data": {
    "date": "2026-11-08",
    "timeZone": "Asia/Ho_Chi_Minh",
    "trackingStartedAt": "2026-11-08T04:45:30Z",
    "calculationCoverage": "PARTIAL",
    "users": 2,
    "calculations": 5,
    "pendingContent": 1,
    "consultants": 1,
    "accounts": { "users": 2, "consultants": 1, "admins": 1, "active": 3, "locked": 1 },
    "methods": [
      { "id": "TIME", "name": "Theo thời điểm", "count": 1 },
      { "id": "OBJECT_COUNT", "name": "Theo số vật đếm được", "count": 1 },
      { "id": "LINES", "name": "Nhập sáu hào", "count": 2 },
      { "id": "TAM_THE", "name": "Tam Thế", "count": 1 }
    ]
  },
  "error": null
}
```

- `users` và `consultants` đếm tài khoản theo vai trò, kể cả tài khoản bị khóa. `accounts` phân nhóm toàn bộ tài khoản theo vai trò và theo trạng thái. `pendingContent` đếm bài hướng dẫn đang ở `PENDING_REVIEW`. Đây là ảnh chụp hiện tại, kể cả khi chọn ngày khác.
- Chỉ `calculations` và `methods` thay đổi theo ngày. Tổng gồm Mai Hoa và Tam Thế. Dùng nhãn **Tổng lượt tính** trên giao diện.
- `UNAVAILABLE` dành cho ngày trước khi bắt đầu ghi nhận. Khi đó `calculations: null` và `methods: []`. Hiển thị **Chưa có dữ liệu**. `PARTIAL` là ngày đầu ghi nhận. `AVAILABLE` là các ngày tiếp theo; số đếm là số đã ghi nhận tới lúc đọc. Trong hai trạng thái có theo dõi, `0` nghĩa là chưa ghi nhận lượt nào trong ngày đó.
- Trạng thái dịch vụ là phạm vi riêng của health check. API này cung cấp số liệu sử dụng và nội dung.

| HTTP | Mã | Xử lý phía Client |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Báo ngày hoặc tham số không hợp lệ. |
| 401 | `INVALID_SESSION` | Yêu cầu phiên Admin hợp lệ. |
| 403 | `CSRF_REJECTED` hoặc `FORBIDDEN` | Báo quyền hoặc cấu hình Origin. |
| 503 | `DATABASE_UNAVAILABLE` | Báo lỗi tạm thời và cho tải lại. |
| 500 | `INTERNAL_ERROR` | Báo lỗi và giữ `requestId` để tra cứu. |

Lỗi dùng `status: "FAILED"`, `data: null` và `error.code` trong envelope.

## Quy tắc đếm và phạm vi dữ liệu

V17 tạo mốc bắt đầu ghi nhận và bộ đếm PostgreSQL theo ngày, phương pháp. Mỗi xử lý STOMP tạo kết quả `COMPLETED` mới tăng một lần, kể cả khách và kết quả không lưu vào lịch sử. Nếu N01 phát lại kết quả của cùng yêu cầu trong phiên và thời hạn idempotency, lượt phát lại giữ nguyên bộ đếm. Khi N01 tiếp nhận một phép tính mới ở phiên khác hoặc sau thời hạn đó, phép tính hoàn tất được tính là lượt mới. Yêu cầu thất bại, bị hủy hoặc quá hạn không tăng bộ đếm.

Số liệu có thể xuất hiện sau khi Client đã nhận kết quả STOMP. Nếu PostgreSQL gián đoạn khi ghi thống kê, Backend vẫn giữ kết quả đã trả và ghi cảnh báo vận hành. Lượt thống kê bị mất trong khoảng đó không được hồi tố. Bộ đếm chỉ chứa ngày, mã phương pháp và số lượt.

## PostgreSQL TEST

Môi trường nghiệm thu dùng database riêng `huyenco_admin_metrics_test_20261108` và Backend `http://127.0.0.1:18113`. Chạy Flyway tới V17 rồi bật profile `db` và `AUTH_ENABLED=true`. Dùng các biến cấu hình Auth/DB trong tài liệu 58 và đặt Origin đúng địa chỉ Client sẽ truy cập. Nếu cần tự tạo Admin TEST, dùng quy trình ở tài liệu 58 với điều kiện `current_database()` trỏ tới database V17 ở trên.

Đối chiếu bằng truy vấn chỉ đọc sau.

```sql
SELECT role, status, count(*) FROM accounts GROUP BY role, status ORDER BY role, status;
SELECT count(*) FROM cms_method_guides WHERE working_status = 'PENDING_REVIEW';
SELECT method, completed_count
FROM admin_calculation_daily_counts
WHERE local_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
ORDER BY method;
```

### Kết quả ngày 08/11/2026

- Flyway migrate và validate V17 thành công. 21 kiểm thử hồi quy Backend đạt.
- Smoke trên Backend thật đạt 18 yêu cầu HTTP và 8 phản hồi STOMP. Xác nhận Admin đọc được, khách và cookie khách hàng nhận 401, Origin sai nhận 403, ngày và query sai nhận 400.
- Hai yêu cầu LINES chạy đồng thời được ghi nhận đầy đủ. Một phản hồi phát lại và hai yêu cầu lỗi không tăng bộ đếm. SQL khớp API với LINES 2, OBJECT_COUNT 1, TIME 1 và TAM_THE 1. Bảng lịch sử tài khoản vẫn có 0 bản ghi.
- Dữ liệu mẫu có 2 tài khoản USER, 1 CONSULTANT, 1 ADMIN, 3 tài khoản hoạt động, 1 bị khóa và 1 bài hướng dẫn chờ duyệt. Xác nhận ngày trước mốc trả `null`, còn ngày có theo dõi và chưa phát sinh lượt trả `0`.
