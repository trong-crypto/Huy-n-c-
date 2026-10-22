# Kế hoạch đến hạn nộp môn Lập trình mạng

Nguồn yêu cầu: bốn tệp `Instruction.md`, `Topics.md`, `README.md`, `Submission.md` người dùng cung cấp và quyết định phạm vi đầy đủ ngày 22/10/2026. Hạn nộp **23:59 ngày 31/10/2026**. Kế hoạch tám tuần trước đây không còn áp dụng. Ma trận F01–F08 ở `10-FUNCTIONAL-REQUIREMENTS.md` là điều kiện nghiệm thu mới; lịch dưới đây là thứ tự làm việc, không phải quyền bỏ bớt chức năng.

## Quyết định phạm vi

- Đăng ký Huyền Cơ theo **Chủ đề 3 — Ứng dụng mạng**; gửi đề xuất cho giảng viên và lưu phản hồi, chưa coi là đã được duyệt.
- **F01–F08 đều bắt buộc:** Mai Hoa TIME/OBJECT_COUNT; ba quẻ và hào động; Tam Thế công danh/tài lộc/tình duyên; 64 quẻ; lịch Âm–Dương/Can Chi; tiến trình WebSocket; lịch sử có quyền sở hữu; cùng yêu cầu mạng và kiểm thử.
- `MAI_HOA`/`LINES` là lát cắt đầu để hoàn thiện giao thức và quy tắc quẻ hỗ/quẻ biến; nó không đại diện cho F01/F02/F04–F08. TV2/TV3 kiểm nguồn trước khi bật kết quả thật. Nếu nguồn chưa rõ, ghi BLOCKED và hỏi giảng viên; không âm thầm bỏ yêu cầu.
- Trước khi nói bản nộp hoàn chỉnh, nhóm phải demo F01–F08. Nếu đến hạn vẫn chưa đạt, báo cáo và README phải công khai chức năng thiếu, nguyên nhân và bằng chứng, không ghi thành tích chưa có.

## Bốn giai đoạn

| Giai đoạn | TV1 — Client | TV2 — Server và mạng | TV3 — nguồn và dữ liệu | Cổng bàn giao |
| --- | --- | --- | --- | --- |
| 22–23/10: khóa nguồn và hợp đồng | Form TIME/OBJECT_COUNT/LINES, mock kết quả và lỗi | DTO/validator LINES và OBJECT_COUNT; đặc tả v1.2, hàm chia dư 8/6 và test | Đối chiếu Mai Hoa; lưu quyết định tháng 5 Tam Thế; lập ma trận nguồn ba nhóm, 64 quẻ và lịch | 23/10: danh sách rule VERIFIED/BLOCKED và hợp đồng đầu vào/đầu ra |
| 24–26/10: các module nghiệp vụ | Trang lịch/tra cứu/Tam Thế, hiển thị bước và progress | TIME/OBJECT_COUNT theo nguồn, ba quẻ, STOMP progress; REST tra cứu/lịch/lịch sử | Bộ lịch/Can Chi, dữ liệu 64 quẻ, ba mục Tam Thế, migration lịch sử; kiểm chéo | 26/10: tích hợp từng F01–F08; chức năng thiếu ghi rõ blocker |
| 27–28/10: an toàn và kiểm thử | Lịch sử, quyền người dùng, hai trình duyệt, lỗi Client | Hàng đợi/worker, idempotency, kiểm truy cập chéo; benchmark 1/5/20 Client | Kiểm đủ nguồn và ca biên, test lịch/tháng nhuận/64 quẻ; hỗ trợ benchmark | 28/10: bảng đạt/chưa đạt F01–F08, raw CSV và kết quả đo thật |
| 29–31/10: hoàn thiện và nộp | README, demo và phần yêu cầu/UI | Sửa lỗi tích hợp, phần mạng/novelty/thực nghiệm | References, dữ liệu, giới hạn và Results/Discussion | 30/10 đóng băng bản ứng viên; 31/10 kiểm lại F01–F08 và gói nộp |

## Novelty và thực nghiệm

Baseline là khung Server hiện tại: controller xử lý trực tiếp, đã có phản hồi theo phiên và `requestId`, nhưng chưa có hàng đợi giới hạn hoặc chống request trùng. Đề xuất để triển khai và chứng minh: worker pool/hàng đợi hữu hạn, phản hồi `SERVER_BUSY` khi quá tải, idempotency theo `session + requestId` có TTL/giới hạn bộ nhớ. Không ghi là đã hoàn thành trước khi có mã và test.

Các tham số khởi đầu: 4 worker, queue 100, TTL idempotency 60 giây, tối đa 10.000 khóa; cấu hình được và điều chỉnh sau đo. Xem `09-DECISIONS-TO-START.md` để biết hành vi của request lặp và người nhận bàn giao.

Đo cùng workload trên cùng máy cho baseline/đề xuất, với 1, 5 và 20 Client. Ghi median/p95 latency, throughput, số request hoàn tất, lỗi, `SERVER_BUSY` và số phản hồi sai phiên (mục tiêu 0). Lưu môi trường, cấu hình, số lần lặp, input và raw CSV. Nếu dùng workload giả lập để tách tầng transport, ghi đúng bản chất; không trình bày là kết quả nghiệp vụ. Không tạo số liệu giả.

## Hồ sơ nộp

- Báo cáo dạng technical paper, có Abstract, Keywords, Background, Problem, Approach, Architecture, Network Communication, Implementation, Experimental Setup, Results, Discussion, Novelty/Contributions, Limitations, Future Work, Conclusion, References và Appendix.
- README theo mẫu học phần: cách cài/chạy Server, Client và nhiều Client; cấu hình/DB nếu dùng; test, thí nghiệm, kết quả thực, novelty, giới hạn, tham khảo và demo.
- Nộp **một** báo cáo Compilatio, nên là `NhomXX_HuyenCo_Report.docx`; `Similarity + Plagiarism ≤ 20%`. Source chạy được trong `NhomXX_HuyenCo_Source`; gói `NhomXX_HuyenCo/Source/Report`. Source qua Google Drive theo link giảng viên thông báo; lớp trưởng thu USB. Không tự đoán số nhóm `XX` hoặc link nộp.
- Cả ba thành viên hiểu và giải thích được kiến trúc, message flow, code quan trọng và số liệu thực nghiệm.

