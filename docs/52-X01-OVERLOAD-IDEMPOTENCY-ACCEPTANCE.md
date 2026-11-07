# X01.5 — Nghiệm thu quá tải và idempotency

**Cập nhật sau X01.6:** bảng, năm biểu đồ PNG/SVG và phân tích ma trận hiệu năng đã hoàn thành tại [53](53-X01-BENCHMARK-ANALYSIS.md). Bước tiếp theo X01.7 là báo cáo nộp; artifact X01.5 dưới đây giữ nguyên.

**Ngày 29/10/2026, 10:34:46–10:35:59 (UTC+7): 7/7 tình huống PASS qua WebSocket/STOMP và PostgreSQL thật; auditor đối chiếu raw độc lập PASS.** Đây là kiểm độ tin cậy riêng, không bổ sung mẫu vào ma trận hiệu năng ở [biên bản 51](51-X01-BENCHMARK-RESULTS.md).

## 1. Môi trường và phạm vi

- Database: `huyenco_benchmark_test_20261029_010531`, PostgreSQL local `127.0.0.1:5432`, V1–V12; dùng manifest/baseline ở [48](48-X01-TEST-DATABASE-BASELINE.md).
- Backend: `http://127.0.0.1:18091`, WebSocket `ws://127.0.0.1:18091/ws`, Origin `http://127.0.0.1:3173`.
- Cùng JAR đã pin cho X01.4, SHA-256 `71a9d31d11adda8f50330398e87ccad6029fe7782b0a5b6239eaabf1bad0ab39`, JDK 17.0.12, heap `-Xms256m -Xmx512m`.
- Hai JVM riêng, chạy tuần tự: suite idempotency dùng `bounded`, **4 worker/queue 100**; suite overload dùng **2 worker/queue 4** theo kế hoạch 47. Các giới hạn khác giữ nguyên: deadline 10 giây, TTL 60 giây, registry 10.000, 1.024 phiên, 1.000 Run toàn Server, 16 Run/phiên.
- Mỗi suite có 20 kết nối thật, HTTP upgrade 101 và fixture LINES trước khi kiểm. Suite idempotency có thêm một kết nối mới khi reconnect. Client không dùng cookie, không tự reconnect hoặc tự retry; các lần gửi lại được kịch bản chỉ định và ghi vai trò rõ ràng.
- Backend giữ Flyway tắt và Hikari read-only. Không sửa Java, UI, dữ liệu nguồn hay artifact 18 lượt trước đó.

## 2. Kết quả từng tình huống

| Tình huống | Bằng chứng quan sát | Kết quả |
| --- | --- | --- |
| Gửi trùng khi đang xử lý và xung đột lúc in-flight | Quan sát JDBC bị chặn bởi khóa TEST trước và sau SEND lặp. Cùng ID/payload nhưng đảo key JSON và viết hoa UUID: chỉ một chuỗi 4 progress/một kết quả gốc. Payload khác trả đúng một `INVALID_INPUT`, công việc gốc vẫn hoàn thành. | PASS |
| Replay terminal và xung đột sau terminal | Hai lần replay trả nguyên terminal gốc, không progress mới. Xen giữa là payload khác cùng ID trả `INVALID_INPUT`; cache kết quả gốc vẫn giữ. | PASS |
| 20 phiên cùng ID, input khác nhau | 20 dãy hào khác nhau, mỗi phiên nhận đủ 4 progress và đúng ba quẻ theo input của mình; không sự kiện lẫn phiên. | PASS |
| Reconnect | Đóng WebSocket cũ, tạo WebSocket mới HTTP 101, chủ động gửi lại cùng ID/input; nhận 4 progress và kết quả tính mới. | PASS |
| Hết TTL mặc định | Giữ phiên ban đầu; gửi lại ID gốc sau **61,506 giây** tính từ lúc Client nhận terminal đầu. Nhận đủ 4 progress và một kết quả mới. Không rút ngắn TTL để kiểm. | PASS |
| Burst tự nhiên 20 × 8 | 160 ID mới, không khóa DB: **10 COMPLETED, 150 SERVER_BUSY**. Các việc bị từ chối không phát progress; gửi lại một ID bị từ chối và một ID mới đều tính thành công sau khi tải giảm. | PASS |
| Chạm giới hạn 2 worker + queue 4 có kiểm soát | 160 ID mới trong lúc hai worker chờ đọc DB: **6 việc được nhận, 154 SERVER_BUSY** trước khi mở khóa. Sau mở khóa, cả 6 hoàn thành; ID bị từ chối được gửi lại thành công, ID mới cũng thành công. | PASS |

Mọi kết quả LINES được kiểm theo sáu hào, hào động, công thức quẻ chủ/hỗ/biến, mã quẻ, trạng thái tên VERIFIED, hai rule `MH-MUTUAL`/`MH-CHANGE` và nguồn sách đúng hash/trang. Replay được so toàn bộ terminal, không chỉ so status.

## 3. Vì sao xác định được quá tải tại dispatcher?

Trong ca có kiểm soát, PostgreSQL ghi nhận **hai kết nối JDBC chờ khóa `public.hexagrams`** do phiên giao dịch thử nghiệm giữ. Client chưa nhận kết quả thành công nào khi 154 lỗi đã về. Khi mở khóa, đúng sáu công việc hoàn thành: hai đang chạy và bốn đang chờ phù hợp cấu hình worker/queue.

Các giới hạn còn lại không bị chạm: mỗi phiên chỉ gửi tám việc, dưới 16; tổng 160 dưới 1.000; số ID cả suite dưới 10.000; 20 phiên dưới 1.024. Server vẫn chạy và readiness sau burst là `READY`. Cấu hình thực và mã `CalculationDispatcher` đã pin xác định đường từ chối còn lại là `ThreadPoolExecutor`/`AbortPolicy`; không suy ra queue đầy chỉ từ một thông báo `SERVER_BUSY`.

Hai lượt gửi lại ID từng bị từ chối đều phát chuỗi progress mới và thành công. Điều này xác nhận lỗi quá tải không được cache thành terminal replay trong các ca đã kiểm.

## 4. Điều kiện giữ công việc ở trạng thái quan sát được

Nghiệp vụ LINES chạy nhanh, vì vậy ca in-flight và ca queue có kiểm soát dùng **fault injection tại database benchmark**: một kết nối `psql` riêng mở giao dịch, lấy `ACCESS EXCLUSIVE` trên `public.hexagrams`, rồi `ROLLBACK` để mở khóa. Không có câu lệnh sửa/xóa dữ liệu và không thêm sleep vào mã sản phẩm.

Controller kiểm tên database TEST, chỉ cho phép các thao tác giữ/quan sát/mở khóa đã định sẵn; không nhận SQL tùy ý từ runner. Giao dịch có `lock_timeout=1s`, `statement_timeout=3s`, `idle_in_transaction_session_timeout=4s` để tự giải phóng khi controller hỏng. Khoảng quan sát từ xác nhận giữ đến xác nhận mở khóa lần lượt khoảng **0,267 giây** và **0,154 giây**; đây không phải số đo chính xác thời gian chiếm khóa ở bên trong PostgreSQL.

Các điều kiện này được ghi riêng trong transcript. Không dùng độ trễ của ca giữ khóa để kết luận hiệu năng thông thường. Số lần thực thi bên trong JVM không được gắn bộ đếm mới; kết luận dedupe/tính mới dựa trên trạng thái JDBC quan sát được và các chuỗi progress/terminal thực qua giao thức.

## 5. Đối soát, an toàn và artifact

| Suite | SEND | Progress | Terminal COMPLETED | Lỗi dự kiến |
| --- | --- | --- | --- | --- |
| Idempotency | 50 | 176 | 46, gồm 2 replay | 2 INVALID_INPUT |
| Overload | 344 | 160 | 40 | 304 SERVER_BUSY |
| Tổng | 394 | 336 | 86 | 306 lỗi dự kiến |

Hai SEND lặp lúc in-flight dùng chung terminal gốc, vì vậy số SEND không bằng tổng terminal. `SERVER_BUSY`/`INVALID_INPUT` trong bảng là kết quả được yêu cầu ở các bài âm tính; không cộng vào lỗi của cohort hiệu năng X01.4.

Snapshot trước/sau cả hai suite khớp toàn bộ **16 bảng tri thức/migration và schema** với baseline; hai bảng `anonymous_sessions`/`interpretation_history` đều giữ 0 dòng. Knowledge SHA-256 giữ `115d9ced12f174341833dbe88ed5a15850a40f63e05a3922244bb6c2d77a01cc`; schema SHA-256 giữ `16bc7fcec71e6af200a9f2f80a33da0ac87dd48888b586500dd0361b8b25752a`. Toàn bộ khóa giao dịch đã giải phóng; hai Java thử nghiệm và các Node runner đã dừng.

Thư mục gốc: `scripts/generated/x01_reliability_20261029_103446_353616/`.

- `idempotency/` và `overload/`: `environment.json`, `database_before.json`, `database_after.json`, `server.log`, `gate_operations.json`, `control-transcript.jsonl`.
- Mỗi `runner/`: `events.jsonl` giữ SEND/RECEIVE/control theo thứ tự và thời gian đơn điệu; `records.json` giữ input từng phiên/ID; `summary.json` giữ từng case.
- `source_snapshot/` và `source_pins.json`: bản runner/controller thực sự chạy, chụp trước hai suite. `backend_manifest.json` giữ binary/config/nguồn Backend đã pin.
- `independent_audit.json`: **7/7 PASS**, đối soát raw thay vì chỉ tin cờ PASS của runner. Mã auditor được lưu riêng trong `analysis_source/` sau lượt chạy; không mô tả nó là mã đã chụp trước khi đo.
- `evidence_checksums.json`: hash artifact sau kiểm toán; checkpoint local `scripts/generated/x01_reliability_completed.json` trỏ tới kết quả đã kiểm.

Artifact sinh tự động được Git ignore; khi bàn giao báo cáo cần đóng gói bộ bằng chứng đã rà soát riêng. Không có mật khẩu, cookie hoặc CSRF trong artifact này. Bảy kiểm tra Python của công cụ đạt: ba bảo vệ TEST/cấu hình/khóa và bốn ca phát hiện dữ liệu kiểm toán bị hỏng. Không chạy lại toàn bộ Java/UI vì binary nghiệp vụ không thay đổi.

## 6. Chạy lại

Từ repo root, giữ trống cổng benchmark 18091 và dùng manifest TEST/JAR hiện có:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_x01_reliability.ps1
```

Script hỏi mật khẩu PostgreSQL bằng nhập ẩn, chỉ đưa vào môi trường tiến trình và khôi phục biến sau khi xong. Mỗi lượt tạo thư mục mới; không tự chạy lại khi thất bại. Script luôn lưu bằng chứng và dừng đúng tiến trình do nó tạo. Nếu manifest/source/JAR/baseline đã đổi hoặc cổng có tiến trình khác, cần kiểm lại nguyên nhân trước khi chạy.

Đối chiếu offline sau khi cả hai suite thành công, thay đường dẫn bằng thư mục lượt mới:

```powershell
python .\scripts\audit_x01_reliability.py --evidence .\scripts\generated\x01_reliability_20261029_103446_353616
python -m unittest discover -s scripts/tests -p 'test_x01_reliability_*.py'
```

`--suite idempotency` hoặc `--suite overload` trên wrapper chỉ chạy nhóm tương ứng; auditor nghiệm thu đầy đủ yêu cầu có cả hai suite trong cùng lượt mặc định.

## 7. Giới hạn và bước tiếp theo

Đây là các Client STOMP logic trên cùng máy qua loopback, chưa phải hai hoặc 20 máy vật lý. Đường nghiệp vụ trong suite là LINES; không thay nghiệm thu chức năng chi tiết mọi phương pháp hoặc UI. Ca TTL xác nhận hành vi sau mốc hết hạn có khoảng đệm, không đo sai số TTL đến từng mili giây. Chưa kiểm crash giữa phép tính, idempotency bền vững qua restart, registry đầy hoặc deadline/cancel qua STOMP trong suite này; test N01 trước đó có phạm vi riêng tại [36](36-N01-CONCURRENCY-IDEMPOTENCY-HANDOFF.md).

**X01.5 hoàn thành trong phạm vi mục 7 kế hoạch 47. Tiếp theo X01.6: tổng hợp chỉ số, biểu đồ và phân tích kết quả.** X01.4 vẫn giữ công bố một SEND ngoài ranh 0,022 ms trong bản đo gốc; X01.5 không xóa sai lệch đó hoặc đóng toàn task X01.
