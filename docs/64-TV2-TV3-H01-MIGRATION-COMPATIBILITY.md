# Kiểm toán bảo toàn lịch sử H01 khi nâng lên V20

ADM-DATA-01 kiểm tra khả năng giữ dữ liệu H01 từ trước khi có lịch sử tài khoản và ranh giới truy cập của hai loại phiên sau nâng cấp. Lượt kiểm dùng mã nguồn tại commit `7228acc` và một PostgreSQL TEST riêng, `huyenco_adm_data01_test_20261108`.

## Phương pháp

1. Khôi phục bản sao lưu TEST trước V14, `before-v14-180958782.dump`, vào database riêng. Xác nhận phiên bản V13, 64 quẻ và một bản ghi lịch sử H01 có sẵn.
2. Dùng Backend với Auth tắt trên V13 để tạo hai phiên H01 tổng hợp. Phiên A lập quẻ Mai Hoa qua STOMP và lưu một bản ghi. Phiên A đọc được bản ghi, phiên B bị từ chối. Giữ cookie thử trong bộ nhớ tiến trình.
3. Chụp số dòng và dấu vân tay của hai bảng. Áp dụng Flyway V14–V20, chạy validate rồi đối chiếu lại. Kiểm `account_history` ngay sau migration để phát hiện việc tự động chuyển bản ghi H01.
4. Gọi API qua hai cấu hình trên cùng bản sao V20. Dùng `AUTH_ENABLED=false` để đối chiếu H01 tương thích và `AUTH_ENABLED=true` để kiểm lịch sử tài khoản. Tính lại dấu vân tay H01 sau kiểm thử.

SQL đối chiếu chỉ đọc và chỉ xuất số dòng, SHA-256 tổng hợp. Toàn bộ cột tham gia vào phép băm, kể cả khóa chủ sở hữu, dấu thời gian và nội dung kết quả. Dùng cùng múi giờ và thứ tự khóa chính ở cả hai lần đo.

```sql
BEGIN READ ONLY;
SET LOCAL TIME ZONE 'UTC';
SELECT 'anonymous_sessions' AS table_name, count(*) AS rows,
       encode(sha256(convert_to(
         coalesce(string_agg(to_jsonb(s)::text, E'\n' ORDER BY owner_id), ''), 'UTF8')), 'hex') AS sha256
FROM anonymous_sessions s
UNION ALL
SELECT 'interpretation_history', count(*),
       encode(sha256(convert_to(
         coalesce(string_agg(to_jsonb(h)::text, E'\n' ORDER BY id), ''), 'UTF8')), 'hex')
FROM interpretation_history h
ORDER BY 1;
COMMIT;
```

## Kết quả ngày 08/11/2026

| Bảng | Trước khi migrate V13 | Sau V20 | Sau kiểm quyền | SHA-256 ở cả ba mốc |
| --- | ---: | ---: | ---: | --- |
| `anonymous_sessions` | 3 | 3 | 3 | `d443a2df44f09e5af04823534fd19649dae5a54ffa1bb1bbd71c31459eee9429` |
| `interpretation_history` | 2 | 2 | 2 | `af9846a056b694b94b97cc21465d2f6fa520cfa6266603ccb6c6e62b90e59d98` |

Flyway áp dụng đủ bảy migration từ V14 đến V20 và validate thành công. Ngay sau migration, `account_history` có 0 bản ghi. Sau kiểm quyền, database có 2 tài khoản tổng hợp và đúng 1 bản ghi lịch sử theo tài khoản. Flyway phát cảnh báo về phạm vi hỗ trợ PostgreSQL 18.6 trong phiên bản đang dùng.

| Ca nghiệm thu | Kết quả |
| --- | --- |
| Chủ phiên H01 đọc bản ghi kiểm soát ở V13 và V20 | `200` ở chế độ tương thích, nội dung phản hồi khớp hoàn toàn. Phiên H01 khác không thấy bản ghi và nhận `404` khi truy cập ID. |
| Cookie H01 gọi lịch sử khi bật Auth | Tạo phiên lịch sử, xem danh sách, đọc và xóa trả `401 LOGIN_REQUIRED`. |
| Tài khoản A gửi kèm cookie H01 cũ | Danh sách tài khoản ban đầu rỗng. Đọc hoặc xóa ID cũ trả `404 NOT_FOUND`. |
| Tài khoản A lập quẻ và lưu kết quả mới | STOMP hoàn tất, lưu trả `201`. Phiên đăng nhập thứ hai của A đọc được đúng bản ghi. |
| Tài khoản B hoặc phiên H01 thử đọc bản ghi của A | Nhận `404`. Tài khoản B cũng bị từ chối khi xóa. |
| Tài khoản A đăng xuất khỏi một phiên | Phiên đó nhận `401`. Phiên đăng nhập khác của A vẫn đọc được. |

Tổng cộng 32 yêu cầu HTTP và 2 lượt STOMP đạt qua hai cấu hình Backend loopback. Dấu vân tay sau cùng khớp mốc trước migration, bao gồm bản ghi H01 có sẵn trong bản sao lưu. Các ca đọc qua API dùng bản ghi kiểm soát có cookie còn hạn. Lượt kiểm thực hiện ở lớp API và PostgreSQL.

## Quy tắc sử dụng

Khi Auth bật, trang Lịch sử đọc bản ghi thuộc tài khoản đã đăng nhập. Phiên H01 cũ chỉ truy xuất được trong chế độ tương thích Auth tắt với cookie phiên tương ứng còn hạn. Việc chuyển lịch sử ẩn danh vào tài khoản là một nghiệp vụ riêng.
