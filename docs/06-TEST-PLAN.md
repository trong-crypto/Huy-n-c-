# Kế hoạch kiểm thử

Kết quả mới nhất: **N01 ngày 25/10/2026** ở cuối tài liệu; các mục D03/H01 và các mốc trước đó là bằng chứng lịch sử theo đúng phạm vi từng đợt.

## D03 đã kiểm ngày 25/10/2026

- 464 kiểm thử Java có PostgreSQL đạt, gồm chín ca D03; vòng 60 năm × 12 tháng: 360 kết quả đủ ba category, 360 lỗi thiếu khóa Lộc đúng. Kiểm category riêng không bị bảng không yêu cầu chặn, nhiều nghề, nguồn nối trang, Tết/tháng nhuận, dữ liệu chưa duyệt/hỏng và lỗi JDBC an toàn.
- Bootstrap hai lần vẫn giữ nguyên toàn bộ bản ghi/metadata và mọi chốt nguồn cũ; DB tạm đã xóa. D03 không có migration/import.
- 263 terminal/1.034 progress STOMP D03 đạt; hai phiên cùng ID khác input, đủ nhóm nội dung, thứ tự category, 120 khóa Can–tháng/60 ô LOVE/60 năm, malformed payload và tháng nhuận. Hồi quy TIME/LINES/OBJECT_COUNT/B02/reconnect/đích broker trái phép đạt.
- Chụp bốn fixture success và một lỗi no-match thật; 7 test Java DTO/context sau khi chụp đạt; 24 fixtures khớp TypeScript, typecheck và 12 test guard/trạng thái Client đạt.
- So hash mọi bảng `huyenco` trước/sau smoke: nguyên trạng; Server tạm localhost đã dừng, Flyway tắt. Không lấy số đo smoke làm benchmark hoặc nghiệm thu UI. Lệnh/bằng chứng tại `30-D03-TAM-THE-HANDOFF.md`.

## D02 đã kiểm ngày 25/10/2026

- 50 kiểm thử Python đạt; kiểm hồ sơ nguồn pin hash, mọi khóa Lộc thiếu/nhiều kết quả, LOVE đủ tám câu/chuỗi trang, đủ 36 phần, 12 tháng × 1.440 phút và mọi ranh phần giờ.
- DB trống bootstrap hai lần, toàn bộ bản ghi/metadata giống nhau; tám ca sửa sai D02 bị từ chối/rollback; các chốt nguồn cũ vẫn đạt; DB tạm đã xóa.
- 455 kiểm thử Java có DB đạt, không bỏ qua; kiểm multiplicity, 15 bản ghi LOVE có hai trang, nguyên metadata TV2 tháng 5 và hồi quy nghiệp vụ đang có.
- Huyenco đã sao lưu đầy đủ rồi áp dụng V9/D02; dữ liệu cũ ngoài D02 so lại giữ nguyên. Audit thật **50 kiểm tra/0 FAIL/1 PENDING: E01**, không phải kiểm xong TamTheService/UI.
- Chia 40 phút là quy ước đã chốt, không lấy test để chứng minh sách ghi như vậy. Chi tiết/lệnh/bằng chứng tại `29-D02-TAM-THE-DATA.md`.

## B04 đã kiểm ngày 24/10/2026

454 kiểm thử Java có DB đạt, 0 lỗi/0 bỏ qua. Miền số học TIME gồm 51.840 tổ hợp Y×M×D×H, kiểm thượng/hạ/hào và ba quẻ bằng bit oracle; không coi mọi tổ hợp số học là ngày lịch hợp lệ. Kiểm service từ ngày chuẩn: Tết/năm âm,00:00/23:00/giờ biên, nhuận cùng số tháng, instant khác offset, phạm vi sau chuẩn hóa, năm cực trị, nguồn thiếu/snapshot sai và dữ liệu quái thiếu.

STOMP TIME thật: 58 thành công +8 lỗi =66 terminal/248 progress; gồm 16 ca HKO×3 thời điểm và ca biên, hai phiên cùngID khácinput, kiểm source/basis và không echo question. Hồi quy OBJECT_COUNT324 terminal/1.276 progress; LINES387 terminal/1.546 progress; B02 JSON lỗi/phục hồi, TIME thành công/lỗi ngày, reconnect và chặn SEND/SUBSCRIBE đạt.

41 Python,17 fixtures khớp TypeScript/typecheck và11 test Client đạt; guard Client nhận được TIME fixture có lunarDate thật và nguồn ngoài sách. Bootstrap DB tạm hai lần/metadata/guard S02-D01-C01 vẫn đạt, DB tạm đã xóa; audit huyenco45/0 FAIL/2 PENDING. MH-TIME giữ BLOCKED_SOURCE_CONFLICT/TEAM_DECISION; chưa nghiệm thu UI hoặc luận giải toàn hệ thống. Bằng chứng ở `27-B04-TIME-HANDOFF.md`.

Theo phạm vi mới, F01–F08 ở `10-FUNCTIONAL-REQUIREMENTS.md` đều cần test đầu cuối trước khi coi là hoàn thành. Các test LINES bên dưới chỉ kiểm lát cắt đầu tiên.

## Hợp đồng

- Yêu cầu TIME/OBJECT_COUNT/LINES/TAM_THE hợp lệ và không hợp lệ.
- UUID và `type` đúng; ngày/giờ, tháng nhuận; `OBJECT_COUNT` hợp lệ nhưng thiếu bất kỳ điều kiện nguồn/policy/dữ liệu/implementation bắt buộc trả `RULE_NOT_AVAILABLE`; TEAM_DECISION hợp lệ giữ nguyên trạng thái nguồn và phải có cảnh báo; `NUMBER` cũ trả `INVALID_METHOD`.
- `COMPLETED`/`FAILED`, `data`/`error` và mã lỗi thống nhất.

## Thuật toán

- Đối chiếu từng phép tính với ví dụ của đúng ấn bản, ghi expected result và trang nguồn.
- Quy tắc DRAFT không được trả kết quả suy đoán.
- P0 `MAI_HOA`/`LINES`: sáu boolean từ dưới lên, hào động 1 và 6, quẻ hỗ từ hào 2–4/3–5, quẻ biến chỉ đảo một hào; `movingLine` ngoài 1–6, thiếu/thừa hào và sai kiểu trả `INVALID_INPUT`. Chạy test cấu trúc với mọi 64 mẫu hào × 6 vị trí; TV3 kiểm ít nhất các ví dụ nguồn trước khi chuyển `MH-MUTUAL`/`MH-CHANGE` thành `VERIFIED`.
- Mai Hoa: số dư 0 của 8/6, hào 1/6, quẻ hỗ hào 2–4 và 3–5; đối chiếu xung đột tr. 50 của bản in.
- Quyết định mới: TIME dùng tổng chia 6 (dư 0→6), giữ dấu vết dòng tr. 50 in “trừ 8”. OBJECT_COUNT dùng 12 vật, giờ Mùi=8 → thượng 4, hạ 8, hào 2; kiểm dư 0→8/6, `objectCount` 0 hoặc quá 999999, `hourIndex` 0/13, `NUMBER` cũ bị từ chối. TV3 cần ca đối chiếu trang 51 cho cách hiểu “số quẻ” trước VERIFIED.
- Tam Thế: 60 cặp Can Chi; 7 nhóm mốc giờ theo tháng, 36 phần giờ; xung đột tháng 5; tra đa nhãn nghề và đủ 120 ô Can×tháng.
- Tháng 5 Tam Thế: 05:19 trước Dần; 05:20–07:19 dùng Dần, 07:20 bắt đầu Mão; dữ liệu nguồn vẫn giữ chữ gốc Dậu và lý do sửa của nhóm.

## Mạng và riêng tư

- Ít nhất 20 Client đồng thời; mỗi kết quả đúng `requestId` và session.
- Mất kết nối, kết nối lại, timeout, request trùng, quá tải (`SERVER_BUSY`); lỗi một phiên không lan sang phiên khác.
- WSS, origin allowlist, payload sai/quá lớn, không lưu hoặc log ngày sinh tại Server.

## Thực nghiệm cho bài tập lớn

- So baseline xử lý trực tiếp với phương án worker pool/hàng đợi hữu hạn và idempotency **sau khi phương án được triển khai**. Cùng máy, cùng workload, cùng cấu hình và dữ liệu.
- Chạy 1, 5 và 20 Client đồng thời, lặp lại có ghi số lần; đo median/p95 thời gian phản hồi, throughput, số hoàn tất, lỗi, `SERVER_BUSY` và phản hồi sai phiên.
- Lưu raw CSV, script/câu lệnh chạy, môi trường, input, cấu hình, biểu đồ và phần giải thích. Không ghi số liệu dự kiến thành kết quả thực.
- Có test requestId trùng cùng payload, requestId trùng khác payload, disconnect khi đang chờ, hàng đợi đầy, input sai, lỗi database nếu bật database và một tuyến nghiệp vụ thật đã `VERIFIED`.

## Nghiệm thu chức năng đầy đủ

- F01/F02: ca chuẩn từ sách cho TIME và phương pháp số đã chốt; so quẻ chủ/hỗ/biến, hào động, bước tính và nguồn; test ranh số dư, lịch nhuận và thời điểm đổi ngày.
- F04: công danh, tài lộc, tình duyên có ca chuẩn riêng; ô chưa có nguồn trả lỗi rõ, không trộn nhãn hoặc tự sinh lời giải.
- F05: kiểm đủ 64 mã duy nhất, tìm tên/mã, lọc thượng/hạ quái, sáu hào và nguồn; không hiển thị tên/quẻ suy đoán.
- F06: chuyển Dương↔Âm hai chiều, tháng nhuận, phạm vi năm, ranh ngày và Can Chi theo bộ chuẩn độc lập.
- F07: progress có thứ tự, đúng requestId/session; hai Client không nhận nhầm bước hoặc kết quả; timeout/disconnect không hiện thành hoàn tất.
- F08: lưu theo yêu cầu, liệt kê/tìm/xem/xóa của đúng chủ sở hữu; phân trang, truy cập chéo và dữ liệu nhạy cảm trong log/DB.


## A01 đã chạy ngày 23/10/2026

Java 21/21 kiểm thử đạt, TypeScript typecheck đạt, 12 JSON fixtures khớp DTO Client qua `npm run check:contract`. Kiểm registry: thiếu state, version sai, thiếu nguồn/review, DISABLED, TEAM_DECISION giữ SOURCE_AMBIGUOUS và không được dùng cho lời luận giải. Validator chặn policy do Client gửi, số nguyên quá lớn, UUID rút gọn và categories Tam Thế không hợp lệ. Chi tiết ở `16-A01-CONTRACT-HANDOFF.md`; đây không phải kiểm thử đầu cuối phép tính B01.

## B01 đã kiểm đêm 23–24/10/2026

422 test Java có DB, 0 lỗi/0 bỏ qua; gồm ma trận hàm thuần 64 dãy × 6 hào động, kiểm bất biến/đầu vào/gate nguồn/dữ liệu cấu trúc và service nối DB thật. `npm run smoke:lines` kiểm 384 tổ hợp qua hai kết nối STOMP, thêm hai request cùng ID khác input và một lỗi đầu vào: 387 phản hồi đúng, không lẫn phiên. `smoke:stomp` cũ vẫn đạt với OBJECT_COUNT/Tam Thế chưa triển khai. Đây là kiểm chức năng, không phải benchmark, kiểm SUBSCRIBE chéo hay nghiệm thu toàn bộ F01–F08. Cách tái lập và giới hạn ở `18-B01-LINES-HANDOFF.md`.

## B02 đã kiểm ngày 24/10/2026

429 test Java có DB, 0 lỗi/0 bỏ qua; thêm controller JSON lỗi/UTF-8/deadline/disconnect/một terminal, giới hạn transient state và interceptor. Client 10/10 test reducer/guard/render Panel; typecheck, 12 fixtures và production build đạt. STOMP thật: 1.546 progress có thứ tự và 387 terminal đúng; ca JSON lỗi/phục hồi, prefix lỗi, reconnect, chặn queue/SEND và timeout tác vụ DB thật với hạn kiểm tra 1 ms đạt. Test unit giữ handler bằng latch để xác nhận kết quả trả sau timeout/disconnect bị bỏ. Không có sleep trong nghiệp vụ sản phẩm. Xem `20-B02-PROGRESS-HANDOFF.md`; chưa nghiệm thu worker/idempotency, tải hoặc toàn bộ UI F01–F08.

## D01 đã kiểm ngày 24/10/2026

38 kiểm thử Python đạt, gồm kiểm nguồn/hash, chiều tra bảng, nhiều nghề cùng khóa và phát hiện sửa nội dung/nhãn/trang/reviewer. 434 kiểm thử Java có DB đạt, 0 lỗi/0 bỏ qua; thêm đọc đủ dữ liệu công danh và metadata. `test_a02_bootstrap.py` dựng DB trống, chạy bootstrap hai lần rồi so toàn bộ hàng và reviewed_at giống nhau; 5 trường hợp bảo vệ dữ liệu công danh và 3 ca ô legacy đạt (chỉ ô09 cũ, ô09 cũ đi cùng ô08 mới, từ chối đổi ô VERIFIED). DB tạm được xóa sau kiểm.

Đã sao lưu đầy đủ rồi chạy bootstrap trên `huyenco`: V1-V7, 231 ô tra/22 mục nguồn; audit DB thật 42 kiểm tra, 0 FAIL/2 PENDING. Hai lượt đọc ảnh nguồn cùng Codex được ghi riêng, không gọi kiểm bằng chương trình là kiểm sách độc lập. Chưa nghiệm thu F04 hoặc UI từ kết quả này. Bằng chứng và phạm vi tại `25-D01-CAREER-DATA.md`.


## C01 đã kiểm ngày 24/10/2026

Ghi nhận C01 dưới đây là lịch sử; kết quả E02 mới nhất nằm cuối tài liệu.

447 kiểm thử Java có PostgreSQL đạt, 0 lỗi/0 bỏ qua. Kiểm khứ hồi đủ 73.049 ngày 1900–2099, sinh lại dataset theo Time4J 5.9.4, cross-check 48.213 ngày hiện đại cùng thư viện; 16 ca HKO riêng gồm Tết/tháng nhuận/năm thế kỷ/cuối phạm vi và 2054. Không gọi cross-check cùng thư viện là nguồn thiên văn độc lập; không dùng lịch UTC+8 thay mọi ngày UTC+7.

41 Python, 18 HTTP trên Server thật và 16 fixtures/typecheck đạt. Bootstrap V8 hai lần giống toàn bộ hàng/thời điểm duyệt; 3 ca bảo vệ nguồn lịch chặn hash/URL/reviewer sai; DB tạm được xóa. Đã sao lưu rồi áp dụng C01 vào huyenco; audit 45 kiểm tra/0 FAIL/2 PENDING. Fixtures lịch chụp từ runtime; giao diện TV1 và tuyến TIME B04 còn riêng. Bằng chứng/giới hạn ở `26-C01-CALENDAR-HANDOFF.md`.

## E02 đã kiểm ngày25/10/2026

470 Java với PostgreSQL đạt (0 lỗi/0 bỏ qua), gồm5 test tra quẻ/service/controller và1 test JDBC kiểm64 quẻ/64 nghĩa thật. Bootstrap2 lần có toàn bộ bản ghi và reviewed_at giống nhau, DB tạm đã xóa. Phép kiểm readiness trước E01 đã được cập nhật để kỳ vọng64 interpretations hiện có.

123 HTTP với DB và2 HTTP không DB trên JAR thật đạt: toàn bộ64 chi tiết khớp CSV E01/nguồn/hình hào,16 bộ lọc quái, Bĩ/Bí/Ly/Lý/Càn/Cấn, tìm mã, page lớn không tràn, tham số lạ/lặp/sai kiểu/ranh,404,503 không DB và UUID riêng qua8 yêu cầu đồng thời. Unit test còn kiểm Unicode NFC/NFD, ẩn nghĩa chưa duyệt/thiếu metadata và lỗi không lộ secret. TypeScript/27 JSON fixtures/54 Python đạt. Snapshot `huyenco` trước/sau HTTP giống nhau; không bật Flyway trong phép kiểm và hai Server tạm đã dừng. Chạy lại bằng `scripts/verify_e02.py` hoặc `scripts/smoke_e02_hexagrams.py`; xem `32-E02-HEXAGRAM-LOOKUP-HANDOFF.md` để phân biệt cách kiểm dùng DB thật chỉ đọc và bootstrap trên DB tạm. Chưa coi UI F05/H01/N01/benchmark hoàn thành.

## H01 đã kiểm ngày25/10/2026

480 Java có PostgreSQL đạt,0 lỗi/0 bỏ qua; gồm7 test bảo mật/cache/controller/handshake và3 test JDBC lịch sử. DB tạm bootstrap2 lần giống toàn bộ dữ liệu,đã dọn. Kiểm quota bằng8 yêu cầu lưu đồng thời với hạn1: chỉ1 thành công. Owner khác không đọc/xóa/truy cập requestId hộ; snapshot tồn tại khi tạo lại repository,phiên hết hạn bị từ chối. Bảy test bảo mật còn được chạy riêng với cấu hình Mockito mặc định và đều đạt.

Server thật:54 HTTP H01+8 terminal STOMP,hai owner cùng requestId/hai socket cùng owner,cookie và header spoof,CSRF/Origin,JSON/field sai,query/pagination,TTL cache rút ngắn,lưu lặp,xung đột requestId và riêng tư snapshot đều đạt. Dừng/khởi động lại Server giữa lượt kiểm,cookie/CSRF và lịch sử đã lưu vẫn hợp lệ; cache kết quả chưa lưu không tồn tại lại. Thêm2 HTTP khi không profile db trả503/401 đúng;121 HTTP hồi quy E02 đạt. TypeScript/31 fixtures/54 Python đạt. Script tái lập `verify_h01.py`,bằng chứng `h01_network.json`, `h01_integration.json`,biên bản34.

V11 đã triển khai huyenco sau backup archive được kiểm;11 bảng tri thức có hash trước/sau giống nhau,audit nguồn54 PASS/0 FAIL/0 PENDING. Hai bảng phiên/lịch sử trống khi triển khai,không nạp demo vào DB dùng thật. UI I01,N01,benchmark và giới hạn nguồn ngoài phạm vi H01 còn riêng.

## N01 — kiểm trọng tâm ngày 25/10/2026

Chạy lại bằng JDK 17, từ thư mục `server`: `.\mvnw.cmd -o '-Dtest=CalculationDispatcherTest,CalculationFlowTest' test`. **11 test đạt, 0 failure, 0 error, 0 skipped; BUILD SUCCESS.** Năm test dispatcher kiểm queue hữu hạn/quá tải/giải phóng sau disconnect, dedupe/replay/TTL và xung đột payload, registry đầy không loại ID còn hiệu lực, deadline gồm thời gian chờ, 20 session cùng ID độc lập. Sáu test vòng đời kiểm progress/JSON/UTF-8/đầu vào, timeout, disconnect và giới hạn Run.

Báo cáo: `server/target/surefire-reports/com.huyenco.websocket.CalculationDispatcherTest.txt` và `com.huyenco.websocket.CalculationFlowTest.txt`; thiết kế, cấu hình và cách bàn giao ở [biên bản 36](36-N01-CONCURRENCY-IDEMPOTENCY-HANDOFF.md). Các ca sử dụng worker thật trong JVM và service/transport thử nghiệm có latch; không coi đây là nghiệm thu STOMP/DB/UI thực tế hoặc benchmark. N01 không có migration/import, không tạo bằng chứng VERIFIED mới và không sửa dữ liệu sách.

**Hồi quy bổ sung kết thúc 23:49 ngày 25/10: BUILD SUCCESS, 485 test tổng cộng; 464 đạt, 21 skipped, 0 failure, 0 error.** Lượt này không bật profile/kết nối PostgreSQL nên 21 test cần DB tự bỏ qua. Mockito self-attach mặc định bị vướng quyền pipe JVM trên Windows; chạy sẵn `mockito-core-5.17.0.jar` qua `-DargLine=-javaagent:...` đã cho suite kết thúc. Lệnh tái lập đầy đủ trong mục 5 của biên bản 36. Lượt bị ngắt trước đó không được tính là kết quả thành công; không dùng số 485 để tuyên bố 485 test đã chạy đạt hoặc DB đã được kiểm lại.

Mốc H01/D03 phía trên là lịch sử trước N01. T01 cần kiểm SEND trùng cùng/khác payload, replay không progress, TTL/reconnect, overload và tách phiên qua WebSocket thật. X01 đo direct/bounded với 1/5/20 kết nối, warm-up 10 giây/đo 60 giây, ít nhất ba lần mỗi cấu hình; lưu raw CSV và phân loại lỗi, không suy ra hiệu năng từ số unit test.
