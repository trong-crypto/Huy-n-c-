# D02 — dữ liệu tài lộc, tình duyên chung và giờ sinh

**Cập nhật sau D03 ngày 25/10:** TamTheService đã triển khai ba category, WEALTH/LOVE đã mở SOURCE_VERIFIED và kiểm STOMP thật; xem `30-D03-TAM-THE-HANDOFF.md`. Mục D03 chưa triển khai/DISABLED/tiếp theo dưới đây ghi trạng thái tại thời điểm bàn giao D02, không còn là việc chờ hiện tại. Không có thay đổi nguồn hay VERIFIED trong D03.

Ngày đối chiếu: **25/10/2026**. Phụ trách: Codex theo ủy quyền của chủ dự án kiêm TV2 + TV3. Hai lượt nhìn ảnh do **cùng công cụ** thực hiện; không phải hai người kiểm độc lập và không giả chữ ký TV2.

## 1. Phạm vi dữ liệu

Nguồn: PDF *Diễn Cầm Tam Thế Diễn Nghĩa* người dùng cung cấp, 360 trang, SHA-256 `7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d`. Số trang PDF bắt đầu từ 1. Trang in ở các mục này bằng trang PDF + 1.

| Mục | Nội dung nhập/duyệt | Trang PDF | Khóa |
| --- | --- | --- | --- |
| TT-TAI-LOC | 120 giao điểm, liên kết 12 đoạn Lộc | 41–42 | Can năm âm + tháng âm; có thể nhiều kết quả |
| TT-TINH-DUYEN | 60 giao điểm, liên kết 12 bài thơ, mỗi bài 8 câu | Dẫn cách coi 63, bảng 64, thơ 64–67 | Hành mệnh năm âm + tháng âm; nam nữ chung |
| TT-36-PHAN | 36 đoạn đầu/giữa/sau của 12 Chi | 25–28 | Chi giờ + phần 1/2/3 |
| TT-GIO-SINH | Kiểm đủ 12 mốc và chuỗi ngày/đêm | 12–15 | Tháng âm |

Tổng bổ sung **216 bản ghi tra cứu**; 60 đoạn nội dung riêng = 12 Lộc + 12 thơ + 36 phần giờ. Nội dung dùng lại theo đúng bảng, không phải 216 lời luận khác nhau. V9 thêm `tam_the_lookup_source_pages` để giữ đầy đủ trang của một đoạn. Có **231 liên kết trang** cho 216 bản ghi mới; ba bài Quan Đài/Suy/Tuyệt kéo qua hai trang, mỗi bài được năm hành tham chiếu.

`VERIFIED` ở đây xác nhận ánh xạ và bản chép trong phạm vi công bố, không xác nhận dự đoán đúng với thực tế hay xác định đầy đủ ấn bản xuất bản. Giữ cách viết cổ, chuẩn hóa khoảng trắng/dấu câu. Bài Hưởng Lộc có một chữ bị hỏng trong scan, lưu **`[CHU_MO]`** thay vì đoán chữ; việc duyệt bản chép có ghi rõ khoảng thiếu này. LOVE chỉ lấy **tám câu thơ** theo hướng dẫn PDF63, không lấy các lời tóm tắt in nghiêng (dòng tóm tắt Suy bị mờ), không nhập chương riêng cho nam/nữ.

## 2. Quyết định để D03 triển khai ngay

### Tài lộc

Các số trong ô là **tháng sinh**, không phải chỉ số kết quả. Tìm mọi cột có số bằng tháng nhập trong hàng Can năm âm, trả theo thứ tự cột 1–12.

- Giáp/tháng 1 → `WEALTH_C01` Hưởng lộc **và** `WEALTH_C07` Sát lộc.
- Giáp/tháng 2 → **không có giao điểm** trong nguồn.
- Toàn bảng chỉ phủ **60/120 khóa Can–tháng**, mỗi khóa có đúng hai kết quả; 60 khóa còn lại không có trong bảng. D03 phải trả `RULE_NOT_AVAILABLE` cho category WEALTH không được hỗ trợ, không kết luận người đó không có tài lộc và không dùng bảng khác bù tự động.
- Cột 3 in **Bất lộc**, đoạn in **Bối Lộc**; cột 11 in **Bịch lộc**, đoạn in **Bịnh Lộc**. Lưu riêng hai nhãn, liên kết theo vị trí tương ứng trong chuỗi 12 mục: `DEC-20261025-D02-EDITORIAL`. Đây là liên kết biên tập, không khẳng định cách viết giống nhau.

### Tình duyên chung

Tra bảng theo hành lấy từ **TT-NGU-HANH/năm âm** và tháng âm. Không yêu cầu giới tính hay người thứ hai cho tuyến này. Không trộn các bảng Cô Thần/Quả Tú, năm–giờ hoặc chương nam/nữ riêng vào tuyến chung.

Ca đối chiếu: Kim/tháng 4 → Trường Sanh; Kim/tháng 1 → Tuyệt; Mộc/tháng 1 → Lâm Quan; Hỏa/tháng 12 → Dưỡng. Mỗi hành có đủ 12 tháng, mỗi khóa đúng một bài thơ. Đọc cả chuỗi `page_order`, không chỉ `content_source_section_id` của trang đầu.

### Giờ và 36 phần

| Tháng âm | Mốc Dần | PDF chứa chuỗi ngày/đêm |
| --- | --- | --- |
| 1, 9 | 04:20 | 12 |
| 2, 8 | 04:00 | 12–13 |
| 3, 7 | 04:30 | 13 |
| 4, 6 | 04:40 | 13–14 |
| 5 | 05:20 | 14 |
| 11 | 03:40 | 14–15 |
| 10, 12 | 04:00 | 15 |

Sau mốc là chuỗi Dần, Mão, Thìn, Tỵ, Ngọ, Mùi, Thân, Dậu, Tuất, Hợi, Tý, Sửu, mỗi Chi 120 phút. Với độ chính xác phút:

```text
offset = floorMod(phút_trong_ngày - mốc_tháng, 1440)
vị_trí_chi = offset / 120 (chia nguyên)
phần = (offset % 120) / 40 + 1 (chia nguyên)
```

Chốt `[0,40)` đầu, `[40,80)` giữa, `[80,120)` sau; quấn qua 00:00. **40 phút là quy ước triển khai**, không phải câu chữ in đã xác minh. `DEC-20261025-D02-HOUR-PARTS` được ghi theo quyền quyết định kỹ thuật đã giao:

1. Giữ nguyên chữ nguồn **Dậu** và dùng **Dần** tháng 5 theo xác nhận cũ; reviewer/ngày/ghi chú TV2 của ô tháng 5 được bảo toàn.
2. PDF25 dẫn “Số 4” khi kiểm giờ; dùng bảng **Số 5 PDF12–15** vì Số 4 là bảng hành mệnh.
3. PDF15, đêm tháng 11, dòng đầu in **3:40–5:30**, dòng sau bắt đầu **5:40**. Triển khai điểm cuối **5:39**, phù hợp các khoảng 120 phút còn lại, không để hở chín phút; giữ nguyên dấu vết chữ in và không gọi là đính chính của NXB.
4. Giữ các chữ/tuổi lạ trong lời luận, ví dụ đầu Thìn “12 tuổi”, giữa Thìn “44 tuổi”, cuối Hợi “Khắc của”; không tự sửa nội dung dự đoán.

Catalog TT-GIO-SINH dùng **TEAM_DECISION** để phép phân giờ mang theo quyết định trên. TT-36-PHAN vẫn là **SOURCE_VERIFIED cho nội dung chép**, không bao gồm khẳng định sách ghi mỗi phần 40 phút. Nếu D03 dùng 36 phần, phải gộp bằng chứng tính giờ và nội dung, không che phần quyết định nhóm. WEALTH/LOVE vẫn DISABLED trong catalog tới khi D03 triển khai service; duyệt dữ liệu không tự mở endpoint.

## 3. Hồ sơ và bộ nhập

- `data/tam_the_d02_source.json`: hàng bảng, 60 đoạn và trang.
- `data/tam_the_d02_columns.csv`: lượt đọc theo cột, đối chiếu với hàng bảng.
- `data/tam_the_d02_anchors.csv`: 12 mốc và đủ trang ngày/đêm.
- `data/tam_the_d02_review.json`: hash PDF, hash tệp, phạm vi và quyết định; hash biên bản được pin trong bộ nhập.
- `scripts/import_tam_the_d02.py`: mặc định dry run; `--apply` nhập, `--apply --review` áp dụng biên bản. Kiểm hash PDF, khóa/coverage, dữ liệu đã duyệt, người duyệt, nhãn/trang/chuỗi trang và quy tắc; sao lưu phạm vi trước mỗi lần ghi, transaction có khóa và timeout.
- `scripts/import_all.ps1`: chạy V9 rồi nhập/duyệt D02 trước kiểm toán. Chạy lại giữ nguyên bản ghi và metadata duyệt.

Không sửa migration V1–V8 hoặc hồ sơ S03/D01 lịch sử. Không lưu mật khẩu trong tệp. Bản sao lưu DB nằm trong `scripts/generated/db-backups/` được Git bỏ qua.

## 4. Nghiệm thu

**Đã áp dụng vào `huyenco`:** Flyway V1–V9, 447 ô tra, 33 mục nguồn sách, 231 liên kết trang nội dung mới; 12/14 quy tắc VERIFIED, đủ 12 mốc VERIFIED. Bộ nhập đã kiểm lại hash hai PDF trước khi ghi.

- **455 kiểm thử Java có DB đạt**, không bỏ qua ca nào; gồm kiểm nguồn thơ hai trang, số khóa, metadata tháng 5 và các tuyến Mai Hoa/lịch hiện có.
- **50 kiểm thử Python đạt**; gồm hồ sơ hash, thiếu/nhiều kết quả, thơ nối trang và phép phân đoạn 12 tháng × 1.440 phút, mọi ranh 39/40/79/80/119/120.
- Bootstrap DB trống **hai lần giống toàn bộ bản ghi và metadata**; tám ca sửa sai D02 bị từ chối và rollback trong DB tạm. Các chốt S01/S02/D01/C01/MH-TIME cũ vẫn đạt; DB tạm đã xóa.
- Kiểm toán DB thật: **50 kiểm tra, 0 FAIL, 1 PENDING**. Mục còn chờ là **lời giải 64 quẻ / E01**; không còn báo thiếu các bảng D02. Audit dữ liệu không nghiệm thu các service chưa triển khai.
- Bản sao lưu đầy đủ trước khi áp dụng: `scripts/generated/db-backups/huyenco-before-d02-20261024T173912Z.dump` (50.533 byte); đã đọc danh mục bằng `pg_restore --list`. Sau áp dụng đã so dữ liệu cũ (S01/S02/D01/C01/Mai Hoa) và metadata TV2 tháng 5: giữ nguyên.

Lệnh tái lập: `python -m unittest discover -s scripts/tests -v`; cấp `PGPASSWORD` ở môi trường tiến trình rồi `python scripts/test_a02_bootstrap.py`; kiểm DB thật chỉ đọc bằng `python scripts/audit_tv3.py --live`. Bằng chứng cục bộ: `scripts/generated/d02_python_tests.log`, `d02_bootstrap.log`, `a02_bootstrap_result.json`, `d02_real_apply.log`, `d02_real_result.json`, `tv3_audit_report.md` (Git bỏ qua). Các kiểm thử này kiểm bộ nhập/phân đoạn vừa có mã, không thay cho nghiệm thu TamTheService.

## 5. Công việc tiếp theo — D03

1. Repository đọc CAREER11/13, WEALTH, LOVE có kiểm VERIFIED từng bản ghi và toàn bộ trang nguồn.
2. TamTheService dùng lịch C01 → Can Chi năm âm → hành S02; tra riêng các category được yêu cầu, không dùng bảng tuổi neo 1969.
3. Giữ nhiều kết quả công danh/Lộc, xử lý không có giao điểm theo hợp đồng. Chỉ bật WEALTH/LOVE khi tuyến thật hoàn tất.
4. Kiểm service + STOMP hai phiên, cập nhật fixtures/nguồn/tiến trình bàn giao TV1. UI thuộc TV1.

D02 hoàn thành dữ liệu trong phạm vi này chưa đồng nghĩa F04 hoặc toàn database dự án đã hoàn tất. Nghĩa tên 64 quẻ E01, API tra cứu, lịch sử và các task mạng/nghiệm thu vẫn còn.
