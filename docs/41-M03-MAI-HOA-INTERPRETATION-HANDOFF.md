# M03 hoàn thành — service lời luận Mai Hoa

**Sau triển khai DB26/10 theo [43](43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md):** huyenco đã V12/bộ M01, M03/D04 chạy thật trên DB dự án và bốn capture M03 khớp nguyên vẹn. Các dòng huyenco vẫn V11/chỉ chạy TEST bên dưới giữ mốc bàn giao M03 trước triển khai; I02/T02 vẫn còn làm.

**Cập nhật sau D04 ngày26/10:** Tam Thế EXTENDED cũng đã hoàn thành theo [42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md). M03 capture không đổi, smoke hồi quy trên Server D04 đạt15 terminal/44 progress/22 HTTP; M02 hiện tại13/34 đạt, tổng62 fixtures/452 Client tests. Các câu D04 chưa mở/task tiếp theo D04 và số liệu M03 gốc bên dưới là lịch sử. Tiếp theo I02/T02; huyenco vẫn V11, TEST V12.

**26/10/2026: Server đã sinh lời luận thật từ mẫu M01 đã duyệt cho LINES, OBJECT_COUNT và TIME.** Đã kiểm logic, PostgreSQL TEST, STOMP và lịch sử qua HTTP. Giữ giao diện thuộc TV1. **Tiếp theo D04 — Tam Thế WEALTH mở rộng**, và I02/T02 theo [kế hoạch37](37-DETAILED-INTERPRETATION-EXPANSION-PLAN.md).

M03 thay chốt IMPLEMENTATION_UNAVAILABLE của Mai Hoa ở mốc M02. Tam Thế EXTENDED vẫn chờ D04. Request cũ không có reading giữ JSON/hành vi cũ. Database dự án `huyenco` vẫn V11; kiểm nghiệm M03 chạy trên `huyenco_m02_test_20261026` đã seed V12. Không có migration mới hoặc thay approval nguồn trong đợt này.

## 1. Kết quả người dùng nhận

Giữ ba quẻ/hào động/bước tính cũ, thêm `detailedReading` khi payload có `reading`:

1. Chủ đề GENERAL/CAREER/WEALTH/LOVE do Client chọn rõ ràng.
2. Thể/Dụng, phía trên/dưới, mã quái và hành; Thể là phía không có hào động theo quy ước nhóm.
3. Bốn mục theo thứ tự INITIAL_USE, MIDDLE_BODY_MUTUAL, MIDDLE_USE_MUTUAL, FINAL_USE. Tất cả so với **Thể gốc**, hai quái hỗ trình bày riêng.
4. Nội dung lấy đúng mẫu `topic + relation` đã duyệt, nguồn trang/hash và loại văn bản EDITORIAL_PARAPHRASE. Có tổng hợp từng giai đoạn; không cộng điểm hoặc che kết quả khác chiều.
5. TIME dùng datetime gốc đã đổi UTC+7 và dùng lại phép chuyển lịch. LINES/OBJECT_COUNT chỉ xét mùa nếu có reading.context.datetime. Thiếu context trả NOT_EVALUATED/MISSING_READING_TIME; không lấy ngày máy.
6. Quyết định tính toán và giới hạn theo bản in đi cùng kết quả, tách khỏi nguồn của đoạn luận.

Thêm ba bước `READING_BODY_USE`, `READING_PHASES`, `READING_SEASON` vào calculationSteps. Dữ liệu câu hỏi không được echo vào kết quả, không quyết định topic, thời điểm đích hay sự kiện. Đây là lời luận quy tắc theo nguồn; không phải64 bài luận/384 lời hào nguyên văn hoặc một hệ thống tự trả lời mọi câu hỏi tự do.

## 2. Hợp đồng và ví dụ thật cho TV1

Envelope vẫn1.2, detailedReading.schemaVersion1.0. Field cụ thể theo [39](39-DETAILED-READINGS-CONTRACT.md). Ví dụ:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440070",
  "type": "MAI_HOA",
  "payload": {
    "method": "LINES",
    "linesBottomUp": [true, false, true, true, true, false],
    "movingLine": 1,
    "reading": {"topic": "LOVE"}
  }
}
```

Ca này trả Cách, hỗ Tiểu súc, biến Hàm; Thể Đoài/Kim ở trên, Dụng Ly/Hỏa ở dưới. Bốn quan hệ: Dụng khắc Thể; tỷ hòa; Thể khắc quái đang đối chiếu; quái Dụng biến sinh Thể. Mùa không xét vì thiếu thời điểm. Đây là ca được kiểm với service/DB và chụp STOMP, không lấy response schema-only làm output.

Đã chụp4 cặp `.request.json`/`.response.json` tại docs/examples:

- `m03-lines-reading`: ca Cách, không context.
- `m03-lines-season`: cùng quẻ có thời điểm để xét mùa.
- `m03-object-reading`: số vật12/giờ8, chủ đề WEALTH, không context.
- `m03-time-reading`: TIME có offset và chủ đề GENERAL, lịch/mùa thật.

Tổng **52 JSON fixtures**:31 bản nền,13 M02,8 M03. Bốn `.schema.response.json` M02 vẫn chỉ là mẫu kiểu; các lỗi unavailable M02 của Mai Hoa là mốc trước M03 hoặc trường hợp không cấu hình interpreter trong test. Không xóa lịch sử đó để coi như service đã có từ M02.

TV1 cần thêm lựa chọn topic và gửi reading; không có reading thì Server tiếp tục tuyến cũ. TIME không gửi context thứ hai. UI hiển thị4 phase, nguồn/decision và trạng thái mùa; không tự tính Thể/Dụng hoặc suy topic từ câu hỏi. Nếu cần lưu lịch sử, bootstrap phiên HTTP trước khi mở WS theo [34](34-H01-SESSION-HISTORY-HANDOFF.md). M03 không sửa trang/component/form của TV1.

## 3. Nguồn đã duyệt và quy ước còn khác biệt theo ấn bản

| Phần | Căn cứ đang dùng | Phạm vi khẳng định |
| --- | --- | --- |
|20 đoạn luận/chủ đề, năm quan hệ có chiều | M01 VERIFIED; qua RuleRegistry với purpose INTERPRETATION và SOURCE_VERIFIED | Đúng nội dung diễn giải biên tập đã duyệt, không phải duyệt mọi câu của trang sách |
| Chọn Thể và vị trí hai quái hỗ | M01 BODY/PHASES: TEAM_DECISION, SOURCE_AMBIGUOUS | Chưa xác minh câu tổng quát cho sáu vị trí theo ấn bản; giữ giới hạn và nguồn ví dụ |
| Nhóm tháng âm và context | M01 SEASON: TEAM_DECISION, SOURCE_LOCATED | Quy ước tháng1–2/4–5/7–8/10–11 và tháng3/6/9/12; không phải tiết khí |
| Phân loại vượng/suy có cấu trúc | DEC-20261026-M03-SEASON-STRENGTH, TEAM_DECISION/CALCULATION, SOURCE_LOCATED | Xuân Mộc/Thổ; Hạ Hỏa/Kim; Thu Kim/Mộc; Đông Thủy/Hỏa; tháng Thổ Thổ/Thủy, lần lượt vượng/suy; hành khác UNCLASSIFIED. Không phát một đoạn luận mùa SOURCE_VERIFIED |
| Số quái/hỗ/biến và lịch | Các rule bản nền đã kiểm, source/edition hash và trang đúng phạm vi | M03 không thay TIME chia6, OBJECT_COUNT hay quyết định giờ tháng5 Tam Thế đã chốt |

Quyết định M03-SEASON-STRENGTH do Codex thực hiện theo quyền quyết định kỹ thuật TV2/TV3 đã giao ngày26/10. Chỉ phân loại cấu trúc, không biến nguồn SOURCE_LOCATED thành văn bản đã VERIFIED. Các mức vượng/suy không được cộng thành điểm chung, xác suất, số tiền hay ngày ứng nghiệm. Chúng được trả riêng với source/limitation của chính quy ước.

Kết quả Mai Hoa có reading mang **TEAM_DECISION / SOURCE_AMBIGUOUS** ở mức tổng vì đã sử dụng BODY/PHASES. Từng đoạn luận vẫn SOURCE_VERIFIED/VERIFIED. Điều này không mở lại quyết định TIME chia6 đã được chủ dự án duyệt; xem đúng từng rule trong rules và calculationDecisions. `MH-THE-DUNG`1.0 cũ tiếp tục DISABLED; service dùng scoped codes MH-READING-* với purpose phù hợp. Không dùng TEAM_DECISION để vượt chốt INTERPRETATION.

Review M01 vẫn là hai lượt cùng Codex, không gọi là hai người độc lập. Không sửa reviewed_at/hash/status hoặc cờ lịch sử runtimeEnabled=false trong bundle M01 để mở chức năng. Chính provider/code M03 cấp quyền thực thi sau kiểm nguồn; approval nội dung vẫn đến từ attestation DB.

## 4. Cách service bảo vệ dữ liệu nguồn

- `JdbcMaiHoaReadingRepository` đọc bundle và20 template trong một transaction read-only/repeatable-read; giới hạn21 dòng để phát hiện thừa, query timeout3s.
- `ReviewedMaiHoaKnowledge` nạp bản M01 đóng gói trong JAR, kiểm pin UTF-8 đã chuẩn hóa xuống dòng. Sau đó so toàn bộ attestation JSON, hash, editor/reviewer, thời điểm, phương pháp review, trạng thái và mọi cột/JSON nguồn của20 mẫu với snapshot DB. Thiếu/sửa mẫu của bất kỳ topic nào đều không cho phát lời luận từ bundle bị hỏng.
- Kiểm SHA/trang/số trang/tên sách và8 quái chuẩn (mã, số, hành, hình hào); các proof MH-TRIGRAM/MH-MUTUAL/MH-CHANGE phải khớp trang/section/printed page/hash đã duyệt, không chỉ có một source reference bất kỳ.
- Tạo catalog/state **riêng theo bundle đã kiểm** cho các scoped rule; đoạn luận qua SOURCE_VERIFIED/INTERPRETATION, quy ước qua TEAM_DECISION/CALCULATION. Catalog14 rule bản nền không bị sửa để giả rằng MH-THE-DUNG đã verified.
- Chỉ cache tài nguyên bất biến trong JAR, **không cache approval/row DB**. Mỗi request kiểm snapshot mới. Nếu thiếu bundle trả RULE_NOT_AVAILABLE/RULE_STATE_UNAVAILABLE; thiếu review trả MISSING_SOURCE_REVIEW; nội dung/metadata bị sửa trả KNOWLEDGE_DATA_INCOMPLETE; mất kết nối trả DATABASE_UNAVAILABLE. Không fallback sang response cũ hoặc nội dung mặc định.
- Mọi chốt nguồn hoàn thành trước CALCULATING; trạng thái sách lỗi không phát các progress giả. Schema V12 chưa có cũng là dữ liệu/schema chưa đầy đủ, không phải lý do bỏ kiểm.

Maven đóng gói đúng `data/m01_reviewed_readings.json` vào `readings/` trong JAR, không duy trì một bản chép JSON thủ công khác. Build cần checkout đầy đủ folder data; runtime không cần truy cập repo root hay hai PDF trong Downloads. Bootstrap/import vẫn cần hai PDF đúng hash theo biên bản38.

Readiness A02 vẫn có scope KNOWLEDGE_STORAGE/các rule bản nền, không phải một feature flag M03. Không dùng businessFeaturesReady của toàn sản phẩm để gọi M03 đã bao phủ mọi chức năng; Tam Thế EXTENDED/T02 vẫn còn việc.

## 5. Bằng chứng nghiệm thu

| Nhóm | Đã chạy |
| --- | --- |
| Ma trận logic |1536 =64 cấu trúc×6 hào×4 topic, đối chiếu độc lập vai trò/quái/quan hệ và đúng text;25 cặp hành có chiều,12 nhóm tháng, hào3/4, nhuận, offset và question không điều khiển kết quả |
| PostgreSQL | Chạy lại1536 tổ hợp bằng service/JDBC thật, có tên đã duyệt; ba phương pháp hoạt động; ba JSON bản nền giữ nguyên chính xác |
| Bảo vệ nguồn |8 kiểu sửa/xóa DB bị chặn trong transaction **rollback-only**, không commit hỏng dữ liệu; các ca reviewer/hash/timestamp/document/source thêm ở unit. Default profile không có DB không tự duyệt bundle đóng gói |
| Toàn suite Backend |2062 ca báo cáo: **2041 PASS /21 SKIP /0 lỗi**; SKIP là bộ DB A02 cần database/env riêng, không gọi là đã chạy. Thêm4 ca Java round-trip cho capture M03 sau khi chụp, đều đạt |
| Client | Typecheck/52 fixtures đạt; **445/445 test**,14 file;12 Node calculation-state đạt. Không dùng số test từ nhánh TV1 khác để công bố cho checkout này |
| STOMP+HTTP thật | **15 terminal /42 progress /22 HTTP /2 owner**. Bốn result được Server sinh rồi lưu/đọc lại qua H01; owner khác không đọc/xóa được, owner đúng xóa được. Replay/đổi topic/context/cùng ID khác session và bốn request bản nền đạt |
| Hồi quy smoke hợp đồng M02 trên M03 | **13 terminal /32 progress /2 phiên** đạt sau khi cập nhật script: ba reading Mai Hoa thành công, Tam Thế EXTENDED vẫn gate D04, lỗi validation và JSON bản nền đúng |
| Đóng gói | JAR profile database tạo thành công sau test; scope runtime dùng dữ liệu đã seed và source gates thật |
| Dọn/kiểm DB | Đã dừng Server tạm, dọn đúng2 owner smoke theo token hash. Sessions/history TEST đều0; toàn bộ dòng public khớp snapshot trước M03; huyenco vẫn V11 |

Snapshot TEST vẫn `4543343a82c7eefb161b15bd359284c3dae350617a362aa56bcac0d180195f86`. Bằng chứng cục bộ ở `scripts/generated/m03_fullsuite.log`, `m03_package.log`, `m03_live_acceptance.json`, `m03_after_contract_audit.json`, `server/target/surefire-reports/`. Logs/owner hashes/backup không đưa Git. Server tạm dùng127.0.0.1:18087/profile db đã dừng; đây không phải URL Server nhóm đang hoạt động.

## 6. Chạy lại trên TEST

1. Dùng database TEST riêng đã bootstrap và nhập M02 theo38; không trỏ mặc định vào huyenco. Hướng dẫn profile/env/Origin ở [35](35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md).
2. Build JAR profile database và khởi động profile db vào TEST. Ví dụ port18087, ALLOWED_ORIGINS có đúng Origin của Client. Credentials ở biến môi trường, không đi theo Git. Profile db hiện bật Flyway tự động khi khởi động: kiểm DB_URL thật sự trỏ TEST đã bootstrap/seed theo38; không dùng huyenco để thử. Trước khi áp dụng vào DB dự án, làm backup/kiểm/import theo wrapper38 và cổng nghiệm thu đã chốt.
3. Từ client:

```powershell
$env:M03_HTTP_URL = 'http://127.0.0.1:18087'
$env:M03_ORIGIN = 'http://localhost:3000'
node scripts/smoke-m03-readings.mjs
```

Script mặc định so kết quả thật với4 capture đã lưu, không ghi đè fixtures. `M03_CAPTURE_FIXTURES=1` chỉ dùng khi TV2/TV3 chủ động ghi nhận phiên bản mới sau khi đối chiếu; không bật để làm mất mismatch. Script M02 cũng đã cập nhật để kiểm Mai Hoa thành công trên Server M03, trong khi vẫn kiểm chốt D04.

4. Smoke M03 tạo hai phiên HTTP riêng để kiểm owner và xóa từng history đã tạo. Vì H01 chưa có logout xóa owner, dọn riêng các owner test bằng helper sau khi smoke kết thúc, kể cả khi smoke thất bại:

```powershell
# PGPASSWORD nhận riêng qua môi trường/prompt, không ghi vào lệnh hoặc file Git.
python .\scripts\cleanup_m03_test_owners.py --database huyenco_m02_test_tv1
```

Lệnh cleanup chạy từ repo root; đổi tên thành TEST thực tế, bắt buộc prefix huyenco_m02_test_*. Helper chỉ xóa token_hash được client ghi ở scripts/generated/m03_owner_cleanup.json, không xóa rộng các phiên/lịch sử khác và từ chối tên DB sản xuất. Giữ file hash nếu cleanup thất bại để có thể chạy lại; không chia sẻ cookie/CSRF qua log.

Lượt Java có DB dùng profile database, HUYENCO_M02_DB_URL trỏ local TEST prefix trên, HUYENCO_TEST_DB_USER và PGPASSWORD qua môi trường; chạy `MaiHoaReadingDatabaseTest` hoặc suite đầy đủ. Các lệnh Client giống40. TEMP/TMP có thể trỏ work/m02/vitest-tmp khi sandbox Windows gặp lỗi rename.

## 7. Phần còn lại

- D04 nối WEALTH mở rộng với Lộc/Sang hèn/Điền sản; giữ no-match Lộc và nguồn/nhãn riêng. M03 không mở Tam Thế EXTENDED bằng dữ liệu giả.
- TV1 làm I02 để người dùng chọn topic/context và nhìn thấy lời luận trên UI. Hiện Server đã trả field thật; giao diện hiện tại chưa tự có màn hình mới chỉ vì DTO đã thêm.
- T02 kiểm toàn sản phẩm, concurrency/load/source failure và luồng người dùng mới sau D04/I02. Chưa công bố đã đạt ma trận720 Tam Thế hoặc mọi nội dung hai sách.
- Chỉ áp dụng V12/dữ liệu mở rộng vào huyenco khi đạt các bước nghiệm thu mở rộng đã chốt. M03 không tự migrate/seed DB dự án hoặc push/merge Git.
