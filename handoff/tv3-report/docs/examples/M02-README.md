# Phân loại fixtures M02/M03/D04

**Sau triển khai V12 theo [43](../43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md):** năm capture D04 được cố định thứ tự sourceReferences tổng theo result_code, không đổi nội dung/khóa/tập trang hoặc thứ tự các entry. Đã chụp phản hồi thật trên huyenco rồi khởi động JVM lại và so chính xác cả chín capture M03/D04 đạt. Tổng vẫn62 JSON; M03 fixtures không đổi.

**D04:** thêm năm cặp `d04-*.request.json`/`.response.json`, gồm Lộc có/không giao điểm, nhãn khác nhau, âm nhuận và Dương tương đương. Đây là capture service/STOMP thật theo [42](../42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md); Java/TypeScript/guard/state parser và720 tổ hợp thật đạt. Tổng hiện tại **62 JSON**. Các con số44/52 và gate chưa mở dưới đây là lịch sử M02/M03; capture M03 giữ nguyên.

**M03:** thêm bốn cặp `m03-*.request.json`/`.response.json` (LINES không context, LINES có mùa, OBJECT_COUNT, TIME). Bốn response là capture STOMP thật từ service Mai Hoa/DB V12 ngày26/10; các ca Java/TypeScript và smoke so nội dung. Tổng hiện có **52 JSON**. Bàn giao runtime hiện tại ở [41](../41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md).

Các mục dưới đây mô tả mốc M02 trước khi có service Mai Hoa:

- `m02-*.request.json`: 5 đầu vào được validator M02 hỗ trợ. LEGACY chạy tuyến cũ; reading/EXTENDED hiện bị chặn IMPLEMENTATION_UNAVAILABLE chờ M03/D04.
- `m02-*-unavailable.response.json`: 4 phản hồi được kiểm với controller và hai service thật (chốt trước DB); không phải lỗi dữ liệu nguồn chưa duyệt.
- `m02-*.schema.response.json`: 4 mẫu kết quả **chỉ kiểm schema/DTO/guard và vòng lưu–đọc H01**. Chưa được service M03/D04 phát ra, không phải bằng chứng nghiệm thu lời luận. Nội dung lấy từ bộ M01 đã duyệt để mẫu truyền dữ liệu có nguồn; test schema không tự duyệt nguồn.

31 fixture cũ giữ nguyên nội dung. Mốc M02 có44 JSON; sau M03 có52. Xem [39](../39-DETAILED-READINGS-CONTRACT.md) cho hợp đồng, [40](../40-M02-CONTRACT-HANDOFF.md) cho lịch sử M02 và41 cho trạng thái mới. Gate Mai Hoa M02 chỉ còn áp dụng ở test chưa cấu hình interpreter; Tam Thế EXTENDED tiếp tục chờ D04.
