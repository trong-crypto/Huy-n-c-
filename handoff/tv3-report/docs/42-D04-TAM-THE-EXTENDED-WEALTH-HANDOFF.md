# D04 hoàn thành — Tam Thế WEALTH mở rộng

**Sau triển khai huyenco26/10 theo [43](43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md):** DB dự án đã V12/cùng bộ M01 như TEST, dữ liệu V11 giữ nguyên;720 tổ hợp D04 chạy thật đạt. Đã sửa thứ tự nguồn tổng hợp chưa ổn định giữa các JVM bằng sắp theo result_code; năm capture D04 chỉ đổi thứ tự nguồn tổng, không đổi text/khóa/tập nguồn. Lượt khởi động mới tiếp theo khớp capture nguyên vẹn. Hồi quy mới2262 Java PASS/21 SKIP,452 Client/62 fixtures đạt. Các dòng huyenco V11 và số liệu lượt D04 gốc bên dưới là lịch sử; UI/I02/T02 chưa hoàn tất.

**26/10/2026: Backend đã trả Lộc, Sang hèn và Điền sản thật qua PostgreSQL TEST/STOMP.** Đủ720 tổ hợp Can Chi năm–tháng trong chu kỳ60 năm. Bảng Lộc có360 tổ hợp không có giao điểm: chế độ EXTENDED công bố đúng tình trạng đó và vẫn trả Sang hèn/Điền sản, cùng CAREER/LOVE nếu được yêu cầu. Giao diện thuộc TV1/I02; nghiệm thu toàn sản phẩm thuộc T02.

Không sửa schema, seed, review hoặc catalog14 rule nền trong D04. TEST `huyenco_m02_test_20261026` đã có V12/bundle M01 từ M02. Database dự án `huyenco` vẫn V11. Server nghiệm thu tạm127.0.0.1:18088 đã dừng; đây không phải URL Server nhóm đang hoạt động. Chưa commit/push/merge Git trong task này.

## 1. Cách TV1 yêu cầu kết quả mới

Giữ envelope1.2 và endpoint STOMP `/app/tam-the/calculate`; nhận results/errors/progress ở `/user/queue/*` theo phiên. Thêm `payload.wealthMode="EXTENDED"`:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440091",
  "type": "TAM_THE",
  "payload": {
    "birthDate": "1984-02-01",
    "birthTime": "08:30",
    "calendarType": "LUNAR",
    "isLeapMonth": false,
    "wealthMode": "EXTENDED"
  }
}
```

Không có categories nghĩa là CAREER/WEALTH/LOVE. Có categories thì giữ đúng thứ tự Client yêu cầu; EXTENDED bắt buộc có WEALTH. WEALTH riêng vẫn được hỗ trợ. `birthTime` được kiểm định dạng nhưng không tham gia ba phép tra năm–tháng này; không tự nối bảng giờ để thay lời luận chung. Lịch C01 quyết định năm/tháng âm từ đầu vào, kể cả Tết và tháng nhuận. Nhuận dùng cùng số tháng của bảng; không dùng ngày máy hoặc tự suy mốc từ câu hỏi.

Đầu ra `categories[].entries` giữ tên cũ. Riêng WEALTH thêm `subreadings`, đúng thứ tự:

| code / ruleCode | Khóa | Kết quả |
| --- | --- | --- |
| LOC / TT-TAI-LOC | `STEM:<Can năm âm>\|MONTH:MM` | MATCHED có hai entry theo đúng thứ tự cột; hoặc NO_SOURCE_MATCH, entries rỗng, reason NO_PRINTED_INTERSECTION và vẫn có nguồn bảng |
| SANG_HEN / TT-SANG-HEN | `BRANCH:<Chi năm âm>\|MONTH:MM` | Một entry MATCHED từ144 ánh xạ và12 đoạn đã duyệt |
| DIEN_SAN / TT-DIEN-SAN | `ELEMENT:<hành mệnh>\|MONTH:MM` | Một entry MATCHED từ60 ánh xạ và7 đoạn đã duyệt |

`categories[WEALTH].entries` bằng phép nối entries của ba tiểu mục, theo đúng thứ tự, không đổi nội dung. Từng entry có `subreadingCode`. Kết quả gốc thêm `coverageMode="EXTENDED"`, `bundleId`, `editorialDecisions`; giữ `decisionReferences` cũ nguyên kiểu. Chi tiết kiểu và validator ở [39](39-DETAILED-READINGS-CONTRACT.md).

Ví dụ trên trả đủ ba category; LOC không có giao điểm, Sang hèn là Lục Hại, Điền sản giữ “Phú / Phá”. Đây không phải dựng thêm một ô Lộc hoặc dùng Sang hèn/Điền sản để gọi kết quả Lộc đã đầy đủ.

**LEGACY:** thiếu wealthMode hoặc wealthMode=LEGACY tiếp tục JSON/hành vi trước D04. Khi yêu cầu WEALTH ở khóa thiếu Lộc, tuyến cũ vẫn trả RULE_NOT_AVAILABLE/LOOKUP_NOT_AVAILABLE cho cả request. D04 không tự nâng mọi Client cũ sang EXTENDED.

## 2. Bảo toàn nội dung và giới hạn bản in

Dùng bundle M01 `M01-READINGS-20261026-V1`, pin UTF-8 chuẩn hóa SHA `e3c460cdfe1a96546b243155205d12e8a27c1e45882452344a7dafa778e295b6`. Sách Tam Thế360 trang có SHA `7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d`. Nguồn và review ở [38](38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md), không có lượt tự duyệt sách mới trong D04.

- Sang hèn dùng PDF43–44/trang in44–45. Giữ Hoa cái/Hao Cái, Vong sát/Vong Thần, Tướng linh/Tướng Tinh và Thiên an/Phiên An. Chỉ entry thật sự dùng nhãn khác biệt mới mang quyết định SANG-HEN-LABELS; không sửa mất nhãn bảng.
- Điền sản dùng PDF49–50/trang in50–51. Giữ “Phú / Phá” ở cột6. Mọi kết quả Điền sản mang quyết định DIEN-SAN-REFERENCE: bản in dẫn Số6, dự án dùng hành mệnh TT-NGU-HANH/Số4 đã duyệt. Riêng cột6 thêm DIEN-SAN-LABELS.
- Nội dung đoạn biên tập đã duyệt mang SOURCE_VERIFIED/VERIFIED. Các liên kết nhãn/tham chiếu mang TEAM_DECISION/SOURCE_AMBIGUOUS, có purpose EDITORIAL_LINK hoặc CALCULATION, policy, mô tả, giới hạn và trang riêng. Chúng xuất hiện trong decisionReferences của tiểu mục và editorialDecisions gốc.
- Theo hợp đồng M02, ruleBasis/sourceStatus gốc Tam Thế mô tả lớp nội dung đã duyệt; **không có nghĩa mọi liên kết biên tập đã được bản in xác minh**. TV1 phải hiển thị editorialDecisions, không dùng cờ gốc để che các quy ước.
- Hai lượt review M01 do cùng Codex thực hiện; không gọi là hai người độc lập. Cờ runtimeEnabled=false/hash/review trong hồ sơ M01 giữ nguyên mốc dữ liệu, không sửa để mở runtime.

Không tạo số tiền, xác suất, ngày ứng nghiệm hoặc kết luận chắc chắn về sự kiện từ các đoạn sách. Mâu thuẫn giữa ba phép tra được giữ riêng, không cộng điểm thành một phán quyết chung.

## 3. Service và chốt nguồn

`JdbcTamTheExtendedRepository` đọc bundle,19 kết quả,204 ánh xạ và các rule/bản ghi Tam Thế nền được yêu cầu trong **cùng một transaction read-only/repeatable-read**. Tái sử dụng phần đọc nền của JdbcKnowledgeRepository trên chính connection đó; không ghép hai snapshot khác thời điểm. Query timeout3s; phần mới giới hạn20 kết quả/205 ánh xạ để phát hiện cả thiếu lẫn thừa.

`ReviewedTamTheWealth` nạp tài nguyên pin trong JAR rồi đối chiếu snapshot DB mỗi request: toàn bộ reviewed_document, hash, người nhập/kiểm, thời điểm/phương pháp/trạng thái review; mọi cột của19 đoạn, JSON nguồn, tên/hash/số trang sách; mọi khóa/result/row/column của204 ánh xạ. Chỉ cache hồ sơ bất biến trong JAR, không cache approval hoặc bảng DB. Không dùng resource đóng gói làm fallback khi DB thiếu.

Rule TT-SANG-HEN/TT-DIEN-SAN được dựng trong catalog riêng sau kiểm nguồn, rồi đi qua RuleRegistry với SOURCE_VERIFIED/INTERPRETATION. Liên kết biên tập đi qua TEAM_DECISION/CALCULATION riêng; không dùng TEAM_DECISION để vượt chốt phát nội dung chưa duyệt. Bảng Lộc và các category nền vẫn qua các chốt D03, gồm kiểm độ đầy đủ bảng trước khi phân biệt no-match thật với mất dữ liệu.

| Tình huống | Hành vi |
| --- | --- |
| Thiếu bundle | RULE_NOT_AVAILABLE / TT-WEALTH-EXTENDED / RULE_STATE_UNAVAILABLE |
| Bundle chưa VERIFIED hoặc thiếu reviewer/date | SOURCE_UNVERIFIED hoặc MISSING_SOURCE_REVIEW |
| Nội dung/metadata/ánh xạ bị đổi, thiếu/thừa dòng hoặc thiếu schema V12 | KNOWLEDGE_DATA_INCOMPLETE, không fallback hoặc tự nạp lại |
| Mất kết nối JDBC | DATABASE_UNAVAILABLE; không lộ SQL/credential |
| Lộc thật sự không có giao điểm trong EXTENDED | COMPLETED với LOC=NO_SOURCE_MATCH và hai phép bổ sung MATCHED |
| Dữ liệu nền thiếu/hỏng hoặc rule bị thu hồi duyệt | Lỗi theo chốt nguồn, không coi là một ô Lộc không có trong bản in |
| Input sai/EXTENDED thiếu WEALTH/ngày âm nhuận sai | Lỗi validation, không phát kết quả một phần |

Trên các ca nguồn hỏng đã thử, service dừng trước CALCULATING/LOOKUP. Request hợp lệ có bốn progress thật ACCEPTED, VALIDATING, CALCULATING, LOOKUP. Không thêm bước progress giả. N01 fingerprint đã phân biệt wealthMode/ngày/categories; H01 lưu snapshot do Server sinh, không nhận nội dung luận từ Client.

Readiness A02 vẫn là scope KNOWLEDGE_STORAGE của bản nền; READY trên V11 chưa xác nhận D04 có bundle/schema/dữ liệu. Muốn nghiệm thu D04 phải dùng V12 và kiểm request EXTENDED thật.

## 4. Fixtures thật cho TV1

Đã chụp năm cặp `docs/examples/d04-*.request.json`/`.response.json` từ JAR D04 qua STOMP:

1. wealth-matched: Lộc có hai entry; bảo tồn Phú / Phá.
2. wealth-no-loc: Lộc không có giao điểm, vẫn đủ CAREER/WEALTH/LOVE.
3. label-aliases: Thiên an / Phiên An cùng quyết định biên tập.
4. leap-lunar: tháng2 nhuận năm2023.
5. solar-equivalent: ngày Dương2023-03-22; data bằng trường hợp âm nhuận ở mục4.

Tổng62 JSON fixtures:31 bản nền,13 M02,8 M03,10 D04. Bốn mẫu M02 schema-only và lỗi unavailable M02 giữ đúng vai trò lịch sử/test chưa cấu hình service; không gọi chúng là capture thành công. M03 fixtures giữ nguyên nội dung.

TV1 dùng subreadings để trình bày ba mục, trạng thái không có giao điểm và ghi chú biên tập. CAREER/LOVE và các request LEGACY vẫn theo UI cũ. Muốn lưu lịch sử phải bootstrap phiên HTTP trước WS như [34](34-H01-SESSION-HISTORY-HANDOFF.md). D04 không sửa page/component/form của TV1.

## 5. Bằng chứng đã chạy

| Nhóm | Kết quả |
| --- | --- |
| Nguồn/khóa |204 mapping được kiểm text/title/nguồn/quyết định; có ca kiểm độc lập hàng Tý và12 tháng hành Kim, bốn nhãn Sang hèn, Phú/Phá và tham chiếu Số6 |
| Service/JDBC |720/720 tổ hợp1984–2043 ×12 tháng trả đủ ba category;360 có Lộc/360 no-match, bao phủ12 đoạn Sang hèn và7 Điền sản. Lịch Dương/Âm tương đương, nhuận, Tết, biên1900/2099, thứ tự/category riêng và birthTime không thay phép tra đạt |
| Nguồn lỗi |15 kiểu can thiệp DB, gồm bundle/review/hash/content/nhãn/mapping/schema thiếu và mất dòng Lộc, đều bị chặn; viết trong transaction rollback-only. Cùng service đã chạy thành công trước can thiệp nên kiểm được việc không cache approval DB |
| Backend | Toàn suite **2255 PASS /21 SKIP /0 lỗi** trong2276 ca báo cáo;21 SKIP là DB A02 cần env/DB riêng. Sau khi chụp fixtures và bổ sung kiểm biên/schema/outage: lượt mục tiêu217/217 đạt, gồm5 round-trip capture Java; không cộng217 thành số ca mới không trùng |
| Client | **452/452**,15 file; typecheck/62 fixtures và12 Node calculation-state đạt. Chỉ thêm test contract, không sửa UI |
| STOMP/HTTP thật | **737 terminal /2928 progress /27 HTTP /2 owner**, gồm720 tổ hợp; năm result thật lưu/đọc lịch sử, owner khác không đọc/xóa được. Replay, đổi mode/ngày/categories, hai session cùng ID khác input, lỗi input, LEGACY và M03 đạt |
| Hồi quy giao thức | M02 hiện tại13 terminal/34 progress; M03 hiện tại15 terminal/44 progress/22 HTTP và bốn lịch sử đạt. M03 response fixtures khớp nguyên bản |
| Đóng gói/dữ liệu | JAR profile database build thành công. Server tạm đã dừng; dọn đúng2 owner D04 và2 owner M03. TEST sessions/history đều0, toàn bộ dòng public giữ nguyên; huyenco vẫn V11 |

Snapshot TEST sau cùng: `4543343a82c7eefb161b15bd359284c3dae350617a362aa56bcac0d180195f86`. Bằng chứng cục bộ: `scripts/generated/d04_fullsuite.log`, `d04_capture_source_tests.log`, `d04_package.log`, `d04_live_acceptance.json`, `d04_before_audit.json`, `d04_after_audit.json`, `d04_client_tests.log`, `d04_typecheck.log`. Log/backup/owner hash không đưa Git. Một ca setup thử xóa dữ liệu nền ban đầu bị khóa ngoại từ chối; đã sửa setup để xóa trang phụ thuộc trong cùng transaction rollback, rồi kiểm lại đạt, không nới khóa ngoại sản phẩm.

Đây là nghiệm thu Backend/D04 và hồi quy giao thức; chưa thay T02 nhiều Client đồng thời, benchmark, giao diện hay nghiệm thu toàn sản phẩm.

## 6. Chạy lại trên TEST

1. Nhận cùng checkout đầy đủ server/client/data/scripts/docs, dùng TEST riêng đã bootstrap và seed M02 theo38. Không trỏ DB_URL vào huyenco để thử. Không cần nhập lại TEST đã có đúng bundle. Khi tạo TEST mới, theo wrapper backup trước schema và backup trước import; không sửa V1–V12 hoặc Flyway history.
2. Theo [35](35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md), dùng Maven profile database khi build, Spring profile db khi chạy. Profile db bật Flyway tự động: kiểm DB_URL trước khởi động. DB_USERNAME/DB_PASSWORD truyền qua môi trường riêng. ALLOWED_ORIGINS phải chứa Origin thật của Client.
3. Sau readiness READY, chạy từ client, ví dụ Server ở127.0.0.1:18088:

```powershell
$env:D04_HTTP_URL = 'http://127.0.0.1:18088'
$env:D04_ORIGIN = 'http://localhost:3000'
node scripts/smoke-d04-wealth.mjs
```

Script mặc định so năm capture đã lưu; không bật D04_CAPTURE_FIXTURES=1 chỉ để bỏ qua mismatch. Script chạy cả720 ca và tạo hai phiên HTTP; xóa history của nó nhưng cần dọn owner sau khi xong, kể cả khi kiểm bị lỗi. Từ repo root, PGPASSWORD nhận riêng qua môi trường/prompt:

```powershell
python .\scripts\cleanup_m03_test_owners.py --task D04 --database huyenco_m02_test_tv1
```

Thay tên bằng TEST thực tế, bắt buộc prefix huyenco_m02_test_*. Helper đọc đúng `scripts/generated/d04_owner_cleanup.json`, chỉ xóa token_hash do smoke ghi, từ chối tên DB dự án. Giữ hashfile nếu cleanup lỗi; không bàn giao cookie/CSRF. Không đổi test DB trong lúc còn owner cần dọn.

Lượt Java dùng HUYENCO_M02_DB_URL dạng JDBC local TEST prefix trên, HUYENCO_TEST_DB_USER/PGPASSWORD riêng và `-Pdatabase`; chạy TamTheExtendedDatabaseTest/ReviewedTamTheWealthTest/D04ContractExamplesTest hoặc suite đầy đủ. Client dùng npm run test:run, typecheck, check:contract, test:calculation. Khi sandbox Windows gây lỗi rename, TEMP/TMP có thể trỏ thư mục làm việc trong repo theo41.

## 7. Task tiếp theo

**I02 — TV1 tích hợp UI lời luận Mai Hoa và ba tiểu mục Tam Thế**, dựa trên39/41/42 và các capture thật. **T02 — TV2/TV3 nghiệm thu toàn luồng cùng Client mới**, gồm nguồn bị thu hồi, lịch sử, nhiều phiên, tải/hàng đợi/reconnect và gói chạy sạch. Chỉ đưa V12/dữ liệu mở rộng vào database dự án theo quy trình backup/import khi đã đạt cổng nghiệm thu; D04 không tự thay database chung hoặc công bố toàn bộ dự án đã hoàn tất.
