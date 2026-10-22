# Mai Hoa Dịch Số — logic nghiệp vụ đối chiếu bản scan

Nguồn: *Mai Hoa Dịch Số*, Thiệu Khang Tiết, Ông Văn Tùng dịch/chú thích, NXB Văn hóa – Thông tin; PDF người dùng cung cấp, 672 trang. Dẫn trang dạng `trang in / trang PDF`, tính PDF từ 1. Quy tắc đã định vị nguồn có trạng thái `SOURCE_LOCATED`, chưa `VERIFIED` đến khi TV2 viết test và TV3 kiểm chéo.

## Dữ liệu nền

- Số Tiên thiên trong bản này: 1 Càn, 2 Đoài, 3 Ly, 4 Chấn, 5 Tốn, 6 Khảm, 7 Cấn, 8 Khôn (tr. 44–45 / PDF 39–40). `quai(n)`: dư 1–7 giữ nguyên, dư 0 ứng với 8. Ví dụ 9→Càn, 25→Càn (tr. 45 / PDF 40).
- Sáu hào đánh từ dưới lên. Hạ quái = hào 1–3, thượng quái = hào 4–6 (tr. 47 / PDF 42). `hao(n)`: dư 1–5 giữ nguyên, dư 0 ứng với hào 6 (tr. 46 / PDF 41); ví dụ tổng 69→hào 3. Chỉ nhận số nguyên dương.
- Càn/Đoài→Kim, Chấn/Tốn→Mộc, Khảm→Thủy, Ly→Hỏa, Cấn/Khôn→Thổ (tr. 40 / PDF 35; tr. 28–29 / PDF 23–24). Tra tên 64 quẻ bằng cặp thượng/hạ quái, gắn trang nguồn.

## MH-TIME: năm–tháng–ngày–giờ

Đầu vào `datetime` có offset; chuẩn hóa về `Asia/Ho_Chi_Minh`, rồi lấy `Y` = số Chi của **năm âm lịch** (Tý=1…Hợi=12), `M` = tháng âm 1…12, `D` = ngày âm 1…30, `H` = số Chi giờ (Tý=1…Hợi=12). Năm, tháng, ngày và giờ phải theo âm lịch (tr. 48–50 / PDF 43–45). Thuật toán chuyển lịch, ranh giới giờ Chi và xử lý tháng nhuận cần nguồn/ca kiểm thử riêng; sách chưa đặc tả đủ để tự cài.

1. Thượng quái = `quai(Y+M+D)`.
2. Hạ quái = `quai(Y+M+D+H)`.
3. Hào động = `hao(Y+M+D+H)`.
4. Ghép hai quái thành quẻ chủ.

**Xung đột bản in:** câu cuối tr. 50 / PDF 45 nói tổng bốn số “trừ đi 8” để lấy hào động, nhưng nguyên văn tr. 48–49 / PDF 43–44 và mục “Hào trừ 6” tr. 46 / PDF 41 đều nói chia 6. Kế hoạch tạm theo chia 6; trạng thái `BLOCKED_SOURCE_CONFLICT` cho đến khi TV2/TV3 đối chiếu ví dụ và ghi quyết định. Chưa phát kết quả thật cho MH-TIME trước khi giải quyết cả xung đột và bộ chuyển lịch.

## MH-NUMBER: số vật đếm được

Mục “Xem bằng số vật” (tr. 51 / PDF 46) dùng số vật `N` để lấy thượng quái, số giờ `H` để lấy hạ quái, rồi cộng “số quái” với giờ và chia 6 để lấy hào động. Dự kiến `upper=quai(N)`, `lower=quai(H)`. Chưa rõ “số quái” ở bước cuối là `N` gốc hay số sau chia 8: để `SOURCE_AMBIGUOUS`, không tự chốt `hao(N+H)` khi chưa kiểm ví dụ.

Hợp đồng cũ `numbers:[a,b]` là biến thể **chưa tìm thấy căn cứ trong mục số vật của ấn bản**. Giữ mã riêng `MH-TWO-NUMBERS` ở trạng thái DRAFT hoặc trả `RULE_NOT_AVAILABLE`; không gắn nhãn theo sách. Nếu nhóm chọn triển khai số vật, JSON phải đổi thành `objectCount` và `datetime`/giờ đã chuẩn hóa.

## MH-MUTUAL, MH-CHANGE, MH-THE-DUNG

- Quẻ hỗ: hào 2–3–4 của quẻ chủ thành hạ quái; hào 3–4–5 thành thượng quái (tr. 47–48 / PDF 42–43).
- Quẻ biến: đảo âm↔dương tại đúng hào động; giữ năm hào khác (tr. 46 / PDF 41).
- Thể là phía mình/chủ, Dụng là sự việc/khách; xét sinh–khắc giữa Ngũ hành hai quái, đồng hành là hòa. Thể khắc Dụng hoặc Dụng sinh Thể là thuận; Dụng khắc Thể hoặc Thể sinh Dụng là bất lợi (tr. 124–125 / PDF 118–119; tr. 137–139 / PDF 131–133). Sách còn xét quẻ hỗ, quẻ biến, vượng/suy theo mùa. **Chưa xác nhận rõ từ trang đã đối chiếu cách chọn quái nào là Thể theo vị trí hào động**; trả `RULE_NOT_AVAILABLE` cho phần này, không gán theo quy ước ngoài sách.

## Đầu ra và kiểm thử

Đầu ra có `method`, `lunarDate`, `yearBranch`, `hourBranch`, tổng số trung gian, thượng/hạ quái, quẻ chủ/hỗ/biến, hào động, `ruleVersion`, `sourceReferences`. Chỉ có `body/use` khi quy tắc đã VERIFIED. Kiểm thử: 9→Càn, 25→Càn, tổng 69→hào 3; chia hết 8→Khôn, chia hết 6→hào 6; hào 1 và 6; quẻ hỗ 2–4/3–5; ranh ngày âm, tháng nhuận và giờ Chi. TV2 làm test, TV3 đối chiếu ảnh trang.
