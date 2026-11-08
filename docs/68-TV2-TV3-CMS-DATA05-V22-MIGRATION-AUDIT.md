# CMS-DATA-05 · Kiểm toán bảo toàn dữ liệu khi nâng lên V22

**Kết quả ngày 08/11/2026 · PASS_LOCAL_TEST.** PostgreSQL 18.6, database riêng `huyenco_cms_data05_test_20261108_164851`, tạo từ bản sao TEST `huyenco_adm_data01_test_20261108`. Backend V20 dựng từ commit `7228acc`. Backend V22 dựng từ mã cục bộ có các thay đổi V21–V22. Thao tác ghi và migration chỉ chạy trên bản sao TEST.

## Sao lưu và kiểm toán migration

1. Sao lưu và khôi phục database nguồn V20 vào database mới. Bản sao ban đầu bỏ dữ liệu bảng `account_sessions`. Tạo phiên H01 và tài khoản tổng hợp mới trên bản sao, rồi lưu và đọc một bản ghi lịch sử ở mỗi chế độ trước khi nâng cấp.
2. Dừng Backend V20 và chụp bản sao lưu đầy đủ `huyenco_cms_data05_test_20261108_164851-before-migrate.dump`. Kiểm danh mục archive bằng `pg_restore -l`. SHA-256 của bản sao lưu là `ebcd39bde851cbbece517854c4507a28309f1014881224c2995e8003052dfbe0`.
3. Chụp số dòng và SHA-256 toàn bộ cột của từng bảng `public` trong giao dịch `REPEATABLE READ READ ONLY`. Chuẩn hóa múi giờ UTC và sắp xếp biểu diễn JSON theo collation `C`. Đối chiếu riêng 20 bản ghi Flyway đã có trước đó.
4. Chạy Flyway `migrate` và `validate` đến V22, rồi đối chiếu lại trước khi khởi động Backend. **28/28 bảng cũ khớp số dòng và SHA-256**, kể cả bảng phiên, lịch sử, tri thức và chỉ số. 20 bản ghi Flyway cũ khớp. V21 và V22 được ghi thành công. Hai bảng CMS mới có 0 dòng ngay sau migration.

| Dữ liệu đối chiếu | Số dòng ở cả V20 và V22 |
| --- | ---: |
| `hexagrams` / `hexagram_lines` / `interpretations` | 64 / 384 / 64 |
| `source_books` / `source_sections` / `calculation_rules` | 2 / 33 / 14 |
| `mai_hoa_reading_templates` | 20 |
| `tam_the_lookup_entries` / `tam_the_lookup_source_pages` | 447 / 231 |
| `tam_the_supplement_mappings` / `tam_the_supplement_results` | 204 / 19 |
| `anonymous_sessions` / `interpretation_history` | 5 / 3 |
| `accounts` / `account_sessions` / `account_history` | 4 / 2 / 2 |

Flyway 11.7.2 báo PostgreSQL 18.6 nằm ngoài phạm vi đã kiểm thử của phiên bản đó. Lượt chạy này áp dụng đủ hai migration và validate thành công cả 22 migration.

## Hồi quy trên Backend và PostgreSQL TEST

| Luồng | Kết quả |
| --- | --- |
| Tra cứu E02 | 121 yêu cầu HTTP đạt. Đối chiếu đủ 64 quẻ, tên, sáu hào, nghĩa tên E01, trang nguồn, tìm kiếm và phân trang. |
| Mai Hoa | Kết quả luận chi tiết `LINES`, `OBJECT_COUNT` và `TIME` khớp fixture và mốc V20. Kiểm `requestId` và bốn bước tiến trình STOMP. |
| Tam Thế | Ca tài lộc mở rộng và ca tháng âm nhuận khớp fixture và mốc V20. |
| Lịch Âm–Dương | Chuyển đổi lịch và tính Can Chi khớp fixture và mốc V20. |
| H01 và lịch sử tài khoản | Hai bản ghi kiểm soát tạo trên V20 đọc lại nguyên vẹn trên V22. Phiên khác hoặc tài khoản khác bị từ chối. Cookie H01 gọi lịch sử khi bật Auth nhận `401`. Tài khoản khác đọc hoặc xóa bản ghi nhận `404`. Chủ tài khoản lưu, đọc và xóa được một bản ghi thử mới. |

Lượt hồi quy thực hiện 15 yêu cầu HTTP và 7 lượt STOMP trước nâng cấp. Sau nâng cấp có 22 yêu cầu HTTP, 6 lượt STOMP và 121 yêu cầu HTTP E02. So sánh sau hồi quy cho thấy 26/28 bảng cũ vẫn khớp dấu vân tay. Hai bảng thay đổi đúng theo thao tác thử, gồm hai phiên tài khoản mới và sáu lượt tính được ghi vào bộ đếm theo phương pháp. Bảng lịch sử khớp vì bản ghi thử phát sinh sau V22 đã được xóa qua API.

## Chạy lại

- Tạo database TEST riêng từ một bản sao V20 có dữ liệu E01, Mai Hoa, Tam Thế và lịch sử. Dựng Backend V20 để ghi mốc trước nâng cấp. Dùng hai tiến trình loopback với Auth tắt và bật khi kiểm tra hai loại lịch sử.
- Sao lưu và đối chiếu dữ liệu với các tiến trình đã dừng. Đặt `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` theo bản sao TEST rồi chạy `.\mvnw.cmd -Pdatabase -Dflyway.target=22 flyway:migrate` và `.\mvnw.cmd -Pdatabase -Dflyway.target=22 flyway:validate` tại thư mục Server.
- Chạy lại Backend V22 ở hai chế độ. Dùng `smoke_e02_hexagrams.py --url <Backend TEST>` và các fixture `m03-*`, `d04-*`, `calendar-*` trong kho mã. Đọc lại các bản ghi kiểm soát bằng phiên gốc, rồi kiểm quyền với phiên thứ hai.

Phạm vi kiểm toán là schema V20 → V22, dữ liệu cũ trên TEST và các ca API/STOMP nêu trên.
