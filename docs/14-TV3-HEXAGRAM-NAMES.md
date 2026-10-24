# TV3 — Bàn giao tên 64 quẻ có nguồn

**Cập nhật 24/10 — S01 đã hoàn thành:** Codex đã đối chiếu lượt hai theo sơ đồ, danh sách chữ in và đúng hash bản scan; 64 tên được duyệt với reviewer ghi đúng công cụ/lượt kiểm, không mạo nhận TV2 độc lập. Biên bản và giới hạn chuẩn hóa tên tại `19-S01-HEXAGRAM-NAME-REVIEW.md`; bảng từng dòng tại `data/hexagram_name_review.csv`. Nội dung/bảng “Chờ” bên dưới lưu hiện trạng lúc nhập ngày 23/10, không phải trạng thái hiện tại.

Ngày nhập: 23/10/2026. Bộ dữ liệu: `data/hexagram_names.csv`. Script: `scripts/import_hexagram_names.py`.

## Kết quả thực tế

- Đã cập nhật 64 bản ghi trong PostgreSQL `huyenco` từ nhãn tổ hợp sang tên quẻ truyền thống.
- `name_kind=CANONICAL_TITLE`, `verification_status=SOURCE_LOCATED`; `editor=TV3_AI_ASSISTED_SOURCE_TRANSCRIPTION_2026_10_23`; `reviewer=NULL`.
- Đã thêm bốn mục nguồn: ba trang tên và một trang sơ đồ. `source_sections`: 17 → 21. Không thêm trùng quẻ; vẫn 64 quẻ và 384 hào.
- Kiểm toán trực tiếp sau nhập: 0 FAIL, 3 PENDING. Các mục chờ là review tên, lời giải và dữ liệu Tam Thế; không có lời luận giải mới được tự tạo.

## Nguồn và cách đối chiếu

Sách: Mai Hoa Dịch Số, bản PDF người dùng cung cấp, 672 trang. SHA-256: `225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de`.

| Loại chứng cứ | Trang PDF (từ 1) | Trang in |
| --- | --- | --- |
| Tên quẻ 1–3 | 269 | 276 |
| Tên quẻ 4–40 | 270 | 277 |
| Tên quẻ 41–64 | 271 | 278 |
| Sơ đồ tên và hình sáu hào để đối chiếu cặp quái | 274 | 281 |
| Danh sách thứ tự bổ sung | 500–501 | 509–510 |

Đã đọc trực quan các trang trên. Tên giữ dạng ngắn trong sách, viết hoa đầu từ; không tự thêm các tiền tố như “Thuần”, “Thiên Địa”. Phân biệt Càn/Cấn, Ly/Lý và Bĩ/Bí. Tên “Hoán” dùng ở PDF 271; không thay bằng cách ghi khác ở danh sách PDF 501. Thứ tự 1–64 trong CSV là thứ tự Thượng kinh/Hạ kinh, không phải số Tiên thiên 1–8 dùng để lập quẻ.

Sơ đồ PDF 274 là ảnh scan nhỏ, có nhãn viết tay; toàn bộ ánh xạ tên–cặp quái vẫn cần TV2 review độc lập. SOURCE_LOCATED xác nhận đã định vị chứng cứ, chưa xác nhận mọi nét chữ/mọi hình là chính xác tuyệt đối. Một hào `true` là dương, `false` là âm; hào 1–3 thuộc hạ quái, hào 4–6 thuộc thượng quái.

## Danh sách bàn giao

| STT | Mã quẻ hiện có | Tên | Thượng | Hạ | PDF / in | Review TV2 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `H_CAN_CAN` | Càn | Càn | Càn | 269 / 276 | Chờ |
| 2 | `H_KHON_KHON` | Khôn | Khôn | Khôn | 269 / 276 | Chờ |
| 3 | `H_KHAM_CHAN` | Truân | Khảm | Chấn | 269 / 276 | Chờ |
| 4 | `H_CAN2_KHAM` | Mông | Cấn | Khảm | 270 / 277 | Chờ |
| 5 | `H_KHAM_CAN` | Nhu | Khảm | Càn | 270 / 277 | Chờ |
| 6 | `H_CAN_KHAM` | Tụng | Càn | Khảm | 270 / 277 | Chờ |
| 7 | `H_KHON_KHAM` | Sư | Khôn | Khảm | 270 / 277 | Chờ |
| 8 | `H_KHAM_KHON` | Tỷ | Khảm | Khôn | 270 / 277 | Chờ |
| 9 | `H_TON_CAN` | Tiểu súc | Tốn | Càn | 270 / 277 | Chờ |
| 10 | `H_CAN_DOAI` | Lý | Càn | Đoài | 270 / 277 | Chờ |
| 11 | `H_KHON_CAN` | Thái | Khôn | Càn | 270 / 277 | Chờ |
| 12 | `H_CAN_KHON` | Bĩ | Càn | Khôn | 270 / 277 | Chờ |
| 13 | `H_CAN_LY` | Đồng nhân | Càn | Ly | 270 / 277 | Chờ |
| 14 | `H_LY_CAN` | Đại hữu | Ly | Càn | 270 / 277 | Chờ |
| 15 | `H_KHON_CAN2` | Khiêm | Khôn | Cấn | 270 / 277 | Chờ |
| 16 | `H_CHAN_KHON` | Dự | Chấn | Khôn | 270 / 277 | Chờ |
| 17 | `H_DOAI_CHAN` | Tùy | Đoài | Chấn | 270 / 277 | Chờ |
| 18 | `H_CAN2_TON` | Cổ | Cấn | Tốn | 270 / 277 | Chờ |
| 19 | `H_KHON_DOAI` | Lâm | Khôn | Đoài | 270 / 277 | Chờ |
| 20 | `H_TON_KHON` | Quan | Tốn | Khôn | 270 / 277 | Chờ |
| 21 | `H_LY_CHAN` | Phệ hạp | Ly | Chấn | 270 / 277 | Chờ |
| 22 | `H_CAN2_LY` | Bí | Cấn | Ly | 270 / 277 | Chờ |
| 23 | `H_CAN2_KHON` | Bác | Cấn | Khôn | 270 / 277 | Chờ |
| 24 | `H_KHON_CHAN` | Phục | Khôn | Chấn | 270 / 277 | Chờ |
| 25 | `H_CAN_CHAN` | Vô vọng | Càn | Chấn | 270 / 277 | Chờ |
| 26 | `H_CAN2_CAN` | Đại súc | Cấn | Càn | 270 / 277 | Chờ |
| 27 | `H_CAN2_CHAN` | Di | Cấn | Chấn | 270 / 277 | Chờ |
| 28 | `H_DOAI_TON` | Đại quá | Đoài | Tốn | 270 / 277 | Chờ |
| 29 | `H_KHAM_KHAM` | Khảm | Khảm | Khảm | 270 / 277 | Chờ |
| 30 | `H_LY_LY` | Ly | Ly | Ly | 270 / 277 | Chờ |
| 31 | `H_DOAI_CAN2` | Hàm | Đoài | Cấn | 270 / 277 | Chờ |
| 32 | `H_CHAN_TON` | Hằng | Chấn | Tốn | 270 / 277 | Chờ |
| 33 | `H_CAN_CAN2` | Độn | Càn | Cấn | 270 / 277 | Chờ |
| 34 | `H_CHAN_CAN` | Đại tráng | Chấn | Càn | 270 / 277 | Chờ |
| 35 | `H_LY_KHON` | Tấn | Ly | Khôn | 270 / 277 | Chờ |
| 36 | `H_KHON_LY` | Minh di | Khôn | Ly | 270 / 277 | Chờ |
| 37 | `H_TON_LY` | Gia nhân | Tốn | Ly | 270 / 277 | Chờ |
| 38 | `H_LY_DOAI` | Khuê | Ly | Đoài | 270 / 277 | Chờ |
| 39 | `H_KHAM_CAN2` | Kiển | Khảm | Cấn | 270 / 277 | Chờ |
| 40 | `H_CHAN_KHAM` | Giải | Chấn | Khảm | 270 / 277 | Chờ |
| 41 | `H_CAN2_DOAI` | Tổn | Cấn | Đoài | 271 / 278 | Chờ |
| 42 | `H_TON_CHAN` | Ích | Tốn | Chấn | 271 / 278 | Chờ |
| 43 | `H_DOAI_CAN` | Quải | Đoài | Càn | 271 / 278 | Chờ |
| 44 | `H_CAN_TON` | Cấu | Càn | Tốn | 271 / 278 | Chờ |
| 45 | `H_DOAI_KHON` | Tụy | Đoài | Khôn | 271 / 278 | Chờ |
| 46 | `H_KHON_TON` | Thăng | Khôn | Tốn | 271 / 278 | Chờ |
| 47 | `H_DOAI_KHAM` | Khốn | Đoài | Khảm | 271 / 278 | Chờ |
| 48 | `H_KHAM_TON` | Tỉnh | Khảm | Tốn | 271 / 278 | Chờ |
| 49 | `H_DOAI_LY` | Cách | Đoài | Ly | 271 / 278 | Chờ |
| 50 | `H_LY_TON` | Đỉnh | Ly | Tốn | 271 / 278 | Chờ |
| 51 | `H_CHAN_CHAN` | Chấn | Chấn | Chấn | 271 / 278 | Chờ |
| 52 | `H_CAN2_CAN2` | Cấn | Cấn | Cấn | 271 / 278 | Chờ |
| 53 | `H_TON_CAN2` | Tiệm | Tốn | Cấn | 271 / 278 | Chờ |
| 54 | `H_CHAN_DOAI` | Quy muội | Chấn | Đoài | 271 / 278 | Chờ |
| 55 | `H_CHAN_LY` | Phong | Chấn | Ly | 271 / 278 | Chờ |
| 56 | `H_LY_CAN2` | Lữ | Ly | Cấn | 271 / 278 | Chờ |
| 57 | `H_TON_TON` | Tốn | Tốn | Tốn | 271 / 278 | Chờ |
| 58 | `H_DOAI_DOAI` | Đoài | Đoài | Đoài | 271 / 278 | Chờ |
| 59 | `H_TON_KHAM` | Hoán | Tốn | Khảm | 271 / 278 | Chờ |
| 60 | `H_KHAM_DOAI` | Tiết | Khảm | Đoài | 271 / 278 | Chờ |
| 61 | `H_TON_DOAI` | Trung phu | Tốn | Đoài | 271 / 278 | Chờ |
| 62 | `H_CHAN_CAN2` | Tiểu quá | Chấn | Cấn | 271 / 278 | Chờ |
| 63 | `H_KHAM_LY` | Ký tế | Khảm | Ly | 271 / 278 | Chờ |
| 64 | `H_LY_KHAM` | Vị tế | Ly | Khảm | 271 / 278 | Chờ |

## TV2 thực hiện đối chiếu

1. Mở đúng PDF và kiểm SHA-256; dùng cột trang PDF để tới trang, không trừ một hằng số cho mọi phần sách.
2. Đối chiếu tên với danh sách PDF 269–271, kiểm thêm danh sách PDF 500–501 nếu chữ mờ.
3. Kiểm cặp thượng/hạ và sáu hào ở PDF 274; chú ý Ký tế (`H_KHAM_LY`) và Vị tế (`H_LY_KHAM`), Thái (`H_KHON_CAN`) và Bĩ (`H_CAN_KHON`).
4. Ghi kết quả từng dòng, người kiểm và ngày kiểm vào biên bản; báo lại mã cụ thể nếu có sai khác.
5. Sau khi có xác nhận, TV3 tạo đợt cập nhật VERIFIED riêng cho đúng những dòng được duyệt. Xác nhận trước đây của TV2 cho quẻ hỗ/quẻ biến và tháng 5 không áp dụng tự động cho bộ tên này.

## Chạy lại hoặc nạp trên máy nhóm

Lệnh chuyên cho bước này (hỏi mật khẩu ẩn):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_hexagram_names.ps1
```

Lệnh tổng `scripts/import_all.ps1` đã tích hợp bước nhập tên sau bước tạo cấu trúc. Không cần Flyway mới, sử dụng schema V3/V4 hiện có. Script kiểm đúng hash, 64 mã/cặp/hình hào và sao lưu JSON tại `scripts/generated/db-backups/` trước khi cập nhật. Nó chỉ cập nhật nhãn cấu trúc DRAFT do seed tạo; giữ tên đã nhập giống nhau, không hạ VERIFIED, dừng và rollback nếu gặp tên thủ công khác/nguồn khác. Nếu tên VERIFIED trùng tên và nguồn, script giữ nguyên người duyệt.

Kiểm toán offline xuất `scripts/generated/tv3_seed_audit_report.md`; kiểm toán DB xuất `scripts/generated/tv3_audit_report.md` để không ghi đè bằng chứng kiểm toán thật bằng kết quả offline.

## Công việc tiếp theo

Bộ tên đã sẵn sàng cho TV2 review. TV3 tiếp tục nạp 60 Can Chi/ngũ hành từ Tam Thế PDF 11, sau đó 120 ô Số 13 và 36 phần giờ. Bảng `interpretations` hiện vẫn trống; tên quẻ hoàn chỉnh chưa đồng nghĩa chức năng luận giải F05 hoàn chỉnh.
