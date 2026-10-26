# huyenco V12 — biên bản sao lưu, nhập dữ liệu và nghiệm thu

**Hoàn thành ngày26/10/2026, giờ Việt Nam.** Theo yêu cầu trực tiếp của chủ dự án, đã sao lưu `huyenco`, kiểm phục hồi, áp dụng V12, nhập bundle M01 đã duyệt và nghiệm thu M03/D04 trên chính database này. `huyenco` hiện có cùng dữ liệu mở rộng đã duyệt như TEST. Các dòng “huyenco vẫn V11/chưa nhập mở rộng” trong biên bản38–42 là lịch sử trước lần triển khai này.

## 1. Trạng thái sau nâng cấp

| Thành phần | Trước | Sau |
| --- | ---: | ---: |
| Flyway | V1–V11 success | V1–V12 success, checksum đã validate |
| Số bảng public |14 |18 |
| reading_source_bundles | Chưa có |1 hồ sơ M01 |
| mai_hoa_reading_templates | Chưa có |20 mẫu Mai Hoa |
| tam_the_supplement_results | Chưa có |19 đoạn Sang hèn/Điền sản |
| tam_the_supplement_mappings | Chưa có |204 ánh xạ:144 Sang hèn +60 Điền sản |
| Phiên/lịch sử bền vững |0 /0 |0 /0, giữ nguyên |

Đã so **toàn bộ dòng của14 bảng V11** trước/sau; dữ liệu, review và metadata cũ giữ nguyên, kể cả11 dòng Flyway đã có. Chỉ thêm bốn bảng và một dòng migration V12. Các bảng nền vẫn có8 quái,64 quẻ,384 hào,64 nghĩa tên,447 ô Tam Thế,231 liên kết trang,33 mục sách,14 rule và12 mốc giờ như trước.

Đối chiếu bốn bảng mới với `huyenco_m02_test_20261026` đạt; chuẩn hóa ID sách theo SHA trước khi so để không giả định hai DB có cùng sequence. Không sao chép toàn DB TEST, phiên, lịch sử hoặc Flyway history từ TEST sang database dự án.

## 2. Sao lưu và kiểm phục hồi đã thực hiện

Trước thay đổi, xác nhận đúng database/V11 và không có kết nối khác. Đã tạo bản `pg_dump -Fc` đầy đủ:

`scripts/generated/db-backups/before-huyenco-v12-20261026T061624986622Z.dump`

- Kích thước73.980 byte; SHA-256 `68d81221068f16034d63fef6084abc994544923139288d10e997b2356074ef6a`.
- `pg_restore --list` đọc được archive.
- Khôi phục thử bằng pg_restore vào database tạm mới tạo, so toàn bộ dòng14 bảng với snapshot V11: khớp hoàn toàn.
- Database phục hồi tạm đã được xóa sau khi kiểm; bản dump vẫn giữ để phục hồi khi cần.
- Wrapper nhập dữ liệu còn tạo thêm backup trước schema và trước import. Không đưa dump, snapshot riêng hoặc mật khẩu vào Git.

Đường dẫn tuyệt đối của backup đầu tiên trên máy hiện tại:
`C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\scripts\generated\db-backups\before-huyenco-v12-20261026T061624986622Z.dump`.

## 3. Migration, nguồn và kiểm toán

Đã dùng `scripts/import_m02.ps1 -Apply -DbName huyenco`: kiểm hai PDF đúng hash, backup, Flyway target12 và nhập trong transaction bảo vệ. Không chạy lại bootstrap bản nền, không sửa V1–V11, review timestamp hoặc checksum Flyway thủ công. V12 đã áp dụng thành công; lượt flyway:validate sau đó xác nhận đủ12 migration.

Bundle dùng `M01-READINGS-20261026-V1`, pin SHA `e3c460cdfe1a96546b243155205d12e8a27c1e45882452344a7dafa778e295b6`. Nội dung và quyết định theo [38](38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md), contract [39](39-DETAILED-READINGS-CONTRACT.md), nghiệp vụ [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md)/[42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md).

Kết quả kiểm toán:

- Bộ kiểm nguồn nền: **54 kiểm tra,0 FAIL,0 PENDING**, cả trước và sau nâng cấp.
- `audit_v12_readings.py`: đọc một snapshot READ ONLY/REPEATABLE READ, so chính xác bundle, review, nội dung, nguồn, nhãn và từng mapping với hồ sơ pin; đạt1/20/19/204 bản ghi. Không có constraint chưa validated.
- So dữ liệu mới với TEST: đạt. So mọi dòng V11 trước/sau: đạt; SHA snapshot gốc được giữ `0b705f8761ede8fc25037937c3520aa12e5f89bb511781fdb1dcaf16cc6484ad`.
- Không có lượt cấp VERIFIED mới. TEAM_DECISION/SOURCE_AMBIGUOUS cho các liên kết nhãn/tham chiếu và quy ước đã chốt vẫn đi theo kết quả. Review M01 vẫn ghi đúng hai lượt cùng Codex.

Cờ `runtimeEnabled=false` trong JSON M01 là hồ sơ giai đoạn dữ liệu; importer in thông báo lịch sử đó. Không sửa cờ/hash để bật chức năng. M03/D04 hiện có code kiểm snapshot/approval và đã chạy thành công qua STOMP trên `huyenco`.

## 4. Nghiệm thu trên database dự án

Đã khởi động JAR profile db tạm ở127.0.0.1:18089, DB_URL trỏ đúng `huyenco`. Flyway trên Server tạm được tắt vì V12 vừa được áp dụng/validate riêng. Dùng GET và WebSocket ẩn danh; không POST tạo owner, không lưu/xóa lịch sử hoặc thử phá dữ liệu trên database chính. Các thử can thiệp nguồn và H01 viết/đọc lịch sử vẫn thực hiện trên TEST theo41/42.

Sau khi sửa lỗi thứ tự nguồn nêu ở mục5, đã khởi động lại JVM và chạy lại với so fixture nguyên vẹn, không bật ghi đè capture:

| Kiểm | Kết quả |
| --- | --- |
| HTTP | health200/UP, readiness200/READY |
| M03 | Bốn capture LINES/OBJECT_COUNT/TIME/mùa khớp nguyên vẹn |
| D04 | Năm capture có/thiếu Lộc, nhãn khác nhau, âm nhuận/Dương tương đương khớp nguyên vẹn |
| Bản nền | Sáu ca Mai Hoa/Tam Thế LEGACY giữ JSON cũ; thiếu Lộc LEGACY vẫn trả lỗi đúng |
| Bao phủ D04 |720/720 tổ hợp có đủ ba category:360 có Lộc,360 no-match; text/nhãn/mapping khớp dữ liệu đã duyệt |
| N01/phiên | Replay giữ kết quả, đổi mode cùng ID bị chặn, hai phiên cùng ID được định tuyến riêng |
| Tổng giao thức | **739 terminal,2948 progress,2 HTTP GET**, không tạo owner hoặc ghi history |
| Sau nghiệm thu | Server tạm đã dừng; toàn bộ dữ liệu V11 và bốn bảng mới giữ đúng kết quả kiểm toán |

Maven hồi quy sau sửa trên TEST: **2262 PASS /21 SKIP /0 lỗi** trong2283 ca;21 SKIP là DB A02 cần env/DB riêng. Client **452/452**,15 file; typecheck/62 fixtures đạt. Không nới giới hạn của các test chỉ được phép chạy trên TEST để trỏ chúng vào `huyenco`.

JAR đã nghiệm thu: `server/target/huyen-co-server-0.1.0-SNAPSHOT.jar`, SHA-256 `c9e6192e1abc381260333b0da0bb56a9aa80714df14a001dc9aacc9d80ddc3f0`. Đây là build từ working tree có thay đổi chưa commit trên branch codex/detailed-interpretations; không gọi HEAD61a9696 là toàn bộ mã đang nghiệm thu. Chưa commit/push Git trong lần triển khai này.

## 5. Lỗi thứ tự nguồn được phát hiện và sửa

Lần khởi động mới đầu tiên phát hiện D04 gom nguồn qua Map.copyOf.values(), nên thứ tự trang trong rules/sourceReferences tổng có thể khác giữa các JVM, dù nội dung và tập trang giống nhau. Đã sửa để gom theo result_code chuẩn, thêm kiểm hồi quy bắt thứ tự cụ thể và build lại JAR.

Năm capture D04 được cập nhật bằng phản hồi thật, sau chốt bắt buộc mọi nội dung, khóa, review, tập nguồn và thứ tự entry/giai đoạn đều giữ nguyên. Kiểm diff riêng xác nhận chỉ đổi thứ tự **sourceReferences tổng và của hai rule bổ sung**. Lượt khởi động lại kế tiếp khớp toàn bộ capture, không cập nhật fixture nào. Không đổi bundle hoặc bản ghi DB để chữa lỗi này; M03 fixtures giữ nguyên.

## 6. Cách dùng và kiểm lại

Máy hiện tại đã có V12/bundle: **không cần nạp lại** để chạy M03/D04. Khởi động lại Backend bằng code/JAR mới với Spring profile db, DB_URL trỏ `jdbc:postgresql://127.0.0.1:5432/huyenco`; DB_USERNAME/DB_PASSWORD và Origin theo [35](35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md). Không ghi mật khẩu vào application-db.yml. Server127.0.0.1:18089 trong biên bản đã dừng, không phải dịch vụ đang chạy cho TV1.

Kiểm chỉ đọc từ repo root, credential nhận riêng qua môi trường:

```powershell
python .\scripts\audit_tv3.py --live --database huyenco --output scripts/generated/v12_after_baseline_audit.md
python .\scripts\audit_v12_readings.py --database huyenco
```

Muốn chạy lại nghiệm thu trên Server đã khởi động, từ client:

```powershell
$env:V12_HTTP_URL = 'http://127.0.0.1:8080'
$env:V12_ORIGIN = 'http://localhost:3000'
node scripts/smoke-v12-readings.mjs
```

Script này chỉ dùng GET/STOMP ẩn danh. Mặc định so chính xác capture, không ghi lại fixtures. Chốt một lần V12_CAPTURE_SOURCE_ORDER_FIX chỉ dùng trong đợt sửa metadata đã mô tả, không cần bật khi nghiệm thu bình thường.

Evidence cục bộ ở `scripts/generated/v12_*`: backup_restore, upgrade.log, flyway_validate.log, main_readings_audit, preservation_audit, main_acceptance, source_order_evidence, backend_regression, client_regression và backend_build. Các file JSON/log/dump/snapshot này không đưa Git; biên bản và mã kiểm tra có thể bàn giao.

TV1 ở máy khác vẫn phải có database riêng đã bootstrap/seed hoặc kết nối một Server được cấu hình dùng DB này; Git pull không chuyển dữ liệu PostgreSQL. UI cần gửi reading.topic cho Mai Hoa và wealthMode=EXTENDED cho Tam Thế. I02/T02 còn là nhiệm vụ tích hợp/nghiệm thu toàn sản phẩm; nâng cấp database không tự tạo giao diện mới hoặc hoàn thành mọi chức năng.
