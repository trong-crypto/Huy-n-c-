# E01 — Đối chiếu và nhập 64 nghĩa tên quẻ (25/10/2026)

**Trạng thái: DONE (25/10/2026).** Đã nhập và kiểm toán dữ liệu thực trên PostgreSQL `huyenco`: 64 `NAME_GLOSS` ở trạng thái `VERIFIED`, Flyway V10 thành công, chạy lại không tạo bản ghi trùng. Kết quả kiểm toán tổng thể: **54 PASS / 0 FAIL / 0 PENDING**. Xem `scripts/generated/tv3_audit_report.md`.

## 1. Mục tiêu và ranh giới

- Nhập đúng 64 **nghĩa tên ngắn**, mỗi quẻ 1 bản ghi trong `interpretations`, `category='NAME_GLOSS'`.
- Không dùng các nghĩa tên này làm 64 bài dự đoán, lời luận từng hào hoặc thay dữ liệu Tam Thế.
- Chỉ nhận đúng hai bước `SOURCE_LOCATED` → `VERIFIED` qua biên bản E01. Không nâng trạng thái quy tắc Mai Hoa hoặc bảng khác.
- Dữ liệu nguồn từ *Mai Hoa Dịch Số*, PDF 672 trang, SHA-256 `225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de`.

## 2. Kế hoạch thực hiện và tiêu chí nghiệm thu

| Bước | Việc làm | Tiêu chí |
| --- | --- | --- |
| 1 | Đối chiếu mục 1–3 trên PDF 269/in 276; 4–40 trên PDF 270/in 277; 41–64 trên PDF 271/in 278 | Đủ thứ tự, nguyên nghĩa; phát hiện nhãn in sai |
| 2 | So từng mã quẻ với S01 `data/hexagram_names.csv`, so với khảo sát S03 | 64 mã chuẩn, trang và thứ tự khớp |
| 3 | Chốt CSV duyệt và manifest hash SHA-256 | 64 dòng, có editor, reviewer, decision; hash khớp |
| 4 | Kiểm tra script bằng dry-run và kiểm thử bảo vệ dữ liệu | SQL sinh được, không có sửa ngoài `NAME_GLOSS` |
| 5 | Sao lưu **toàn bộ** database `huyenco` trước schema | Có tệp `.dump` hợp lệ trong `scripts/generated/db-backups/` |
| 6 | Flyway migration `V10__hexagram_name_gloss_reviews.sql` | `flyway_schema_history.version='10'`, `success=true` |
| 7 | Nhập và duyệt 64 dòng, chạy lại không tạo bản ghi trùng | 64 `VERIFIED`, mỗi mã 1 dòng, đủ metadata và nguồn |
| 8 | Kiểm toán trực tiếp rồi cập nhật kế hoạch | E01 audit PASS, không có FAIL E01, có log DB thực tế |

## 3. Biên bản đối chiếu và quyết định biên tập

- Lượt một: dữ liệu khảo sát S03 `data/s03_hexagram_source_map.csv`, dựa trên ba trang PDF 269–271.
- Lượt hai: Codex xem lại ảnh ba trang và đối chiếu S01. **Hai lượt do cùng công cụ hỗ trợ, không phải xác minh độc lập của hai người.** CSV ghi rõ danh tính reviewer này.
- Mục 48: tại PDF 271/in 278, vị trí sau **Khốn** và trước **Cách** in nhãn **“Ích: Giếng nước”**. Vị trí chuẩn 48 là **Tỉnh**, mã `H_KHAM_TON`; **Ích** là quẻ 42. Chốt nghĩa **“Giếng nước”** thuộc **Tỉnh**, nhưng trường `printed_source_label` giữ **“Ích”**. Ghi mã quyết định `PRINTED_ICH_AT_TINH_POSITION; identity normalized to verified Tỉnh (48)`.
- `VERIFIED` của E01 chỉ xác nhận phép chép/đối chiếu và quyết định định danh trên **nghĩa tên ngắn** theo hai lượt của cùng Codex. Không đại diện xác thực bởi người duyệt độc lập hoặc bảo chứng tính đúng đắn của thuật đoán.

## 4. Danh sách 64 mục đã ghi vào CSV

Các giá trị dưới đây được sinh trực tiếp từ `data/e01_hexagram_gloss_review.csv` (manifest cố định), tránh chép tay sai khác.

<!-- E01_ROWS_BEGIN -->
| STT | Ma que | Ten chuan | Nghia ngan | Trang PDF / in | Nhan tren ban in |
| ---: | --- | --- | --- | --- | --- |
| 1 | H_CAN_CAN | Càn | Trời | 269/276 | Càn |
| 2 | H_KHON_KHON | Khôn | Đất | 269/276 | Khôn |
| 3 | H_KHAM_CHAN | Truân | Mới sinh, khó khăn | 269/276 | Truân |
| 4 | H_CAN2_KHAM | Mông | Mờ tối, non yếu | 270/277 | Mông |
| 5 | H_KHAM_CAN | Nhu | Ăn uống, chờ đợi | 270/277 | Nhu |
| 6 | H_CAN_KHAM | Tụng | Kiện cáo, tranh giành | 270/277 | Tụng |
| 7 | H_KHON_KHAM | Sư | Quân lính, số đông người | 270/277 | Sư |
| 8 | H_KHAM_KHON | Tỷ | Thân thiết, gần gũi | 270/277 | Tỷ |
| 9 | H_TON_CAN | Tiểu súc | Chứa nhỏ (hoặc lớn) | 270/277 | Tiểu súc |
| 10 | H_CAN_DOAI | Lý | Lễ | 270/277 | Lý |
| 11 | H_KHON_CAN | Thái | Thông suốt | 270/277 | Thái |
| 12 | H_CAN_KHON | Bĩ | Lấp, bế tắc | 270/277 | Bĩ |
| 13 | H_CAN_LY | Đồng nhân | Cùng với người | 270/277 | Đồng nhân |
| 14 | H_LY_CAN | Đại hữu | Có, sở hữu lớn | 270/277 | Đại hữu |
| 15 | H_KHON_CAN2 | Khiêm | Khiêm nhường | 270/277 | Khiêm |
| 16 | H_CHAN_KHON | Dự | Vui vẻ | 270/277 | Dự |
| 17 | H_DOAI_CHAN | Tùy | Theo | 270/277 | Tùy |
| 18 | H_CAN2_TON | Cổ | Mê loạn, đổ nát | 270/277 | Cổ |
| 19 | H_KHON_DOAI | Lâm | Lớn | 270/277 | Lâm |
| 20 | H_TON_KHON | Quan | Xem xét | 270/277 | Quan |
| 21 | H_LY_CHAN | Phệ hạp | Làm cho hợp lại | 270/277 | Phệ hạp |
| 22 | H_CAN2_LY | Bí | Trau dồi, trang sức | 270/277 | Bí |
| 23 | H_CAN2_KHON | Bác | Lột đi | 270/277 | Bác |
| 24 | H_KHON_CHAN | Phục | Trở lại | 270/277 | Phục |
| 25 | H_CAN_CHAN | Vô vọng | Không làm càn bậy | 270/277 | Vô vọng |
| 26 | H_CAN2_CAN | Đại súc | Chứa lớn | 270/277 | Đại súc |
| 27 | H_CAN2_CHAN | Di | Nuôi | 270/277 | Di |
| 28 | H_DOAI_TON | Đại quá | Quá lớn | 270/277 | Đại quá |
| 29 | H_KHAM_KHAM | Khảm | Hiểm | 270/277 | Khảm |
| 30 | H_LY_LY | Ly | Bám vào | 270/277 | Ly |
| 31 | H_DOAI_CAN2 | Hàm | Giao cảm | 270/277 | Hàm |
| 32 | H_CHAN_TON | Hằng | Lâu dài | 270/277 | Hằng |
| 33 | H_CAN_CAN2 | Độn | Tránh đi | 270/277 | Độn |
| 34 | H_CHAN_CAN | Đại tráng | Lớn mạnh | 270/277 | Đại tráng |
| 35 | H_LY_KHON | Tấn | Tiến lên | 270/277 | Tấn |
| 36 | H_KHON_LY | Minh di | Sáng bị tổn hại | 270/277 | Minh di |
| 37 | H_TON_LY | Gia nhân | Người cùng nhà | 270/277 | Gia nhân |
| 38 | H_LY_DOAI | Khuê | Ngang trái lìa nhau | 270/277 | Khuê |
| 39 | H_KHAM_CAN2 | Kiển | Hiểm trở | 270/277 | Kiển |
| 40 | H_CHAN_KHAM | Giải | Mở ra | 270/277 | Giải |
| 41 | H_CAN2_DOAI | Tổn | Bị tổn hại | 271/278 | Tổn |
| 42 | H_TON_CHAN | Ích | Thêm vào phải có lợi | 271/278 | Ích |
| 43 | H_DOAI_CAN | Quải | Quả quyết | 271/278 | Quải |
| 44 | H_CAN_TON | Cấu | Gặp gỡ | 271/278 | Cấu |
| 45 | H_DOAI_KHON | Tụy | Tụ hợp | 271/278 | Tụy |
| 46 | H_KHON_TON | Thăng | Lên | 271/278 | Thăng |
| 47 | H_DOAI_KHAM | Khốn | Khốn cùng | 271/278 | Khốn |
| 48 | H_KHAM_TON | Tỉnh | Giếng nước | 271/278 | Ích |
| 49 | H_DOAI_LY | Cách | Biến đổi, cải cách | 271/278 | Cách |
| 50 | H_LY_TON | Đỉnh | Cái vạc | 271/278 | Đỉnh |
| 51 | H_CHAN_CHAN | Chấn | Sấm động | 271/278 | Chấn |
| 52 | H_CAN2_CAN2 | Cấn | Ngăn lại | 271/278 | Cấn |
| 53 | H_TON_CAN2 | Tiệm | Dần dần | 271/278 | Tiệm |
| 54 | H_CHAN_DOAI | Quy muội | Con gái về nhà chồng | 271/278 | Quy muội |
| 55 | H_CHAN_LY | Phong | Lớn thịnh | 271/278 | Phong |
| 56 | H_LY_CAN2 | Lữ | Xa nhà | 271/278 | Lữ |
| 57 | H_TON_TON | Tốn | Vào | 271/278 | Tốn |
| 58 | H_DOAI_DOAI | Đoài | Vui | 271/278 | Đoài |
| 59 | H_TON_KHAM | Hoán | Lìa tan | 271/278 | Hoán |
| 60 | H_KHAM_DOAI | Tiết | Hạn chế | 271/278 | Tiết |
| 61 | H_TON_DOAI | Trung phu | Lòng có đức tin | 271/278 | Trung phu |
| 62 | H_CHAN_CAN2 | Tiểu quá | Nhỏ và nhiều | 271/278 | Tiểu quá |
| 63 | H_KHAM_LY | Ký tế | Sự đã rồi | 271/278 | Ký tế |
| 64 | H_LY_KHAM | Vị tế | Việc chưa xong | 271/278 | Vị tế |
<!-- E01_ROWS_END -->

## 5. Bộ file và cách triển khai

| Tệp | Vai trò |
| --- | --- |
| `data/e01_hexagram_gloss_review.csv` | 64 nghĩa tên và quyết định đã so nguồn |
| `data/e01_hexagram_gloss_manifest.json` | SHA-256 PDF, khảo sát S03 và CSV |
| `server/src/main/resources/db/migration/V10__hexagram_name_gloss_reviews.sql` | Metadata review, constraint, unique index |
| `scripts/import_hexagram_glosses.py` | Dry-run/import/review idempotent có kiểm nguồn |
| `scripts/import_e01.ps1` | Sao lưu full DB → Flyway → import/review → audit |
| `scripts/audit_tv3.py` | Kiểm tra 64 dòng từ DB cùng mã/trang/nguồn/trạng thái |
| `scripts/tests/test_hexagram_glosses.py` | Unit test manifest, mục 48 và SQL guard |

Tại PowerShell trong thư mục gốc repository:

```powershell
python -m unittest discover -s scripts/tests -p 'test_hexagram_glosses.py' -v
python scripts/import_hexagram_glosses.py
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_e01.ps1
```

Lệnh thứ ba sẽ hỏi mật khẩu PostgreSQL dưới dạng ẩn, sao lưu trước khi ghi và trả kết quả kiểm toán tại `scripts/generated/tv3_audit_report.md`. Không chèn mật khẩu vào mã nguồn hoặc commit backup lên Git.

## 6. Tình trạng xác nhận

- **Đã đạt:** 64 dòng CSV, manifest SHA-256, xác minh PDF/hash lúc dry-run, 4 bài test Python, PowerShell không có lỗi cú pháp, xuất SQL.
- **Đã triển khai DB thực tế (25/10/2026):** Người thực hiện chạy `scripts/import_e01.ps1` trên máy PostgreSQL và cung cấp log đầy đủ 6/6 bước. Script xác nhận sao lưu toàn bộ database vào `scripts/generated/db-backups/before-e01-schema-20261025T073431506Z.dump`, áp dụng Flyway V10, nhập 64 dòng `SOURCE_LOCATED`, nâng 64 dòng lên `VERIFIED`, nhập lại lần nữa không phát sinh trùng.
- **Đã kiểm tra báo cáo kiểm toán tại workspace:** `scripts/generated/tv3_audit_report.md` ghi **54 kiểm tra, 0 FAIL, 0 PENDING**, gồm 5 phép kiểm E01 PASS: số lượng 64 không trùng, nội dung/trang nguồn, trạng thái/reviewer, trường hợp Tỉnh/Ích, Flyway V10.
- **Giới hạn biên bản:** Reviewer là Codex thực hiện lượt hai với cùng công cụ; `VERIFIED` ở đây chỉ áp dụng cho phép đối chiếu tên/nghĩa ngắn và không thay thế xác nhận độc lập của con người.
- **Công việc sau E01:** E02 — API tra cứu quẻ. Nghĩa tên `NAME_GLOSS` không đồng nghĩa dữ liệu luận giải chi tiết đã hoàn thành.
