# Hợp đồng JSON/STOMP v1.1 và phần mở rộng bắt buộc v1.2

- Endpoint: `/ws`; application prefix: `/app`; broker prefix: `/queue`; user prefix: `/user`.
- SEND: `/app/mai-hoa/calculate`, `/app/tam-the/calculate`.
- SUBSCRIBE: `/user/queue/results`, `/user/queue/errors`.
- Chỉ gửi phản hồi cho session yêu cầu. Không broadcast dữ liệu cá nhân.
- `requestId`: UUID duy nhất; `type`: `MAI_HOA` hoặc `TAM_THE`.
- `birthDate`: `YYYY-MM-DD`; `birthTime`: `HH:mm`; `datetime`: ISO 8601 có offset. Múi giờ nghiệp vụ mặc định `Asia/Ho_Chi_Minh`.
- `calendarType`: `SOLAR` hoặc `LUNAR`; `isLeapMonth` bắt buộc với `LUNAR`.
- `linesBottomUp`: sáu boolean từ hào dưới lên; `true` = dương, `false` = âm.
- `status`: `COMPLETED` hoặc `FAILED`. Thành công có `data`, `error: null`; thất bại có `data: null`, `error.code`, `error.message`, `error.ruleCode` (null nếu không gắn một quy tắc cụ thể).
- `method=LINES` là chức năng P0: `linesBottomUp` có đúng sáu boolean từ dưới lên; `movingLine` là số nguyên 1–6. Server trả sáu hào quẻ chủ, quẻ hỗ (hào 2–4 rồi 3–5) và quẻ biến (đảo hào động) **chỉ sau khi** `MH-MUTUAL` và `MH-CHANGE` được TV2/TV3 kiểm chứng theo trang sách. Tên/mã quẻ và lời luận giải không thuộc P0 khi bảng chưa kiểm nguồn. Xem `examples/mai-hoa-lines.request.json` và `09-DECISIONS-TO-START.md`.
- `method=TIME`: TV2 dùng chia 6 lấy dư để tìm hào động (dư 0 → hào 6), theo quyết định nhóm; Server vẫn cần lịch/Can Chi và test trước khi trả kết quả thật.
- `method=OBJECT_COUNT`: payload gồm `objectCount` nguyên dương (giới hạn kỹ thuật 1–999999), `hourIndex` nguyên 1–12 (Tý=1…Hợi=12), `question` tùy chọn tối đa 500 ký tự. Thượng quái = dư `objectCount % 8` (0→8), hạ quái = dư `hourIndex % 8` (0→8), hào động = dư `(objectCount + hourIndex) % 6` (0→6). `method=NUMBER` và `numbers:[a,b]` cũ **bị loại bỏ**, trả `INVALID_METHOD`. Xem `examples/mai-hoa-object-count.request.json`.
- Kết quả thuật toán chỉ `COMPLETED` khi toàn bộ quy tắc cần dùng đã `VERIFIED`; nếu chưa, trả `RULE_NOT_AVAILABLE` cùng `ruleCode`. Mỗi dữ liệu luận giải có `sourceReferences` gồm sách, mục và trang in/PDF.

Các ví dụ trong `examples/` là **mẫu cấu trúc, không phải kết quả thuật toán**.

## Response P0 LINES

`data` gồm `method: "LINES"`, `ruleVersion`, `primaryHexagram.linesBottomUp`, `mutualHexagram.linesBottomUp`, `changedHexagram.linesBottomUp`, `movingLine` và `sourceReferences` (ấn bản, trang in, trang PDF). Với ví dụ trong `mai-hoa-lines.request.json`, dự kiến `mutualHexagram.linesBottomUp = [false,true,false,true,false,true]` và `changedHexagram.linesBottomUp = [true,true,true,false,true,false]`; đây là expected của phép biến đổi cấu trúc, **chưa phải chứng nhận VERIFIED** khi chưa có review độc lập theo ấn bản.

Đầu vào LINES sai cấu trúc trả `INVALID_INPUT`; khi quy tắc chưa `VERIFIED` trả `RULE_NOT_AVAILABLE` cùng `ruleCode`. Không tự thay response envelope đã chốt.

## Mã lỗi Server

`INVALID_INPUT`, `INVALID_DATE`, `INVALID_METHOD`, `RULE_NOT_AVAILABLE`, `SERVER_BUSY`, `INTERNAL_ERROR`.

`REQUEST_TIMEOUT` và `DISCONNECTED` là trạng thái phía Client. Theo phạm vi F01–F08 mới, `/user/queue/progress` là yêu cầu bắt buộc của v1.2; TV2 cần chốt payload `requestId`, `step`, `sequence`, `message` và kết quả cuối vẫn đi qua `/user/queue/results` hoặc `/user/queue/errors`.

## Phần mở rộng v1.2 phải đặc tả trước khi code

- Mai Hoa `TIME`: thời điểm ISO 8601 kèm offset; Server trả quẻ chủ/hỗ/biến, hào động, `calculationSteps` và nguồn sau khi lịch/Can Chi, xung đột tr. 50 và ca chuẩn được chốt.
- Mai Hoa theo số vật dùng `OBJECT_COUNT` như trên. Công thức lấy hào động từ `objectCount` gốc là quyết định nhóm trước cụm “số quẻ” còn mơ hồ ở tr. 51 / PDF 46; TV2/TV3 phải đối chiếu ca chuẩn trước khi gắn `VERIFIED`. Cho đến khi toàn tuyến được kiểm, Server trả `RULE_NOT_AVAILABLE` với `MH-OBJECT-COUNT`.
- Tam Thế: kết quả gồm các mục `CAREER`, `WEALTH`, `LOVE`, mỗi mục có `sourceReferences` và trạng thái nguồn; chỉ trả mục đã được xác minh, không tự tạo diễn giải từ bảng chưa kiểm.
- REST `/api/v1/hexagrams` và `/api/v1/hexagrams/{id}` để tìm và xem 64 quẻ; `/api/v1/calendar/convert` và `/api/v1/calendar/can-chi` để đổi lịch/tính Can Chi. Cần ghi rõ query, phạm vi năm, trường kết quả, phân trang/lỗi và ví dụ trong PR hợp đồng.
- Lịch sử: REST `/api/v1/history` cho tạo/danh sách, `/api/v1/history/{id}` cho xem/xóa. Chỉ lưu khi người dùng chủ động yêu cầu; chốt cơ chế định danh/chủ sở hữu và kiểm quyền trước khi bật API. Không coi session STOMP là định danh dài hạn.
- Tất cả tính toán vẫn ở Server; các response mới phải thống nhất cách báo lỗi, `ruleVersion`, `sourceReferences` và `requestId` khi là yêu cầu STOMP. V1.2 ở đây là danh mục cần đặc tả, **chưa phải xác nhận endpoint đã tồn tại**.

## Bảo mật

Khung hiện có origin allowlist, giới hạn kích thước thông điệp và không chủ động log ngày sinh/câu hỏi. Trước khi triển khai công khai, TV2 phải bổ sung HTTPS/WSS và giới hạn tần suất theo phiên/IP, rồi kiểm thử cấu hình proxy và log. Không đưa khóa hoặc mật khẩu vào Client/repository.

