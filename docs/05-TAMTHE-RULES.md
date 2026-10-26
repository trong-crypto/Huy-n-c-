# Diễn Cầm Tam Thế Diễn Nghĩa — logic nghiệp vụ đối chiếu bản scan

**D04 hoàn thành ngày26/10:** EXTENDED đã tra Lộc theo Can–tháng, Sang hèn theo Chi–tháng và Điền sản theo hành–tháng;720 tổ hợp qua JDBC/STOMP đạt theo [42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md). Lộc không có giao điểm được ghi riêng, không lấp ô hoặc làm mất các category.19 đoạn bổ sung giữ SOURCE_VERIFIED; liên kết nhãn và tham chiếu Số6/Số4 giữ TEAM_DECISION/SOURCE_AMBIGUOUS ở editorialDecisions. Database huyenco chưa đổi; phần chưa mở D04 trong mốc M01/M02 bên dưới là lịch sử.

**Mở rộng ngày 26/10:** chủ dự án yêu cầu đủ nhóm luận cho mọi đầu vào hợp lệ. M01 đã đối chiếu lượt hai Sang hèn PDF43-44 (144 Chi-tháng) và Điền sản PDF49-50 (60 hành-tháng), duyệt19 đoạn diễn giải và ghi quyết định nối nhãn bảng/tiêu đề. M02 đã nhập bộ bổ sung vào TEST V12 theo [biên bản38](38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md); hồ sơ S04 vẫn giữ trạng thái khảo sát. D04 service chưa mở. WEALTH sẽ có tiểu mục/nguồn riêng, giữ no-match Lộc; bảo tồn Hoa cái/Hao Cái, Vong sát/Vong Thần, Tướng linh/Tướng Tinh, Thiên an/Phiên An và Phú/Phá theo quyết định biên tập, không coi là đính chính của nhà xuất bản hoặc các ô Lộc phục dựng.

Nguồn: *Diễn Cầm Tam Thế Diễn Nghĩa*, soạn giải Dương Công Hầu, hiệu Khương Đức; PDF người dùng cung cấp, 360 trang. Bìa ghi 1952 nhưng thiếu dữ kiện xuất bản đầy đủ, nên chưa khẳng định NXB/năm in của ấn bản. Dẫn trang dạng `trang in / trang PDF` (PDF từ 1). Sách là tư liệu tín ngưỡng truyền thống, không phải dự đoán khoa học. Cập nhật S02 ngày 24/10: riêng 60 ánh xạ Can Chi→hành mệnh và TT-NGU-HANH đã VERIFIED theo biên bản 22, reviewer Codex cùng công cụ lượt hai; các bảng và mô tả khác giữ trạng thái riêng.

## Chuẩn hóa đầu vào

Server xác định ngày/tháng/năm âm, Can Chi **năm sinh âm lịch**, hành mệnh theo bảng và giờ địa phương. Sách dặn tháng nhuận kể như cùng tháng thường liền trước và mùa xét theo tiết lập Xuân/Hạ/Thu/Đông (tr. 7 / PDF 6); thuật toán chuyển lịch/tiết khí cần nguồn và quyết định riêng. Bảng “Mục lục số tuổi” neo tại **1969** (tr. 10–11 / PDF 9–10), không dùng tuổi tĩnh trong bảng cho hiện tại.

## TT-NGU-HANH: mệnh theo tuổi

“Số 4” có 60 tổ hợp Can Chi và cột hành mệnh (tr. 12 / PDF 11). Khóa là `yearStem + yearBranch`, không phải ngày/tháng hay tổng chữ số năm. **S02 đã chép, nhập và duyệt đủ 60 bản ghi** trong `tam_the_lookup_entries`, gắn rule TT-NGU-HANH 1.0; kiểm chu kỳ/khóa/trang và biên bản lượt hai. Không nhầm mệnh tuổi Tam Thế với hành của quái Mai Hoa.

Phạm vi VERIFIED chỉ gồm mã Can/Chi và giá trị cột mạng. Dòng 28 Mậu Ngọ/Kỷ Mùi ghi Hỏa nhưng phần mô tả “cây lựu đá” bất nhất với hành; giữ chứng cứ ở `22-S02-TAM-THE-YEAR-ELEMENTS.md`, chưa nhập/duyệt mô tả hoặc tên nạp âm thay thế. `description=NULL` cho 60 ô. Chuyển ngày Dương sang năm âm thuộc C01; TamTheService vẫn chưa triển khai các tuyến luận giải D03.

## TT-GIO-SINH: mốc giờ theo tháng và 36 phần

“Số 5” quy định mốc bắt đầu ban ngày của giờ Dần theo **tháng âm** (tr. 13–16 / PDF 12–15): tháng 1/9→04:20; 2/8→04:00; 3/7→04:30; 4/6→04:40; 5→05:20; 11→03:40; 10/12→04:00. Sau đó mỗi 120 phút lần lượt Mão, Thìn, Tỵ, Ngọ, Mùi; ban đêm Thân, Dậu, Tuất, Hợi, Tý, Sửu. Khoảng tính `[mốc, mốc+120 phút)`; tất cả 12 khoảng phải phủ kín 24 giờ. Không tái dùng mốc giờ Chi cố định của Mai Hoa.

**Quyết định triển khai của nhóm ngày 22/10/2026:** TV3 dùng **Dần** cho ô tháng 5, 05:20–07:19, rồi tiếp Mão, Thìn, Tỵ, Ngọ, Mùi. Bản in tr. 15 / PDF 14 vẫn ghi **Dậu**; lưu `source_branch=DAU`, `adopted_branch=DAN`, lý do và `decision_status=TEAM_CORRECTION`. **D02 ngày 25/10 đã kiểm đủ 12 mốc/chuỗi ngày đêm và VERIFIED toàn bộ**, hai lượt cùng Codex theo ủy quyền mới; giữ nguyên reviewer/ngày TV2 của tháng 5. PDF15 in điểm cuối dòng đầu đêm tháng 11 là 5:30; triển khai 5:39 để tiếp dòng 5:40, có dấu vết hiệu chỉnh.

“Số 8” chia mỗi giờ Chi thành đầu/giữa/sau, tổng **36 ô** luận giải (tr. 26–29 / PDF 25–28). **D02 đã nhập/VERIFIED 36 bản chép**, giữ chữ/tuổi lạ theo scan. Ba đoạn `[0,40)`, `[40,80)`, `[80,120)` phút là **TEAM_DECISION DEC-20261025-D02-HOUR-PARTS**, không phải sách ghi 40 phút. TT-GIO-SINH mang policy TEAM_DECISION; TT-36-PHAN duyệt nội dung SOURCE_VERIFIED. Xem biên bản 29 về ranh giờ và phạm vi chứng cứ.

## TT-CONG-DANH: nghề nghiệp

“Số 11” (tr. 33 / PDF 32) tra `hành mệnh + tháng sinh âm`, nam nữ chung; có thể trả **nhiều** loại. Bảng nguồn MVP:

| Loại | Kim | Mộc | Thủy | Hỏa | Thổ |
| --- | --- | --- | --- | --- | --- |
| Mua bán | 4,5,8,10 | 2,4,6,10 | 4,8,12 | 5,11 | 7,8,10 |
| Câu/chài lưới/đáy rọ/mua thủy lợi | 1,3,9,10 | 4,5,6,12 | 2,4,6,8,11 | 2,6,7,11 | 1,2,3,6,8,9 |
| Làm thợ | 8,10 | 6,10 | 7,11,12 | 1 | 1,3,7,10 |

**D01 đã đối chiếu và VERIFIED 51 giao điểm Số 11.** Thủy câu/chài đúng là **2,4,6,8,11**; tháng 9 trong seed cũ là lỗi nhập đã sửa theo ảnh PDF32 phóng lớn. Giữ nhiều nghề cùng khóa; không có giao điểm không được hiểu là không có nghề nghiệp.

“Số 13” phần nghề nghiệp (tr. 36–37 / PDF 35–36) tra `Thiên Can năm sinh + tháng sinh âm`, nam nữ chung, ra nhãn nghề và đoạn giải nghĩa. Thứ tự cột PDF 35: Quan nhơn, Trùng Tổ, Tú Tài, Đã Thết, Sự Thoát, Sanh Quan, Âm nhạc, Tiêm Dược, Tăng đạo, Tài Phùng, Hoàng Quí, Thứ Tác. **D01 đã đối chiếu đủ 120 ô theo hàng/cột và 12 đoạn, nhập/VERIFIED đúng phạm vi.** Dùng bản chép bảng tường minh; phép kiểm rút gọn `floorMod(lunarMonth-1-stemIndex,12)`, Giáp=0…Quý=9, khớp cả 120 ô. Không dùng công thức dấu cộng cũ. Ví dụ Ất tháng 1→cột 12, Ất tháng 2→cột 1. Các bảng PDF 37 trở đi và mục học/thi cử Số 16–17 là phạm vi riêng.

Bốn cặp khác nhãn Trùng Tổ/Trùng Tế, Đã Thết/Đã Thiết, Sự Thoát/Sư Thuật, Thứ Tác/Thủ Tất được giữ nguyên ở `source_table_label` và `source_content_heading`, liên kết biên tập theo thứ tự 12 cột/12 đoạn nguồn (`POSITIONAL_EDITORIAL_LINK`). Không khẳng định đã phục dựng chữ trước lỗi in. V7 lưu nguồn riêng từng đoạn; D03/TV1 cần hiển thị cả hai nhãn khi khác nhau. Review hai lượt cùng Codex, không phải hai người độc lập. Chi tiết `25-D01-CAREER-DATA.md`; TamTheService/lịch và toàn F04 chưa hoàn tất.

## S03: hiệu chỉnh theo lượt đọc ảnh ngày 24/10/2026

Chi tiết và ca nguồn ở `24-S03-SOURCE-MAP.md`; ma trận máy đọc được ở `data/s03_source_matrix.csv`. Các nhận xét mới dưới đây thay mô tả sơ bộ tương ứng ở phần trên; chưa đổi seed/database hoặc duyệt runtime.

- **Số 13 nghề nghiệp:** công thức dấu cộng trong tài liệu trước S03 bị đảo chiều tra. PDF 35/in36 có Ất tháng 1 ở cột cuối Thứ Tác, Ất tháng 2 ở Quan nhơn. D01 dùng bảng chép tường minh; phép rút gọn ứng viên là `floorMod(lunarMonth - 1 - stemIndex, 12)`, cần so đủ 120 ô. Bảng nghề và 12 đoạn nằm PDF 35-36; PDF 37 trở đi là các bảng phụ khác. Không tự gộp chúng vào bảng nghề. Có khác nhãn giữa cột và đoạn: Trùng Tổ/Trùng Tế, Đã Thết/Đã Thiết, Sự Thoát/Sư Thuật, Thứ Tác/Thủ Tất; cần quyết định alias có nguồn.
- **TT-TAI-LOC/D02:** 120 giao điểm và 12 đoạn PDF41–42 đã nhập/VERIFIED có phạm vi. Can năm âm + tháng âm, trả mọi giao điểm theo thứ tự cột. Chỉ 60/120 khóa có trong bảng, mỗi khóa hai kết quả; Giáp/tháng 2 không có giao điểm. Giữ Bất lộc/Bối Lộc và Bịch lộc/Bịnh Lộc, liên kết biên tập theo vị trí. Một chữ mờ Hưởng Lộc lưu `[CHU_MO]`. Không dùng bảng phụ PDF43–46/49–50 làm fallback.
- **TT-TINH-DUYEN/D02:** 60 ô và 12 bài tám câu đã nhập/VERIFIED. Dẫn cách coi PDF63, bảng64, thơ64–67, đủ trang nối cho Quan Đài/Suy/Tuyệt. Input hành mệnh năm âm + tháng âm; không cần giới tính/người thứ hai. Không nhập tóm tắt in nghiêng hoặc chương nam/nữ riêng; không trộn các phép năm–giờ/năm–tháng.
- **TT-36-PHAN/D02:** giữ dẫn “Số 4” ở PDF25 và chốt dùng bảng Số 5 PDF12–15; 40 phút có quyết định nhóm riêng, chưa phải xác minh nguyên văn hay ví dụ độc lập.

Ma trận S03 giữ nguyên hồ sơ khảo sát lịch sử. D01/D02 hoàn tất dữ liệu theo biên bản 25/29; **D03 ngày 25/10 đã triển khai TamTheService cả ba nhóm**, mở WEALTH/LOVE bằng SOURCE_VERIFIED. CAREER giữ mọi nghề Số11 + một đoạn Số13, WEALTH giữ hai kết quả hoặc lỗi thiếu khóa, LOVE dùng bài tám câu và đủ trang nối. Không cần giờ theo mùa để tra ba bảng chung này; birthTime chỉ được kiểm hợp lệ theo hợp đồng. Xem biên bản 30; F04 còn nghiệm thu giao diện TV1 và công bố giới hạn khóa Lộc.

## Bản ghi và kiểm thử

Mỗi ô bảng có `bookId`, `sectionNo`, `printedPage`, `pdfPage`, `ruleCode`, `inputKey`, `outputCode`, `editor`, `reviewer`, `status`. Thiếu ô, mơ hồ lịch/tiết khí, xung đột in hoặc diễn giải chưa duyệt → `RULE_NOT_AVAILABLE`. Test: 60 Can Chi/chu kỳ 60 năm/mốc 1969; tháng nhuận; ranh mốc giờ của 7 nhóm tháng; 36 phần giờ phủ kín không chồng; xung đột tháng 5; Số 11 nhiều loại; 120 ô Số 13; mọi kết quả có trang nguồn. TV3 nhập/test, TV2 review.
