# Thành viên 3 — chuẩn bị 64 cấu trúc quẻ và 384 hào

**Cập nhật 23/10/2026:** Đã nạp 64 tên truyền thống có nguồn vào database ở trạng thái SOURCE_LOCATED. Xem `14-TV3-HEXAGRAM-NAMES.md` để kiểm từng dòng và bàn giao TV2. Các mô tả nhãn cấu trúc dưới đây ghi lại giai đoạn chuẩn bị trước khi nhập tên.

## Mục tiêu, giới hạn

Theo `docs/04-MAIHOA-RULES.md`, mỗi quái có ba hào (âm/dương từ dưới lên). Ghép **hạ quái** vào ba vị trí 1–3 và **thượng quái** vào ba vị trí 4–6 tạo 8 × 8 = **64 cấu trúc**, mỗi cấu trúc 6 hào → **384 dòng hào**. Các cấu trúc này hỗ trợ TV2 tra quẻ theo mã cặp thượng/hạ hoặc dãy hào.

**Giới hạn:** trường `name` hiện chỉ là nhãn tổ hợp `[CẤU TRÚC] <thượng> trên <hạ>`, **không phải tên 64 quẻ truyền thống** của Kinh Dịch. Không có lời luận giải. Các dòng này có `name_kind=STRUCTURAL_LABEL`, `verification_status=DRAFT`, `source_section_id=NULL`, `reviewer=NULL`. Chức năng F05 chỉ đạt điều kiện nghiệm thu khi bổ sung tên, trích nguồn và lời luận giải được TV2/TV3 kiểm chéo. Không coi bản ghi cấu trúc là thông tin đã duyệt.

## Schema và mã định danh

Migration mới `server/src/main/resources/db/migration/V3__hexagram_provenance.sql` thêm `name_kind`, `verification_status`, `source_section_id`, `editor`, `reviewer` vào `hexagrams`. Không sửa Flyway V1/V2 đã áp dụng. Check constraint chỉ cho trạng thái `VERIFIED` khi `name_kind=CANONICAL_TITLE`, có trang nguồn và có reviewer.

Mã cấu trúc là `H_<UPPER_CODE>_<LOWER_CODE>`, ví dụ `H_CAN_KHON`, `H_KHAM_LY`. Ví dụ `H_CAN_KHON`: Càn trên Khôn nên `lines_bottom_up=[false,false,false,true,true,true]`. Có đủ 64 tổ hợp duy nhất, mã và thứ tự hào ổn định.

## Nhập và kiểm tra dữ liệu

Từ PowerShell thư mục gốc dự án chạy **một lệnh**; script yêu cầu mật khẩu ẩn, áp dụng Flyway V3, nhập lại phần seed cũ không nhân đôi, bổ sung 64 cấu trúc / 384 hào rồi chạy kiểm toán read-only:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_all.ps1
```

Nếu script chạy thành công trên DB trước đó có đúng 104 bản ghi, dự kiến bảng thêm `hexagrams=64`, `hexagram_lines=384`, `interpretations=0`. Tổng hàng của 9 bảng = **552**. Lệnh lặp lại không thay đổi các bản ghi đã duyệt nhờ `ON CONFLICT DO NOTHING`. SQL ở `scripts/seed_hexagram_structure.sql` có transaction và kiểm tra cấu trúc trước COMMIT; một phần sai thì rollback toàn lô mới.

Xem báo cáo sau khi chạy: `scripts/generated/tv3_audit_report.md`. Kiểm SQL thủ công nếu cần:

```sql
SELECT verification_status, name_kind, count(*)
FROM hexagrams GROUP BY verification_status, name_kind;

SELECT h.code, h.name, h.lines_bottom_up,
       array_agg(l.is_yang ORDER BY l.line_number) AS lines_from_detail
FROM hexagrams h JOIN hexagram_lines l ON l.hexagram_code=h.code
GROUP BY h.code, h.name, h.lines_bottom_up
ORDER BY h.code;
```

## Việc tiếp theo để F05 có tên và nội dung thật

TV3 định vị bảng/từng quẻ trong PDF gốc, nhập tên sách cùng số trang, lưu `source_section_id`, `name_kind=CANONICAL_TITLE`, `editor`. TV2 xác minh độc lập, ký `reviewer`; sau khi số liệu và nội dung hợp lệ mới đổi `verification_status=VERIFIED`. Lời luận giải có nguồn để riêng trong `interpretations` và cần quy tắc xét duyệt riêng. Tài lộc, tình duyên, 60 Can Chi và 120 ô Tam Thế cũng còn thiếu (xem `docs/12-TV3-SOURCE-REVIEW.md`).
