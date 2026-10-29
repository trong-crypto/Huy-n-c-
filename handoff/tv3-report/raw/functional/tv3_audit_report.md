# Kiểm toán TV3 — PostgreSQL và đối chiếu nguồn

- Ngày: 2026-10-25T08:45:10+00:00
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
| PASS | DB source_sections | Có 33, tối thiểu 17 |
| PASS | DB calculation_rules | Có 14, tối thiểu 14 |
| PASS | DB trigrams | Có 8, tối thiểu 8 |
| PASS | DB tam_the_hour_anchors | Có 12, tối thiểu 12 |
| PASS | DB tam_the_lookup_entries | Có 447, tối thiểu 51 |
| PASS | Flyway V1/V2 đã được áp dụng | Migration: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 |
| PASS | PDF database khớp nội dung tệp đang dùng |  |
| PASS | Trigram code/số/hành/hào khớp seed |  |
| PASS | DB lưu đúng toàn bộ 12 mốc, nguồn và sửa tháng 5 |  |
| PASS | Xác nhận TV2 VERIFIED mốc tháng 5, vẫn giữ chữ Dậu |  |
| PASS | 51 ô công danh khớp khóa/loại nghề và nguồn trang 32 |  |
| PASS | Không VERIFIED thiếu người review ở ô nghề / mốc giờ |  |
| PASS | 14 mã quy tắc bắt buộc có mặt |  |
| PASS | Xác nhận TV2 VERIFIED hai quy tắc Mai Hoa |  |
| PASS | MH-TRIGRAM VERIFIED có metadata và nguồn đúng |  |
| PASS | MH-TIME VERIFIED theo xac nhan chia6 cua chu du an |  |
| PASS | OBJECT_COUNT vẫn giữ trạng thái nguồn đa nghĩa |  |
| PASS | Flyway V4 đã áp dụng |  |
| PASS | 64 tổ hợp và 384 hào khớp 8 quái | Mỗi quẻ gồm hạ quái ở hào 1–3 và thượng quái ở hào 4–6. |
| PASS | Migration V3 về nguồn/tên quẻ |  |
| PASS | 64 tên quẻ và trang nguồn khớp bộ chép sách |  |
| PASS | Có nguồn sơ đồ đối chiếu tên / hình hào |  |
| PASS | E01 đủ 64 NAME_GLOSS không trùng mã | Chỉ là nghĩa tên ngắn, chưa phải lời luận chi tiết. |
| PASS | E01 nghĩa tên và trang nguồn đúng CSV/manifest/PDF |  |
| PASS | E01 64 mục VERIFIED có biên bản cùng công cụ | Reviewer là Codex lượt hai, không đại diện xác minh độc lập của con người. |
| PASS | E01 mục 48 giữ chữ in Ích, chuẩn hóa thành Tỉnh |  |
| PASS | E01 Flyway V10 đã áp dụng |  |
| PASS | S02 đủ 60 Can Chi/hành và trang nguồn |  |
| PASS | S02 từng ô VERIFIED có biên bản đúng phạm vi |  |
| PASS | S02 TT-NGU-HANH VERIFIED có nguồn/biên bản |  |
| PASS | S02 migration V6 metadata ô tra cứu |  |
| PASS | C01 nguồn ngoài sách khớp phiên bản và hash bảng lịch |  |
| PASS | C01 LUNAR-CONVERSION VERIFIED đúng phạm vi/biên bản |  |
| PASS | C01 migration V8 nguồn thuật toán ngoài sách |  |
| PASS | D01 171 giao điểm/ô nghề và nội dung khớp nguồn đã duyệt |  |
| PASS | D01 hai rule công danh có phạm vi và metadata duyệt |  |
| PASS | D01 V7 lưu riêng nguồn/nhãn bảng và đoạn |  |
| PASS | D02 216 ô/đoạn khớp nội dung và metadata duyệt |  |
| PASS | D02 đủ chuỗi trang nguồn, gồm ba bài thơ qua hai trang |  |
| PASS | D02 bốn quy tắc VERIFIED đúng phạm vi/biên bản |  |
| PASS | D02 12 mốc đã duyệt, giữ reviewer TV2 tháng 5 |  |
| PASS | D02 tài lộc: 60 khóa có hai kết quả, 60 khóa không có trong nguồn | Không diễn giải khóa thiếu thành số xấu; không dùng bảng khác bù tự động. |
| PASS | D02 migration V9 lưu đầy đủ nguồn nhiều trang |  |

**Tổng:** 54 kiểm tra, **0 FAIL**, **0 PENDING**.

`PENDING` biểu thị dữ liệu chưa nhập/thiếu người kiểm chứng, không đồng nghĩa phép thử thất bại.
