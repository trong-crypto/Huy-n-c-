# Kế hoạch đến hạn nộp — cập nhật TV2 + TV3

Ngày cập nhật: 23/10/2026, giờ Việt Nam. Hạn nộp theo `Submission.md`: **23:59 ngày 31/10/2026**. Chủ dự án hiện phụ trách cả TV2 và TV3; Codex đã được giao quyết định kỹ thuật và triển khai phần này. TV1 tiếp tục Client.

**Kế hoạch điều hành chi tiết:** `15-COMBINED-TV2-TV3-PLAN.md`. Tài liệu đó chứa hiện trạng, thứ tự task/phụ thuộc/đầu ra, chính sách nguồn, các quyết định về lịch/lịch sử/mạng, kiểm thử, rủi ro và điều kiện hoàn thành. F01–F08 vẫn thuộc phạm vi bắt buộc.

| Ngày | TV2 + TV3/Codex | TV1 ghép theo module | Điều kiện bàn giao |
| --- | --- | --- | --- |
| 23/10 | Contract/chính sách nguồn, repository, bắt đầu LINES thật và khảo sát nguồn còn thiếu | JSON thật và LINES | Chốt hợp đồng và phép biến đổi quẻ trong service |
| 24/10 | Bootstrap DB, LINES/progress/OBJECT_COUNT; 64 tên và 60 Can Chi; kết luận khảo sát nguồn | Ba quẻ, nguồn, tiến trình | Có kết quả thật qua mạng; thiếu nguồn được chỉ rõ |
| 25/10 | Lịch hai chiều/Can Chi và TIME; kiểm bảng nghề | Màn lịch, TIME | Lịch/TIME có ca chuẩn và ranh ngày rõ |
| 26/10 | Tam Thế ba nhóm và nội dung/REST 64 quẻ theo nguồn đã tìm | Tam Thế, tra quẻ | Có từng luồng thật; mục thiếu không được gọi hoàn thành |
| 27/10 | Lịch sử theo owner, worker/queue, idempotency | Lưu/xem/xóa, reconnect và lỗi | Không lộ lịch sử; request lặp/quá tải xử lý đúng |
| 28/10 | Tích hợp F01–F08, kiểm mạng/riêng tư; bắt đầu đo | Demo hai trình duyệt | Ma trận nghiệm thu từng F và lỗi ưu tiên |
| 29/10 | Đo 1/5/20 Client; paper/novelty/discussion | Ảnh demo, phần Client | Raw CSV và số đo thật tái lập được |
| 30/10 | Sửa lỗi chặn, chạy từ gói sạch/DB trống, chuẩn bị Compilatio | Diễn tập và kiểm bản đóng gói | Release candidate chạy được |
| 31/10 | Compilatio/bản cuối/đóng gói/nộp | Bảo vệ và demo | Mục tiêu nội bộ trước 20:00; hạn chính thức 23:59 |

Các mốc là mục tiêu kế hoạch, không phải bằng chứng đã hoàn thành. Hiện backend còn khung; dữ liệu đã nhập không đồng nghĩa API/UI đã chạy đủ. Xem task A01–R02 tại tài liệu 15.

## Thực nghiệm

Sau khi có LINES thật, lưu baseline xử lý trực tiếp rồi thêm bounded worker/queue và idempotency. So cùng nghiệp vụ, cấu hình và dữ liệu; không so baseline trả lỗi với bản mới trả kết quả. Cấu hình đầu: 4 worker, queue 100, TTL request 60 giây, tối đa 10.000 mục; thông số có thể chỉnh sau đo.

Tải 1/5/20 Client, warm-up 10 giây, đo 60 giây, lặp ít nhất ba lần mỗi cấu hình. Ghi mức tải, raw CSV, median/p95 latency, throughput, lỗi, SERVER_BUSY, phản hồi sai phiên và môi trường. Thử request trùng và độ trễ giả lập thành phép đo riêng. Không viết kết luận cải tiến trước khi có kết quả.

## Hồ sơ nộp

Tuân thủ bốn file hướng dẫn học phần. Báo cáo cấu trúc technical paper, có contribution và số liệu thật; Compilatio Similarity + Plagiarism ≤ 20%; một báo cáo đúng tên `NhomXX_HuyenCo_Report.docx`. Source có README/build/run/test/data/config và thực nghiệm, tên `NhomXX_HuyenCo_Source`; gói cuối `NhomXX_HuyenCo/Source/Report`. Link Drive và số nhóm lấy từ thông tin thực tế; bàn giao USB theo Submission.md. Các thành viên phải giải thích được phần đóng góp, kiến trúc và message flow.
