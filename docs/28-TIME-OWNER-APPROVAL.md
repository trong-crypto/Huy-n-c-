# MH-TIME — ghi nhận quyết định chia 6 đã được chủ dự án duyệt

Ngày xác nhận lại: **24/10/2026**. Chủ dự án đã chốt từ trước: hào động dùng tổng năm/tháng/ngày/giờ chia6, dư0→6; tiếp tục khẳng định không cần treo chờ xác minh lại quyết định này.

## Quyết định có hiệu lực

**MH-TIME 1.0 = VERIFIED**, phạm vi là **quy tắc dự án đã được chủ dự án duyệt**. Reviewer ghi rõ xác nhận của chủ dự án qua hội thoại, do Codex ghi nhận; không ghi giả thành nhà xuất bản đính chính hoặc người kiểm sách độc lập.

```text
upper = (Y+M+D) % 8, dư0→8
lower = (Y+M+D+H) % 8, dư0→8
movingLine = (Y+M+D+H) % 6, dư0→6
```

Trạng thái BLOCKED_SOURCE_CONFLICT của MH-TIME trước biên bản này được thay bằng VERIFIED. Các dòng “chưa duyệt/không nâng VERIFIED” trong biên bản B04 và lịch sử là quyết định cũ đã được cập nhật. **Không yêu cầu chủ dự án xác nhận lại hoặc cung cấp ấn bản khác để chấp nhận công thức chia6.**

## Truy nguồn và phản hồi

- Giữ nguyên sách/PDF45-trang in50 và địa chỉ nguồn; ghi chú vẫn lưu câu chữ bản in dùng “trừ đi 8”. VERIFIED ở đây xác nhận quy tắc hiệu chỉnh đã được duyệt trong dự án; không tuyên bố bản in đã đổi chữ.
- Chính sách thực thi tiếp tục TEAM_DECISION để lưu căn cứ và các quy ước dân sự/nhuận. TEAM_DECISION không có nghĩa chờ phê duyệt: công thức đã được duyệt, đang chạy.
- Kết quả TIME có **ruleBasis=TEAM_DECISION, sourceStatus=VERIFIED** khi năm rule đều VERIFIED. Không còn báo MH-TIME bị chặn. Câu hỏi về phép chia6 đã được giải quyết.
- OBJECT_COUNT, các bảng Tam Thế và các mục khác giữ phạm vi duyệt riêng; không duyệt hàng loạt ngoài nội dung xác nhận này.

## Áp dụng

`scripts/verify_time_decision.py --apply` sao lưu dòng MH-TIME trước khi cập nhật, kiểm mã/module/version/hash sách/trang/nội dung gốc, ghi reviewer/date/verification_note. Chạy lại giữ nguyên thời điểm duyệt; từ chối nếu nguồn hoặc metadata khác đã bị sửa. `import_all.ps1` đã nối bước này để DB mới/cập nhật lại đều nhận đúng quyết định.

Kiểm trên DB tạm: bootstrap lặp, metadata, hai guard thay source/reviewer và toàn bộ kiểm Java. Fixtures và kiểm STOMP đã cập nhật theo trạng thái được duyệt. Biên bản này thay trạng thái MH-TIME trong các tài liệu 02/04/07/15/27 tại mốc trước.


## Đã ghi nhận vào huyenco

Áp dụng thành công lúc **23:58:30 ngày24/10/2026 UTC+7**. Truy vấn thực tế: `MH-TIME | VERIFIED`, reviewer `Project owner confirmation via chat 2026-10-24; recorded by Codex`; ngày duyệt và ghi chú phạm vi đã lưu. Có backup JSON dòng cũ trong `scripts/generated/db-backups/`. Bootstrap hai lần và hai ca bảo vệ nguồn/reviewer đã đạt trên DB tạm; 454 Java/43 Python đạt. Kiểm toán huyenco sau cập nhật không có lỗi. Phản hồi STOMP TIME thật và fixture đã đổi sang sourceStatus=VERIFIED.
