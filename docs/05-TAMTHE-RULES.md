# Diễn Cầm Tam Thế Diễn Nghĩa — logic nghiệp vụ đối chiếu bản scan

Nguồn: *Diễn Cầm Tam Thế Diễn Nghĩa*, soạn giải Dương Công Hầu, hiệu Khương Đức; PDF người dùng cung cấp, 360 trang. Bìa ghi 1952 nhưng thiếu dữ kiện xuất bản đầy đủ, nên chưa khẳng định NXB/năm in của ấn bản. Dẫn trang dạng `trang in / trang PDF` (PDF từ 1). Sách là tư liệu tín ngưỡng truyền thống, không phải dự đoán khoa học. Bảng được định vị là `SOURCE_LOCATED`, chỉ `VERIFIED` khi TV3 nhập đủ, test và TV2 review.

## Chuẩn hóa đầu vào

Server xác định ngày/tháng/năm âm, Can Chi **năm sinh âm lịch**, hành mệnh theo bảng và giờ địa phương. Sách dặn tháng nhuận kể như cùng tháng thường liền trước và mùa xét theo tiết lập Xuân/Hạ/Thu/Đông (tr. 7 / PDF 6); thuật toán chuyển lịch/tiết khí cần nguồn và quyết định riêng. Bảng “Mục lục số tuổi” neo tại **1969** (tr. 10–11 / PDF 9–10), không dùng tuổi tĩnh trong bảng cho hiện tại.

## TT-NGU-HANH: mệnh theo tuổi

“Số 4” có 60 tổ hợp Can Chi và hành mệnh/nạp âm (tr. 12 / PDF 11). Khóa là `yearStem + yearBranch`, không phải ngày/tháng hay tổng chữ số năm. Chép thành 60 bản ghi, kiểm không trùng/thiếu, mỗi bản ghi có nguồn. Không nhầm mệnh tuổi Tam Thế với hành của quái Mai Hoa.

## TT-GIO-SINH: mốc giờ theo tháng và 36 phần

“Số 5” quy định mốc bắt đầu ban ngày của giờ Dần theo **tháng âm** (tr. 13–16 / PDF 12–15): tháng 1/9→04:20; 2/8→04:00; 3/7→04:30; 4/6→04:40; 5→05:20; 11→03:40; 10/12→04:00. Sau đó mỗi 120 phút lần lượt Mão, Thìn, Tỵ, Ngọ, Mùi; ban đêm Thân, Dậu, Tuất, Hợi, Tý, Sửu. Khoảng tính `[mốc, mốc+120 phút)`; tất cả 12 khoảng phải phủ kín 24 giờ. Không tái dùng mốc giờ Chi cố định của Mai Hoa.

**Xung đột bản in:** dòng đầu tháng 5 tr. 15 / PDF 14 ghi “giờ Dậu” cho 05:20–07:19, trong khi chuỗi tiếp theo là Mão…Mùi. Lưu cả `sourceText=Dậu` và `proposedCorrection=Dần`, trạng thái `BLOCKED_SOURCE_CONFLICT`; nhóm phải ghi quyết định trước khi triển khai ô này.

“Số 8” chia mỗi giờ Chi thành đầu/giữa/sau, tổng **36 ô** luận giải (tr. 26–29 / PDF 25–28). Kế hoạch chia mỗi khoảng 120 phút thành ba đoạn 40 phút và tra theo `hourBranch + segment`; cách chia 40 phút là suy luận triển khai từ “một giờ chia ba”, phải đối chiếu ví dụ trước khi VERIFIED. Không xuất lời luận giải chưa nhập/kiểm nguồn.

## TT-CONG-DANH: nghề nghiệp

“Số 11” (tr. 33 / PDF 32) tra `hành mệnh + tháng sinh âm`, nam nữ chung; có thể trả **nhiều** loại. Bảng nguồn MVP:

| Loại | Kim | Mộc | Thủy | Hỏa | Thổ |
| --- | --- | --- | --- | --- | --- |
| Mua bán | 4,5,8,10 | 2,4,6,10 | 4,8,12 | 5,11 | 7,8,10 |
| Câu/chài lưới/đáy rọ/mua thủy lợi | 1,3,9,10 | 4,5,6,12 | 2,4,6,9,11 | 2,6,7,11 | 1,2,3,6,8,9 |
| Làm thợ | 8,10 | 6,10 | 7,11,12 | 1 | 1,3,7,10 |

“Số 13” (tr. 36–38 / PDF 35–37) tra `Thiên Can năm sinh + tháng sinh âm`, nam nữ chung, ra một nhãn nghề và đoạn giải nghĩa. Cột tr. 36 theo thứ tự: Quan Nhơn, Trúng Tế, Tú Tài, Đã Thất, Sự Thoát, Sanh Quan, Âm Nhạc, Tiêm Dược, Tăng Đạo, Tài Phong, Hoàng Quí, Thứ Tác. Hàng Giáp tháng 1 bắt đầu cột 0; mỗi Can sau và mỗi tháng sau dịch một cột, vòng 12. Công thức rút từ bảng: `index=(stemIndex+lunarMonth-1)%12`, Giáp=0…Quý=9. **Kiểm đủ 120 ô bảng gốc** trước VERIFIED; không lấy công thức rút gọn làm căn cứ duy nhất. Các mục học/thi cử “Số 16–17” (tr. 52–56 / PDF 51–55) là phạm vi khác, chưa nhập MVP.

## Bản ghi và kiểm thử

Mỗi ô bảng có `bookId`, `sectionNo`, `printedPage`, `pdfPage`, `ruleCode`, `inputKey`, `outputCode`, `editor`, `reviewer`, `status`. Thiếu ô, mơ hồ lịch/tiết khí, xung đột in hoặc diễn giải chưa duyệt → `RULE_NOT_AVAILABLE`. Test: 60 Can Chi/chu kỳ 60 năm/mốc 1969; tháng nhuận; ranh mốc giờ của 7 nhóm tháng; 36 phần giờ phủ kín không chồng; xung đột tháng 5; Số 11 nhiều loại; 120 ô Số 13; mọi kết quả có trang nguồn. TV3 nhập/test, TV2 review.
