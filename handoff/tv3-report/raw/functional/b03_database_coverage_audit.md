# Kiểm toán TV3 — PostgreSQL và đối chiếu nguồn

- Ngày: 2026-10-23T18:18:59+00:00
- Chương trình chỉ đọc; không sửa database và không cấp trạng thái VERIFIED.
- Nguồn: hai PDF người dùng cung cấp; xem `docs/12-TV3-SOURCE-REVIEW.md`.

| Kết quả | Nội dung | Chi tiết |
| --- | --- | --- |
| PASS | Hai PDF được mở và có SHA-256 | Mai Hoa 672 trang; Tam Thế 360 trang (số trang được đối chiếu khi có pdfinfo). |
| PASS | Bộ seed 104 bản ghi |  |
| PASS | Quy tắc nhập không tự duyệt VERIFIED |  |
| PASS | 12 mốc giờ khớp trang Tam Thế 12–15 |  |
| PASS | Lưu nguyên văn Dậu và quyết định Dần tháng 5 |  |
| PASS | Ranh tháng 5: 05:19 / 05:20 / 07:19 / 07:20 |  |
| PASS | 12 Chi phủ 24 giờ, không chồng lấn |  |
| PASS | Đã chuẩn bị xác nhận TV2: quẻ hỗ / quẻ biến | Chủ dự án đã báo TV2 xác nhận; chỉ kiểm DB --live mới chứng minh Flyway V4 đã áp dụng. |
| PASS | Đã chuẩn bị xác nhận TV2: giờ tháng 5 | V4 duyệt ô tháng 5; vẫn bảo lưu bản in Dậu, chọn Dần. Chưa xác nhận DB ở lượt offline. |
| PASS | Bộ tên 64 quẻ có nguồn và đủ cặp thượng/hạ | Tên PDF 269–271 / trang in 276–278; sơ đồ PDF 274 / trang in 281. Chờ TV2 review. |
| PASS | DB source_books | Có 2, tối thiểu 2 |
| PASS | DB source_sections | Có 21, tối thiểu 17 |
| PASS | DB calculation_rules | Có 14, tối thiểu 14 |
| PASS | DB trigrams | Có 8, tối thiểu 8 |
| PASS | DB tam_the_hour_anchors | Có 12, tối thiểu 12 |
| PASS | DB tam_the_lookup_entries | Có 51, tối thiểu 51 |
| PASS | Flyway V1/V2 đã được áp dụng | Migration: 1, 2, 3, 4, 5 |
| PASS | PDF database khớp nội dung tệp đang dùng |  |
| PASS | Trigram code/số/hành/hào khớp seed |  |
| PASS | DB lưu đúng toàn bộ 12 mốc, nguồn và sửa tháng 5 |  |
| PASS | Xác nhận TV2 VERIFIED mốc tháng 5, vẫn giữ chữ Dậu |  |
| PASS | 51 ô công danh khớp khóa/loại nghề và nguồn trang 32 |  |
| PASS | Không VERIFIED thiếu người review ở ô nghề / mốc giờ |  |
| PASS | 14 mã quy tắc bắt buộc có mặt |  |
| PASS | Xác nhận TV2 VERIFIED hai quy tắc Mai Hoa |  |
| PASS | Quy tắc toàn bộ 12 tháng chưa bị nâng VERIFIED |  |
| PASS | MH-TRIGRAM VERIFIED có metadata và nguồn đúng |  |
| PASS | OBJECT_COUNT vẫn giữ trạng thái nguồn đa nghĩa |  |
| PASS | Flyway V4 đã áp dụng |  |
| PASS | 64 tổ hợp và 384 hào khớp 8 quái | Mỗi quẻ gồm hạ quái ở hào 1–3 và thượng quái ở hào 4–6. |
| PASS | Migration V3 về nguồn/tên quẻ |  |
| PASS | 64 tên quẻ và trang nguồn khớp bộ chép sách |  |
| PASS | Có nguồn sơ đồ đối chiếu tên / hình hào |  |
| PENDING | Chưa có lời giải 64 quẻ | Bảng interpretations còn trống; không sinh luận giải giả. |
| PENDING | Bảng Tam Thế còn thiếu | 60 Can Chi, 120 ô Số 13, 36 phần giờ, tài lộc, tình duyên cần nhập có trang nguồn và review. |

**Tổng:** 35 kiểm tra, **0 FAIL**, **2 PENDING**.

`PENDING` biểu thị dữ liệu chưa nhập/thiếu người kiểm chứng, không đồng nghĩa phép thử thất bại.
