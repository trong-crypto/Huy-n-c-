# Quyết định khởi động nhóm ngày 22/10/2026

Tài liệu này chốt những lựa chọn triển khai để TV1, TV2, TV3 làm song song ngay. **Cập nhật phạm vi ngày 22/10:** chủ dự án yêu cầu toàn bộ F01–F08 trong `10-FUNCTIONAL-REQUIREMENTS.md`; các chữ P0/P1 bên dưới chỉ mô tả lát cắt làm trước, không còn cho phép bỏ TIME, NUMBER, Tam Thế, 64 quẻ, lịch, progress hoặc lịch sử. Trạng thái `VERIFIED` của quy tắc sách chỉ có hiệu lực sau khi hai người kiểm chéo chứng cứ. Hạn nộp môn học: **23:59 ngày 31/10/2026**.

## 1. Phạm vi P0 đã chốt

- Đề tài: **Huyền Cơ**, nhóm **Chủ đề 3 — Ứng dụng mạng**. Nhóm gửi mô tả một trang cho giảng viên và lưu phản hồi; không ghi là đã được xác nhận nếu chưa có phản hồi.
- Chức năng nghiệp vụ P0: **biến đổi cấu trúc quẻ từ sáu hào người dùng nhập**. Input là `linesBottomUp` gồm đúng sáu boolean, đánh từ dưới lên, và `movingLine` từ 1 đến 6. Output là sáu hào quẻ chủ, quẻ hỗ (hạ: hào 2–3–4; thượng: hào 3–4–5) và quẻ biến (đảo đúng hào động), kèm nguồn ấn bản/trang. Tên quẻ và lời luận giải chỉ thêm khi bảng tương ứng được xác minh.
- Đây là **công cụ biến đổi quẻ**, không phải phép tự lập quẻ theo thời gian hoặc lời dự đoán. `TIME`, `OBJECT_COUNT`, Thể–Dụng và các bảng Tam Thế vẫn `RULE_NOT_AVAILABLE` cho đến khi toàn tuyến được kiểm chứng. `NUMBER` hai số cũ đã bị loại bỏ và trả `INVALID_METHOD`.
- Không dùng PostgreSQL hoặc Docker cho lát cắt LINES đầu tiên. F08 cần lưu trữ Server và kiểm quyền truy cập, nên TV3 triển khai migration PostgreSQL ở giai đoạn tiếp theo; có thể cài trực tiếp hoặc dùng Server chung, không bắt buộc Docker. Chỉ lưu lịch sử khi người dùng chủ động chọn và theo quy tắc riêng tư đã chốt.

## 2. Hợp đồng JSON/STOMP v1.1

- Giữ `/ws`, `/app/mai-hoa/calculate`, `/user/queue/results`, `/user/queue/errors`; giữ response envelope `requestId`, `type`, `status`, `data`, `error` và định tuyến theo session.
- Thêm `payload.method = "LINES"` cho `type = "MAI_HOA"`. Payload chỉ có `method`, `linesBottomUp` và `movingLine`. Không yêu cầu ngày giờ, lịch hoặc database. Không gửi `question` trong P0 này.
- Thành công chỉ khi cả `MH-MUTUAL` và `MH-CHANGE` đạt `VERIFIED`: `data` có `method`, `ruleVersion`, `primaryHexagram.linesBottomUp`, `mutualHexagram.linesBottomUp`, `changedHexagram.linesBottomUp`, `movingLine`, `sourceReferences`; `error = null`. Tên/mã quẻ chỉ xuất hiện sau khi bảng 64 quẻ được kiểm nguồn.
- Sai kiểu/thiếu trường/sáu hào không đủ hoặc `movingLine` ngoài 1–6 → `FAILED` với `INVALID_INPUT`. Quy tắc chưa `VERIFIED` → `RULE_NOT_AVAILABLE` cùng `ruleCode`. Không dùng `COMPLETED` cho mock.
- Ví dụ request ở `docs/examples/mai-hoa-lines.request.json`. Ví dụ expected chỉ để test cấu trúc; TV3 phải đối chiếu quy tắc với trang sách và TV2 viết test trước khi đánh dấu `VERIFIED`.

## 3. Điểm mới kỹ thuật của môn Lập trình mạng

- Baseline: controller xử lý trực tiếp; phản hồi theo phiên và requestId đã có trong khung.
- Bản đề xuất: worker pool **4** luồng với queue **100** yêu cầu, cấu hình được; queue đầy trả `SERVER_BUSY` ngay. Idempotency theo `(sessionId, requestId)` trong **60 giây**, giới hạn **10.000** mục: lặp cùng payload nhận cùng kết quả; cùng khóa nhưng payload khác trả `INVALID_INPUT`. Request đang chạy bị lặp chỉ xử lý một lần. Ngắt kết nối không tự gửi lại; session mới là khóa mới.
- TV2 bật được hai chế độ `direct` và `bounded` bằng cấu hình chỉ dùng khi benchmark. Chạy cùng workload cho 1, 5, 20 Client; ghi median/p95 latency, throughput, completed/errors/`SERVER_BUSY`, sai phiên. Dùng workload thật của LINES; nếu thêm độ trễ giả lập để kiểm backpressure thì báo riêng là thử nghiệm tầng mạng. Không cam kết trước rằng bản đề xuất nhanh hơn; novelty là cơ chế tin cậy và kiểm soát tải có bằng chứng.
- Không triển khai WSS/Docker cho demo cục bộ. Nếu đưa lên Internet phải có HTTPS/WSS, origin allowlist và giới hạn tần suất; không trình bày demo cục bộ là triển khai công khai an toàn.

## 4. Việc bắt đầu ngay và giao nhận

| Mốc | TV1 — Client | TV2 — Server | TV3 — nguồn và kiểm chéo |
| --- | --- | --- | --- |
| 22/10 | Thêm lựa chọn LINES và form sáu hào/hào động; UI kết quả ba dãy hào; mock theo v1.1 | Chốt DTO/validator, hàm thuần quẻ hỗ/quẻ biến, unit test; giữ session routing | Đối chiếu tr. 46–48/PDF 41–43 của bản Mai Hoa; ghi trang, ví dụ và điểm chưa rõ; review expected |
| 23/10 | Ghép Server thật, kiểm hai tab/requestId và lỗi | Tích hợp hàm vào STOMP; lỗi chuẩn; cùng TV3 duyệt `MH-MUTUAL`, `MH-CHANGE` | Ký review nguồn/ca chuẩn; chuẩn bị `sourceReferences`; gửi mô tả đề tài cho giảng viên cùng nhóm |
| 24–26/10 | Hoàn thiện reconnect/timeout, ảnh demo và test UI | Worker pool/queue, idempotency, test duplicate/overload | Kiểm chéo test và nguồn; chỉ mở tên quẻ/luận giải nếu bảng tra được xác minh |
| 27–28/10 | Test hai phiên và hỗ trợ thu số đo | Benchmark direct/bounded, raw CSV và phân tích | Test mọi ca biên, kiểm nguồn và Results/Discussion |
| 29–31/10 | README, demo và báo cáo UI | Phần mạng/novelty/thực nghiệm | References, dữ liệu, giới hạn; cả nhóm đóng gói, Compilatio và nộp |

**Cổng 23/10:** nếu TV2/TV3 chưa xác minh được hai phép biến đổi theo đúng bản scan, vẫn tiếp tục xây UI/transport/test, nhưng P0 không trả kết quả thật. Nhóm đưa phần chứng cứ chưa rõ cho giảng viên và chốt chức năng tra cứu nguồn thay thế trước 24/10. Không tự nâng `SOURCE_LOCATED` thành `VERIFIED`.

## 5. Những điểm còn cần thông tin bên ngoài

1. Giảng viên xác nhận mô tả Huyền Cơ thuộc Chủ đề 3 và phạm vi P0; ghi lại phản hồi, không chặn việc làm code trong khi chờ.
2. Số nhóm, họ tên/mã sinh viên và link Google Drive nộp bài để điền đúng `NhomXX_HuyenCo_Report.docx` và `NhomXX_HuyenCo_Source` khi đóng gói.
3. TV2/TV3 xác nhận nguồn sách, ca đối chiếu và review để đổi `MH-MUTUAL`/`MH-CHANGE` sang `VERIFIED`. Đây là kiểm chứng học thuật, không phải quyết định có thể bỏ phiếu thay thế.

## 6. Mở rộng bắt buộc theo quyết định mới

- **TV1:** sau form LINES, làm TIME và `OBJECT_COUNT` theo hợp đồng đã chốt; ba mục Tam Thế; trang 64 quẻ, lịch/Can Chi, lịch sử; hiển thị các bước và progress STOMP. Không tính quẻ hoặc luận giải ở Client. Bàn giao ảnh/luồng demo cho F01–F08 và trạng thái lỗi của từng chức năng.
- **TV2:** chốt hợp đồng v1.2, triển khai Mai Hoa TIME/OBJECT_COUNT và quẻ chủ/hỗ/biến/hào động sau kiểm nguồn; TIME chia 6 lấy hào động, OBJECT_COUNT tính dư 8/8/6 theo số vật gốc và giờ Chi. Thêm `/user/queue/progress`, REST cho tra cứu/lịch/lịch sử, bảo vệ quyền đọc lịch sử, giữ định tuyến phiên và benchmark.
- **TV3:** lập bản đồ mục/trang của hai sách, đặc biệt tài lộc và tình duyên; nhập và kiểm đủ 64 quẻ; triển khai lịch hai chiều/Can Chi, Tam Thế ba nhóm và kho dữ liệu/lịch sử. Chọn PostgreSQL cài trực tiếp hoặc Server chung; Docker không phải điều kiện. Bàn giao rule matrix, dataset, migration và test đối chiếu.
- **Cả nhóm:** demo mỗi F01–F08 trước khi đánh dấu đủ phạm vi. Phần nào chưa `VERIFIED` hoặc chưa chạy đầu cuối vẫn ghi BLOCKED/INCOMPLETE và nêu trong báo cáo. Cổng 23/10 ở trên là cổng nguồn của lát cắt LINES, không phải cổng loại bỏ các yêu cầu mới.

## 7. Ba quyết định nghiệp vụ được chủ dự án chốt

1. TV2: với Mai Hoa TIME, hào động lấy tổng năm/tháng/ngày/giờ âm chia 6, dư 0 tương ứng hào 6. Giữ chứng cứ tr. 50/PDF 45 in “trừ 8”; quyết định triển khai không được trình bày như nguyên văn trang đó.
2. TV3: tháng 5 Tam Thế, 05:20–07:19 dùng giờ Dần. Lưu chữ in gốc Dậu, giá trị sửa Dần và lý do chuỗi tiếp Mão…Mùi; kiểm ranh 05:20/07:20.
3. TV1/TV2: loại `NUMBER`/`numbers:[a,b]`. JSON mới `method=OBJECT_COUNT`, `objectCount` và `hourIndex` (Tý=1…Hợi=12), `question` tùy chọn. Thượng quái = `quai(objectCount)`, hạ = `quai(hourIndex)`, hào = `hao(objectCount+hourIndex)`. Cụm “số quẻ” tr. 51/PDF 46 còn mơ hồ; đây là quy ước nhóm, TV3 phải tìm ca sách để xác minh trước khi gọi VERIFIED.
