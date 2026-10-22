# Hợp đồng JSON/STOMP v1.0

- Endpoint: `/ws`; application prefix: `/app`; broker prefix: `/queue`; user prefix: `/user`.
- SEND: `/app/mai-hoa/calculate`, `/app/tam-the/calculate`.
- SUBSCRIBE: `/user/queue/results`, `/user/queue/errors`.
- Chỉ gửi phản hồi cho session yêu cầu. Không broadcast dữ liệu cá nhân.
- `requestId`: UUID duy nhất; `type`: `MAI_HOA` hoặc `TAM_THE`.
- `birthDate`: `YYYY-MM-DD`; `birthTime`: `HH:mm`; `datetime`: ISO 8601 có offset. Múi giờ nghiệp vụ mặc định `Asia/Ho_Chi_Minh`.
- `calendarType`: `SOLAR` hoặc `LUNAR`; `isLeapMonth` bắt buộc với `LUNAR`.
- `linesBottomUp`: sáu boolean từ hào dưới lên; `true` = dương, `false` = âm.
- `status`: `COMPLETED` hoặc `FAILED`. Thành công có `data`, `error: null`; thất bại có `data: null`, `error.code`, `error.message`, `error.ruleCode` (null nếu không gắn một quy tắc cụ thể).
- `method=TIME` theo Mai Hoa cần Server xác định năm/tháng/ngày/giờ âm. `method=NUMBER` với `numbers:[a,b]` hiện là mẫu tương thích cũ, **chưa có quy tắc trong mục số vật đã đối chiếu**, nên trả `RULE_NOT_AVAILABLE`. Nếu triển khai “số vật” theo sách, chốt payload `objectCount` và giờ trước khi đổi hợp đồng chung.
- Kết quả thuật toán chỉ `COMPLETED` khi toàn bộ quy tắc cần dùng đã `VERIFIED`; nếu chưa, trả `RULE_NOT_AVAILABLE` cùng `ruleCode`. Mỗi dữ liệu luận giải có `sourceReferences` gồm sách, mục và trang in/PDF.

Các ví dụ trong `examples/` là **mẫu cấu trúc, không phải kết quả thuật toán**.

## Mã lỗi Server

`INVALID_INPUT`, `INVALID_DATE`, `INVALID_METHOD`, `RULE_NOT_AVAILABLE`, `SERVER_BUSY`, `INTERNAL_ERROR`.

`REQUEST_TIMEOUT` và `DISCONNECTED` là trạng thái phía Client. `/user/queue/progress` có thể bổ sung sau qua PR; chưa thuộc v1.0.

## Bảo mật

Khung hiện có origin allowlist, giới hạn kích thước thông điệp và không chủ động log ngày sinh/câu hỏi. Trước khi triển khai công khai, TV2 phải bổ sung HTTPS/WSS và giới hạn tần suất theo phiên/IP, rồi kiểm thử cấu hình proxy và log. Không đưa khóa hoặc mật khẩu vào Client/repository.

