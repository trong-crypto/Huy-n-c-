# Fixtures hợp đồng v1.2

Các mẫu dùng để TV1 phát triển giao diện và kiểm tương thích DTO. Riêng mẫu LINES đã được cập nhật từ phản hồi runtime B01 (cố định lại requestId cho fixture). Các mẫu thành công khác vẫn là đầu ra dự kiến, không xác nhận dữ liệu hiện VERIFIED. Không phục vụ các mẫu bằng controller giả.

- `mai-hoa-lines.request/response.json`: sáu hào/hào động 2; H_KHAM_LY → hỗ H_LY_KHAM, biến H_KHAM_CAN. Sau S01 ngày 24/10 response có tên Ký tế/Vị tế/Nhu và nameStatus VERIFIED; thay mẫu B01 trước đó có name=null. Xem `18-B01-LINES-HANDOFF.md` và `19-S01-HEXAGRAM-NAME-REVIEW.md`.
- `mai-hoa-object-count.request/response.json`: 12 vật/giờ 8, phản hồi runtime B03 với requestId cố định: Dự/hỗ Kiển/biến Giải, hào 2. MH-TRIGRAM đã VERIFIED theo biên bản 21; công thức MH-OBJECT-COUNT giữ TEAM_DECISION/SOURCE_AMBIGUOUS. Fixture không thay biên bản nguồn.
- `mai-hoa-time.request.json`: request hợp đồng, chưa có fixture kết quả vì lịch chưa được triển khai/kiểm chuẩn.
- `tam-the.request.json`: mặc định cả ba category; `tam-the-career.request.json`: chỉ CAREER. Chưa có mẫu luận giải thành công do nguồn chưa đủ. `tam-the-unavailable.response.json` mô tả lỗi service chưa triển khai.
- `calculation.progress.json`: event riêng, không phải kết quả cuối; B02 đã phát thật, fixture lấy từ event ACCEPTED thực và cố định requestId. LINES thành công phát đủ 1–4; lỗi chỉ có tiền tố bước thực.
- `rule-not-available.response.json`: lỗi registry chưa có trạng thái nguồn; khác IMPLEMENTATION_UNAVAILABLE khi code nghiệp vụ chưa sẵn sàng.
- `calendar-convert.request.json`, `history-save.request.json`: body REST dự kiến, không có STOMP envelope. Chưa có controller các endpoint này.

Kiểu Java và TypeScript phải khớp các mẫu. `ruleBasis=TEAM_DECISION` buộc UI hiện cảnh báo quy ước nhóm, dù JSON có nhiều rule khác VERIFIED. Thông điệp lỗi không chứa dữ liệu sinh/secret.
