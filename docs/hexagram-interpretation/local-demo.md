# Thư viện 64 quẻ trên máy DEMO

Kho biên tập ghép ba bài mẫu với 61 tổng quan và 61 phần bổ sung. File nguồn lưu URL phiên bản cố định. Lời giải tiếng Việt chờ duyệt, còn hai trường nguyên văn của Bác và Cách để trống vì cần thống nhất cách ngắt câu hoặc dị tự. Xem [ghi chú theo quẻ](source-review.md).

## Chuẩn bị PostgreSQL TEST

Khôi phục bản sao V33 đã kiểm checksum vào một PostgreSQL cách ly. Chỉ định database mang hậu tố `_disposable` trên cổng riêng. Kiểm `current_database()`, địa chỉ loopback, cổng và đủ 33 migration thành công trước khi chạy Flyway. Dùng JDK 17 và Maven profile `database`. Cung cấp biến `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` trong tiến trình riêng bằng nguồn credential TEST.

```powershell
mvn.cmd -Pdatabase '-Dflyway.target=34' flyway:migrate
mvn.cmd -Pdatabase '-Dflyway.target=34' flyway:validate
```

V34 tạo riêng các bảng nguồn, phiên bản, sự kiện duyệt và dấu vết import. E01 giữ bảng và dữ liệu hiện hành.

## Nhập DRAFT

Chạy từ gốc repo. Lượt không có `--apply` kiểm gói và báo SHA-256. Lượt ghi kiểm đích trên kết nối TCP thực, lịch sử Flyway V1–V34 và UUID của một Admin TEST đang ACTIVE. Dùng credential PostgreSQL qua prompt ẩn hoặc biến tiến trình đã được cung cấp cho tác vụ TEST.

```powershell
python scripts/import_hexagram_interpretations.py
python scripts/import_hexagram_interpretations.py --apply --database huyenco_hex_v34_disposable --port 55579 --db-user <role-test> --admin-id <uuid-admin-test> --psql <psql-18>
```

Công cụ khóa từng quẻ, đối chiếu sáu hào với E01 và tạo bản DRAFT đầu tiên cùng snapshot nguồn `SOURCE_LOCATED`. Mỗi bản ghi dấu vết lưu checksum gói. Toàn bộ import là một transaction. Chạy lại bỏ qua quẻ đã có bất kỳ phiên bản nào, kể cả PUBLISHED. Nếu nguồn đã tồn tại mà khác metadata gói, import dừng để kiểm tra.

## Duyệt từ CMS

1. Khởi động Backend profile `db` với `SPRING_FLYWAY_ENABLED=false` và `HUYENCO_HEXAGRAM_INTERPRETATION_ENABLED=true`. Build Client với `NEXT_PUBLIC_HEXAGRAM_INTERPRETATIONS=1` và cấu hình cùng origin trên máy local.
2. Admin biên tập vào `/admin/readings`, chọn quẻ và mở bản nháp. Đối chiếu từng lời hào, ghi chú dị bản, bản nguồn và điều kiện sử dụng trước khi xác nhận một nguồn.
3. Sau khi người duyệt nguồn xác nhận, quản trị viên dữ liệu cập nhật trạng thái của **đúng nguồn đã duyệt** trong registry TEST. Mở lại bài trong CMS và lưu thành bản nháp mới để chụp trạng thái nguồn đã duyệt. Phiên bản import ban đầu vẫn giữ snapshot cũ.
4. Admin biên tập bấm **Gửi duyệt**. Admin khác kiểm lại nội dung và nguồn trong bản đang chờ, rồi nhập ghi chú và bấm **Công bố** hoặc **Trả lại**. CMS kiểm quyền, CSRF, phiên bản và đối chiếu snapshot nguồn. Database cũng chặn chính tác giả chèn sự kiện công bố cho bản mình tạo.
5. Mở quẻ từ `/hexagrams` bằng phiên khách. Đối chiếu bài công khai với phiên bản đã duyệt. Lập quẻ ở `/mai-hoa` để kiểm bài tương ứng mã quẻ chủ, hỗ, biến và đúng số hào động ở quẻ chủ.

Công bố trong quy trình trên là trạng thái CMS của bản demo nội bộ.
