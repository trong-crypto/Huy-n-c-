# Huyền Cơ

Dự án Client–Server cho Mai Hoa Dịch Số và Diễn Cầm Tam Thế. **Cập nhật 24/10/2026:** chủ dự án phụ trách cả TV2 và TV3; TV1 phụ trách giao diện. Kế hoạch ở [docs/15-COMBINED-TV2-TV3-PLAN.md](docs/15-COMBINED-TV2-TV3-PLAN.md). `LINES` và `OBJECT_COUNT` đã tính quẻ chủ/hỗ/biến qua PostgreSQL và STOMP thật. Ba rule MH-TRIGRAM/MH-MUTUAL/MH-CHANGE, mốc tháng 5 và 64 tên quẻ đã VERIFIED trong đúng phạm vi biên bản. Công thức OBJECT_COUNT vẫn **TEAM_DECISION/SOURCE_AMBIGUOUS**. TIME và Tam Thế chưa triển khai. Xem [biên bản S01](docs/19-S01-HEXAGRAM-NAME-REVIEW.md) và [bàn giao B03](docs/21-B03-OBJECT-COUNT-HANDOFF.md).

**B02 đã hoàn thành:** Server phát tiến trình thật, Client hiển thị các bước và dọn trạng thái khi lỗi/timeout/disconnect; đã chặn SEND/SUBSCRIBE thẳng vào broker hoặc queue của người khác. Hạn Run mặc định 10 giây, Client tổng 15 giây; chưa có worker/queue/idempotency N01. Xem [bàn giao B02](docs/20-B02-PROGRESS-HANDOFF.md).

**S02 đã hoàn thành:** huyenco có đủ 60 ánh xạ Can Chi→hành từ Tam Thế PDF11, từng ô và TT-NGU-HANH đã VERIFIED đúng phạm vi; V6 lưu metadata duyệt. Tổng ô tra Tam Thế là 111 (60 hành + 51 công danh chưa duyệt). Phần mô tả nạp âm, các bảng luận giải khác và TamTheService vẫn còn việc; database toàn hệ thống chưa hoàn tất. Xem [biên bản S02](docs/22-S02-TAM-THE-YEAR-ELEMENTS.md). Giao diện thuộc TV1.

**Phạm vi sản phẩm đã cập nhật:** Mai Hoa theo thời gian và con số; quẻ chủ/hỗ/biến, hào động; Tam Thế công danh/tài lộc/tình duyên; tra cứu 64 quẻ; đổi lịch Âm–Dương/Can Chi; tiến trình theo thời gian thực; lưu và tra cứu lịch sử. Đây là **yêu cầu cần triển khai**, chưa phải các chức năng đã có. Xem `docs/10-FUNCTIONAL-REQUIREMENTS.md` và `docs/01-SCOPE.md`. Docker không bắt buộc; khi làm lịch sử Server và kho dữ liệu, nhóm cần cấu hình PostgreSQL cài trực tiếp hoặc dùng Server chung.

## Cấu trúc

- `client/`: Next.js, hai màn hình nhập liệu và STOMP WebSocket Client (TV1).
- `server/`: Spring Boot, định tuyến STOMP, kiểm tra đầu vào, điểm mở rộng nghiệp vụ (TV2/TV3).
- `server/src/main/resources/db/migration/`: schema PostgreSQL do Flyway quản lý; V1–V4 đã áp dụng, không sửa checksum các bản đã chạy.
- `docs/`: hợp đồng chung, quy tắc, kế hoạch kiểm thử và nhật ký quyết định.
- `scripts/import_book_knowledge.py`: kiểm nguồn PDF, tạo SQL và nhập dữ liệu có địa chỉ trang sách; hướng dẫn tại `docs/11-DATA-IMPORT.md`.
- `scripts/import_all.ps1`: khởi tạo DB mới hoặc cập nhật DB hiện có theo thứ tự V1–V3 → seed sách → V4/latest → **64 quẻ + 384 hào** → tên có nguồn → kiểm toán; nhập mật khẩu ẩn hoặc dùng `PGPASSWORD` của tiến trình.
- `scripts/audit_tv3.py` / `scripts/audit_tv3.ps1`: kiểm tra dữ liệu cục bộ và truy vấn PostgreSQL chỉ đọc, sinh báo cáo kiểm toán.
- `docs/12-TV3-SOURCE-REVIEW.md` và `docs/13-TV3-HEXAGRAM-STRUCTURE.md`: chứng cứ trang sách, dữ liệu đã có và giới hạn còn chờ kiểm chéo.

Giao diện thuộc TV1. B03 bàn giao API STOMP `OBJECT_COUNT`, phản hồi ba quẻ, các bước tính và metadata để TV1 tích hợp; kiểm bằng chương trình Client STOMP không đồng nghĩa đã nghiệm thu giao diện. Ba thay đổi biểu mẫu trong B03 đã được hoàn tác theo nhắc nhở của chủ dự án. TIME phía Server chưa sẵn sàng; `NUMBER` hai số đã bị loại bỏ. Xem [bàn giao B03](docs/21-B03-OBJECT-COUNT-HANDOFF.md) và `docs/02-API-CONTRACT.md`.

## Chạy cục bộ

Yêu cầu Node.js 20.9+ và Java 17+. Không cần Docker hay PostgreSQL để chạy khung ban đầu. Maven Wrapper đã nằm trong `server/`, nên không cần cài Maven riêng.

1. Trong `server/`, chạy `.\mvnw.cmd spring-boot:run` trên Windows hoặc `./mvnw spring-boot:run` trên macOS/Linux.
2. Trong `client/`, chạy `npm install`, sao chép `.env.example` thành `.env.local`, rồi chạy `npm run dev`.
3. Mở `http://localhost:3000`. Kiểm tra Server tại `http://localhost:8080/api/v1/health`.

Server mặc định chạy luồng WebSocket; không bật DB thì registry không cấp quyền LINES/OBJECT_COUNT. Không cần database để chạy khung; readiness trả HTTP 503 với `database=DISABLED`. Muốn tính thật, bootstrap DB và bật cấu hình database bên dưới.

Để kiểm tra mã: `npm run typecheck`, `npm run check:contract` và `npm run build` trong `client/`; `.\mvnw.cmd test` trong `server/`. Trên Windows với thư mục OneDrive, script Next.js dùng Webpack để tránh lỗi tạo tiến trình của Turbopack.
Khi Server đang chạy, chạy `npm run smoke:stomp` trong `client/` để kiểm tra hai phiên Client, mã lỗi và `ruleCode`. Đặt `WS_URL=ws://localhost:<cổng>/ws` nếu Server không dùng cổng 8080.

Khi Server bật profile DB và đã bootstrap, chạy `npm run smoke:lines` để kiểm 384 tổ hợp LINES, hai phiên dùng cùng requestId với đầu vào khác nhau và lỗi hào động. Đây là kiểm chức năng; chưa phải benchmark.

B03: `npm run smoke:object-count` kiểm chu kỳ 24 số × 12 giờ, hai số biên lớn, hai phiên cùng ID và 10 input sai; 324 terminal/1.276 progress. Cần bootstrap mới nhất để MH-TRIGRAM được duyệt theo biên bản.

B02: `npm run test:calculation` kiểm trạng thái/hiển thị Client; `npm run smoke:lines` kiểm thêm 1.546 progress đúng thứ tự; `npm run smoke:progress` kiểm JSON hỏng/phục hồi, prefix bước khi lỗi, reconnect và từ chối queue trái phép. Hai smoke command cần Server có DB/bộ tên đã duyệt. Cách kiểm deadline trên Server kiểm tra riêng và cấu hình giới hạn ở `docs/20-B02-PROGRESS-HANDOFF.md`.

## Khi bắt đầu làm database

TV3 có thể dùng PostgreSQL cài trên máy hoặc một Server PostgreSQL chung của nhóm. Đặt `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, rồi chạy Server với cả Maven profile `database` và Spring profile `db`:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/huyenco"
$env:DB_USERNAME = "huyenco"
$env:DB_PASSWORD = "<mật khẩu của nhóm>"
.\mvnw.cmd -Pdatabase spring-boot:run "-Dspring-boot.run.profiles=db"
```

Với DB mới, chạy script bootstrap bên dưới **trước** khi bật Server profile `db`, vì V4 cần seed sách. Server vẫn kiểm Flyway lúc khởi động. Schema hỗ trợ trang in/PDF, nhận diện file scan, trạng thái kiểm chứng và nhiều kết quả nghề cho cùng một khóa tra.

Trên Windows, chạy từ repo root: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_all.ps1`. Lệnh hỏi mật khẩu ẩn hoặc dùng PGPASSWORD, áp dụng migration còn thiếu, nạp seed/64 quẻ/384 hào, nhập tên và áp dụng biên bản duyệt tên/bảng quái trước khi kiểm toán. Không cần tạo lại DB đã nhập. **64 tên đã VERIFIED theo S01, MH-TRIGRAM theo B03**; lời luận giải vẫn thiếu. Xem `docs/19-S01-HEXAGRAM-NAME-REVIEW.md` và `docs/21-B03-OBJECT-COUNT-HANDOFF.md`.

A02 đã nối registry với PostgreSQL qua repository chỉ đọc. `GET /api/v1/readiness` báo riêng kết nối/schema/seed, trạng thái từng quy tắc và việc còn thiếu; `READY` chỉ thuộc phạm vi kho dữ liệu, `businessFeaturesReady=false` cho đến khi đủ nghiệp vụ. Hướng dẫn và bằng chứng bootstrap hai lần trên DB trống: [docs/17-A02-DATABASE-HANDOFF.md](docs/17-A02-DATABASE-HANDOFF.md). Script kiểm tra tự tạo/xóa DB tạm: `python scripts/test_a02_bootstrap.py` (cần `PGPASSWORD`, quyền tạo DB và dependency đã cài).

## Hợp đồng giao tiếp

Client kết nối `/ws`, gửi tới `/app/mai-hoa/calculate` hoặc `/app/tam-the/calculate`, đăng ký `/user/queue/progress`, `/user/queue/results`, `/user/queue/errors`. Mỗi yêu cầu mang `requestId` UUID. Progress có sequence tăng trong từng lần xử lý; chỉ terminal xác định thành công/thất bại. Các ví dụ JSON có trong `docs/02-API-CONTRACT.md` và `docs/examples/`.

## Quy tắc phát triển

`main` là bản đã tích hợp; `develop` dùng tích hợp; mỗi việc mới làm trên nhánh `codex/<task-id>-<noi-dung>`. Mọi thay đổi JSON, schema hoặc thuật toán phải cập nhật tài liệu và được chủ module review trước khi merge. Không hiển thị lời luận giải không có nguồn ấn bản/chương/trang và đối chiếu. A01/A02/B01/S01/B02/B03/S02 đã có hợp đồng v1.2, registry nối DB, bootstrap, tên/60 hành đã duyệt, LINES/OBJECT_COUNT và progress thật. Tiếp tục S03 và C01 trước các tuyến còn lại. Xem các biên bản 16–22 trong `docs/`.

