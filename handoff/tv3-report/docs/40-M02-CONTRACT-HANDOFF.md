# M02 hoàn thành — hợp đồng lời luận mở rộng

**Cập nhật sau D04 ngày26/10:** Tam Thế EXTENDED đã hoàn thành theo [42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md), có năm capture mới và tổng62 fixtures. Smoke M02 hiện tại đạt13 terminal/34 progress, cả Mai Hoa và Tam Thế mở rộng thành công; M03 hồi quy đạt15/44. Các gate và số liệu M02/M03 bên dưới giữ đúng lịch sử các lượt trước D04.

**Cập nhật sau M03 ngày26/10:** service Mai Hoa đã hoàn thành theo [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md), có bốn capture thành công thật và tổng52 fixtures. Script smoke M02 đã cập nhật tương thích Server M03:13 terminal/32 progress đạt; Mai Hoa reading thành công, Tam Thế EXTENDED vẫn bị chặn chờ D04. Các bảng lỗi/số24 progress/bộ44 fixtures dưới đây giữ đúng lịch sử nghiệm thu M02, không mô tả runtime Mai Hoa hiện tại.

**26/10/2026: hoàn thành DTO, validator, shared types/guards, fixtures và kiểm tích hợp M02.** Phần dữ liệu/V12/import đã hoàn thành ở [38](38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md). Đặc tả chính xác ở [39](39-DETAILED-READINGS-CONTRACT.md). **Task tiếp theo là M03 — MaiHoaInterpretationService**, sau đó D04/T02; UI thuộc TV1.

## 1. Hành vi đã có trên Server

Request Mai Hoa có thể thêm `reading.topic` và context thời điểm cho LINES/OBJECT_COUNT. TIME dùng datetime gốc và cấm context thứ hai. Validator kiểm object, topic, unknown key, null, ngày/offset và miền Dương1900–2099 sau đổi UTC+7; không suy đoán topic hoặc thời điểm từ question hay đồng hồ máy. Tam Thế nhận wealthMode LEGACY/EXTENDED; EXTENDED yêu cầu WEALTH hoặc bộ ba category mặc định.

M03/D04 chưa triển khai service tính lời luận. M02 xử lý input mới hợp lệ bằng chốt rõ ràng **trước mọi đọc DB/tính toán**:

| Request | code | ruleCode | reason |
| --- | --- | --- | --- |
| Mai Hoa có reading | RULE_NOT_AVAILABLE | MH-DETAILED-READING | IMPLEMENTATION_UNAVAILABLE |
| Tam Thế wealthMode EXTENDED | RULE_NOT_AVAILABLE | TT-WEALTH-EXTENDED | IMPLEMENTATION_UNAVAILABLE |

Input mới sai vẫn trả INVALID_INPUT/INVALID_DATE. Đây không phải xác nhận database thiếu dữ liệu hay sách chưa được duyệt; reason cho biết service mở rộng chưa có. Chỉ gửi hai progress ACCEPTED/VALIDATING trước lỗi, không giả đã tính/tra cứu. Tuyến cũ không có reading và Tam Thế LEGACY tiếp tục chạy như trước.

## 2. DTO và tương thích

- `MaiHoaReadingOptions`, `ReadingDecision`, `DetailedReading`, `WealthSubreading` định nghĩa topic/context, bốn phase, mùa, lời luận có nguồn và quyết định dự án. DTO kiểm hình dạng và bằng chứng truy nguồn, **không tự cấp quyền xác minh nội dung**; M03/D04 phải kiểm bundle/review/source trước khi tạo kết quả.
- `MaiHoaResult.detailedReading` là phần tùy chọn. `TamTheResult` bổ sung coverageMode/bundleId/editorialDecisions và subreadings trong category WEALTH. Giữ **categories[].entries** như API cũ; mỗi entry mở rộng có subreadingCode. Danh sách phẳng phải đúng bằng ba danh sách con nối theo thứ tự.
- LOC được phép NO_SOURCE_MATCH với lý do NO_PRINTED_INTERSECTION và nguồn bảng; không được giả nội dung. Sang hèn/Điền sản phải MATCHED. Phải giữ đúng mã phép tra riêng; quyết định dùng trong tiểu mục phải hiện ở metadata kết quả.
- Phần nội dung duyệt mang SOURCE_VERIFIED; các quy ước và liên kết biên tập mang TEAM_DECISION, kèm hạn chế theo ấn bản. Kết quả Mai Hoa tổng phản ánh cả phép chọn Thể theo quy ước, không chỉ cờ duyệt đoạn văn.
- Các trường tùy chọn không có được **bỏ khỏi JSON**, không thêm null vào kết quả cũ. Constructor cũ vẫn dùng được. 31 fixtures cũ không đổi; cả Java round-trip và Client cũ đều đạt. H01 giữ nguyên snapshot JSON, không cần migration mới cho DTO.
- N01 fingerprint sẵn có bao gồm toàn bộ payload JSON. Đã kiểm khác topic/context, có/không reading, đổi wealthMode cùng ID bị INVALID_INPUT; lặp cùng nội dung được replay và hai session độc lập.

Shared code chỉ thay `client/src/types/` và công cụ kiểm giao thức; không sửa trang, component hoặc biểu mẫu TV1. Test loader Node chuyển sang bộ nạp module hiện có để theo được dependency guard mới.

## 3. Fixtures cho TV1

Trong `docs/examples/` có **44 JSON**:

| Phạm vi | Số | Cách dùng |
| --- | --- | --- |
| Fixtures bản nền giữ nguyên | 31 | Kiểm tuyến Client/Server cũ |
| `m02-*.request.json` | 5 | LINES/OBJECT_COUNT/TIME có reading; Tam Thế EXTENDED và LEGACY |
| `m02-*-unavailable.response.json` | 4 | Đã đối chiếu controller/service thật và STOMP thật |
| `m02-*.schema.response.json` | 4 | **Chỉ mẫu schema**, hai dạng mùa Mai Hoa và hai dạng LOC; chưa phải output do service M03/D04 sinh ra |

Mẫu schema dùng nội dung M01 có nguồn để kiểm DTO/guard và snapshot H01. Không dùng chúng làm bằng chứng rằng service đã tính được lời luận hoặc mọi đầu vào đã phủ. TV1 có thể chuẩn bị trình bày với nhãn dữ liệu mẫu; nghiệm thu thành công phải đợi service thật. Phân loại ở [M02-README](examples/M02-README.md).

## 4. Kiểm đã chạy

| Nhóm | Kết quả thực tế |
| --- | --- |
| Maven toàn bộ, chưa bật env A02 | 514 ca được báo cáo: **492 PASS**, 22 SKIP do điều kiện DB; 0 lỗi. Có26 ca ReadingContractTest và2 ReadingContractFlowTest |
| H01 trên PostgreSQL TEST | **4/4 PASS**: typed DTO mới qua cache rồi save/read lại bằng store mở mới, chống đọc/xóa khác owner, lưu lặp và xóa đúng owner |
| Lượt M02 sau rà soát metadata ví dụ | **32/32 PASS** gồm26 hợp đồng,2 controller/N01 và4 snapshot PostgreSQL; mẫu mùa có nguồn lịch C01, LOC không khớp chỉ dẫn nguồn bảng |
| Client | **441/441 PASS**, 13 file; riêng hợp đồng mới28 ca. Không dùng số685 của nhánh TV1 để công bố cho checkout này |
| Node calculation state | **12/12 PASS** |
| Shared TypeScript | typecheck đạt; **44/44 fixtures** khớp kiểu |
| Đóng gói | JAR profile database tạo thành công; package dùng skipTests sau lượt test đã đạt, không coi package là lượt test mới |
| STOMP thật + DB TEST | **13 terminal, 24 progress, 2 session**; chốt unavailable, input sai, replay, đổi topic/context, cách ly session và hồi quy LINES/LEGACY khớp fixtures cũ |
| Kiểm sau nghiệm thu | Toàn bộ dòng trong các bảng public TEST giống trước vòng contract; sessions/history đều0. Database huyenco vẫn V11 |

DB là `huyenco_m02_test_20261026`, profile db; Server tạm bind127.0.0.1:18086, origin http://localhost:3000. Flyway xác thực12 migration và không chạy thêm migration. Snapshot TEST giữ SHA `4543343a82c7eefb161b15bd359284c3dae350617a362aa56bcac0d180195f86`.

Đã dừng đúng Server tạm sau kiểm; không có Server dùng chung đang được duy trì từ lượt này. Không sửa DB huyenco, không nâng source approval, không sửa migration cũ hoặc UI. Các test H01 chỉ tạo/xóa owner riêng trên TEST. Các ca DB A02 cũ bị SKIP trong lượt Maven toàn bộ vẫn cần env/DB tạm theo bộ kiểm A02 khi nghiệm thu phạm vi đó; không gọi chúng là đã chạy ở M02.

Vitest trên Windows sandbox gặp EPERM trong thư mục tạm trước khi chạy test; đổi TEMP/TMP sang `work/m02/vitest-tmp` rồi cả441 ca đạt. Không tắt hoặc bỏ test để vượt lỗi môi trường.

Bằng chứng cục bộ: `server/target/surefire-reports/`, `scripts/generated/m02_contract_smoke.json`, `scripts/generated/m02_after_contract_audit.json`, log Server M02. Các file chạy/backup không đưa vào Git.

## 5. Lệnh tái lập

Từ `server`, dùng JDK17 và Maven cache đã chuẩn bị:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
.\mvnw.cmd -o '-DargLine=-javaagent:C:/Users/abc/.m2/repository/org/mockito/mockito-core/5.17.0/mockito-core-5.17.0.jar' test
```

Đường dẫn agent tùy máy, theo Mockito đã resolve tại local Maven repo; không sao chép nguyên đường dẫn user abc sang máy khác. Lượt riêng DB dùng `-Pdatabase -Dtest=ReadingHistoryDatabaseTest`, env HUYENCO_M02_DB_URL trỏ **local huyenco_m02_test_***, HUYENCO_TEST_DB_USER và PGPASSWORD qua kênh/biến môi trường riêng. Test từ chối DB huyenco hoặc URL ngoài prefix TEST. Không đặt mật khẩu vào lệnh/file Git.

Từ `client`:

```powershell
npm run typecheck
npm run check:contract
npm run test:calculation
New-Item -ItemType Directory -Force '..\work\m02\vitest-tmp' | Out-Null
$env:TEMP = (Resolve-Path '..\work\m02\vitest-tmp').Path
$env:TMP = $env:TEMP
npm run test:run -- --reporter=dot
```

Sau khi tự khởi động Server profile db vào TEST theo [hướng dẫn35](35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md), kiểm giao thức:

```powershell
$env:M02_WS_URL = 'ws://127.0.0.1:18086/ws'
$env:M02_ORIGIN = 'http://localhost:3000'
node scripts/smoke-m02-contract.mjs
```

URL chỉ trỏ tiến trình trên máy đang chạy lệnh. Server phải đã seed đúng bản nền; script có hai request LEGACY thành công, không chỉ kiểm lỗi. DB TEST của TV2 không tự đi theo Git; TV1 dựng riêng từ bootstrap38 hoặc dùng một Server nhóm đã được xác nhận đang chạy. Profile/env/origin không đổi bởi M02.

## 6. Việc M03/D04 còn phải làm

Thay chốt unavailable bằng repository/provider kiểm bundle M01 và service thật; tính Thể/Dụng/quan hệ/phases/mùa cùng tổng hợp evidence; nối subreadings Tam Thế. Giữ nguyên validator và phân tách source/decision. Nghiệm thu1536 cấu trúc Mai Hoa×topic,720 năm–tháng Tam Thế và source failure/history/progress trên TEST trước khi áp dụng huyenco. M02 hoàn thành hợp đồng không đồng nghĩa những ma trận nghiệp vụ này đã đạt.

Bundle M01 đã pin là biên bản bất biến, gồm `runtimeEnabled=false` ghi trạng thái tại thời điểm review M01. M03 mở service bằng provider/code/policy đã kiểm; không sửa ngầm cờ lịch sử, nội dung, hash hoặc metadata duyệt trong bundle để coi như đã triển khai từ trước.
