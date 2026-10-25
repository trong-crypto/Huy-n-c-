# Huyền Cơ — biên bản đối chiếu nguồn và bàn giao TV3 (23/10/2026)

## 1. Phạm vi và cách xác nhận

**Cập nhật D02 ngày 25/10:** đã đối chiếu ảnh hai lượt cùng Codex và nhập/VERIFIED dữ liệu Lộc 120 giao điểm/12 đoạn, tình duyên chung 60 ô/12 bài tám câu, 36 đoạn giờ và đủ 12 mốc + bốn quy tắc. Huyenco V9/447 ô/33 mục nguồn, 231 liên kết trang nội dung D02; audit 0 FAIL/1 PENDING (E01). Giữ reviewer TV2 tháng 5, chữ mờ Hưởng Lộc và nhãn khác; 40 phút là quy ước nhóm, không phải nguyên văn đã xác minh. Những dòng chưa nhập/chưa duyệt của mốc 23/10 dưới đây là lịch sử; trạng thái mới xem `29-D02-TAM-THE-DATA.md`.

**Cập nhật D01 ngày 24/10:** đã đọc lại toàn trang PDF32/35/36 hai lượt cùng Codex, đối chiếu/nhập/VERIFIED 51 giao điểm Số 11, 120 ô Số 13, 12 đoạn và hai quy tắc công danh. Sửa seed Thủy câu/chài tháng 9 thành tháng 8; giữ riêng nhãn cột/đoạn và liên kết biên tập theo thứ tự nguồn. Theo phân quyền mới ở tài liệu 15, reviewer ghi đúng cùng công cụ lượt hai, không giả danh TV2 độc lập. Biên bản 23/10 và mốc S03 bên dưới được giữ làm lịch sử; xem trạng thái hiện tại trong `25-D01-CAREER-DATA.md`.

**Cập nhật S03 ngày 24/10:** đã tìm được tài lộc PDF 41-42/in42-43, tình duyên chung cuối PDF 63 đến PDF 67/in64-68 và nghĩa tên 64 quẻ Mai Hoa PDF 269-271/in276-278. Các dòng SOURCE_NOT_LOCATED và việc chưa nhập/chưa duyệt trong biên bản 23/10 bên dưới là lịch sử; trạng thái nhập/duyệt hiện tại xem S01/S02 và biên bản mới `24-S03-SOURCE-MAP.md`. S03 chưa nhập DB hoặc nâng VERIFIED. Đã phát hiện sai chiều công thức nghề Số 13 và điểm nhãn Tỉnh/Ích ở nguồn nghĩa tên; không dùng số lượng bản ghi để che các vấn đề này.

Nguồn dùng đúng hai PDF trong thư mục Downloads của thành viên 3. Số trang **PDF** tính từ 1, khác với **trang in**. Đã quan sát trực tiếp các ảnh PDF 41–43 của *Mai Hoa Dịch Số* và PDF 12–15 của *Diễn Cầm Tam Thế Diễn Nghĩa*; thông tin nền về bảng nghề Số 11 lấy từ `docs/05-TAMTHE-RULES.md` và bộ seed, **chưa phải kết quả kiểm chéo toàn trang**. Dấu SHA-256 mỗi PDF do `scripts/import_book_knowledge.py` tính để phân biệt ấn bản.

`SOURCE_LOCATED`: đã tìm trang liên quan. `SOURCE_AMBIGUOUS`: có nhiều cách hiểu. `BLOCKED_SOURCE_CONFLICT`: xung đột bản in/quyết định nhóm. Chỉ chuyển thành `VERIFIED` sau khi **TV2 kiểm độc lập, TV3 đối chiếu lại và ghi biên bản**. Chạy code qua test không thay thế việc này.

**Cập nhật 23/10/2026:** Chủ dự án thông báo TV2 đã xác nhận các mục chờ: `MH-MUTUAL`, `MH-CHANGE` và **riêng mốc giờ tháng 5**. Thông tin này được ghi vào nhật ký `docs/07-DECISION-LOG.md` và migration V4. Trạng thái `VERIFIED` được ghi trong database **sau khi Flyway áp dụng V4**, với reviewer nêu rõ là xác nhận qua chủ dự án. Đây không phải chữ ký trực tiếp của TV2. Quy tắc `TT-GIO-SINH` tổng thể vẫn đang chờ kiểm toàn bộ 12 tháng.

## 2. Bằng chứng đã đối chiếu trực quan

| Mã | Sách, trang in / trang PDF | Nội dung quan sát | Đánh giá hiện tại |
| --- | --- | --- | --- |
| `MH-CHANGE` | Mai Hoa tr. 46 / PDF 41 | Hào động đổi âm thành dương hoặc dương thành âm; chỉ đổi một hào. | TV2 đã xác nhận theo thông báo của chủ dự án; V4 chuyển `VERIFIED` |
| `MH-MUTUAL` | Mai Hoa tr. 47–48 / PDF 42–43 | Hỗ hạ lấy hào 2, 3, 4; hỗ thượng lấy hào 3, 4, 5 (đếm từ dưới lên). | TV2 đã xác nhận theo thông báo của chủ dự án; V4 chuyển `VERIFIED` |
| `MH-TIME` | Mai Hoa tr. 50 / PDF 45 | Tài liệu quy tắc nêu bản in có mâu thuẫn phép trừ 8 so với quy tắc trừ 6; nhóm chọn modulo 6. | `BLOCKED_SOURCE_CONFLICT`; chưa kiểm độc lập trang 45 trong đợt này |
| `MH-OBJECT-COUNT` | Mai Hoa tr. 51 / PDF 46 | Quy ước nhóm: thượng từ số vật, hạ từ chỉ số giờ, hào từ tổng chia 6; “số quẻ” còn đa nghĩa. | `SOURCE_AMBIGUOUS`; chưa kiểm độc lập trang 46 trong đợt này |
| `TT-GIO-SINH` | Tam Thế tr. 13–16 / PDF 12–15 | Mốc giờ đầu giờ Dần theo 12 tháng, mỗi chi kế tiếp cách 120 phút. | `SOURCE_LOCATED` (11 tháng); TV2 còn review |
| `TT-GIO-SINH-5` | Tam Thế tr. 15 / PDF 14 | 05:20–07:19 nguồn **in Dậu**, kế sau Mão; nhóm chọn **Dần** để giữ chuỗi liên tục. | TV2 đã xác nhận theo thông báo của chủ dự án; V4 chuyển **ô tháng 5** sang `VERIFIED`, giữ cả hai giá trị |
| `TT-CONG-DANH-11` | Tam Thế tr. 33 / PDF 32 | 51 giao điểm của ba nhóm nghề đã nhập từ ma trận tài liệu. | `SOURCE_LOCATED`; cần đối chiếu trực tiếp từng ô |

## 3. Ca mẫu bàn giao TV2 (không tự đổi VERIFIED)

Hàm `LINES` dùng dãy sáu hào từ **dưới lên**:

```json
{
  "linesBottomUp": [true, false, true, false, true, false],
  "movingLine": 3
}
```

Kỳ vọng cấu trúc: quẻ chủ `[true,false,true,false,true,false]`; quẻ hỗ `[false,true,false,true,false,true]`; quẻ biến `[true,false,false,false,true,false]`. Thử thêm toàn bộ 64 mẫu 6 hào × 6 vị trí đổi và các trường hợp hào 1, 6, không hợp lệ 0, 7. Mẫu này xác nhận cách áp dụng quy tắc đã đọc, **không phải ví dụ được chép nguyên từ sách**.

Đối với tháng âm 5, giờ địa phương: `05:19→Sửu`, `05:20→Dần`, `07:19→Dần`, `07:20→Mão` theo quyết định nhóm. Chương trình `scripts/audit_tv3.py` kiểm 24 giờ liên tục cho cả 12 tháng; kết quả từ dữ liệu seed không xác nhận độc lập mọi ô của sách.

## 4. Những nội dung TV3 còn phải làm

| Dữ liệu / mã | Tình trạng | Việc TV3 thực hiện và bàn giao |
| --- | --- | --- |
| 64 quẻ, 384 hào | Đã nạp cấu trúc và 64 tên có nguồn; tên ở SOURCE_LOCATED | TV2 review bảng `14-TV3-HEXAGRAM-NAMES.md`, tên PDF 269–271 và sơ đồ PDF 274 trước VERIFIED |
| 60 Can Chi / nạp âm `TT-NGU-HANH` | Sách tr. 12 / PDF 11; chưa nhập 60 ô | Chép 60 cặp Can Chi và hành mệnh, đảm bảo khóa không trùng; TV2 review |
| 120 ô `TT-CONG-DANH-13` | Sách tr. 36–38 / PDF 35–37; chưa nhập | Lập ma trận 10 Can × 12 tháng, so từng ô của bảng in; reviewer độc lập |
| 36 ô `TT-36-PHAN` | Sách tr. 26–29 / PDF 25–28; chưa nhập | Chép từng đoạn luận, kiểm ranh ba phần của từng giờ; không tự sinh lời giải |
| `TT-TAI-LOC` và `TT-TINH-DUYEN` | `SOURCE_NOT_LOCATED` trong phạm vi kiểm tra hiện tại | Tìm trang mục tương ứng và thống nhất quy tắc, ghi `SOURCE_AMBIGUOUS` nếu còn không rõ |
| `LUNAR-CONVERSION` | Chưa có nguồn thuật toán hai chiều đã kiểm | Chọn nguồn thư viện/quy tắc, kiểm tháng nhuận, năm âm, Can Chi, múi giờ Việt Nam; ghi phiên bản |
| Lịch sử F08 | Chưa có schema/API hoàn chỉnh | Thiết kế bản ghi theo ownerId ổn định, lưu chủ động, truy cập/xóa theo owner; phối hợp TV2 bảo mật |

### Điều kiện bàn giao

TV3 gửi TV2: trang in/PDF, SHA-256 PDF, giá trị đầu vào, expected, trạng thái, người nhập và chữ ký kiểm của người thứ hai. TV2 chỉ bật các nhánh phản hồi thật khi quy tắc và dữ liệu tương ứng đã đủ chứng cứ. Phần chưa đủ trả `RULE_NOT_AVAILABLE` theo hợp đồng.
