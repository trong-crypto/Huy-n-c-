# Huyền Cơ

Khung dự án Client–Server cho Mai Hoa Dịch Số và Diễn Cầm Tam Thế. Đây là bộ khung để ba thành viên phát triển song song. Hai bản sách đã được đối chiếu ở mức đặc tả (`SOURCE_LOCATED`), nhưng **chưa có thuật toán luận giải nào đạt `VERIFIED`**. Server nhận yêu cầu hợp lệ rồi trả `RULE_NOT_AVAILABLE` kèm `ruleCode` cho đến khi dữ liệu và kiểm thử được duyệt.

**Phạm vi sản phẩm đã cập nhật:** Mai Hoa theo thời gian và con số; quẻ chủ/hỗ/biến, hào động; Tam Thế công danh/tài lộc/tình duyên; tra cứu 64 quẻ; đổi lịch Âm–Dương/Can Chi; tiến trình theo thời gian thực; lưu và tra cứu lịch sử. Đây là **yêu cầu cần triển khai**, chưa phải các chức năng đã có. Xem `docs/10-FUNCTIONAL-REQUIREMENTS.md` và `docs/01-SCOPE.md`. Docker không bắt buộc; khi làm lịch sử Server và kho dữ liệu, nhóm cần cấu hình PostgreSQL cài trực tiếp hoặc dùng Server chung.

## Cấu trúc

- `client/`: Next.js, hai màn hình nhập liệu và STOMP WebSocket Client (TV1).
- `server/`: Spring Boot, định tuyến STOMP, kiểm tra đầu vào, điểm mở rộng nghiệp vụ (TV2/TV3).
- `server/src/main/resources/db/migration/`: bản nháp schema PostgreSQL do TV3 quản lý; chỉ dùng khi bật cấu hình database.
- `docs/`: hợp đồng chung, quy tắc, kế hoạch kiểm thử và nhật ký quyết định.

Giao diện Mai Hoa có biểu mẫu theo thời gian và số vật (`OBJECT_COUNT`). Biến thể `NUMBER` với mảng hai số đã bị loại bỏ. TV2 đã có hàm số học chia dư 8/6 theo quyết định nhóm, nhưng Server vẫn trả `RULE_NOT_AVAILABLE` cho đến khi quy tắc và dữ liệu đầu cuối được kiểm chứng; xem `docs/04-MAIHOA-RULES.md` và `docs/05-TAMTHE-RULES.md`.

## Chạy cục bộ

Yêu cầu Node.js 20.9+ và Java 17+. Không cần Docker hay PostgreSQL để chạy khung ban đầu. Maven Wrapper đã nằm trong `server/`, nên không cần cài Maven riêng.

1. Trong `server/`, chạy `.\mvnw.cmd spring-boot:run` trên Windows hoặc `./mvnw spring-boot:run` trên macOS/Linux.
2. Trong `client/`, chạy `npm install`, sao chép `.env.example` thành `.env.local`, rồi chạy `npm run dev`.
3. Mở `http://localhost:3000`. Kiểm tra Server tại `http://localhost:8080/api/v1/health`.

Server mặc định chạy luồng WebSocket và trả `RULE_NOT_AVAILABLE` cho các phép tính chưa xác minh. Không cần database ở giai đoạn này.

Để kiểm tra mã: `npm run typecheck` và `npm run build` trong `client/`; `.\mvnw.cmd test` trong `server/`. Trên Windows với thư mục OneDrive, script Next.js dùng Webpack để tránh lỗi tạo tiến trình của Turbopack.
Khi Server đang chạy, chạy `npm run smoke:stomp` trong `client/` để kiểm tra hai phiên Client, mã lỗi và `ruleCode`. Đặt `WS_URL=ws://localhost:<cổng>/ws` nếu Server không dùng cổng 8080.

## Khi bắt đầu làm database

TV3 có thể dùng PostgreSQL cài trên máy hoặc một Server PostgreSQL chung của nhóm. Đặt `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, rồi chạy Server với cả Maven profile `database` và Spring profile `db`:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/huyenco"
$env:DB_USERNAME = "huyenco"
$env:DB_PASSWORD = "<mật khẩu của nhóm>"
.\mvnw.cmd -Pdatabase spring-boot:run "-Dspring-boot.run.profiles=db"
```

Migration tại `server/src/main/resources/db/migration/` sẽ chạy khi bật cấu hình này. Schema hỗ trợ trang in/PDF, nhận diện file scan, trạng thái kiểm chứng và nhiều kết quả nghề cho cùng một khóa tra. TV3 vẫn cần nhập bảng nguồn và review trước khi kích hoạt tính toán.

## Hợp đồng giao tiếp

Client kết nối `/ws`, gửi tới `/app/mai-hoa/calculate` hoặc `/app/tam-the/calculate`, đăng ký `/user/queue/results` và `/user/queue/errors`. Mỗi thông điệp mang `requestId` UUID. Các ví dụ JSON có trong `docs/02-API-CONTRACT.md` và `docs/examples/`.

## Quy tắc phát triển

`main` là bản đã tích hợp; `develop` dùng tích hợp; mỗi việc làm trên nhánh `feature/...`. Mọi thay đổi JSON, schema hoặc thuật toán phải cập nhật tài liệu và được chủ module review trước khi merge. Không số hóa hoặc hiển thị lời luận giải không có nguồn ấn bản/chương/trang và kiểm thử đối chiếu.

