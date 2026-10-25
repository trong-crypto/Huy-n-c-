# Kiểm tra độ đầy đủ database huyenco — 25/10/2026

Thời điểm truy vấn: **15:07:45 UTC+07:00, 25/10/2026**. Kết nối PostgreSQL `127.0.0.1:5432`, database `huyenco`. Chỉ SELECT trong transaction READ ONLY; không nạp lại dữ liệu, đổi trạng thái, chạy migration hoặc sửa schema. Mật khẩu chỉ truyền qua môi trường tiến trình, không lưu trong báo cáo/mã nguồn.

**Kết luận:** đủ dữ liệu theo phạm vi nghiệp vụ đã nhập và duyệt đến **E02**; chưa thể coi database của toàn bộ dự án hoặc nội dung hai sách đã hoàn thành100%.

## Kết quả trực tiếp

- Kiểm toán nguồn/dữ liệu hiện có: **54 PASS / 0 FAIL / 0 PENDING**.
- Flyway **V1–V10** đều success; database có12 bảng public, gồm bảng lịch sử Flyway.
- **16 khóa ngoại** đều validated; không có constraint chưa validated.

| Nhóm dữ liệu | Số bản ghi | Phạm vi xác nhận |
| --- | ---: | --- |
| source_books | 2 | Hash hai PDF khớp bộ nguồn đã pin |
| source_sections | 33 | Địa chỉ mục/trang sách theo phạm vi đã nhập |
| external_sources | 1 | Thuật toán lịch C01 có phiên bản/hash; ngoài hai sách |
| calculation_rules | 14 | 12 VERIFIED;2 SOURCE_AMBIGUOUS, không tự nâng trạng thái |
| trigrams | 8 | Đủ tám quái |
| hexagrams | 64 | Tên, cặp thượng/hạ và nguồn khớp S01 |
| hexagram_lines | 384 | Chỉ cấu trúc6 hào/quẻ, không có lời luận hào |
| interpretations | 64 | Chỉ category NAME_GLOSS, tất cả VERIFIED |
| tam_the_hour_anchors | 12 | Đủ mốc12 tháng theo D02/biên bản tháng5 |
| tam_the_lookup_entries | 447 | Tất cả VERIFIED có reviewer/thời điểm |
| tam_the_lookup_source_pages | 231 | Chuỗi trang nội dung D02 được audit kiểm |

| Quy tắc tra cứu | Dòng | Khóa phân biệt | Nội dung |
| --- | ---: | ---: | --- |
| TT-NGU-HANH | 60 | 60 | Ánh xạ Can Chi→hành; không có mô tả nạp âm |
| TT-CONG-DANH-11 | 51 | 34 | Giao điểm nhóm nghề; có thể nhiều nghề/khóa, không có bài luận dài |
| TT-CONG-DANH-13 | 120 | 120 | Đủ Can×tháng; liên kết12 đoạn công danh |
| TT-TAI-LOC | 120 | 60 | Mỗi khóa hỗ trợ có2 kết quả; chỉ phủ60/120 Can×tháng |
| TT-TINH-DUYEN | 60 | 60 | Đủ hành×tháng cho tuyến tình duyên chung |
| TT-36-PHAN | 36 | 36 | Nội dung12 Chi×3 phần giờ |

Các dòng description rỗng ở TT-NGU-HANH và TT-CONG-DANH-11 phù hợp phạm vi bảng ánh xạ, không tự suy ra lỗi nhập. Bảng Số11 không có giao điểm cho26/60 khóa hành–tháng; đây là danh sách nghề theo nguồn, không tự kết luận người đó không có nghề. Service CAREER còn dùng Số13 đủ120 khóa.

## Những phần chưa đủ hoặc cần hiểu đúng

1. **H01 chưa có schema phiên/owner/lịch sử.** Trong danh sách bảng public không có bảng phục vụ chức năng lưu/tra/xóa lịch sử của người dùng. Đây là việc tiếp theo theo kế hoạch; không sửa database trong lượt kiểm này.
2. **Tra quẻ E02 có64 nghĩa tên ngắn.** Không có bộ64 bài luận đầy đủ hay384 lời luận hào: `interpretations` chỉ có NAME_GLOSS, còn `hexagram_lines` chỉ gồm mã quẻ, số hào, âm/dương. Không thể dùng số dòng để khẳng định đã số hóa mọi nội dung hai sách.
3. **Tài lộc chưa bao phủ mọi đầu vào.** 120 dòng chỉ là60 khóa×2 kết quả, không phải120 khóa. Theo biên bản D02,60 khóa còn lại không có giao điểm trong nguồn; yêu cầu WEALTH cho khóa đó trả LOOKUP_NOT_AVAILABLE. Muốn mở rộng cần căn cứ bổ sung, không tự sinh lời luận.
4. **Hai rule còn SOURCE_AMBIGUOUS:** `MH-OBJECT-COUNT` chạy theo TEAM_DECISION đã chốt, không phải công thức còn chờ người dùng xác nhận; `MH-THE-DUNG` còn DISABLED. MH-TIME hiện VERIFIED cho quy tắc dự án, vẫn giữ TEAM_DECISION trong catalog.
5. **Các giới hạn nguồn đã công bố vẫn giữ:** bản chép Hưởng Lộc có `[CHU_MO]`, nạp âm chưa duyệt nội dung mô tả, tình duyên hiện là tuyến chung; các chương/bảng ngoài phạm vi chưa được coi là đã nhập. VERIFIED phản ánh biên bản và người/công cụ thực tế, không phải xác minh độc lập hai người hoặc xác thực ấn bản xuất bản.

`0 PENDING` chỉ cho biết bộ kiểm toán hiện hành không có mục chờ trong dữ liệu đã xác định; không có nghĩa mọi chức năng/sách/đầu vào đã được bao phủ.

## Bằng chứng

- `scripts/generated/tv3_audit_report.md`: báo cáo kiểm toán live đã chạy lại.
- `scripts/generated/e02_database_completeness.json`: schema, migration, số dòng/khóa, trạng thái quy tắc, khóa ngoại từ truy vấn chỉ đọc.
- `docs/25-D01-CAREER-DATA.md`, `docs/29-D02-TAM-THE-DATA.md`: phạm vi bảng công danh/tài lộc/tình duyên và giới hạn nguồn.
- `docs/31-E01-HEXAGRAM-GLOSSES.md`, `docs/32-E02-HEXAGRAM-LOOKUP-HANDOFF.md`: phạm vi nghĩa tên và API tra quẻ.

**Ưu tiên tiếp theo:** H01 (phiên/owner/lịch sử). Các nhu cầu luận quẻ/hào hoặc tài lộc ngoài khóa hiện có cần được xử lý thành phạm vi nguồn riêng; không trì hoãn H01 chỉ để tạo dữ liệu đủ số lượng.
