# Huyền Cơ

**Đã triển khai vào huyenco ngày26/10:** đã sao lưu/khôi phục thử, nâng DB dự án lên **V12**, nhập1 bundle/20 mẫu Mai Hoa/19 đoạn Tam Thế/204 ánh xạ và kiểm toán đạt. Dữ liệu mở rộng khớp TEST; mọi dòng V11 giữ nguyên. Nghiệm thu trên huyenco đạt739 terminal/2948 progress, gồm720 tổ hợp Tam Thế và chín capture M03/D04; Server tạm đã dừng. Xem [biên bản43](docs/43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md). Khởi động Backend bằng code mới/profile db để dùng; các dòng huyenco V11/chưa nhập trong mốc cũ bên dưới là lịch sử. Tiếp theo I02/T02, chưa commit/push Git.

**D04 hoàn thành ngày26/10:** Server trả WEALTH mở rộng với **Lộc/Sang hèn/Điền sản**, nguồn và quyết định biên tập riêng. Đủ720 tổ hợp qua PostgreSQL/STOMP thật;360 trường hợp thiếu Lộc vẫn trả đủ ba category và ghi đúng no-match. Đã kiểm737 terminal/2928 progress/27 HTTP, năm lịch sử thật;452 Client tests/62 fixtures đạt. Xem [bàn giao42](docs/42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md). **Tiếp theo I02 (TV1)/T02 (TV2–TV3)**. Huyenco vẫn V11, TEST V12; Server tạm đã dừng. Các mốc M03/M02 dưới đây là lịch sử; chưa gọi toàn sản phẩm đã hoàn thành.

**M03 hoàn thành ngày26/10:** Server đã sinh lời luận Mai Hoa thật cho LINES/OBJECT_COUNT/TIME khi có `payload.reading`, gồm bốn chủ đề, Thể/Dụng, bốn giai đoạn, mùa có thời điểm và nguồn/quyết định. Đã kiểm1536 tổ hợp qua logic và PostgreSQL TEST,445 Client tests/52 fixtures và STOMP–HTTP–lịch sử thật. Xem [bàn giao M03](docs/41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md). Tam Thế EXTENDED còn D04; giao diện lời luận thuộc TV1/I02. DB `huyenco` vẫn V11, TEST V12; Server tạm đã dừng. **Tiếp theo D04**, rồi I02/T02; các đoạn M02 và mốc cũ bên dưới là lịch sử.

**M02 hoàn thành ngày26/10:** đã có bộ dữ liệu M01/V12 trên TEST, DTO/validator/shared types/guards và44 fixtures cho lời luận mở rộng; tương thích JSON cũ, N01 và snapshot H01 đã kiểm. Opt-in reading/EXTENDED hiện trả IMPLEMENTATION_UNAVAILABLE chờ **M03/D04 service thật**, không trả kết quả tính quẻ cũ thay lời luận. Xem [bàn giao M02](docs/40-M02-CONTRACT-HANDOFF.md) và [hợp đồng39](docs/39-DETAILED-READINGS-CONTRACT.md). DB huyenco vẫn V11; Server TEST dùng trong nghiệm thu đã dừng. Các mốc “tiếp theo” ở lịch sử bên dưới không thay tiến độ mới này.

**H01 hoàn thành Server/schema ngày25/10:** đã có cookie phiên30 ngày,CSRF và5 API tạo phiên/lưu/list/search/detail/delete lịch sử theo owner. Kết quả lưu do Server tạo,không nhận snapshot/ownerId từ Client; đã kiểm cách ly phiên và xem lại sau restart. V11 đã áp dụng vào huyenco sau backup đầy đủ; dữ liệu sách giữ nguyên.480 Java có DB,54 HTTP H01+8 terminal STOMP,2 ca không DB,121 HTTP E02,31 fixtures/typecheck và54 Python đạt. [Bàn giao H01 cho TV1](docs/34-H01-SESSION-HISTORY-HANDOFF.md). Khởi động lại backend profile db để dùng mã mới; TV1 bootstrap session trước WebSocket khi cần lưu lịch sử. **Tiếp theo N01 — điều phối hữu hạn/idempotency**. Các mốc tiếp theo cũ dưới đây là lịch sử.

**E02 hoàn thành Server ngày25/10:** Hai GET `/api/v1/hexagrams` và `/api/v1/hexagrams/{code}` đã có tìm tên có/không dấu/mã, lọc thượng/hạ, phân trang và chi tiết64 quẻ với nghĩa tên E01 VERIFIED/nguồn sách. 470 Java có DB,123 HTTP có DB+2 không DB, TypeScript/27 fixtures và54 Python đạt; bootstrap2 lần giữ dữ liệu, snapshot `huyenco` trước/sau HTTP giống nhau. Không có migration mới sau V10 hoặc thay đổi UI. [Bàn giao E02 và ví dụ tích hợp](docs/32-E02-HEXAGRAM-LOOKUP-HANDOFF.md). **Tiếp theo H01 — phiên và lịch sử**; các mốc tiếp theo cũ bên dưới là lịch sử. Khởi động lại backend profile `db` để dùng mã API mới; không cần nhập lại E01.

**D03 hoàn thành Server ngày 25/10:** `TamTheService` đã trả công danh/tài lộc/tình duyên qua STOMP với nguồn S02/D01/D02 và lịch C01. Đã giữ nhiều kết quả, thứ tự category và đủ trang nguồn; khóa Lộc không có trong sách trả `LOOKUP_NOT_AVAILABLE` cho cả request. 464 Java có DB đạt; D03 STOMP **263 terminal/1.034 progress**, hồi quy Mai Hoa/B02 đạt; 24 fixtures/typecheck/12 kiểm thử guard Client đạt. Không đổi dữ liệu hoặc metadata DB, không sửa UI TV1. Xem [bàn giao D03](docs/30-D03-TAM-THE-HANDOFF.md). **Tiếp theo: E01 — duyệt/nhập 64 nghĩa tên quẻ**, rồi E02 API tra cứu. Các mốc “D03 tiếp theo/chưa có service” dưới đây là lịch sử.

**D02 hoàn thành ngày 25/10:** đã nhập/VERIFIED 120 giao điểm tài lộc + 60 tình duyên chung + 36 đoạn giờ, kiểm đủ 12 mốc; giữ xác nhận TV2 tháng 5. `huyenco` hiện **V9, 447 ô tra, 33 mục nguồn sách, 12 quy tắc VERIFIED**; 455 Java có DB/50 Python đạt, bootstrap lặp giữ nguyên dữ liệu; audit thật 50 kiểm tra/0 FAIL/**1 PENDING (E01)**. Có lưu chuỗi trang cho thơ nối trang; Lộc chỉ phủ 60/120 khóa, 40 phút là quyết định nhóm và một chữ mờ Hưởng Lộc được đánh dấu. Xem [biên bản D02](docs/29-D02-TAM-THE-DATA.md). **Tiếp theo: D03 — TamTheService CAREER/WEALTH/LOVE.** UI thuộc TV1; các mốc tiếp theo cũ bên dưới là lịch sử.

**Cập nhật theo xác nhận của chủ dự án:** MH-TIME đã được duyệt **VERIFIED cho quy tắc dự án dùng chia6**; không còn chờ xác nhận lại. TIME trả TEAM_DECISION/VERIFIED; câu chữ bản in được giữ trong ghi chú nguồn. Biên bản `docs/28-TIME-OWNER-APPROVAL.md` thay các ghi nhận BLOCKED/chưa duyệt của MH-TIME ở mốc trước.

Dự án Client–Server cho Mai Hoa Dịch Số và Diễn Cầm Tam Thế. **Cập nhật 24/10/2026:** chủ dự án phụ trách cả TV2 và TV3; TV1 phụ trách giao diện. Kế hoạch ở [docs/15-COMBINED-TV2-TV3-PLAN.md](docs/15-COMBINED-TV2-TV3-PLAN.md). `LINES`, `OBJECT_COUNT` và `TIME` đã tính quẻ chủ/hỗ/biến qua PostgreSQL và STOMP thật. Các rule/bản ghi đã VERIFIED có phạm vi riêng theo biên bản. Công thức OBJECT_COUNT giữ **TEAM_DECISION/SOURCE_AMBIGUOUS**, TIME giữ **TEAM_DECISION/VERIFIED**. TamTheService còn D03. Xem [bàn giao B04](docs/27-B04-TIME-HANDOFF.md).

**B02 đã hoàn thành:** Server phát tiến trình thật, Client hiển thị các bước và dọn trạng thái khi lỗi/timeout/disconnect; đã chặn SEND/SUBSCRIBE thẳng vào broker hoặc queue của người khác. Hạn Run mặc định 10 giây, Client tổng 15 giây; chưa có worker/queue/idempotency N01. Xem [bàn giao B02](docs/20-B02-PROGRESS-HANDOFF.md).

**S02 đã hoàn thành:** huyenco có đủ 60 ánh xạ Can Chi→hành từ Tam Thế PDF11, từng ô và TT-NGU-HANH đã VERIFIED đúng phạm vi; V6 lưu metadata duyệt. Tại mốc S02 có 111 ô tra (60 hành + 51 công danh chưa duyệt); D01 bên dưới đã cập nhật phần công danh. Phần mô tả nạp âm, các bảng luận giải khác và TamTheService vẫn còn việc; database toàn hệ thống chưa hoàn tất. Xem [biên bản S02](docs/22-S02-TAM-THE-YEAR-ELEMENTS.md). Giao diện thuộc TV1.

**Phạm vi sản phẩm đã cập nhật:** Mai Hoa theo thời gian và con số; quẻ chủ/hỗ/biến, hào động; Tam Thế công danh/tài lộc/tình duyên; tra cứu 64 quẻ; đổi lịch Âm–Dương/Can Chi; tiến trình theo thời gian thực; lưu và tra cứu lịch sử. Đây là **yêu cầu cần triển khai**, chưa phải các chức năng đã có. Xem `docs/10-FUNCTIONAL-REQUIREMENTS.md` và `docs/01-SCOPE.md`. Docker không bắt buộc; khi làm lịch sử Server và kho dữ liệu, nhóm cần cấu hình PostgreSQL cài trực tiếp hoặc dùng Server chung.

**S03 đã hoàn thành khảo sát nguồn:** đã định vị tài lộc, tình duyên và nghĩa tên riêng cho đủ 64 quẻ; có ma trận 13 mục, hash và bản chép ứng viên. Tại mốc S03 chưa nhập/VERIFIED lời luận mới. S03 phát hiện sai chiều công thức nghề Số 13, khóa tài lộc nhiều kết quả/thiếu tháng và dòng Tỉnh in nhãn Ích. Xem [biên bản S03](docs/24-S03-SOURCE-MAP.md). Kiểm hồ sơ chỉ đọc bằng `python scripts/check_s03_sources.py`.

**D01 đã hoàn thành ngày 24/10:** đã đối chiếu hai lượt ảnh sách, nhập/VERIFIED 51 giao điểm nghề Số 11, 120 ô Số 13 kèm 12 đoạn và hai quy tắc công danh. Sửa ô Thủy–câu/chài tháng 9 thành tháng 8; giữ riêng bốn cặp nhãn bảng/tiêu đề đoạn khác nhau, liên kết biên tập theo thứ tự nguồn. `huyenco` hiện có **231 ô tra, 22 mục nguồn, Flyway V1-V7**; 434 Java/38 Python đạt, bootstrap hai lần giống nhau, audit 42 kiểm tra/0 FAIL/2 PENDING. Phạm vi VERIFIED và giới hạn cùng công cụ đọc lại được ghi trong [biên bản D01](docs/25-D01-CAREER-DATA.md). **Task tiếp theo: C01 — lịch Âm-Dương/Can Chi.** D02/D03/E01 và phần API còn việc; F04 và database toàn hệ thống chưa hoàn tất.

**C01 đã hoàn thành phần Server:** hai API `POST /api/v1/calendar/convert` và `/can-chi` hỗ trợ lịch hai chiều 1900–2099, tháng nhuận, Can Chi năm/tháng/ngày/giờ. Dùng UTC+7 cố định, năm đổi tại Tết/ngày đổi 00:00; bảng tính sinh từ Time4J 5.9.4, có hash và nguồn ngoài sách trong V8. Đã áp dụng biên bản `LUNAR-CONVERSION` vào huyenco. Xem [bàn giao C01](docs/26-C01-CALENDAR-HANDOFF.md) về nguồn/giấy phép, khác biệt lịch sử và kiểm chứng. **Task tiếp theo: B04 — nối TIME vào lịch và phép lập ba quẻ.** Các mốc “C01 tiếp theo” trong cập nhật trước đó là lịch sử.

**B04 đã hoàn thành phần TIME Server:** nối lịch C01 → chỉ số Chi năm âm/giờ → ba quẻ và hào động chia6. Đã kiểm UTC+7, Tết/00:00/23:00, nhuận cùng số tháng, năm cực trị và phạm vi sau chuẩn hóa. Ca 10/2/2024 00:00+07:00 → Bác/hỗ Khôn/biến Mông, hào2; 66 terminal/248 progress TIME thật đúng phiên, hồi quy LINES/OBJECT_COUNT và B02 đạt. 454 Java có DB/41 Python/17 fixtures/typecheck đạt. **Task tiếp theo: D02 — dữ liệu Tam Thế còn thiếu**, rồi D03 tích hợp. Giới hạn nguồn/cảnh báo nhóm và bàn giao TV1 ở [biên bản B04](docs/27-B04-TIME-HANDOFF.md); các mốc “B04 tiếp theo” ở cập nhật trước là lịch sử.

## Cấu trúc


- `client/`: Next.js, hai màn hình nhập liệu và STOMP WebSocket Client (TV1).
- `server/`: Spring Boot, định tuyến STOMP, kiểm tra đầu vào, điểm mở rộng nghiệp vụ (TV2/TV3).
- `server/src/main/resources/db/migration/`: schema PostgreSQL do Flyway quản lý; V1–V9 đã áp dụng, không sửa checksum các bản đã chạy.
- `docs/`: hợp đồng chung, quy tắc, kế hoạch kiểm thử và nhật ký quyết định.
- `scripts/import_book_knowledge.py`: kiểm nguồn PDF, tạo SQL và nhập dữ liệu có địa chỉ trang sách; hướng dẫn tại `docs/11-DATA-IMPORT.md`.
- `scripts/import_all.ps1`: khởi tạo DB mới hoặc cập nhật DB hiện có theo thứ tự V1–V3 → seed sách → V4/latest → **64 quẻ + 384 hào** → tên/quái → S02/D01/C01/MH-TIME/D02 và biên bản duyệt → kiểm toán; nhập mật khẩu ẩn hoặc dùng `PGPASSWORD` của tiến trình.
- `scripts/audit_tv3.py` / `scripts/audit_tv3.ps1`: kiểm tra dữ liệu cục bộ và truy vấn PostgreSQL chỉ đọc, sinh báo cáo kiểm toán.
- `docs/12-TV3-SOURCE-REVIEW.md` và `docs/13-TV3-HEXAGRAM-STRUCTURE.md`: chứng cứ trang sách, dữ liệu đã có và giới hạn còn chờ kiểm chéo.

Giao diện thuộc TV1. B03/B04 bàn giao STOMP `OBJECT_COUNT`/`TIME`, ba quẻ, bước tính và metadata; kiểm bằng chương trình Client STOMP không đồng nghĩa đã nghiệm thu giao diện. Ba thay đổi biểu mẫu B03 đã được hoàn tác theo nhắc nhở của chủ dự án. TIME đã sẵn sàng phía Server với DB V8/biên bản C01; `NUMBER` hai số đã bị loại bỏ. Xem `docs/27-B04-TIME-HANDOFF.md` và `docs/02-API-CONTRACT.md`.

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

B04: `npm run smoke:time` kiểm ngày chuẩn và ranh lịch qua hai phiên: 58 thành công/8 lỗi, 248 progress. Có `WS_URL` nếu khác cổng8080. Sau khi đóng gói Server `-Pdatabase` và đặt PGPASSWORD trong tiến trình, `python scripts/smoke_b04_time.py` tự chạy/dừng Server tạm và kiểm TIME/OBJECT_COUNT/LINES/giao thức; `--progress-only` kiểm B02. Chi tiết tại `docs/27-B04-TIME-HANDOFF.md`.

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

`main` là bản đã tích hợp; `develop` dùng tích hợp; mỗi việc mới làm trên nhánh `codex/<task-id>-<noi-dung>`. Mọi thay đổi JSON, schema hoặc thuật toán phải cập nhật tài liệu và được chủ module review trước khi merge. Không hiển thị lời luận giải không có nguồn ấn bản/chương/trang và đối chiếu. Đã có hợp đồng v1.2, registry nối DB, bootstrap, dữ liệu đã duyệt theo từng biên bản, LINES/OBJECT_COUNT/TIME và progress thật. C01/D01 hoàn thành; tiếp tục D02/D03 và các tuyến tra cứu/lịch sử/mạng. Xem các biên bản 16–27 trong `docs/`.

