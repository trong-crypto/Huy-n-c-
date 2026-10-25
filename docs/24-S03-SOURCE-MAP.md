# S03 - Bản đồ nguồn nghiệp vụ và việc cần nhập tiếp

Ngày khảo sát: **24/10/2026**. Người/công cụ thực hiện: **Codex**. Nhánh: `codex/s03-source-map`.

## 1. Kết quả và giới hạn của S03

**Cập nhật sau khảo sát:** D01 đã đối chiếu/nhập/duyệt phần công danh, xem `25-D01-CAREER-DATA.md`. Các CSV/manifest và trạng thái trong hồ sơ S03 này giữ nguyên tại mốc khảo sát, không đại diện trạng thái DB sau D01. Nguồn tài lộc/tình duyên và nghĩa tên quẻ vẫn thuộc D02/E01.

**Hoàn thành khảo sát nguồn S03**, gồm ma trận 13 mục nguồn, địa chỉ cho đủ 64 nghĩa tên quẻ, các đầu vào/cách tra và danh sách xung đột cần xử lý. Đây là lượt đọc ảnh nguồn để chuẩn bị triển khai D01/D02/E01. Chưa phải nghiệm thu các chức năng F04/F05.

- Hai file scan còn nguyên hash đã dùng trong S01/S02: Mai Hoa 672 trang, Tam Thế 360 trang. Không có lớp text ở cả hai PDF; khảo sát qua ảnh Poppler, không dùng kết quả OCR làm bản chép đã duyệt.
- Tài lộc và tình duyên **đã định vị được nguồn**. Các ghi nhận SOURCE_NOT_LOCATED trước S03 là hiện trạng lịch sử; không còn dùng để mô tả kết quả khảo sát mới.
- Có đủ **64 nghĩa tên ngắn** tại Mai Hoa PDF 269-271 / trang in 276-278. Đây là nội dung tri thức tra cứu; không tương đương 64 bài dự đoán đầy đủ về công danh/tài lộc/tình duyên hoặc 384 lời hào.
- Chưa nhập dữ liệu S03 vào PostgreSQL, chưa đổi trạng thái quy tắc runtime, chưa sửa giao diện. Các lời luận mới chưa được VERIFIED.
- Lượt kiểm sau phải mở lại ảnh và chép/đối chiếu từng ô; ghi đúng cùng người/công cụ nếu vẫn do Codex thực hiện. Không coi hai lượt của cùng công cụ là hai người kiểm độc lập.

## 2. Hồ sơ bàn giao

| File | Nội dung |
| --- | --- |
| `data/s03_source_matrix.csv` | 13 mục: chức năng/category, rule, đầu vào, chiều tra, trang PDF/in, phạm vi đầu ra, blocker và task tiếp |
| `data/s03_hexagram_source_map.csv` | 64 mã quẻ khớp bộ tên hiện có; nghĩa tên ứng viên, trang/định vị trong danh sách, trạng thái riêng của nội dung |
| `data/s03_source_manifest.json` | Hash hai PDF và các CSV, trang đã khảo sát, phương pháp, người thực hiện và giới hạn duyệt |
| `scripts/check_s03_sources.py` | Kiểm chỉ đọc: hash, 64 mã/khóa/trang, cấu trúc ma trận và metadata; tùy chọn dựng lại ảnh các trang có trong ma trận |

Ảnh cục bộ nằm tại `work/s03/` (ignored). File gốc nằm trong Downloads của người dùng; không chép toàn bộ sách vào Git. Manifest không phụ thuộc đường dẫn tuyệt đối của máy này.

## 3. Ma trận triển khai Tam Thế

Trang PDF tính từ 1. Trong các mục Tam Thế dưới đây, trang in = trang PDF + 1; kiểm số trang trên ảnh thay vì suy ra cho toàn bộ sách.

| Mục | PDF / trang in | Input sau chuẩn hóa lịch | Cách tra và output | Việc tiếp |
| --- | --- | --- | --- | --- |
| CAREER - Số 11 | 32 / 33 | Hành mệnh năm âm, tháng âm | Tìm tất cả tháng trùng trong hàng hành, trả nhiều nghề nếu có | D01 kiểm 51 giao điểm đã nhập và điều kiện không có giao điểm |
| CAREER - Số 13 nghề nghiệp | 35-36 / 36-37 | Can năm âm, tháng âm | Tìm tháng trong hàng Can, lấy nhãn ở đầu cột rồi đọc đoạn tương ứng | D01 chép 120 ô, 12 đoạn, xử lý nhãn khác giữa bảng và giải nghĩa |
| WEALTH - bảng Lộc | 41-42 / 42-43 | Can năm âm, tháng âm | Tìm **mọi** cột có giá trị tháng trùng, trả danh sách nhãn Lộc theo thứ tự cột cùng đoạn giải thích | D02 chép 120 ô và 12 đoạn; ghi rõ các khóa không có nguồn, không tự bù |
| LOVE - phần nam nữ chung | Cuối 63, bảng 64, các đoạn 64-67 / 64-68 | Hành mệnh năm âm, tháng âm | Bảng 5 hành x 12 nhãn Trường Sanh...Dưỡng; chọn cột có tháng trùng, đọc trọn đoạn gồm phần nối trang | D02 chép 60 ô, 12 đoạn và ghi phạm vi luận hôn nhân chung |
| 36 phần giờ | 25-28 / 26-29 | Chi giờ theo Tam Thế, phần đầu/giữa/sau | 36 đoạn có nội dung đời sống pha trộn | D02 kiểm đủ đoạn và căn cứ phân giờ; không dùng thay cho ba bảng category trên |

### 3.1. Chốt phạm vi LOVE ban đầu

Dùng đúng mục **“Coi số vợ chồng, Nam nữ coi chung”** bắt đầu cuối PDF 63, bảng PDF 64. Tuyến này phù hợp hợp đồng hiện có vì không cần thêm giới tính hoặc dữ liệu người thứ hai.

Không dùng mặc định các phần riêng cho nam/nữ tại PDF 67-72, danh sách Cô Thần/Quả Tú ở PDF 62, hay bảng năm-giờ ở PDF 63. Đây là các quy tắc khác, có đầu vào và điểm mơ hồ riêng. Không gọi kết quả tuyến chung là kiểm hợp tuổi hai người; không thêm input người yêu/vợ/chồng vào request hiện tại.

Ca đối chiếu cho D02: **Kim + tháng 4 -> Trường Sanh; Kim + tháng 1 -> Tuyệt; Mộc + tháng 1 -> Lâm Quan; Hỏa + tháng 12 -> Dưỡng**. Các nhãn này đọc trực tiếp từ bảng PDF 64; chưa phải phản hồi API đã triển khai. Trường Sanh/Mộc Dục ở PDF 64; Quan Đài nối PDF 64-65; Lâm Quan/Đế Vượng/Suy ở PDF 65; Suy nối PDF 65-66; Bịnh/Tử/Mộ ở PDF 66; Tuyệt nối PDF 66-67; Thai/Dưỡng ở PDF 67.

### 3.2. WEALTH có nhiều kết quả và thiếu khóa ngay trong bản in

Ví dụ hàng **Giáp** của bảng PDF 41, theo thứ tự 12 cột: **1, 11, 9, 7, 5, 3, 1, 11, 9, 7, 5, 3**. Vì vậy:

- Giáp + tháng 1 có hai nhãn **Hưởng Lộc, Sát Lộc**. Không lấy kết quả đầu tiên rồi bỏ nhãn còn lại.
- Giáp + tháng 2 **không có giao điểm** trong bảng này. Không tự đổi sang tháng 1, không suy diễn ngược hoặc coi là không có tài lộc.
- Mỗi hàng có sáu tháng phân biệt, mỗi tháng lặp hai lần; trước khi hoàn thành D02 phải đối chiếu cả 120 ô và thống kê coverage thực từ bản chép. Không áp công thức chung thay cho việc kiểm ô.
- Nhãn bảng **Bất lộc** khác tiêu đề đoạn **Bối Lộc**, nhãn bảng **Bịch lộc** khác đoạn **Bịnh Lộc**. Lưu cả hai giá trị; chỉ nối bằng quyết định alias có biên bản, không sửa scan hoặc tự VERIFIED.

Chốt cách cài ban đầu: tra toàn bộ giao điểm có nguồn, giữ thứ tự; khóa không có hoặc nhãn chưa giải quyết trả `RULE_NOT_AVAILABLE` theo hợp đồng hiện tại. D02 phải ghi rõ các ngày bị giới hạn. Không gọi F04 hoàn thành đầy đủ nếu WEALTH còn thiếu các đầu vào thuộc phạm vi công bố.

Đã định vị thêm các bảng “sang hèn” theo Chi/tháng tại PDF 43-46 và ruộng đất theo hành/tháng tại PDF 49-50. Đây là ứng viên mở rộng có địa chỉ riêng; không tự coi nội dung ruộng đất là lời giải tài lộc tổng quát, không âm thầm dùng làm fallback cho bảng Lộc. D02 phải định nghĩa từng subrule và kiểm nội dung trước khi kết hợp.

### 3.3. Sửa sai chiều công thức CAREER Số 13

Tài liệu cũ ghi `index=(stemIndex+lunarMonth-1)%12`; công thức này **không khớp chiều tra bảng** PDF 35.

Ca phản chứng đọc trực tiếp: hàng **Ất**, tháng **1** nằm cột cuối **Thứ Tác**, không phải cột Trùng Tổ. Giáp tháng 1 ở Quan nhơn; Ất tháng 2 cũng ở Quan nhơn; Quý tháng 1 ở cột Đã Thết.

Chốt D01 dùng bảng chép tường minh. Với đúng ma trận dịch vòng quan sát được, công thức ứng viên là `floorMod(lunarMonth - 1 - stemIndex, 12)`, Giáp=0...Quý=9. Đây là phép rút gọn cần kiểm lại đủ 120 ô; chưa cấp VERIFIED cho công thức hoặc nội dung Số 13.

Một số tiêu đề cột và đoạn giải nghĩa không đồng nhất: **Trùng Tổ / Trùng Tế**, **Đã Thết / Đã Thiết**, **Sự Thoát / Sư Thuật**, **Thứ Tác / Thủ Tất**. D01 lưu nhãn gốc theo vị trí, ghi alias được xét riêng; không tự sửa tất cả thành một tên. Trang PDF 37 trở đi có các bảng khác cùng phần Thiên Can, không gộp số ô của chúng vào 120 ô nghề nghiệp PDF 35.

### 3.4. Giờ và dữ liệu nền vẫn có phạm vi riêng

S02 đã duyệt 60 Can Chi -> hành, nhưng C01 vẫn phải xác định **năm âm lịch** trước khi tra, nhất là ngày Dương trước Tết. Không lấy năm Dương hoặc tuổi số neo 1969 để thay thế.

Số 8 PDF 25 mở đầu trỏ sang Số 4 khi nói kiểm giờ; bảng giờ đã định vị ở Số 5. Lưu đây là điểm tham chiếu cần giải quyết ở D02. Chia 120 phút thành ba phần 40 phút vẫn là suy luận triển khai, không phải câu nguyên văn đã xác minh. Bảng năm-giờ ở PDF 63 có dấu Tý/Tỵ và cách nhóm cần kiểm lại; không mở subrule này bằng dữ liệu suy đoán.

## 4. Nguồn cho tra cứu 64 quẻ

Đã xác định danh sách có nghĩa tên riêng cho đủ 64 mục:

| Vị trí theo thứ tự quẻ | PDF / trang in | Vị trí trong trang |
| --- | --- | --- |
| 1-3: Càn, Khôn, Truân | 269 / 276 | Chú thích cuối trang, phần Thượng kinh |
| 4-30: Mông...Ly | 270 / 277 | Phần Thượng kinh |
| 31-40: Hàm...Giải | 270 / 277 | Phần Hạ kinh |
| 41-64: Tổn...Vị tế | 271 / 278 | Tiếp phần Hạ kinh |

Chốt loại nội dung E01 ban đầu là **NAME_GLOSS** (nghĩa tên quẻ), tách khỏi lời dự đoán cá nhân. Mỗi dòng CSV có code `H_THUONG_HA`, tên chuẩn hiện có, nghĩa ứng viên, trang và ordinal trong phần. Ví dụ: Càn -> Trời; Khôn -> Đất; Ký tế -> Sự đã rồi; Vị tế -> Việc chưa xong. Đây là bản chép ứng viên, chưa phải các bản ghi `interpretations` được duyệt.

Điểm cần giữ riêng: dòng thứ 8 trên PDF 271, tương ứng quẻ Tỉnh theo vị trí danh sách, **in “Ích: Giếng nước”**; không đổi tên chuẩn `H_KHAM_TON` thành Ích và không sửa scan. Dòng nội dung này giữ `SOURCE_AMBIGUOUS` đến khi E01 đối chiếu nguồn/ghi quyết định. Việc tên Tỉnh đã VERIFIED theo sơ đồ S01 không tự duyệt nghĩa tên ở một dòng khác.

Chương XVII-XVIII PDF 585-589 / in 596-600 bàn thêm về tượng/nghĩa một số quẻ, có ích để bổ sung liên kết nguồn. Không phải 64 bài luận đầy đủ. Mục lục PDF 660 chỉ dẫn các chương hôn nhân/cầu danh/cầu tài ở in 156/162/164; S03 chưa kiểm các trang nội dung đó và không dùng chúng làm dữ liệu Tam Thế.

**E01 còn phải làm:** đối chiếu lượt sau từng dòng, xử lý dòng Tỉnh/Ích, thêm metadata duyệt cho `interpretations` qua migration mới, nhập idempotent, rồi kiểm đủ 64 code. Nếu sản phẩm yêu cầu lời luận dài hoặc dự đoán riêng cho từng quẻ, nghĩa tên ngắn không đáp ứng phần yêu cầu đó; giữ giới hạn trong F05/README, không sinh văn bản để đủ số lượng.

## 5. Trình tự công việc sau S03

1. **C01:** chọn/cố định nguồn lịch, triển khai chuyển đổi hai chiều và Can Chi với bộ chuẩn độc lập.
2. **B04:** dùng lịch đã kiểm để hoàn thiện Mai Hoa TIME, giữ quyết định modulo 6 và metadata TEAM_DECISION khi áp dụng.
3. **D01/D02:** nhập và đối chiếu các bảng/đoạn ở mục 3; chốt alias và coverage trước khi mở runtime.
4. **D03:** kết hợp `CAREER/WEALTH/LOVE` đúng category; `entries[]` chứa đủ kết quả và nguồn; category được yêu cầu chưa đủ thì lỗi toàn request theo hợp đồng đã chốt.
5. **E01/E02:** duyệt nội dung tra quẻ theo phạm vi NAME_GLOSS, sau đó API tìm/lọc/phân trang/chi tiết.

S03 không thay đổi schema hay nâng quyền chạy các rule. Không cần chạy lại bootstrap database cho công việc khảo sát này.

## 6. Kiểm tra hồ sơ

Chạy tại repo root:

```powershell
python .\scripts\check_s03_sources.py
```

Chương trình kiểm hash hai file trong Downloads mặc định; dùng `--pdf-dir <thu_muc>` khi chuyển máy. Dùng `--render-dir work/s03-recheck` nếu muốn dựng lại các trang của ma trận qua `pdftoppm`. Kiểm này chỉ chứng minh hồ sơ gắn đúng file và không thiếu mã/trang, không thay lượt đối chiếu nội dung hoặc xác minh thuật toán.
