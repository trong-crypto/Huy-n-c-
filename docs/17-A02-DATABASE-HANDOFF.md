# A02 — PostgreSQL, registry và khởi tạo dữ liệu

Hoàn thành ngày 23/10/2026. Phạm vi: tầng đọc tri thức, trạng thái nguồn, kiểm tra sẵn sàng kho dữ liệu và khởi tạo database mới. Các service tính Mai Hoa/Tam Thế vẫn là phần việc B01 trở đi.

## 1. Những phần đã triển khai

| Thành phần | Hành vi |
| --- | --- |
| `JdbcKnowledgeRepository` | Đọc quy tắc theo đúng mã + module + phiên bản trong catalog; đọc nguồn sách, 8 quái, 64 quẻ và dãy hào PostgreSQL |
| `KnowledgeDatabaseConfig` | Spring profile `db` tạo đúng một provider DB; profile mặc định dùng provider rỗng, không tự cấp VERIFIED |
| `RuleRegistry` | Dùng trạng thái nguồn/người duyệt/thời gian duyệt từ DB, dùng quyền thực thi từ catalog; không ghi ngược hay nâng trạng thái nguồn |
| `HexagramRecord.toCalculationView()` | Chỉ đưa tên vào kết quả tính nếu là tên chuẩn VERIFIED, có người duyệt và nguồn truy vết được; dãy hào vẫn đọc được khi tên chưa duyệt |
| `GET /api/v1/health` | Liveness: HTTP 200, `{"status":"UP"}`; không truy vấn DB |
| `GET /api/v1/readiness` | HTTP 200 khi kho dữ liệu sẵn sàng, 503 khi tắt DB/mất kết nối/schema hoặc seed chưa đủ; xem mục 3 |
| Lỗi truy cập | Repository ném lỗi công khai cố định, controller STOMP dùng `DATABASE_UNAVAILABLE`; không trả SQL, JDBC URL hoặc mật khẩu |

Profile Maven `database` dùng Spring Boot JDBC/Hikari, Flyway và PostgreSQL driver. Đã thay starter JPA bằng JDBC vì chưa có entity/ORM. Repository dùng prepared statement JDBC trực tiếp trên `DataSource` do Spring quản lý; đây là điều chỉnh cách thực hiện so với dự kiến dùng `JdbcTemplate` trong kế hoạch. Schema vẫn do Flyway quản lý, không có Hibernate tạo/sửa bảng.

Các truy vấn có timeout 3 giây; Hikari chờ kết nối 3 giây, validation 2 giây, tối đa 8 kết nối; PostgreSQL driver connect timeout 3 giây/socket timeout 5 giây. Đây là giới hạn cấu hình, chưa phải kết quả đo tải. Probe dùng transaction chỉ đọc, repeatable read để kiểm cấu trúc trong cùng snapshot. Provider đọc trạng thái trực tiếp mỗi lần, chưa cache quyền duyệt.

## 2. Sửa luồng khởi tạo database mới

V4 chứa kiểm tra và cập nhật các dòng seed, nên cần dữ liệu trước khi chạy. Không sửa nội dung/checksum V1–V4 đã áp dụng.

`scripts/import_all.ps1` thực hiện:

1. Kết nối đúng database đã tồn tại.
2. Nếu chưa có V4 thành công: chạy Flyway đến target V3.
3. Kiểm hai PDF và nhập dữ liệu sách bằng importer hiện có.
4. Chạy Flyway đến phiên bản mới nhất; V4 kiểm bằng chứng và ghi xác nhận đã được chủ dự án cung cấp từ trước.
5. Nạp 64 cấu trúc quẻ và 384 hào.
6. Nhập 64 tên có trang sách ở SOURCE_LOCATED, bảo vệ tên đã duyệt/được biên tập thủ công theo importer hiện có.
7. Kiểm đếm và chạy kiểm toán.

DB đã có V4 bỏ qua target V3, vẫn chạy Flyway validate/migrate mới nhất. Không downgrade, sửa history hoặc chạy SQL migration thủ công. Script gọi goal Flyway một lần rồi thoát, không khởi động WebSocket server để chờ migration. Giới hạn mỗi lần Flyway mặc định 240 giây; timeout chỉ dừng cây tiến trình do script khởi tạo. Mỗi pha có transaction riêng; nếu bị gián đoạn, sửa nguyên nhân rồi chạy lại script, không có một transaction chung bao trùm cả 8 bước.

Từ thư mục gốc repo, sau khi tạo database `huyenco`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_all.ps1
```

Mặc định hỏi mật khẩu ẩn; có thể dùng `PGPASSWORD` đã có trong môi trường tiến trình để tự động hóa. Script phục hồi các biến DB/JDK đã thay đổi khi kết thúc. Không ghi mật khẩu vào file cấu hình hoặc command line của tiến trình con. Tham số hỗ trợ: `-DbHost`, `-DbPort`, `-DbName`, `-DbUser`, `-PdfDir`, `-AuditOutput`, `-MigrationTimeoutSeconds`. Không cần Docker.

Máy cần JDK 17+, Python và các dependency PDF đã dùng bởi importer, PostgreSQL client, hai PDF đúng bản scan. Maven Wrapper có sẵn; lần đầu tải Maven/dependency/plugin cần Internet. Nếu `JAVA_HOME` chưa đặt, script tìm JDK 17/21/24 trong thư mục Java chuẩn trên Windows; máy dùng vị trí khác cần tự đặt `JAVA_HOME`.

Sau bootstrap, chạy Server từ `server/`, đặt `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` trong môi trường rồi dùng:

```powershell
.\mvnw.cmd -Pdatabase spring-boot:run "-Dspring-boot.run.profiles=db"
```

Server profile `db` vẫn kiểm Flyway khi khởi động. Database trống cần qua script bootstrap trước; không khởi động Server trực tiếp để thay bước seed.

## 3. Ý nghĩa readiness

Response là đối tượng probe trực tiếp, giống health, không dùng envelope nghiệp vụ REST. Kiểu Client: `KnowledgeReadiness`.

| Field | Ý nghĩa |
| --- | --- |
| `status` | READY / NOT_READY trong phạm vi `scope=KNOWLEDGE_STORAGE` |
| `database` | UP / UNAVAILABLE / DISABLED; DISABLED khi không bật profile `db` |
| `schema` | READY / NOT_READY / NOT_CHECKED / INVALID_DATA |
| `seed` | READY / NOT_READY / NOT_CHECKED; kiểm số lượng nền, đủ phiên bản quy tắc, liên kết nguồn đã định vị và toàn bộ cấu trúc hào |
| `counts` | Số dòng hiện tại; thêm số quy tắc VERIFIED và số tên đủ điều kiện hiển thị |
| `rules[]` | Mã, policy, trạng thái nguồn, `calculationAuthorized`, lý do bị registry từ chối |
| `businessFeaturesReady` | **false ở A02**: chưa triển khai đầy đủ nghiệp vụ F01–F08 |
| `pending[]` | Công việc còn thiếu: implementation, tên chưa xác minh, nội dung luận giải, quyền thực thi quy tắc |

Quy tắc DRAFT không có nguồn vẫn được ghi nhận là dữ liệu chưa hoàn tất, không ngăn kho lưu trữ khởi động; registry tiếp tục từ chối cấp quyền. Quy tắc đã định vị mà liên kết nguồn không truy vết được làm seed NOT_READY. Kiểm cấu trúc xác nhận 8 quái có số 1–8/dãy 3 hào duy nhất, đủ 64 cặp thượng/hạ và 384 hào khớp. Điều này không xác minh nội dung sách hay quy tắc nghiệp vụ.

`calculationAuthorized=true` chỉ nói registry đã cho phép quy tắc đó, không chứng minh phương pháp/chức năng đã được lập trình. Hiện `MH-MUTUAL`, `MH-CHANGE` có căn cứ SOURCE_VERIFIED; TIME và OBJECT_COUNT được cấp quyền theo TEAM_DECISION nhưng giữ nguyên BLOCKED_SOURCE_CONFLICT/SOURCE_AMBIGUOUS. `MH-TRIGRAM` vẫn chưa VERIFIED nên tuyến số vật chưa đủ điều kiện; không mở phép tính bằng cách đổi cờ nguồn.

## 4. Bằng chứng đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Bootstrap trên PostgreSQL 18.6, database tạm `huyenco_a02_8b791678e547` ban đầu trống | V1–V3 → seed → V4 → cấu trúc/tên → audit chạy xong |
| Chạy lại script trên cùng DB | 10 bảng, gồm Flyway history, có toàn bộ giá trị bản ghi giống lần đầu; không đổi metadata duyệt. Sequence không nằm trong phép so sánh |
| Kiểm toán database tạm | 34 kiểm tra; 0 FAIL, 3 PENDING đúng các mục nguồn còn thiếu |
| Java với profile database và biến test DB | 26 test, 0 lỗi, 0 bỏ qua; bao gồm chọn đúng phiên bản, nguồn/reviewer, profile một provider, prepared parameter, lỗi kết nối và phát hiện hào sai |
| Profile JDBC cuối sau khi bỏ JPA | Chạy lại 26 test đạt; Server khởi động và probe thực qua HTTP đạt |
| HTTP trên `huyenco` hiện có | Health 200 UP; readiness 200 READY cho kho dữ liệu; `businessFeaturesReady=false`, 14 quy tắc, 64 quẻ/384 hào, 2 quy tắc VERIFIED, 0 tên VERIFIED |
| Chạy không bật DB | Server khởi động; health 200 UP, readiness 503 với database DISABLED |
| Client | `npm run typecheck` và 12 JSON fixtures hợp đồng đạt |

Script tái lập: `python scripts/test_a02_bootstrap.py` từ repo root, có `PGPASSWORD` trong môi trường. Script tự tạo tên DB tạm với tiền tố cố định, chạy bootstrap hai lần, so JSON toàn bộ bảng, chạy test Java có driver DB và xóa chính DB tạm đã tạo. Test đòi tài khoản có quyền tạo/xóa DB; không nhắm vào `huyenco`. Test Java sửa hào và thêm phiên bản giả chỉ được chạy trên tên DB test đúng mẫu, sau đó phục hồi; không dùng tài khoản này cho sản phẩm triển khai công khai.

Kết quả cục bộ dưới `scripts/generated/a02_bootstrap_result.json`, `a02_bootstrap_audit.md`, `a02_http_db.json`, `a02_http_no_db.json`; các file sinh này được ignore. Báo cáo DB thật `tv3_audit_report.md` không bị ghi đè bởi thử nghiệm. Kiểm tra mất kết nối bằng DataSource báo lỗi trong test; chưa tắt dịch vụ PostgreSQL thực của người dùng.

Flyway 11.7.2 do Spring Boot quản lý có cảnh báo PostgreSQL 18.6 mới hơn phạm vi hỗ trợ được Flyway công bố trong runtime. Các kiểm tra trên cấu hình thực đã đạt, nhưng không coi đó là chứng nhận tương thích toàn bộ PostgreSQL 18. Chưa nâng riêng Flyway trong A02 để tránh đổi nhiều dependency trước hạn nộp.

## 5. Việc tiếp theo

**B01**: viết bộ tính LINES thuần cho quẻ chủ/hỗ/biến, nối `MaiHoaService` → registry → repository → STOMP; kiểm 64 mẫu × 6 hào và hai Client riêng. Không phụ thuộc tên quẻ VERIFIED để dựng dãy hào; tên chưa duyệt để null. Sau đó B02 bổ sung progress, B03 làm OBJECT_COUNT khi đủ điều kiện quy tắc quái. Dữ liệu thiếu xác minh tiếp tục theo S01/S02/S03; A02 không tự duyệt thêm thuật toán hoặc lời luận.
