# X01.2 — Runner nhiều Client và Backend sẵn sàng cho pilot

**Hoàn thành X01.2 ngày 29/10/2026, giờ Việt Nam: READY_FOR_PILOT.** Đã xây công cụ, pin binary và kiểm thử khói Client–Server–PostgreSQL thật. Cập nhật tiếp: pilot tại [50](50-X01-PILOT-ACCEPTANCE.md), ma trận18 lượt và một sai lệch ranh được công bố tại [51](51-X01-BENCHMARK-RESULTS.md). Bản runner sau ma trận có final publish gate và regression riêng, không trộn vào dữ liệu gốc.

## 1. Công cụ đã có

| File | Trách nhiệm |
| --- | --- |
| `client/scripts/benchmark-stomp.mjs` | Tạo 2/5/20 kết nối STOMP độc lập, readiness trên mỗi kết nối, warm-up/đo/thu nốt, ghi raw CSV và summary |
| `client/scripts/lib/x01-benchmark.mjs` | Workload cố định, oracle LINES, progress, median/p95, cách tính cohort/throughput và CSV |
| `scripts/run_x01_benchmark.py` | Kiểm TEST/binary, build trong thư mục riêng, chạy/dừng đúng Java do wrapper tạo, health/readiness trước/sau và đối chiếu DB |
| `scripts/run_x01_benchmark.ps1` | Điểm chạy trên PowerShell; nhập mật khẩu ẩn nếu môi trường chưa có, khôi phục biến mật khẩu khi kết thúc |
| `scripts/sample_x01_process.ps1` | Lấy mẫu CPU/RAM/số OS thread của Java được tạo, khoảng một giây/mẫu |

Trong `client/package.json` có `npm run benchmark:stomp` và `npm run test:benchmark`. Wrapper là cách chạy chuẩn vì nó kiểm database và mode của tiến trình do chính nó khởi động. Runner Node trực tiếp chỉ nhận target cục bộ đã chốt; nhãn `--mode` của Node một mình không chứng minh cấu hình Server bên ngoài.

## 2. Backend và TEST đã pin

- Database: `huyenco_benchmark_test_20261029_010531`, V12, theo [biên bản 48](48-X01-TEST-DATABASE-BASELINE.md).
- Backend chỉ bind `127.0.0.1:18091`; WS `/ws`; Origin runner `http://127.0.0.1:3173`.
- Maven profile `database`, Spring profile `db`, Flyway tắt; Hikari pool 8 và `read-only=true` cho phép đo ẩn danh này.
- JDK `17.0.12`, dùng executable tuyệt đối trong `C:\Program Files\Java\jdk-17`, không đổi Java trên PATH của máy.
- JVM flags giống nhau: `-Xms256m -Xmx512m`; worker 4, queue 100, deadline 10 giây, TTL idempotency 60 giây/max 10.000. Hai mode chỉ đổi `huyenco.calculation-mode`.
- JAR SHA-256: `71a9d31d11adda8f50330398e87ccad6029fe7782b0a5b6239eaabf1bad0ab39`.
- Binary cục bộ: `scripts/generated/x01_backend_20261029_013243_326170/huyen-co-server.jar`; pointer `scripts/generated/x01_backend_target.json`.
- Build một lần trong `work/x01_build_20261029_013243_326170/`, có bản sao source/resource đã hash; không build đè `server/target` đang có. Bước package dùng `-DskipTests`; không coi đây là một lượt chạy Java regression mới.
- Runner trong lượt kiểm dùng Node `24.21.0`, STOMP.js `7.5.0`, `ws 8.22.0`, TypeScript `5.9.3`. Mỗi run lưu executable/hash/phiên bản và hash package-lock.

Trước mỗi run, wrapper xác nhận đúng tên TEST, JDBC/endpoint, toàn bộ snapshot X01.1 và runtime trống. Nếu nguồn Backend hoặc JAR/JDK/settings lệch pin thì dừng; không tự migrate/import hoặc thay baseline để bỏ qua lỗi.

Các Backend benchmark tạm đều đã dừng sau kiểm thử khói. Cổng 18091 sẽ được wrapper kiểm tra và khởi động lại khi chạy pilot. Backend/UI ở 18090/3173 không bị công cụ này dừng hoặc thay binary. Không cần mở UI để runner kết nối; Origin là header được Backend cho phép. Khi đo chính thức, giữ máy ổn định và tránh sinh tải UI khác trên cùng CPU/PostgreSQL.

## 3. Quy tắc runner

- Một kết nối là một Client, tối đa một request chưa terminal; mỗi request dùng UUID mới.
- Sau terminal, nghỉ tối thiểu 200 ms trước SEND tiếp, giữ khoảng nghỉ qua ranh warm-up/measurement. Không rút ngắn khoảng nghỉ để chen thêm SEND ở cuối cửa sổ đo.
- SUBSCRIBE trước SEND; mỗi kết nối phải nhận đủ bốn progress và kết quả đúng cho fixture readiness. Readiness không tính vào cohort đo.
- Workload LINES theo công thức/seed của tài liệu 47, không lời luận chi tiết, không cookie, không POST session/history.
- Không reconnect/resend tự động. Timeout Client 15 giây, thu nốt tối đa 15 giây sau cửa sổ; progress không gia hạn timeout.
- Kiểm hợp đồng bằng guard Client thật và oracle độc lập cho ba hình quẻ/mã quái/hào động, nguồn và thứ tự progress.
- Phát hiện frame không có request đã gửi, sai phiên, terminal lặp/đến muộn, progress sai hoặc kết quả sai thì lưu sự kiện và dừng lượt; không tính đó là thành công.

Ba chế độ chạy:

| Action | Warm-up | Cửa sổ đo | Mục đích |
| --- | ---: | ---: | --- |
| `Preflight` | 1 giây | 1 giây | Kiểm công cụ, kết nối và ranh pha; không phải kết quả benchmark |
| `Pilot` | 2 giây | 5 giây | X01.3, phát hiện vấn đề trước ma trận dài |
| `Measure` | 10 giây | 60 giây | Một ô/lần lặp trong ma trận 18 lượt X01.4 |

`Measure` buộc chọn đúng một số Client, một mode và repeat 1–3. Thứ tự các ô/lần lặp vẫn theo tài liệu 47; chạy một ô không tự đóng toàn ma trận.

## 4. Bằng chứng kiểm thử khói cuối

Đường dẫn: `scripts/generated/x01_preflight_20261029_014344_633372/runs.json`. Đây là bộ bằng chứng của bản runner cuối có kiểm khoảng nghỉ qua ranh pha và sampler tài nguyên; các thư mục preflight trước đó được giữ làm lịch sử phát triển công cụ.

| Client | Mode | Readiness + warm-up + đo: COMPLETED | Riêng cohort 1 giây | Kết quả |
| --- | --- | ---: | ---: | --- |
| 2 | direct | 22 | 10 | PASS |
| 2 | bounded | 22 | 10 | PASS |
| 5 | direct | 55 | 25 | PASS |
| 5 | bounded | 55 | 25 | PASS |
| 20 | direct | 220 | 100 | PASS |
| 20 | bounded | 220 | 100 | PASS |

Tổng **594 COMPLETED / 2.376 progress**: 54 request readiness, 270 warm-up và 270 request cohort ngắn. Không có sự kiện protocol, sai phiên/kết quả hoặc request lỗi được quan sát. Mỗi lượt đạt đủ peak 2/5/20 kết nối, HTTP upgrade 101 và một STOMP connection/Client. Các bộ đếm và raw CSV đã đối chiếu độc lập; SEND trong cohort đều nằm đúng cửa sổ, khoảng nghỉ từng Client qua warm-up/measurement đều tối thiểu 200 ms.

Health/readiness trước/sau đều đạt. Hash/count/schema của TEST giống baseline trước/sau cả sáu lượt; phiên/lịch sử vẫn trống. Sampler tài nguyên cả sáu lượt exit 0 và có dữ liệu. Mỗi Java/sampler tạm do wrapper tạo đã dừng.

**10 test Node và 3 test bảo vệ orchestrator Python đạt.** Có kiểm loại SERVER_BUSY/timeout khỏi latency thành công, giữ kết quả thu nốt ngoài throughput trong cửa sổ, số học percentile, tiến trình cuối cửa sổ, oracle/progress và chặn target ngoài TEST/Flyway bật/đường dẫn vượt artifact. Hai script PowerShell đã kiểm cú pháp và wrapper được dùng thật cho lượt cuối.

Không dùng latency/throughput từ các lượt một giây để kết luận bounded tốt hơn direct hoặc để điền Results của ma trận X01.4. Chưa chạy overload, idempotency, TTL/reconnect hoặc những kịch bản T01/T02 còn riêng.

## 5. Lệnh tiếp theo để chạy pilot

Chạy trong PowerShell từ repository root. Wrapper hỏi mật khẩu PostgreSQL ẩn nếu chưa có `PGPASSWORD`; không điền mật khẩu vào file.

Kiểm lại/reuse binary pin đã có, không cần build lại:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_x01_benchmark.ps1 -Action Prepare
```

Pilot 2 và 20 Client, cả hai mode, bốn lượt ngắn:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '& .\scripts\run_x01_benchmark.ps1 -Action Pilot -Clients 2,20 -Mode both'
```

Đây là lệnh X01.3, đã chạy sau X01.2 theo biên bản 50; có thể dùng để tái lập pilot. Có thể thêm 5 Client vào danh sách nếu cần pilot đủ ba mức. Mỗi mode được khởi động Backend mới từ cùng JAR.

Sau khi pilot đạt, ví dụ một ô chính thức (20 Client/bounded/lần 1):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_x01_benchmark.ps1 -Action Measure -Clients 20 -Mode bounded -Repeat 1
```

Nếu chủ động thay nguồn Backend, `-Action Prepare -Rebuild` tạo một build pin mới. Không trộn các binary khác hash vào cùng phép so sánh. Không cần tạo lại database để chỉ thay runner; mọi lượt vẫn phải khớp snapshot đã duyệt.

## 6. File đọc kết quả

Mỗi buổi tạo thư mục mới `scripts/generated/x01_<action>_<timestamp>/`, không ghi đè run cũ. Mỗi ô có:

- `runner/raw.csv`: từng request readiness/warm-up/measurement với thời điểm đơn điệu, status/category/lỗi, inputCase, số progress, correctness, validationMs và cờ kết quả đến sau cửa sổ.
- `runner/summary.json`: cấu hình, kết nối, cửa sổ, cohort, median/p95 và phân loại lỗi; `benchmarkResult=false` cho preflight/pilot.
- `runner/events.jsonl`: sự kiện bất thường; rỗng là không quan sát được sự kiện trong lượt đó.
- `runner/runner-resources.csv`: CPU user/system tích lũy và RSS/heap của Node; summary có histogram event loop delay (resolution 20 ms).
- `server-resources.csv`: tổng CPU seconds tích lũy, working set và số OS thread của Java theo mẫu khoảng một giây. OS thread không phải số Java managed thread qua JMX; không ghi giả số liệu thiếu.
- `environment.json`, `server.log`, `sampler.log`, `runner.log`: command/config không mật khẩu, binary/toolchain/hash, health/readiness, trạng thái dừng tiến trình và log.
- `database_before.json`, `database_after.json`: snapshot/hash đối chiếu DB.

Định nghĩa: SEND là `publish` trả về không ném lỗi, chưa phải xác nhận Server đã nhận; latency kết thúc tại lúc nhận terminal trước parse/validation; `validationMs` ghi riêng. Throughput chỉ đếm COMPLETED hợp lệ của cohort nhận trong cửa sổ. Kết quả thu nốt vẫn tham gia cohort success rate/latency, có cờ riêng. SERVER_BUSY/timeout/lỗi không tham gia percentile thành công. Phép đối soát sent chia thành completed/server_failed/client_failed/invalid_response; publish thất bại trước đó được đếm riêng.

File trạng thái X01.2: `scripts/generated/x01_ready_for_pilot.json`; X01.3 bổ sung `scripts/generated/x01_ready_for_matrix.json`. JAR, work snapshot, dump và raw/log được Git bỏ qua; không commit mật khẩu hoặc raw nhạy cảm. Tài liệu/mã công cụ có thể bàn giao. **Tiếp theo X01.4; toàn task X01 và số liệu chính thức chưa hoàn thành.**
