# Mai Hoa Dịch Số — logic nghiệp vụ đối chiếu bản scan

**M03 hoàn thành ngày26/10:** đã có service lời luận ba phương pháp/bốn chủ đề theo [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md),1536 tổ hợp logic/DB đạt. Dùng scoped rules MH-READING-* sau kiểm bundle/approval mới mỗi request; MH-THE-DUNG1.0 cũ vẫn DISABLED. BODY/PHASES giữ TEAM_DECISION/SOURCE_AMBIGUOUS; tháng âm và phân loại mùa giữ TEAM_DECISION/SOURCE_LOCATED, không phát lời luận mùa chưa VERIFIED. M01 có20 đoạn biên tập đã duyệt, không phải384 lời hào nguyên văn. Các dòng chưa mở runtime ở mốc M01 dưới đây là lịch sử.

**Mở rộng ngày 26/10:** F09 bắt buộc có lời luận theo GENERAL/CAREER/WEALTH/LOVE. Sau khảo sát S04, M01 đã đối chiếu lượt hai PDF131-135,150-151,156-158,224-225,227-228, duyệt riêng20 đoạn diễn giải và ghi quy ước chọn Thể/hai quái hỗ/mùa. Dữ liệu đã nhập TEST V12, xem [biên bản38](38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md). Chưa thay policy runtime `MH-THE-DUNG` hoặc mở API lời luận. Không gọi20 đoạn diễn giải là bộ384 lời hào nguyên văn; các thuật toán theo quy ước vẫn mang TEAM_DECISION và giới hạn theo bản in.

**Cập nhật theo xác nhận của chủ dự án:** MH-TIME đã được duyệt **VERIFIED cho quy tắc dự án dùng chia6**; không còn chờ xác nhận lại. TIME trả TEAM_DECISION/VERIFIED; câu chữ bản in được giữ trong ghi chú nguồn. Biên bản `docs/28-TIME-OWNER-APPROVAL.md` thay các ghi nhận BLOCKED/chưa duyệt của MH-TIME ở mốc trước.

Nguồn: *Mai Hoa Dịch Số*, Thiệu Khang Tiết, Ông Văn Tùng dịch/chú thích, NXB Văn hóa – Thông tin; PDF người dùng cung cấp, 672 trang, danh tính ấn bản in chưa xác minh đầy đủ. Dẫn trang dạng `trang in / trang PDF`, tính PDF từ 1. Từ 24/10, MH-TRIGRAM/MH-MUTUAL/MH-CHANGE đã VERIFIED trong đúng phạm vi biên bản; công thức TIME/OBJECT_COUNT giữ trạng thái mâu thuẫn/đa nghĩa tương ứng.

## Dữ liệu nền

- Số Tiên thiên trong bản này: 1 Càn, 2 Đoài, 3 Ly, 4 Chấn, 5 Tốn, 6 Khảm, 7 Cấn, 8 Khôn (tr. 44–45 / PDF 39–40). `quai(n)`: dư 1–7 giữ nguyên, dư 0 ứng với 8. Ví dụ 9→Càn, 25→Càn (tr. 45 / PDF 40).
- Sáu hào đánh từ dưới lên. Hạ quái = hào 1–3, thượng quái = hào 4–6 (tr. 47 / PDF 42). `hao(n)`: dư 1–5 giữ nguyên, dư 0 ứng với hào 6 (tr. 46 / PDF 41); ví dụ tổng 69→hào 3. Chỉ nhận số nguyên dương.
- Càn/Đoài→Kim, Chấn/Tốn→Mộc, Khảm→Thủy, Ly→Hỏa, Cấn/Khôn→Thổ (tr. 40 / PDF 35; tr. 28–29 / PDF 23–24). Tra tên 64 quẻ bằng cặp thượng/hạ quái, gắn trang nguồn.

## MH-TIME: năm–tháng–ngày–giờ

**B04 đã triển khai/kiểm ngày 24/10:** TIME nối C01, chạy qua registry/DB/STOMP và trả ba quẻ cùng nguồn. Quy ước thực thi là UTC+7 cố định, năm đổi tại Tết/ngày đổi 00:00, Tý23:00–00:59; tháng nhuận giữ cùng số tháng và cờ nhuận. Các phần chưa được bản in đặc tả đầy đủ được ghi riêng là quyết định nhóm, không nâng MH-TIME thành VERIFIED. Trạng thái tổng vẫn **TEAM_DECISION/VERIFIED**. Chi tiết/fixture tại `27-B04-TIME-HANDOFF.md`.

Đầu vào `datetime` có offset; chuẩn hóa về `Asia/Ho_Chi_Minh`, rồi lấy `Y` = số Chi của **năm âm lịch** (Tý=1…Hợi=12), `M` = tháng âm 1…12, `D` = ngày âm 1…30, `H` = số Chi giờ (Tý=1…Hợi=12). Năm, tháng, ngày và giờ phải theo âm lịch (tr. 48–50 / PDF 43–45). Thuật toán chuyển lịch, ranh giới giờ Chi và xử lý tháng nhuận cần nguồn/ca kiểm thử riêng; sách chưa đặc tả đủ để tự cài.

1. Thượng quái = `quai(Y+M+D)`.
2. Hạ quái = `quai(Y+M+D+H)`.
3. Hào động = `hao(Y+M+D+H)`.
4. Ghép hai quái thành quẻ chủ.

**Quyết định triển khai của nhóm ngày 22/10/2026:** TV2 dùng tổng `Y+M+D+H` chia 6 lấy dư để tìm hào động; dư 0 ứng với hào 6. Giữ nguyên chứng cứ bản in: câu cuối tr. 50 / PDF 45 ghi “trừ đi 8”, trái nguyên văn tr. 48–49 / PDF 43–44 và mục “Hào trừ 6” tr. 46 / PDF 41. Quyết định của nhóm giải quyết cách cài đặt, **không sửa bản scan hoặc tự biến câu tr. 50 thành chứng cứ chia 6**. TV2/TV3 vẫn cần ca chuẩn và bộ chuyển lịch được kiểm trước khi đánh dấu toàn tuyến MH-TIME `VERIFIED`.

## MH-OBJECT-COUNT: số vật đếm được

Mục “Xem bằng số vật” (tr. 51 / PDF 46) dùng số vật `N` để lấy thượng quái, số giờ `H` để lấy hạ quái, rồi cộng “số quẻ” với giờ và chia 6 để lấy hào động. Nhóm **chốt quy ước triển khai**: `upper=quai(objectCount)`, `lower=quai(hourIndex)`, `movingLine=hao(objectCount+hourIndex)`. `hourIndex` nhận 1–12 theo giờ Chi (Tý=1…Hợi=12), `objectCount` là số nguyên dương; dư 0 khi chia 8 ứng với Khôn (8), dư 0 khi chia 6 ứng với hào 6. Ví dụ `objectCount=12`, `hourIndex=8` → thượng quái 4 (Chấn), hạ quái 8 (Khôn), hào động 2.

**Giới hạn chứng cứ:** cụm “số quẻ” trên tr. 51 / PDF 46 vẫn có thể chỉ số quái đã rút gọn, thay vì số vật gốc. Công thức `hao(objectCount+hourIndex)` là lựa chọn trực tiếp của chủ dự án để ba thành viên dùng chung, chưa được chứng minh độc lập là cách duy nhất của bản in. Giữ trạng thái quy tắc `SOURCE_AMBIGUOUS` và ghi riêng quyết định nhóm trong `07-DECISION-LOG.md`; TV2 viết test và TV3 đối chiếu ví dụ/nguồn trước khi nâng lên `VERIFIED` hoặc trình bày là thuật toán nguyên bản. Không phát lời luận giải chưa xác minh.

Hợp đồng cũ `method=NUMBER` với `numbers:[a,b]` bị loại bỏ. Hợp đồng mới dùng `method=OBJECT_COUNT`, `objectCount`, `hourIndex` và `question` tùy chọn. `NUMBER` cũ trả `INVALID_METHOD`; không giữ đường tính hai số song song.

**B03 ngày 24/10 đã triển khai:** bảng quái đối chiếu PDF 39–40/35/23–24 và sơ đồ S01; chỉ MH-TRIGRAM được nâng VERIFIED với reviewer Codex cùng công cụ lượt hai. OBJECT_COUNT được chạy bằng TEAM_DECISION, nguồn vẫn SOURCE_AMBIGUOUS; 12/8 → Dự/hỗ Kiển/biến Giải, hào 2. Không cần chuyển lịch trong tuyến này. Xem manifest `data/trigram_source_review.csv` và `21-B03-OBJECT-COUNT-HANDOFF.md`.

## MH-MUTUAL, MH-CHANGE, MH-THE-DUNG

- Quẻ hỗ: hào 2–3–4 của quẻ chủ thành hạ quái; hào 3–4–5 thành thượng quái (tr. 47–48 / PDF 42–43).
- Quẻ biến: đảo âm↔dương tại đúng hào động; giữ năm hào khác (tr. 46 / PDF 41).
- Thể là phía mình/chủ, Dụng là sự việc/khách; xét sinh–khắc giữa Ngũ hành hai quái, đồng hành là hòa. Thể khắc Dụng hoặc Dụng sinh Thể là thuận; Dụng khắc Thể hoặc Thể sinh Dụng là bất lợi (tr. 124–125 / PDF 118–119; tr. 137–139 / PDF 131–133). Sách còn xét quẻ hỗ, quẻ biến, vượng/suy theo mùa. **Chưa xác nhận rõ từ trang đã đối chiếu cách chọn quái nào là Thể theo vị trí hào động**; trả `RULE_NOT_AVAILABLE` cho phần này, không gán theo quy ước ngoài sách.

### P0 LINES — biến đổi cấu trúc quẻ do người dùng nhập

Input `linesBottomUp` gồm đúng sáu boolean; `movingLine` từ 1 đến 6. Quẻ chủ là chính dãy đầu vào. Quẻ hỗ lấy hào 2–3–4 làm ba hào dưới, 3–4–5 làm ba hào trên. Quẻ biến sao chép quẻ chủ và đảo đúng hào `movingLine`. LINES không tự lập quẻ từ ngày giờ, không chọn Thể–Dụng và không tạo lời luận giải. B01 đã kiểm bộ 64 cấu trúc và trả mã nội bộ H_THUONG_HA; tên chỉ thêm khi bản ghi tên đạt VERIFIED với nguồn/người duyệt.

Cập nhật 23/10/2026: chủ dự án đã thông báo TV2 xác nhận `MH-MUTUAL` và `MH-CHANGE`; Flyway V4 đã ghi VERIFIED cho hai quy tắc trên database thực tế (xem `07-DECISION-LOG.md`). Bộ tên 64 quẻ nhập sau đó ở SOURCE_LOCATED vẫn cần review riêng (`14-TV3-HEXAGRAM-NAMES.md`). Test cấu trúc kiểm cả 64 dãy hào × 6 vị trí; ít nhất các ca nguồn phải có ảnh/trang và expected. Nếu một trong hai quy tắc chưa `VERIFIED`, `method=LINES` trả `RULE_NOT_AVAILABLE` cùng `ruleCode`; không trả mock như kết quả thật.

B01 đêm 23–24/10 đã triển khai và kiểm 64 × 6 ở hàm thuần và STOMP thật; xem `18-B01-LINES-HANDOFF.md`. Chỉ hai quy tắc biến đổi được dùng cho LINES; không tự duyệt thêm TIME, OBJECT_COUNT, bảng quái hoặc tên quẻ.

## Đầu ra và kiểm thử

Đầu ra có `method`, `lunarDate`, quẻ chủ/hỗ/biến, hào động, `ruleVersion`, `sourceReferences`. Chỉ số Chi năm/giờ và tổng trung gian nằm trong `calculationSteps.TIME_NUMBERS.values` với tên `yearBranchIndex/hourIndex/dateSum/timeSum`, không có `yearBranch/hourBranch` top-level ngoài DTO. Chỉ có `body/use` khi quy tắc đã VERIFIED. Kiểm thử: 9→Càn, 25→Càn, tổng 69→hào 3; chia hết 8→Khôn, chia hết 6→hào 6; hào 1 và 6; quẻ hỗ 2–4/3–5; ranh ngày âm, tháng nhuận và giờ Chi. B04 đã kiểm 51.840 tổ hợp số học và STOMP ca ngày thật; không gọi miền số học là tập ngày lịch hợp lệ.
