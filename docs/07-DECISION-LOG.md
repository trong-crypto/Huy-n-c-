# Nhật ký quyết định

| Ngày | Quyết định | Lý do | Ảnh hưởng | Người duyệt |
| --- | --- | --- | --- | --- |
| 2026-10-22 | Khung JSON/STOMP v1.0 là baseline; hợp đồng P0 v1.1 bổ sung LINES | Cho ba thành viên làm song song, giữ envelope và định tuyến phiên | Client, Server, tài liệu | Quyết định triển khai tại `09-DECISIONS-TO-START.md` |
| 2026-10-22 | Hai bản PDF đã được định vị theo trang; chưa bật kết quả thật | Còn thiếu test, dữ liệu tra và review chéo | Mai Hoa, Tam Thế | TV2/TV3 review |
| 2026-10-22 | Giữ `NUMBER` hai số như hợp đồng cũ nhưng ẩn khỏi UI | Mục “số vật” của sách không chứng minh phép hai số; bước lấy hào còn mơ hồ | Client, API, Mai Hoa | TV2/TV3 chốt nguồn |
| 2026-10-22 | Tạm lấy hào động TIME theo chia 6 | Tr. 50 bản Mai Hoa in “trừ 8”, trái mục “Hào trừ 6” và nguyên văn trước đó | MH-TIME | TV2/TV3 đối chiếu ví dụ |
| 2026-10-22 | Giữ cờ xung đột cho dòng đầu tháng 5 | Bản Tam Thế in “Dậu” ở mốc 05:20 dù chuỗi tiếp là Mão…Mùi | TT-GIO-SINH | TV3/TV2 chốt trước nhập bảng |
| 2026-10-22 | Chọn `MAI_HOA`/`LINES` làm P0 | Quẻ hỗ và quẻ biến có quy tắc định vị tr. 46–48; tránh phụ thuộc lịch âm và xung đột của TIME | Client, API v1.1, Server, test | Quyết định triển khai theo yêu cầu chủ dự án; TV2/TV3 phải kiểm nguồn trước VERIFIED |
| 2026-10-22 | Không dùng PostgreSQL/Docker cho P0 | Tập trung chức năng mạng, đo lường và hạn nộp 31/10 | Build/demo, dữ liệu | Quyết định triển khai; giữ migration cho P1 |
| 2026-10-22 | Novelty dự kiến: worker pool/queue hữu hạn và idempotency trong phiên | Baseline hiện xử lý trực tiếp, chưa có kiểm soát tải/request lặp | TV2, benchmark, README, báo cáo | Chỉ công bố là đóng góp sau khi code, test và đo thật |
| 2026-10-22 | Khóa hợp đồng P0 ở `02-API-CONTRACT.md` v1.1 | Cho TV1/TV2/TV3 làm song song từ cùng request/response | Cả nhóm | Thay đổi tiếp theo qua PR kèm mock/test |
| 2026-10-22 | Chủ dự án yêu cầu F01–F08 đều có trong sản phẩm | Danh sách chức năng đầy đủ thay phân loại P1/P2 cũ | Client, Server, nguồn sách, lịch, 64 quẻ, lịch sử, kế hoạch | Xem `10-FUNCTIONAL-REQUIREMENTS.md`; LINES chỉ là lát cắt đầu, không phải đích cuối |
| 2026-10-22 | Mở rộng hợp đồng lên v1.2 theo từng chức năng, chưa coi quy tắc mới là VERIFIED | TIME/NUMBER, Tam Thế ba nhóm, tiến trình, tra cứu, lịch và lịch sử cần đầu vào/đầu ra rõ | TV1/TV2/TV3 đồng bộ mock, test và nguồn trước tích hợp | Không trả COMPLETED giả hoặc lưu lịch sử chưa có kiểm soát truy cập |
| 2026-10-22 | **Chốt** hào động Mai Hoa theo tổng chia 6, dư 0 thành hào 6 | Chủ dự án chọn cách cài nhất quán với mục “Hào trừ 6”; tr. 50 vẫn in “trừ 8” | TV2 dùng cho TIME và ghi xung đột bản in trong nguồn/test | Quyết định nhóm; toàn tuyến chỉ VERIFIED sau test/lịch và TV3 kiểm |
| 2026-10-22 | **Chốt** tháng 5 Tam Thế 05:20–07:19 là giờ Dần | Chuỗi sau đó là Mão…Mùi, bản in ghi Dậu | TV3 lưu cả chữ gốc Dậu và giá trị dùng Dần; test ranh giờ | Quyết định nhóm; TV2 kiểm toàn bảng trước VERIFIED |
| 2026-10-22 | **Thay** NUMBER hai số bằng `OBJECT_COUNT` | Chủ dự án chốt `objectCount`, `hourIndex`, phép chia 8/8/6 theo số vật gốc | TV1 form; TV2 validator/hàm; JSON mẫu và smoke test đổi theo v1.2 | Cụm “số quẻ” tr. 51 còn mơ hồ; chưa gọi công thức là VERIFIED theo bản in |

Mọi thay đổi JSON, schema hoặc quy tắc phải có Pull Request cập nhật tài liệu, mock và kiểm thử trước khi merge.

Các dòng “chờ duyệt” là việc của nhóm, chưa được coi là quyết định học thuật hay xác minh nguồn. Khi chốt, thêm ngày, người duyệt và ca đối chiếu; không sửa mất nguyên trạng bản in.

