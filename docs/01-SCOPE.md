# Phạm vi Huyền Cơ cho bài tập lớn Lập trình mạng

Huyền Cơ được đề xuất trong **Chủ đề 3 — Ứng dụng mạng**. Trọng tâm bài nộp là thiết kế giao tiếp Client–Server, message format, quản lý phiên, concurrency, lỗi và thực nghiệm. Nhóm cần trình đề xuất cho giảng viên và lưu phản hồi; chưa ghi là đã được duyệt.

## Phạm vi chức năng bắt buộc của sản phẩm

Quyết định của chủ dự án ngày 22/10/2026: **tất cả chức năng dưới đây đều phải có**. Phân loại P0/P1/P2 ở bản kế hoạch cũ chỉ còn mô tả thứ tự triển khai, không còn là cách loại bớt chức năng. Điều kiện nghiệm thu từng chức năng ở `10-FUNCTIONAL-REQUIREMENTS.md`.

1. Lập quẻ Mai Hoa theo thời gian **và** theo số vật đếm được (`OBJECT_COUNT`) bằng quy tắc có nguồn.
2. Tính và hiển thị quẻ chủ, quẻ hỗ, quẻ biến, hào động và từng bước lập quẻ.
3. Luận giải công danh, tài lộc, tình duyên theo Diễn Cầm Tam Thế, gắn trang sách.
4. Tra cứu đủ 64 quẻ Kinh Dịch theo tên/mã/quẻ, có nguồn cho dữ liệu và lời giải.
5. Chuyển lịch Dương–Âm hai chiều, xử lý tháng nhuận và tính Can Chi.
6. Gửi tiến trình và kết quả theo thời gian thực, đúng `requestId` và session.
7. Lưu, tìm, xem lại và xóa lịch sử luận giải của chính người dùng, có kiểm soát truy cập.
8. Xử lý đầu vào sai, mất kết nối, timeout, nhiều Client đồng thời và bảo vệ dữ liệu riêng.

`MAI_HOA/LINES` là lát cắt kỹ thuật làm trước để chứng minh luồng Client–Server; **không thay thế** TIME, NUMBER hoặc các chức năng còn lại. Một chức năng chỉ hoàn thành khi chạy đầu cuối, có kiểm thử và quy tắc/dữ liệu `VERIFIED` theo đúng ấn bản. Hạn nộp 31/10/2026 với ba thành viên là rủi ro tiến độ lớn; báo cáo phải ghi đúng các chức năng đã chạy và chưa chạy, không gọi bản thiếu chức năng là đầy đủ.

## Giai đoạn 1 — nền giao tiếp và lát cắt LINES

- Client và Server chạy được; STOMP/WebSocket có đường kết nối, gửi/nhận, đóng kết nối và xử lý reconnect/timeout.
- JSON thống nhất; `requestId` và `session` định tuyến đúng; nhiều Client đồng thời không nhận nhầm dữ liệu.
- Kiểm tra đầu vào, request trùng, quá tải, lỗi Server/DB nếu dùng; một lỗi không làm sập các phiên khác.
- Tuyến nghiệp vụ P0 đã chọn: `MAI_HOA` với `method=LINES`, nhận sáu hào và hào động do người dùng nhập để tạo quẻ hỗ/quẻ biến; TV2/TV3 phải kiểm nguồn và test trước khi trả `COMPLETED`. Không trình bày đây là phép lập quẻ theo thời gian hoặc lời luận giải. Nếu hai quy tắc vẫn chưa `VERIFIED` tại cổng 23/10, nhóm đưa chứng cứ cho giảng viên và chốt tra cứu tri thức sách có nguồn làm tuyến thay thế trước 24/10.
- Có baseline, cải tiến kỹ thuật worker pool/hàng đợi hữu hạn và xử lý request trùng, số đo thực nghiệm, báo cáo technical paper, README và demo chạy từ gói nộp. PostgreSQL/Docker không thuộc P0.

## Giai đoạn 2 — hoàn thiện các chức năng bắt buộc

- Mai Hoa TIME dùng hào động chia 6 theo quyết định nhóm; phương pháp số vật dùng `OBJECT_COUNT` và `hourIndex` (không dùng NUMBER hai số cũ); lịch/Can Chi và test nguồn theo `04-MAIHOA-RULES.md`.
- Tam Thế công danh, tài lộc, tình duyên: xác định đúng mục/bảng trong sách, nhập đủ ô liên quan, review và test theo `05-TAMTHE-RULES.md`.
- Tra cứu đủ 64 quẻ, chuyển lịch hai chiều, Can Chi, tiến trình thời gian thực và lịch sử có bảo vệ quyền truy cập. PostgreSQL có thể cài trực tiếp hoặc dùng Server chung; Docker không bắt buộc.

## Ngoài phạm vi chức năng đã yêu cầu

Thanh toán và chatbot AI không thuộc yêu cầu. Tài khoản chỉ thêm nếu cần để sở hữu lịch sử; dù chọn cơ chế nào, không dùng session WebSocket làm định danh lịch sử lâu dài. Phương pháp hai con số của khung cũ chưa có căn cứ sách, nên không được gắn nhãn đã hoàn thành chức năng NUMBER. Không ghi luận giải chưa xác minh thành kết quả thật. Nội dung luận giải thuộc tri thức văn hóa/tín ngưỡng truyền thống, không trình bày như dự đoán khoa học.

## Phân công

| Thành viên | Sở hữu | Bàn giao |
| --- | --- | --- |
| TV1 | Next.js, form TIME/NUMBER/Tam Thế, trang 64 quẻ/lịch/lịch sử, STOMP Client | UI từng chức năng, tiến trình/lỗi, hai phiên, README và demo |
| TV2 | Spring Boot, STOMP/REST, Mai Hoa, concurrency, message protocol | Thuật toán Mai Hoa đã kiểm nguồn, Server/progress, API an toàn, benchmark |
| TV3 | Nguồn sách, 64 quẻ, Tam Thế, lịch/Can Chi, lưu trữ | Bộ dữ liệu đã review, module lịch/Tam Thế, schema/migration, test nguồn |

Xem `08-SPRINT-PLAN.md` để biết mốc ngày và hồ sơ nộp.
Các quyết định để ba thành viên bắt đầu ngay nằm ở `09-DECISIONS-TO-START.md`.

