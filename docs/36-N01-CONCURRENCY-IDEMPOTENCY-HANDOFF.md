# Huyền Cơ — Bàn giao N01: xử lý đồng thời, hàng đợi hữu hạn và idempotency

**Ngày kiểm: 25/10/2026 · Phạm vi: Server TV2 + TV3 · Trạng thái: triển khai và kiểm thử trọng tâm đạt.**

N01 bổ sung điều phối cho hai tuyến tính toán STOMP đang có. Kết quả nghiệp vụ, nguồn sách và các quyết định nhóm tiếp tục do service/registry hiện có quyết định. N01 không có migration hoặc yêu cầu nạp lại PostgreSQL. Cách chạy Backend và bootstrap dữ liệu nằm ở [tài liệu 35](35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md).

## 1. Mã nguồn và luồng xử lý

| Thành phần | Trách nhiệm |
| --- | --- |
| `CalculationController` | Parse JSON/UTF-8 nghiêm ngặt, lấy ID hợp lệ, chuyển yêu cầu cho dispatcher; giữ validator và cách ánh xạ lỗi nghiệp vụ. |
| `CalculationDispatcher` | Nhận việc nguyên tử theo session/ID, chống xử lý trùng, giới hạn registry và worker/queue, replay terminal và dọn việc khi mất kết nối. |
| `CalculationSessions` | Giới hạn phiên/Run, hẹn deadline khi nhận việc, phát progress/terminal theo session và báo dispatcher khi Run kết thúc. |

Luồng mặc định: STOMP → controller → kiểm registry/giới hạn → tạo Run và deadline → worker hoặc queue hữu hạn → service → terminal về session gốc → cache terminal.

Dispatcher dùng `ThreadPoolExecutor`, `ArrayBlockingQueue` và `AbortPolicy`. Khi hết chỗ, Server từ chối ngay bằng `SERVER_BUSY`; không chuyển phép tính sang luồng nhận STOMP để né giới hạn. Mọi thay đổi registry được đồng bộ bằng một khóa; việc tính toán thực hiện ngoài khóa này.

## 2. Cấu hình đã triển khai

Đặt biến môi trường trước khi khởi động Server; các giá trị nằm trong `server/src/main/resources/application.yml`.

| Biến môi trường | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `CALCULATION_MODE` | `bounded` | `bounded`: worker/queue hữu hạn; `direct`: chạy phép tính trên luồng gọi để so sánh X01. |
| `CALCULATION_WORKERS` | `4` | Số worker tối đa của dispatcher ở chế độ bounded. |
| `CALCULATION_QUEUE_CAPACITY` | `100` | Số việc tối đa đang chờ trong queue của dispatcher. |
| `PROCESSING_TIMEOUT_MS` | `10000` | Deadline của Run, tính từ lúc nhận việc, gồm thời gian chờ trong queue này. |
| `IDEMPOTENCY_TTL_SECONDS` | `60` | TTL tính từ terminal; phải từ 1 đến 86400 giây. |
| `IDEMPOTENCY_MAX_ENTRIES` | `10000` | Giới hạn toàn Server cho registry, gồm ID đang chạy và ID đã có terminal. |
| `MAX_CALCULATION_SESSIONS` | `1024` | Giới hạn session đang được theo dõi. |
| `MAX_ACTIVE_CALCULATIONS` | `1000` | Giới hạn Run chưa terminal trên toàn Server. |
| `MAX_ACTIVE_PER_SESSION` | `16` | Giới hạn Run chưa terminal của một session. |

Ví dụ PowerShell khi đã cấu hình DB theo tài liệu 35, chạy từ repo root:

```powershell
$env:CALCULATION_MODE = 'bounded'
$env:CALCULATION_WORKERS = '4'
$env:CALCULATION_QUEUE_CAPACITY = '100'
$env:IDEMPOTENCY_TTL_SECONDS = '60'
$env:IDEMPOTENCY_MAX_ENTRIES = '10000'
.\server\mvnw.cmd -f .\server\pom.xml -Pdatabase spring-boot:run '-Dspring-boot.run.profiles=db'
```

Với cấu hình mặc định, dispatcher có tối đa 4 phép tính đang chạy và 100 việc đang chờ. Giới hạn phiên, Run và registry vẫn áp dụng riêng; khi một giới hạn thấp hơn bị chạm, Server có thể từ chối trước khi queue đầy. Queue này không phải queue frame của WebSocket hoặc inbound channel Spring; deadline N01 bắt đầu sau parse/admission ở controller, không đo thời gian gói tin còn ở các tầng trước đó.

## 3. Quy tắc idempotency để TV1 tích hợp

Khóa là `(STOMP sessionId, requestId)`, UUID được chuẩn hóa không phân biệt chữ hoa/thường. Fingerprint gồm tuyến `MAI_HOA`/`TAM_THE` và toàn bộ JSON yêu cầu trừ trường `requestId`; đổi thứ tự key JSON không tạo yêu cầu mới. Thứ tự phần tử mảng vẫn có ý nghĩa.

| Trường hợp | Hành vi Server |
| --- | --- |
| ID mới, đủ chỗ | Nhận một Run/job. |
| Cùng session/ID và cùng nội dung, job đang chạy/chờ | Dùng chung job ban đầu; không tạo Run thứ hai, không phát thêm chuỗi progress hoặc terminal riêng cho SEND lặp. |
| Cùng session/ID và cùng nội dung, đã có terminal còn TTL | Replay terminal gốc, giữ ID/type/data/error; không tính hoặc phát lại progress. |
| Cùng session/ID nhưng khác nội dung hoặc tuyến | Trả `FAILED/INVALID_INPUT`; không sửa/xóa công việc gốc. |
| Cùng ID nhưng session khác | Hai công việc độc lập, chỉ trả về session tương ứng. |
| Queue, registry hoặc giới hạn Run đầy | Trả `FAILED/SERVER_BUSY`; không cache lỗi quá tải này. |
| ID hết TTL và worker cũ đã thực sự kết thúc | Có thể nhận và tính lại. |
| ID thiếu/sai UUID | Không tạo khóa idempotency; validator hiện có trả lỗi đầu vào. |

Registry không loại ID còn hiệu lực để lấy chỗ cho ID mới. Mục hết hạn được thu hồi khi nhận yêu cầu hoặc kiểm kích thước registry. ID có terminal timeout nhưng worker còn chạy vẫn được giữ khóa đến khi worker thực sự dừng để tránh tính trùng.

TV1 cần subscribe trước khi SEND:

- `/user/queue/progress`
- `/user/queue/results`
- `/user/queue/errors`

Hai đích SEND vẫn là `/app/mai-hoa/calculate` và `/app/tam-the/calculate`; envelope v1.2 giữ nguyên. Một lần người dùng muốn tính mới dùng UUID mới. Reconnect tạo session mới, không tự gửi lại yêu cầu cũ và không có bảo đảm replay qua kết nối mới. Hành vi này không thay chính sách owner/cookie và lưu lịch sử H01.

## 4. Deadline, mất kết nối và giới hạn bảo đảm

- Deadline chạy cả khi job đang chờ. Khi quá hạn, chỉ phát một terminal `PROCESSING_TIMEOUT`; progress/kết quả đến sau bị bỏ.
- Job chưa chạy bị hủy và gỡ khỏi queue nếu còn ở đó. Job đã chạy được yêu cầu interruption; JDBC/thư viện có thể không dừng ngay. Worker đang kẹt vẫn chiếm worker, không sinh thêm worker thay thế vượt cấu hình.
- Disconnect hủy các Run/timer, yêu cầu hủy job và xóa registry của session. Session khác không nhận thay kết quả. Kết quả kết thúc đúng lúc disconnect có thể đã được gửi tới session cũ trước khi xử lý sự kiện đóng; không chuyển sang session mới.
- Đây là cache trong bộ nhớ của **một tiến trình Server**. Restart mất cache; không cung cấp idempotency bền vững hoặc dùng chung nhiều instance. Fingerprint và terminal được giữ tạm trong RAM theo giới hạn/TTL; không ghi payload vào log hay database qua cơ chế N01.
- H01 có cache kết quả theo owner và thao tác lưu lịch sử riêng. Replay N01 không chạy lại service hoặc tạo thêm lần capture/lưu lịch sử. Giới hạn và TTL H01 không bị thay bởi N01.
- Các giới hạn trên bảo vệ dispatcher; không thay cho giới hạn payload, origin allowlist, kiểm SEND/SUBSCRIBE hoặc rate limit khi triển khai Internet.

## 5. Kiểm chứng và cách chạy lại

Chạy từ repo root bằng JDK 17 và Maven Wrapper. Bộ test đọc fixture tương đối từ thư mục `server`, vì vậy cần chuyển thư mục trước khi chạy. Cờ `-o` dùng cache Maven; bỏ cờ này khi máy cần tải dependencies lần đầu.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
Push-Location .\server
try {
    .\mvnw.cmd -o '-Dtest=CalculationDispatcherTest,CalculationFlowTest' test
} finally {
    Pop-Location
}
```

Kết quả chạy lại ngày 25/10: **11 test đạt, 0 failure, 0 error, 0 skipped; BUILD SUCCESS**. Báo cáo chi tiết tại `server/target/surefire-reports/com.huyenco.websocket.CalculationDispatcherTest.txt` và `com.huyenco.websocket.CalculationFlowTest.txt`.

| Nhóm | Số test | Phạm vi |
| --- | --- | --- |
| `CalculationDispatcherTest` | 5 | Dedupe khi đang chạy, JSON đảo thứ tự key, replay/TTL, xung đột payload; queue đầy và lấy lại chỗ sau disconnect; registry đầy không loại ID còn hiệu lực; timeout cả lúc chờ; 20 session cùng ID độc lập. |
| `CalculationFlowTest` | 6 | Progress có thứ tự và đúng session; JSON/UTF-8 lỗi; payload sai; một terminal sau timeout; mất kết nối và bỏ kết quả muộn; giới hạn phiên/Run và giải phóng chỗ. |

Các ca này dùng service/transport thử nghiệm có latch điều khiển thời điểm; không sleep trong mã nghiệp vụ sản phẩm. Test 20 session dùng worker thật trong JVM, chưa chứng minh 20 kết nối WebSocket thực tế hoặc throughput.

**Hồi quy Server đã chạy xong lúc 23:49 ngày 25/10:** Maven `BUILD SUCCESS`, tổng **485 test: 464 đạt, 21 skipped, 0 failure, 0 error**. Lượt này không bật profile/kết nối DB; 21 test cần PostgreSQL tự bỏ qua nên không phải bằng chứng kiểm DB sau N01. Các kết quả H01 có DB là mốc trước N01, được giữ riêng trong tài liệu 06/34.

Lượt mặc định trước đó dừng ở Mockito tự attach JVM trên Windows, có lỗi quyền truy cập pipe trong dumpstream. Chạy sẵn Mockito agent đã cho phép suite kết thúc. Lệnh đã kiểm, chạy từ repo root với dependency Mockito 5.17.0 đang được Maven dùng:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
$n01MockitoAgent = Join-Path $env:USERPROFILE '.m2\repository\org\mockito\mockito-core\5.17.0\mockito-core-5.17.0.jar'
if (-not (Test-Path -LiteralPath $n01MockitoAgent)) {
    throw 'Thieu Mockito agent; tai dependencies Maven va doi chieu dung phien ban truoc.'
}
$n01MockitoAgent = $n01MockitoAgent.Replace('\', '/')
Push-Location .\server
try {
    .\mvnw.cmd -o "-DargLine=-javaagent:$n01MockitoAgent" '-DforkedProcessTimeoutInSeconds=90' test
} finally {
    Pop-Location
}
```

Agent chỉ dùng trong JVM chạy test, không phải tham số khởi động Server sản phẩm. Khi nâng dependency Mockito, đổi đường dẫn theo phiên bản Maven thực tế. Chưa chạy STOMP/DB live hoặc benchmark N01 trong đợt này; đây là các mục T01/X01 bên dưới.

## 6. Việc tiếp theo đúng kế hoạch dự án

1. **T01:** chạy Server và PostgreSQL test theo tài liệu 35; dùng fixture LINES/OBJECT_COUNT thật, kiểm progress/terminal theo session và ID. Gửi trùng trước/sau terminal, đổi payload cùng ID, thử hết TTL, reconnect và overload bằng cấu hình nhỏ. Ghi log/bằng chứng và lỗi riêng, không làm chậm giả service của bản sản phẩm để tạo số đo.
2. **I01 — TV1:** tích hợp và nghiệm thu màn hình; giữ xử lý replay không có progress, hiển thị `SERVER_BUSY`, timeout và lỗi xung đột; bootstrap cookie H01 trước WS khi dùng lịch sử.
3. **X01:** so `CALCULATION_MODE=direct` và `bounded` trên cùng tuyến LINES thật, cùng DB/input/máy. 1/5/20 kết nối, warm-up 10 giây, đo 60 giây, ít nhất 3 lần; lưu raw CSV, median/p95/throughput/lỗi/sai phiên. Dùng ID mới cho workload thường; tách bài dedupe riêng.

N01 hoàn thành cơ chế Server và test trọng tâm. T01/I01/X01 chỉ được đánh dấu đạt khi có bằng chứng tương ứng; số test unit không thay cho nghiệm thu mạng, UI hoặc thực nghiệm.
