# X01 — Kế hoạch nghiệm thu benchmark 2/5/20 Client

Ngày lập/cập nhật: 29/10/2026. Phụ trách: TV2 và TV3. Trạng thái: **đủ 18 lượt X01.4 với sai lệch ranh 0,022 ms được công bố; X01.5/X01.6/X01.7 hoàn thành trong phạm vi**. Database/snapshot tại [48](48-X01-TEST-DATABASE-BASELINE.md); công cụ tại [49](49-X01-RUNNER-BACKEND-HANDOFF.md); pilot tại [50](50-X01-PILOT-ACCEPTANCE.md); kết quả và điều kiện chất lượng tại [51](51-X01-BENCHMARK-RESULTS.md); tin cậy tại [52](52-X01-OVERLOAD-IDEMPOTENCY-ACCEPTANCE.md); phân tích tại [53](53-X01-BENCHMARK-ANALYSIS.md); báo cáo nhóm12 tại [54](54-X01-REPORT-HANDOFF.md). Chưa chạy Compilatio/nộp bài, không gọi strict-window raw gốc đạt tuyệt đối.

Tài liệu này chốt cách thực hiện theo yêu cầu mới của chủ dự án: **2, 5 và 20 Client**. Các tài liệu 06/08/15/36 trước đây ghi 1/5/20; mức 1 Client có thể đo bổ sung để đối chiếu lịch sử, nhưng không thay bất kỳ mức 2/5/20 nào bên dưới. Không coi các lượt smoke hoặc số unit test đã có là kết quả benchmark.

## 1. Mục tiêu và phạm vi

- Đo khả năng phục vụ nhiều kết nối STOMP thật của Backend và PostgreSQL TEST.
- So `CALCULATION_MODE=direct` với `CALCULATION_MODE=bounded` trên cùng mã nguồn, dữ liệu, input và môi trường; chỉ thay chế độ điều phối.
- Đo latency, thông lượng, tỷ lệ thành công/lỗi, progress và tính đúng của kết quả/định tuyến phiên.
- Kiểm hàng đợi đầy và idempotency bằng các bài riêng; không trộn phản hồi replay hoặc từ chối nhanh vào latency của phép tính thành công.

Một Client trong phép đo là **một kết nối WebSocket/STOMP độc lập**, có map request riêng. Runner Node.js tạo đủ 2/5/20 kết nối; không cần 20 máy hoặc mở 20 tab trình duyệt. Phép đo này đánh giá tuyến STOMP–Server–PostgreSQL, không đo thời gian render Next.js hay trải nghiệm 20 người thao tác trên UI.

`direct` chạy công việc trên luồng gọi dispatcher của Spring; nó vẫn có thể xử lý nhiều phiên đồng thời, không được mô tả là Server chỉ có một luồng. Cả hai chế độ vẫn giữ cơ chế idempotency N01. X01 so riêng điều phối, không chứng minh lợi ích idempotency bằng chênh lệch direct/bounded.

## 2. Môi trường cố định

### 2.1. Database và tiến trình

1. X01.1 đã tạo và kiểm toán database riêng `huyenco_benchmark_test_20261029_010531`; dùng target manifest cục bộ `scripts/generated/x01_benchmark_target.json` theo [biên bản 48](48-X01-TEST-DATABASE-BASELINE.md). [Tài liệu 46](46-DEMO-CLIENT-SERVER-POSTGRES-TEST.md) tiếp tục dành cho TEST demo/UI. Xác nhận tên database thực tế trước khi chạy; không mặc định rằng cấu hình của terminal cũ còn đúng.
2. Chốt snapshot dữ liệu đầu buổi. Không migrate/import trong lúc đo; đặt `SPRING_FLYWAY_ENABLED=false`.
3. Dùng request LINES không cookie, không gọi `/session`, không lưu/xóa history. Runner tự kết nối STOMP với Origin cho phép. Không tái sử dụng cookie của trình duyệt vừa sửa lỗi phiên.
4. Chạy tuần tự một Backend dành cho benchmark tại `127.0.0.1:18091`, theo target manifest đã chốt, không dùng chung tiến trình với người đang nghiệm thu UI. Cổng 18090 hiện phục vụ UI; chỉ dừng tiến trình benchmark do buổi đo tạo. Dù tách cổng/database, không chạy workload UI đồng thời khi thu số liệu chính thức trên cùng máy.
5. Build một lần, dùng cùng JAR/profile `db` và JVM flags cho cả hai mode. Ghi SHA-256 JAR, commit và bản diff của mã đang dùng; commit đơn lẻ không đủ nếu working tree có thay đổi.
6. Ghi health/readiness trước và sau mỗi lượt. Cần `UP`/`READY` và fixture LINES thành công; readiness một mình chưa chứng minh kết quả nghiệp vụ đúng.

### 2.2. Vị trí máy

Lượt chính có thể chạy runner và Backend/DB trên cùng máy qua loopback để giảm biến động mạng. Khi đó phải ghi rõ kết quả có chia sẻ CPU/RAM với bộ sinh tải.

Nếu nhóm chọn runner trên máy TV1 và Backend/DB trên máy TV2, chạy toàn bộ ma trận trên cùng hai máy/mạng. Cấu hình LAN và firewall theo mục 9 tài liệu 46; chỉ mở Backend cho máy TV1, giữ PostgreSQL ở máy Server. Không gộp số liệu loopback và LAN trong một bảng so sánh.

### 2.3. Cấu hình chốt cho lượt chính

| Tham số | Giá trị |
| --- | --- |
| `CALCULATION_MODE` | `direct` hoặc `bounded` theo ô đo |
| `CALCULATION_WORKERS` | `4` |
| `CALCULATION_QUEUE_CAPACITY` | `100` |
| `PROCESSING_TIMEOUT_MS` | `10000` |
| `IDEMPOTENCY_TTL_SECONDS` | `60` |
| `IDEMPOTENCY_MAX_ENTRIES` | `10000` |
| `MAX_CALCULATION_SESSIONS` | `1024` |
| `MAX_ACTIVE_CALCULATIONS` | `1000` |
| `MAX_ACTIVE_PER_SESSION` | `16` |
| Hikari `maximum-pool-size` | `8`, theo cấu hình hiện tại |
| Origin runner | `http://127.0.0.1:3173`, phải nằm trong `ALLOWED_ORIGINS` |
| Reconnect / resend tự động | Tắt |

Giữ nguyên giới hạn thông điệp/buffer và inbound/outbound channel của Spring ở cả hai mode. Bốn worker và queue 100 chỉ tạo dispatcher hữu hạn trong `bounded`; không đồng nghĩa toàn ứng dụng hoặc mọi hàng đợi Spring đều bị giới hạn như vậy.

## 3. Workload chính

Chọn **Mai Hoa `LINES`, không bật `payload.reading`**, vì đã có tuyến tính toán thật, fixture và oracle kiểm quẻ chủ/hỗ/biến. TIME, OBJECT_COUNT, Tam Thế, lời luận chi tiết, REST và history tiếp tục có nghiệm thu chức năng riêng; không suy rộng số đo LINES sang mọi chức năng.

Mẫu request tham chiếu:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "type": "MAI_HOA",
  "payload": {
    "method": "LINES",
    "linesBottomUp": [true, false, true, false, true, false],
    "movingLine": 2
  }
}
```

UUID trong ví dụ chỉ để minh họa; lượt đo tạo **UUID mới cho từng request**, không dùng lại để nhận cache replay.

Quy tắc sinh tải:

- Tạo đủ N kết nối, subscribe progress/results/errors và chờ đăng ký hoàn tất trước warm-up. Dùng STOMP receipt nếu được hỗ trợ; nếu không, chạy request sẵn sàng ngoài cửa sổ đo trên từng kết nối và xác nhận đủ progress/kết quả.
- Mỗi kết nối có tối đa **một request chưa terminal**. Sau terminal, nghỉ **200 ms** rồi mới gửi tiếp; không có sleep trong Server hoặc nghiệp vụ.
- Đây là tải vòng kín có khoảng nghỉ: thông lượng quan sát phản ánh cấu hình tải này, không được gọi là thông lượng cực đại của hệ thống. N kết nối là số Client đồng thời, không phải số request/giây.
- Với `clientIndex` từ 0 và `sequence` từ 0, dùng `pattern=(17*clientIndex+sequence)%64`, `movingLine=1+((clientIndex+sequence)%6)`; sáu bit từ thấp lên cao là sáu hào. Lưu thuật toán/seed và từng input thực tế để tái lập. Dùng cùng chuỗi cho hai mode; số input thực hiện có thể khác do tốc độ phản hồi khác nhau.
- Khoảng nghỉ giới hạn 20 Client ở tối đa khoảng 100 SEND/giây; 70 giây warm-up+đo tương ứng tối đa khoảng 7.000 khóa mới, dưới registry 10.000 của một lượt độc lập. Đây là lý do giữ khoảng nghỉ trong lượt chính. Không chạy thêm workload khác trên cùng Backend.
- Giữ cùng kết nối qua warm-up và đo, nhưng chờ request warm-up kết thúc rồi mới bắt đầu mốc đo chung. Thời gian chờ này không thuộc 60 giây đo.

Ở lượt chính, tối đa 20 request chưa hoàn tất nên chưa đủ để chứng minh queue 100 đầy. Bài quá tải ở mục 7 xử lý riêng điều đó.

## 4. Ma trận 18 lượt đo

Mỗi lượt: khởi động Backend benchmark mới, kiểm sẵn sàng, kết nối N Client, **warm-up 10 giây**, đo **60 giây**, ngừng SEND mới, thu các request còn chờ trong tối đa **15 giây**, lưu bằng chứng rồi đóng kết nối/dừng Backend của lượt đó. Kiểm CPU/RAM trở lại mức ổn định trước lượt sau.

| Số Client | Direct | Bounded | Tổng |
| --- | --- | --- | --- |
| 2 | 3 lượt | 3 lượt | 6 |
| 5 | 3 lượt | 3 lượt | 6 |
| 20 | 3 lượt | 3 lượt | 6 |
| **Tổng** | **9** | **9** | **18** |

Thứ tự chốt để giảm ảnh hưởng luôn chạy một mode trước:

| Vòng lặp | Thứ tự |
| --- | --- |
| 1 | 2 direct → 2 bounded → 5 bounded → 5 direct → 20 direct → 20 bounded |
| 2 | 20 bounded → 20 direct → 5 direct → 5 bounded → 2 bounded → 2 direct |
| 3 | 5 bounded → 5 direct → 2 direct → 2 bounded → 20 bounded → 20 direct |

Warm-up và cửa sổ đo thuần của 18 lượt là **21 phút**. Cần thêm thời gian build, pilot, khởi động/thu nốt, các bài tin cậy và phân tích; dự kiến chuẩn bị khoảng **1–2 giờ làm việc**, không xem đây là cam kết thời gian chạy.

## 5. Cách đo và kiểm tính đúng

### 5.1. Mốc thời gian

- Dùng đồng hồ đơn điệu tại runner, như `performance.now()`, cho cả SEND và terminal. Không lấy hiệu giữa đồng hồ hai máy.
- `latencyMs = terminalReceivedMonoMs - sendMonoMs`; lưu riêng thời gian xác thực payload tại runner để nhận biết bộ sinh tải có bị chậm.
- Thu mọi request bắt đầu trong cửa sổ 60 giây thành một cohort. Kết quả đến trong thời gian thu nốt vẫn thuộc cohort, gắn cờ đã đến sau cửa sổ.
- Không gửi request mới trong thời gian thu nốt, không gia hạn timeout mỗi khi có progress. Request vẫn chưa terminal sau 15 giây được ghi `CLIENT_TIMEOUT`; không tự gửi lại.
- Ghi riêng thời gian HTTP upgrade/STOMP CONNECTED, không trộn vào latency request đã kết nối.

### 5.2. Chỉ số phải có

| Chỉ số | Cách ghi |
| --- | --- |
| Offered/sent rate | Số SEND mới trong cửa sổ / 60 giây |
| Throughput thành công | Số request gửi và hoàn tất hợp lệ trong cửa sổ / 60 giây; không tính kết quả thu nốt |
| Cohort success rate | Tổng request cohort hoàn tất hợp lệ, kể cả thu nốt / tổng SEND cohort |
| Median/p95 latency | Chỉ tính trên COMPLETED hợp lệ trong cohort; p95 dùng nearest-rank, ghi cả sample count |
| Lỗi | Đếm riêng `SERVER_BUSY`, `PROCESSING_TIMEOUT`, `CLIENT_TIMEOUT`, lỗi DB/nguồn/validation, transport và protocol |
| Độ đúng | `wrongSession`, sai/không biết requestId, terminal lặp, kết quả sai, progress sai thứ tự hoặc đến sau terminal |
| Môi trường | CPU, RAM, số thread JVM và tải runner theo mẫu 1 giây nếu công cụ hỗ trợ; ghi phương pháp lấy mẫu |

Không cộng `SERVER_BUSY` vào COMPLETED hoặc dùng thời gian từ chối nhanh để làm đẹp median/p95. Không bỏ timeout khỏi bảng tổng lỗi. Mỗi run cần đối soát `sent = validCompleted + serverFailed + clientFailed + invalidResponse`; timeout/chưa giải quyết hết khi thu nốt thuộc clientFailed. Publish thất bại trước khi được ghi nhận SEND được đếm riêng. Frame lạ/lặp ghi sự kiện riêng, không tăng số terminal hợp lệ.

Kiểm từng COMPLETED: đúng kết nối sở hữu/requestId/type, đúng mảng hào chủ, quẻ hỗ lấy hào 2–4 và 3–5, quẻ biến chỉ đảo hào động; metadata/hợp đồng đúng phạm vi LINES. Progress hợp lệ phải có sequence 1–4 với ACCEPTED/VALIDATING/CALCULATING/LOOKUP. Không bắt lỗi `SERVER_BUSY` phải có đủ bốn bước.

Không được gán mọi `SERVER_BUSY` cho queue: registry và giới hạn Run cũng có thể từ chối. Mã hiện tại chưa cung cấp telemetry phân biệt đầy đủ các nguyên nhân qua response; nếu không quan sát được phải ghi nguyên nhân chưa phân loại.

### 5.3. Bằng chứng và tổng hợp

Runner ghi `raw.csv` với tối thiểu: runId, mode, clients, repeat, clientId, requestId, inputCase, phase, sendMonoMs, terminalMonoMs, latencyMs, status, errorCode, progressCount, correct, terminalAfterWindow. Sự kiện không có terminal nằm trong `events.jsonl`; thông số/môi trường/JAR/DB/version trong `environment.json`.

Ghi từng run và tổng hợp ba run cho mỗi ô. Trình bày median và khoảng min–max của throughput/p95 từng run; giữ cả ba giá trị gốc. Nếu gộp percentile từ raw, ghi rõ đây là percentile của cohort gộp, không phải trung bình cộng ba p95. Kết quả không tốt hơn baseline vẫn phải báo đúng.

## 6. Trình tự task và phân công

| Task | Người phụ trách | Công việc và đầu ra | Điều kiện xong |
| --- | --- | --- | --- |
| X01.1 | TV3, chủ dự án hiện đảm nhiệm | **DONE**: TEST riêng V12, snapshot/manifest/count/hash; audit nền 54 PASS/0 FAIL/0 PENDING và V12 PASS; xem biên bản 48 | Xác nhận đúng TEST, không migrate/import trong đo |
| X01.2 | TV2 | **DONE**: runner Node STOMP, summary/CSV, wrapper, JDK17/JAR pin; kiểm thử khói 2/5/20 cả hai mode đạt. Tổng hợp biểu đồ/liên run còn X01.6 | Tạo 2/5/20 kết nối thật, ghi đúng cohort/timestamps/lỗi, không cookie/retry tự động; biên bản 49 |
| X01.3 | TV2 + TV3 | **DONE**: bốn pilot 2/20 direct/bounded, warm-up2giây/đo5giây; 1.012 cohort, 1.496 COMPLETED/5.984 progress toàn lượt; audit độc lập đạt, DB không đổi; biên bản 50 | Không sai phiên/kết quả; không thấy CPU runner bão hòa trong mẫu; đủ điều kiện X01.4 |
| X01.4 | TV2 | **Đã chạy đủ 18 lượt**: cohort46.027 COMPLETED/0 lỗi; raw/audit giữ nguyên, công bố1SEND ngoài ranh0,022ms, sửa publish gate và hồi quy riêng; xem51 | Có18 bộ bằng chứng; cohort đạt sau đối chiếu, ràng buộc strict-window ở bản đo gốc có1sai lệch |
| X01.5 | TV2 | **DONE, 7/7 PASS**: in-flight/replay/xung đột/20 phiên/TTL60giây/reconnect, burst20×8 và queue2/4 có kiểm soát; raw/auditor/DB đối chiếu đạt; biên bản52 | Có bằng chứng từng hành vi, DB không đổi, khóa/tiến trình thử đã dọn; tách khỏi ma trận hiệu năng |
| X01.6 | TV3 + TV2 | **DONE**: đối soát TEST chỉ đọc khớp baseline; CSV18lượt/sáu ô, median/P95/P99/throughput và tài nguyên; năm hình PNG/SVG, phân tích tại53 | Hash đầu vào giữ nguyên, chỉ số tái tính được, hình đã kiểm trực quan; công bố cả P99 xấu hơn và giới hạn nguồn mẫu |
| X01.7 | TV2 + TV3; TV1 hỗ trợ khi cần | **DONE**: Word nhóm12 19trang, đủ ba tác giả/MSSV, Setup/Results/Discussion, bảng18lượt/năm biểu đồ, gói bằng chứng và cập nhật test plan; xem54 | Đã đối chiếu CSV/nguồn, kiểm dàn trang19/19, giữ window deviation và giới hạn; Compilatio/nộp thật còn riêng |

Không cần chờ TV1 viết thêm UI. Nếu chạy hai máy, TV1 có thể chạy runner ở máy họ; chủ dự án vẫn có thể tự thực hiện cả TV2/TV3 và runner trên máy hiện tại.

## 7. Bài tin cậy/quá tải riêng

### 7.1. Idempotency và định tuyến

- Cùng session/ID/cùng payload khi còn chạy: một chuỗi xử lý và một terminal gốc; ghi thời điểm gửi để chứng minh thực sự còn in-flight. Nếu job xong quá nhanh, không coi hai terminal do replay hợp lệ là lỗi dedupe.
- Cùng session/ID/cùng payload sau terminal, trong TTL: replay terminal, không progress mới. Đây là độ trễ replay, không đưa vào latency tính mới.
- Cùng session/ID/khác payload: `INVALID_INPUT`; kết quả gốc không bị thay.
- Hai session cùng ID nhưng input khác: mỗi session nhận kết quả đúng input của mình, không lẫn phiên. Chạy ngoài workload UUID mới ở mục 3.
- Sau TTL: nếu worker gốc đã kết thúc, có thể tính mới và có progress mới; kiểm bằng ID cũ, không suy ra chỉ từ nội dung terminal giống nhau.
- Reconnect: session STOMP mới, không tự replay cache phiên cũ; gửi chủ động rồi kiểm chuỗi xử lý mới.

Các ca in-flight/TTL/reconnect cần trạng thái quan sát được và log theo thời gian. Nếu không đủ bằng chứng xác định trạng thái, ghi PENDING thay vì khẳng định đạt bằng unit test cũ.

### 7.2. Hàng đợi đầy

Sau lượt chính, restart Backend benchmark riêng ở `bounded`, workers **2**, queue **4**; giữ các giới hạn khác và ghi rõ đây là cấu hình stress. Dùng 20 kết nối, mỗi kết nối cho phép burst tối đa 8 request chưa hoàn tất, ID mới; tổng tối đa 160 Run, dưới giới hạn toàn Server 1000 và mỗi phiên 16.

Mục tiêu: quan sát được `SERVER_BUSY` có kiểm soát, không crash/treo, không nhận lẫn phiên và phục hồi để xử lý request mới sau burst. Nếu dịch vụ chạy quá nhanh khiến queue chưa đầy, ghi chưa kích hoạt được tình huống; hiệu chỉnh burst trong giới hạn và lưu phiên bản kịch bản, không tự thêm sleep vào mã sản phẩm để tạo kết quả.

Cấu hình stress không được trộn vào bảng direct/bounded mặc định. Chỉ nói “đã kiểm queue đầy” khi có bằng chứng giới hạn dispatcher bị chạm; chỉ một response `SERVER_BUSY` chưa đủ loại trừ các giới hạn khác. Độ trễ giả lập, nếu cần cho thử nghiệm riêng, phải được mô tả tách biệt với nghiệp vụ thật.

## 8. Artifact dự kiến và tiêu chí nghiệm thu

Trạng thái artifact sau X01.2; hướng dẫn thực thi ở biên bản 49:

- `client/scripts/benchmark-stomp.mjs`: đã có sinh tải, oracle, raw, sự kiện và summary từng run.
- `scripts/run_x01_benchmark.ps1` / `.py`: đã có kiểm TEST, build pin, chạy tuần tự Backend/runner, giữ log, dừng đúng tiến trình đã tạo.
- `scripts/summarize_x01_benchmark.py`: **đã triển khai X01.6**, gọi lại auditor, tổng hợp18 lượt/sáu ô, xuất CSV/PNG/SVG và thảo luận; xem [53](53-X01-BENCHMARK-ANALYSIS.md).
- `scripts/generated/x01_<action>_<timestamp>/`: artifact gốc theo buổi và run, đã được ignore. Chỉ đưa bản đã rà soát vào Git, không chứa mật khẩu/cookie/CSRF hoặc dữ liệu cá nhân.
- `docs/51-X01-BENCHMARK-RESULTS.md`: đã có số liệu18 lượt, cohort correction và giới hạn chất lượng. Tài liệu48 là baseline DB,49 là bàn giao công cụ/preflight và50 là pilot.

X01 được hoàn tất khi có đủ 18 lượt hợp lệ và raw tính lại được; mọi sai phiên/kết quả/terminal/progress được điều tra, xử lý hoặc ghi rõ thất bại; các bài tin cậy có trạng thái và bằng chứng riêng; báo cáo thể hiện cả lỗi và giới hạn. Mục tiêu cho tải chính là không lỗi/sai phiên, nhưng kết luận hiệu năng không phụ thuộc việc `bounded` bắt buộc phải nhanh hơn `direct`.

Nếu có bất kỳ sai phiên, lộ dữ liệu, kết quả sai hoặc crash: dừng chạy tiếp ma trận, lưu lượt lỗi, sửa nguyên nhân và chạy lại các cấu hình bị ảnh hưởng. Không bỏ lượt xấu khỏi báo cáo mà không ghi lý do. Kết quả số học đúng nhưng thiếu kiểm T01/T02 khác không đồng nghĩa toàn dự án đã nghiệm thu đầy đủ.

**X01.5 và X01.6 đã hoàn thành ngày29/10:** độ tin cậy ở [52](52-X01-OVERLOAD-IDEMPOTENCY-ACCEPTANCE.md), bảng/biểu đồ/phân tích ở [53](53-X01-BENCHMARK-ANALYSIS.md). **Bước tiếp theo X01.7: đưa Experimental Setup/Results/Discussion và bằng chứng vào báo cáo nộp.** X01.4 có18 lượt và cohort timestamp theo biên bản51, kèm1window deviation; nếu yêu cầu strict-window tuyệt đối cần ma trận mới với runner đã sửa. Toàn task X01 chưa đóng.
