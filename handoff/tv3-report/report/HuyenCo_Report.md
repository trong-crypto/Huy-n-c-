# HUYỀN CƠ

Ứng dụng tra cứu tri thức qua mạng
với điều phối hữu hạn và truy vết nguồn

Nhóm 12 · Đào Viết Trọng — B23DCCN846
Doãn Duy Linh — B23DCCN482
Bùi Ngọc Mạnh — B23DCCN526

Bài tập lớn Lập trình mạng · Năm học 2026–2027 · Ngày 29 tháng 10 năm 2026

### Tóm tắt

Huyền Cơ là ứng dụng Client–Server tra cứu tri thức Mai Hoa Dịch Số và Diễn Cầm Tam Thế. Bài toán kỹ thuật là tiếp nhận nhiều yêu cầu tính toán qua mạng, trả tiến trình đúng phiên, kiểm soát công việc trùng và quá tải, đồng thời bảo toàn căn cứ của dữ liệu số hóa. Hệ thống sử dụng Next.js, Spring Boot, STOMP trên WebSocket và PostgreSQL; Server chịu trách nhiệm tính toán và kiểm chính sách nguồn. Đóng góp triển khai gồm dispatcher với worker/hàng đợi hữu hạn, registry idempotency theo phiên và kết quả có provenance. Thực nghiệm trên cùng máy sử dụng 2/5/20 Client, hai chế độ direct/bounded và ba lần lặp, tạo 18 lượt đo. Cohort theo timestamp có 46.027 yêu cầu thành công, không lỗi ở mức tải đã chọn. Với 20 Client, median độ trễ của bounded là 5,51 ms so với 6,47 ms của direct, nhưng median P99 cao hơn, 36,41 ms so với 22,90 ms. Kiểm độ tin cậy riêng đạt bảy tình huống; stress 2 worker/queue 4 thể hiện từ chối có kiểm soát và phục hồi. Một SEND muộn 0,022 ms được công bố; số đo không được diễn giải thành công suất cực đại hay ưu thế trên mọi mức tải. [5–7]

Từ khóa: Client–Server; WebSocket; STOMP; hàng đợi hữu hạn; idempotency; truy vết nguồn.

## 1 Giới thiệu

Một ứng dụng tra cứu tri thức có thể trả kết quả đúng ở một phiên nhưng vẫn thất bại khi nhiều Client gửi đồng thời, gửi lặp hoặc rời kết nối. Vì vậy mục tiêu của Huyền Cơ gồm cả nghiệp vụ lẫn thiết kế giao tiếp: request phải được kiểm tra, tiến trình được tương quan bằng requestId, kết quả trả đúng socket và giới hạn tài nguyên có hành vi rõ ràng. Nguồn sách còn có chỗ mờ hoặc khác cách áp dụng, nên hệ thống phải phân biệt nội dung đã đối chiếu với quy ước nhóm. [8–10]

Báo cáo trình bày kiến trúc, protocol, thuật toán ở phạm vi đã triển khai và bằng chứng thực nghiệm. Trọng tâm đánh giá là lát cắt LINES trên dữ liệu TEST cố định; các chức năng TIME, OBJECT_COUNT, Tam Thế, lịch và lịch sử được mô tả theo module và biên bản nghiệm thu tương ứng. Nội dung văn hóa truyền thống được trình bày có nguồn và giới hạn, không coi là dự đoán khoa học.

## 2 Cơ sở kỹ thuật và cách tiếp cận liên quan

WebSocket cung cấp kênh giao tiếp hai chiều sau opening handshake trên TCP. STOMP bổ sung frame với lệnh, header và body; Client sử dụng SEND và SUBSCRIBE để gửi yêu cầu, nhận thông điệp theo destination. Trong Spring, handler ứng dụng và broker nội bộ đảm nhiệm các phần định tuyến khác nhau. Các chuẩn này cung cấp cơ chế vận chuyển; hợp đồng nghiệp vụ và nghĩa của các queue vẫn do ứng dụng định nghĩa. [1–3]

Ở lớp thực thi, ThreadPoolExecutor cho phép đặt số luồng, hàng đợi và chính sách khi không nhận thêm công việc. Nhóm dùng fixed-size pool, ArrayBlockingQueue và AbortPolicy. Đây là áp dụng cơ chế thư viện để giới hạn việc tính toán, không phải thuật toán thread pool mới. Baseline direct thực hiện phép tính trên luồng gọi dispatcher của Spring; direct vẫn có thể phục vụ nhiều Client đồng thời. [4,8]

Hai mode chia sẻ thuật toán, cơ chế xác thực input, registry idempotency và dữ liệu nguồn. So sánh này chỉ thay điều phối; không so một baseline trả lỗi hoặc tính khác nghiệp vụ với một bản trả kết quả đầy đủ. Báo cáo không có thí nghiệm đối đầu với sản phẩm thương mại hoặc khảo sát đầy đủ công trình học thuật tương tự, nên không khẳng định tính mới ở cấp độ nghiên cứu thế giới.

## 3 Định nghĩa bài toán

Bảng 1. Đầu vào và đầu ra theo nhóm chức năng

| Nhóm | Đầu vào | Đầu ra |
| --- | --- | --- |
| Mai Hoa | LINES hoặc số vật/giờ Chi hoặc thời điểm | Quẻ chủ/hỗ/biến, hào động, bước tính; lời luận khi chọn reading |
| Tam Thế | Ngày/giờ sinh, loại lịch, tháng nhuận, category | Các mục luận có nguồn; trạng thái không khớp nguồn được giữ rõ |
| Tra cứu và lịch | Tên/mã quẻ; ngày và loại lịch | Thông tin quẻ hoặc lịch chuyển đổi/Can Chi |
| Lịch sử | Phiên owner; requestId kết quả đã tính | Snapshot kết quả, tìm/xem/xóa đúng owner |

Đầu vào được kiểm trên Server; Client không được cấp quyền duyệt nguồn hoặc tự gửi snapshot để lưu. Miền lịch dự án là 1900–2099 với UTC+7 cố định. Các yêu cầu tính toán mang UUID; kết nối STOMP được giữ riêng với cookie owner dùng cho lịch sử. Khi không đủ dữ liệu hoặc điều kiện chính sách, Server trả lỗi có mã thay vì tạo nội dung bù. [9–12]

## 4 Giải pháp đề xuất

Yêu cầu qua STOMP được parse JSON/UTF-8 nghiêm ngặt, sau đó dispatcher kiểm registry theo cặp sessionId/requestId. ID mới được nhận vào vòng đời Run với deadline; ID trùng có cùng fingerprint chia sẻ công việc đang chạy hoặc replay terminal còn hiệu lực. Nội dung khác cùng ID bị từ chối. Trong bounded, chỉ worker thực thi nghiệp vụ; queue đầy trả SERVER_BUSY, không chuyển việc sang luồng nhận STOMP để né giới hạn. [8]

Service tra registry nguồn trước khi tính hoặc lấy lời luận. Dữ liệu kết quả giữ ruleVersion, ruleBasis, sourceStatus, sourceReferences và decisionReferences. Chính sách SOURCE_VERIFIED và TEAM_DECISION được phân biệt với trạng thái nguồn. TIME dùng quy ước chia 6 đã chốt cho dự án; OBJECT_COUNT giữ TEAM_DECISION/SOURCE_AMBIGUOUS theo hồ sơ. Một quyết định nhóm không biến bản in chưa rõ thành chứng cứ ấn bản đã được xác minh. [9–10]

## 5 Kiến trúc hệ thống

![Hình 1. Các thành phần giao tiếp và xử lý của Huyền Cơ. Mũi tên mô tả luồng logic; truy cập dữ liệu và trả thông điệp do các module tương ứng thực hiện.](figures/architecture.png)

Client quản lý nhập liệu và hiển thị; Server giữ thuật toán và quyền truy cập. REST phục vụ các thao tác tra cứu/lịch/lịch sử; WebSocket duy trì kênh progress và kết quả tính toán. PostgreSQL chứa tri thức có nguồn, metadata review và snapshot lịch sử. H01 lưu định danh owner bằng hash token, tách khỏi session STOMP dùng cho định tuyến và N01. [11]

## 6 Thiết kế giao tiếp mạng

### Thiết lập kết nối và trình tự thông điệp

Client mở WebSocket /ws, hoàn tất STOMP CONNECT/CONNECTED rồi subscribe /user/queue/progress, /user/queue/results và /user/queue/errors trước SEND. Tuyến tính toán là /app/mai-hoa/calculate hoặc /app/tam-the/calculate. Với lịch sử, Client bootstrap cookie owner qua POST /api/v1/session trước handshake; cookie hợp lệ được gắn owner phía Server. Client công khai không cookie vẫn tính được nhưng không có snapshot owned để lưu. [9,11]

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "MAI_HOA",
  "payload": {
    "method": "LINES",
    "linesBottomUp": [true, false, true, false, true, false],
    "movingLine": 2
  }
}
```

Progress mang requestId, type, sequence, step và message; chuỗi thành công gồm ACCEPTED, VALIDATING, CALCULATING, LOOKUP. Terminal mang requestId/type/status/data/error; thành công COMPLETED có error=null, thất bại FAILED có mã lỗi. Các frame được trả về socket tương ứng; Client không được SEND trực tiếp vào broker queue hoặc SUBSCRIBE queue của phiên khác. Hợp đồng JSON v1.2 khác với phiên bản STOMP 1.2 dù cùng con số. [2,9]

### Lỗi và đóng kết nối

JSON hỏng, field lạ và input sai bị từ chối; xung đột requestId trả INVALID_INPUT; từ chối admission trả SERVER_BUSY. Deadline của Run gồm thời gian chờ queue; vượt hạn trả PROCESSING_TIMEOUT và chặn terminal/progress muộn. Disconnect hủy Run/timer, yêu cầu interruption và xóa registry của phiên; reconnect tạo session mới. Interruption là best effort, không bảo đảm JDBC đang kẹt dừng ngay. [8]

Ghi/xóa lịch sử yêu cầu cookie owner, custom header và CSRF hợp lệ; truy cập history của owner khác trả 404. Origin allowlist và bảo vệ cookie/CSRF là lớp riêng với session routing. Các lượt benchmark dùng loopback HTTP/WS; chưa phải nghiệm thu TLS hoặc triển khai Internet. [11]

## 7 Triển khai

Bảng 2. Thành phần chính và trách nhiệm

| Module | Vai trò |
| --- | --- |
| CalculationController | Parse nghiêm ngặt, kiểm hợp đồng, gọi service và ánh xạ lỗi |
| CalculationDispatcher | Admission nguyên tử, worker/queue, fingerprint và replay terminal |
| CalculationSessions | Run, progress/terminal theo socket, deadline và cleanup |
| MaiHoaService / TamTheService | Thuật toán và bảng tra có điều kiện nguồn |
| RuleRegistry / JDBC repositories | Cổng chính sách, snapshot dữ liệu và truy vết nguồn |
| H01 và Client | Owner/history/CSRF; nhập liệu, nhận STOMP và hiển thị |

### Thuật toán và dữ liệu

Với LINES, sáu hào được đánh số từ dưới lên. Hỗ hạ lấy hào 2–4, hỗ thượng lấy hào 3–5; quẻ biến đảo duy nhất hào động. OBJECT_COUNT dùng số vật lấy thượng quái, chỉ số giờ Chi lấy hạ quái; tổng số gốc chia 6 lấy hào, dư 0 quy về 6. TIME chuẩn hóa UTC+7 và lấy năm/tháng/ngày âm cùng giờ Chi theo quy ước đã công bố. Luận chi tiết là chức năng opt-in riêng với mẫu đã review, không phải output mặc định của workload benchmark. [9–10]

Tam Thế chuẩn hóa lịch, lấy Can Chi năm âm và hành mệnh rồi tra bảng theo loại nội dung. EXTENDED giữ Lộc, Sang hèn và Điền sản thành các mục riêng; không có giao điểm nguồn của Lộc được ghi NO_SOURCE_MATCH, không tự sinh lời thay thế. Lịch C01 dùng dataset cố định tạo và cross-check với Time4J 5.9.4; kiểm cùng thư viện không được gọi là nguồn thiên văn độc lập. [12]

Schema V1–V12 phân biệt sách/mục nguồn, bát quái/quẻ/hào, quy tắc, nội dung tra và metadata review; V11 bổ sung owner/history, V12 dữ liệu mở rộng. H01 lưu snapshot Result DTO đã tính trên Server theo owner; không nhận payload/snapshot hoặc trạng thái duyệt do Client tự cung cấp. Phạm vi VERIFIED được xác định theo từng hồ sơ; tên quẻ đã duyệt không chứng minh mọi thuật toán hay mọi lời luận đã được duyệt. [10–12]

Các biên bản Client 8E/8F ghi nhận nghiệm thu UI/HTTP/STOMP ở những ca đại diện và hai owner. Chúng được giữ riêng với kết quả Backend và X01; không suy từ vài ca UI thành kiểm hết miền input hoặc mọi tình huống lỗi mạng. [13]

## 8 Thiết lập thực nghiệm

### Phần cứng phần mềm và mạng

Bảng 3. Môi trường đã ghi nhận của ma trận

| Thành phần | Giá trị |
| --- | --- |
| CPU | Intel Core i7-13620H; 10 core, 16 logical processor |
| RAM hệ thống | 25.458.917.376 byte theo snapshot môi trường |
| Hệ điều hành | Windows 11 Home Single Language 64-bit, 10.0.26300 |
| Backend | JDK 17.0.12; Spring Boot 3.5.16; heap 256–512 MiB |
| Runner | Node.js 24.21.0; @stomp/stompjs 7.5.0; ws 8.22.0 |
| Database | PostgreSQL 18.6, database benchmark TEST riêng, schema V12 |
| Mạng | Cùng máy, loopback 127.0.0.1; HTTP 18091, WS /ws |
| Origin / kết nối | http://127.0.0.1:3173; 20/5/2 socket thật tùy lượt |

Bảng 4. Các tham số giữ cố định ngoài mode

| Tham số | Cấu hình |
| --- | --- |
| Ma trận | 2/5/20 Client × direct/bounded × 3 lần = 18 lượt |
| Thời gian | Warm-up 10 s; đo 60 s; drain tối đa 15 s; nghỉ giữa lượt 5 s |
| Tải Client | Một request chưa terminal; nghỉ ít nhất 200 ms sau terminal |
| Worker / queue | Bounded 4/100; direct không qua queue riêng này |
| Deadline / TTL | 10.000 ms gồm queue; idempotency 60 s, tối đa 10.000 ID |
| Giới hạn Run | 1.024 phiên; 1.000 toàn Server; 16/phiên |
| JDBC / Flyway | Pool 8, read-only; Flyway tắt trong mọi lượt đo |
| Retry / cookie | Không auto retry/reconnect, không cookie hoặc ghi history |

Ma trận chạy ngày 29/10/2026 từ 02:20:47 đến 02:44:49 UTC+7. Mỗi lượt có JVM mới, cùng JAR đã pin; không xóa cache PostgreSQL/OS giữa lượt. Thứ tự cân bằng được ghi tại Phụ lục A; không tự thay thế hoặc chạy lại một lượt để chọn kết quả. [5]

### Dữ liệu workload và mốc đo

Database huyenco_benchmark_test_20261029_010531 có snapshot tri thức/schema khớp baseline trước và sau mỗi lượt. JAR SHA-256 là 71a9d31d11adda8f50330398e87ccad6029fe7782b0a5b6239eaabf1bad0ab39. Các snapshot runtime có anonymous_sessions=0 và interpretation_history=0. Thuật toán và dữ liệu không đổi giữa hai mode. [5,7]

Workload là Mai Hoa LINES không reading. Chỉ số Client i tính từ 0, sequence s bắt đầu từ 0 ở mỗi phase; pattern=(17i+s) mod 64; movingLine=1+((i+s) mod 6). Seed cố định, UUID mới mỗi SEND; chu kỳ đo phủ 192 cặp inputCase mỗi lượt, không phải toàn bộ 384 tổ hợp chức năng. Mỗi kết quả được oracle kiểm ba quẻ, hào động, rule/source, requestId, session và chuỗi progress 1–4. [5,7]

Bảng 5. Định nghĩa chỉ số

| Chỉ số | Cách tính |
| --- | --- |
| Cohort | SEND trong [measurement.start, measurement.end) |
| Latency | Terminal nhận tại runner trừ SEND, cùng đồng hồ đơn điệu |
| Median / P95 / P99 | COMPLETED hợp lệ; percentile nearest-rank theo từng lượt |
| Throughput | Số hoàn tất thuộc cohort nhận trước end / 60 giây |
| Tổng hợp ba lượt | Median và min–max của ba chỉ số; không phải CI |
| CPU / bộ nhớ | Mẫu khoảng 1 s; CPU % một core; peak lấy mẫu và phạm vi riêng |

### Sai lệch ranh thời gian và xử lý

Raw có 46.028 dòng gắn nhãn measurement, nhưng SEND tại 20 Client/bounded/lần 1 muộn 0,022 ms sau ranh 60 s. Dòng này vẫn được giữ nguyên. Quy tắc cohort [start,end) áp dụng đồng nhất theo SEND timestamp tạo 46.027 mẫu hợp lệ; median của lượt bị ảnh hưởng sửa 5,5139 thành 5,5143 ms, P95 và throughput không đổi. Đây là sai lệch kiểm soát lịch gửi, không được gọi là strict-window PASS tuyệt đối. [5]

Sau ma trận đã thêm chốt deadline trước publish và kiểm hồi quy riêng. Bản sửa không được đưa ngược vào 18 lượt cũ; raw/summary gốc và snapshot mã đã đo được giữ. Nếu tiêu chí chấm yêu cầu zero SEND ngoài ranh ở bản chạy gốc, cần một ma trận mới. [5,7]

## 9 Kết quả

### Hiệu năng theo cấu hình

Bảng 6. Median của ba chỉ số theo lượt cho mỗi ô

| Client | Mode | Cohort | Med ms | P95 ms | P99 ms | Req/s |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | direct | 1.710 | 2,96 | 6,22 | 16,66 | 9,50 |
| 2 | bounded | 1.712 | 2,97 | 6,23 | 7,68 | 9,52 |
| 5 | direct | 4.278 | 3,11 | 6,12 | 14,56 | 23,75 |
| 5 | bounded | 4.285 | 3,05 | 6,22 | 16,21 | 23,82 |
| 20 | direct | 16.985 | 6,47 | 12,15 | 22,90 | 94,35 |
| 20 | bounded | 17.057 | 5,51 | 11,91 | 36,41 | 94,72 |

Cả 46.027 yêu cầu cohort hoàn tất hợp lệ; không có lỗi hoặc terminal cohort về sau cửa sổ. Tổng raw gồm 162 readiness, 7.640 warm-up, 46.027 cohort và một SEND muộn, thành 53.830 COMPLETED/215.320 progress. Không tính replay hoặc lỗi từ chối nhanh của bài độ tin cậy vào số đo này. Các hình 2–6 trình bày toàn bộ biến thiên theo lượt, ECDF, tài nguyên và diễn biến theo giây. [5–7]

Bảng 7. Khoảng min–max của P95 và throughput qua ba lượt

| Client | Mode | P95 min–max ms | Throughput min–max req/s |
| --- | --- | --- | --- |
| 2 | direct | 6,06–6,24 | 9,50–9,50 |
| 2 | bounded | 5,57–6,58 | 9,50–9,52 |
| 5 | direct | 5,77–6,71 | 23,75–23,80 |
| 5 | bounded | 6,10–6,44 | 23,77–23,83 |
| 20 | direct | 11,20–12,30 | 94,07–94,67 |
| 20 | bounded | 10,75–11,99 | 94,70–94,87 |

Ở 20 Client, median latency bounded giảm khoảng 14,71%, P95 giảm 1,96% và throughput tăng 0,39% so với direct. Tuy nhiên median P99 tăng khoảng 59%, từ 22,90 lên 36,41 ms; max quan sát 60,75 ms so với 52,75 ms. Các khoảng đo vẫn chồng lấn; kết quả không cho phép kết luận bounded tốt hơn toàn phân bố. [7]

Hình 3 so throughput với trần nhịp gửi 5 request/s/Client từ khoảng nghỉ 200 ms; Hình 6 giữ cả ba chuỗi theo bin một giây. Throughput đo được khoảng 94–95 request/s ở 20 Client không phải công suất cực đại Server. [7]

### Độ tin cậy và tài nguyên

Bảng 8. Bảy tình huống qua STOMP và PostgreSQL thật

| Tình huống | Kết quả chính |
| --- | --- |
| In-flight trùng / xung đột | Một progress chain/kết quả gốc; đảo key và UUID hoa được dedupe; khác payload INVALID_INPUT |
| Terminal replay / xung đột | Replay đúng terminal, không progress; conflict không thay kết quả gốc |
| 20 phiên cùng ID | 20 input khác nhận đúng kết quả/progress của phiên tương ứng |
| Reconnect | Socket mới gửi cùng ID/input tạo chuỗi tính mới |
| TTL mặc định 60 s | Gửi lại sau 61,506 s tạo 4 progress và kết quả mới |
| Burst tự nhiên 20 × 8 | 10 COMPLETED, 150 SERVER_BUSY; ID cũ bị từ chối và ID mới phục hồi |
| Queue 2 worker / 4 việc | Có giữ khóa TEST: 6 nhận, 154 SERVER_BUSY; sau mở khóa cả 6 hoàn thành |

Suite stress giữ các giới hạn còn lại lớn hơn burst: tám việc/phiên dưới 16, tổng 160 dưới 1.000, registry dưới 10.000. Hai JDBC waiter được quan sát khi giữ khóa public.hexagrams; 154 từ chối về trước mở khóa, sau đó sáu việc hoàn tất. Điều kiện này cùng mã dispatcher/cấu hình loại trừ các giới hạn admission khác trong ca đã kiểm. Khóa thử chỉ trên database benchmark, giao dịch rollback và watchdog 4 s; không sửa dữ liệu hoặc thêm sleep vào nghiệp vụ. [6]

CPU Node trung bình mẫu trong cửa sổ khoảng 1,28–7,16% một logical core; khoảng cao nhất 21,81%. Peak RSS Node khoảng 170,65 MiB; peak working set Java khoảng 402,27 MiB. Java CPU/RAM/OS thread lấy mẫu toàn vòng đời gồm startup/JIT/warm-up, không phải steady state 60 s. Node dùng đoạn sample thực 58,23–58,37 s trong cửa sổ. Không cộng hai CPU khác phạm vi; PostgreSQL CPU không đo riêng. [7]

Cả 18 cặp snapshot trước/sau và kiểm chỉ đọc X01.6 lúc 11:21:28 UTC+7 ngày 29/10 đều khớp 16 bảng tri thức/migration, schema và runtime trống. Trong X01.5, hai Java/Node thử đã dừng và các khóa được giải phóng; không ghi vào huyenco hoặc TEST nguồn để chạy thí nghiệm. [5–7]

## 10 Thảo luận

### Ý nghĩa của độ trễ và nhịp gửi

Ở 2 và 5 Client, thay đổi median/P95 nhỏ và không đồng nhất. Khi tăng lên 20 Client, median khoảng 5–6 ms và P95 khoảng 12 ms phản ánh nhiều yêu cầu cùng hoạt động hơn, nhưng thí nghiệm chưa tách thời gian queue, JDBC, GC hay scheduling. Không thể quy toàn bộ chênh lệch cho worker pool. Ba lượt/ô và các khoảng chồng lấn chưa hỗ trợ khẳng định ý nghĩa thống kê; min–max không phải confidence interval. [7]

P99 của bounded ở 20 Client cao hơn là một bất lợi cần giữ trong kết luận. Median thấp hơn có thể đi cùng vài request ở phần đuôi chậm hơn; ECDF ở Hình 4 cho thấy vì sao không thể thay mô tả phân bố bằng một con số trung tâm. Báo cáo không loại outlier để cải thiện kết quả. Không có telemetry đủ để kết luận nguyên nhân cụ thể của đuôi dài. [7]

Vòng kín với nghỉ ít nhất 200 ms giới hạn nhịp gửi gần 10/25/100 request/s trước khi tính thời gian xử lý. Do đó throughput gần nhau là điều có thể xảy ra ngay cả khi cơ chế điều phối khác; đây là cách đọc phù hợp thiết kế workload, không phải chứng minh hai hệ thống có cùng năng lực cực đại. Benchmark dùng kết nối đã thiết lập; thời gian HTTP upgrade/STOMP CONNECTED được ghi riêng. [5,7]

### Kiểm soát quá tải và cách ly phiên

Giá trị kỹ thuật rõ hơn của bounded trong bộ thử là hành vi có giới hạn: từ chối khi pool/queue đủ chỗ đã bị sử dụng, không crash, không chuyển trả sai phiên và tiếp nhận việc mới sau burst. Bằng chứng đó đến từ suite stress riêng, không từ bảng latency thường. Idempotency cũng được kiểm riêng vì cả direct và bounded đã cùng bật registry; không thể lấy chênh lệch hai mode làm số đo lợi ích riêng của dedupe. [6,8]

### Nguồn dữ liệu và khả năng tái lập

Hash JAR, nguồn runner, schema và dữ liệu giữ được quan hệ giữa cấu hình và kết quả. Dù vậy cùng máy còn chịu cache PostgreSQL/OS và tác vụ nền; JVM mới không làm các lượt hoàn toàn độc lập về trạng thái hệ thống. Tài nguyên một giây/mẫu có thể bỏ lỡ đỉnh ngắn, Java gồm startup và Node event-loop histogram có resolution 20 ms/phạm vi toàn lượt. Sai lệch SEND muộn là giới hạn thật của kiểm soát thời gian, cần công bố ngay cả khi ảnh hưởng số liệu tổng hợp nhỏ. [5,7]

## 11 Đóng góp kỹ thuật

Bảng 9. Đóng góp ở phạm vi project và bằng chứng

| Đóng góp | Triển khai | Bằng chứng |
| --- | --- | --- |
| Điều phối hữu hạn | Pool cố định, queue hữu hạn, AbortPolicy, deadline và cleanup | Mã dispatcher; stress có hai waiter, 6 nhận/154 từ chối và phục hồi [6,8] |
| Idempotency theo socket | Fingerprint JSON; trùng in-flight; replay TTL; conflict; phiên độc lập | Bảy ca live gồm TTL60s/reconnect/20phiên; không suy từ latency benchmark [6] |
| Kết quả truy vết nguồn | Registry tách policy/trạng thái; phiên bản/hash/trang và quyết định được giữ | Hợp đồng1.2; schema và snapshot kiểm toán; SOURCE_VERIFIED/TEAM_DECISION [9–12] |
| Quy trình thực nghiệm tái tính | Pin JAR/dataset, raw theo timestamp, bảng/ảnh và công bố sai lệch | 18 lượt, auditor độc lập, CSV và hash; một dòng ngoài ranh được giữ [5–7] |

Các đóng góp là kết quả tích hợp và kiểm chứng trong project. Thread pool, WebSocket, STOMP và cache không được tuyên bố là phát minh mới; hình thức UI không được dùng thay bằng chứng cải tiến kỹ thuật. Chưa có ablation bật/tắt idempotency hoặc so các thuật toán queue khác. [1–4,6–8]

## 12 Hạn chế

Bộ đo chỉ dùng LINES, 192 cặp seed, 2/5/20 Client logic cùng máy và workload có khoảng nghỉ. Chưa đánh giá nhiều máy vật lý, jitter/loss/băng thông mạng, tải mở, workload lời luận chi tiết/TIME/Tam Thế/REST/history hoặc mức tải cực đại. Chưa đo tách queue/JDBC và CPU PostgreSQL; chỉ ba lần/ô, không có p-value hoặc CI.

Registry idempotency nằm trong bộ nhớ một tiến trình; restart mất cache, reconnect là session mới. Interruption không bảo đảm thư viện đang chạy dừng ngay. X01.5 không bao phủ crash giữa phép tính, registry đầy hoặc mọi tình huống timeout/cancel qua mạng; test N01 trước đó có phạm vi riêng. [6,8]

Tri thức sách có giới hạn ấn bản và một số quy ước biên tập/nhóm. VERIFIED có phạm vi theo bản ghi và hồ sơ review, không đồng nghĩa kiểm chứng khoa học; các lượt review cùng công cụ không được mô tả là hai chuyên gia độc lập. Dữ liệu không khớp nguồn không được lấp bằng lời luận suy diễn. [10,12]

## 13 Hướng phát triển

Ưu tiên một ma trận mới với final publish gate đã sửa khi cần đáp ứng strict-window tuyệt đối, giữ cả bộ cũ để đối chiếu. Sau đó mở rộng thực nghiệm sang hai máy thật và workload mix có lời luận chi tiết, tách tải mở/vòng kín, đo queue wait và JDBC time bằng telemetry có chi phí được kiểm soát. Tăng số lần lặp và thiết kế phân tích thống kê trước khi thu dữ liệu mới.

Về hệ thống, có thể khảo sát hạn tải theo owner/kết nối, metrics phân biệt nguyên nhân SERVER_BUSY và idempotency bền vững nếu cần nhiều instance. Triển khai Internet còn cần nghiệm thu TLS/reverse proxy, cookie, chính sách log và vận hành; không suy từ loopback hiện tại thành sẵn sàng vận hành công cộng. Mở rộng nội dung phải bắt đầu từ khảo sát/review nguồn thay vì sinh nội dung thay thế.

## 14 Kết luận

Huyền Cơ kết hợp tra cứu tri thức có nguồn với thiết kế Client–Server qua REST và STOMP/WebSocket. Server chịu trách nhiệm thuật toán, cổng nguồn, vòng đời request và dữ liệu sở hữu. Phần N01 bổ sung worker/queue hữu hạn cùng idempotency theo session, giúp hành vi khi nhiều Client hoặc quá tải có điều kiện và kết quả kiểm tra rõ ràng.

Ma trận 18 lượt có 46.027 yêu cầu cohort hoàn tất hợp lệ ở mức tải đã chọn; suite độ tin cậy đạt bảy tình huống. Bounded tại 20 Client có median thấp hơn nhưng P99 cao hơn; throughput hai mode gần nhau và bị ràng buộc bởi khoảng nghỉ. Kết quả vì vậy ủng hộ đánh giá dựa trên nhiều chỉ số và bằng chứng quá tải riêng, thay vì khẳng định ưu thế tốc độ toàn diện. Một SEND muộn 0,022 ms và các giới hạn tài nguyên/mạng được giữ trong báo cáo. [5–7]

### Phân công và trách nhiệm

Bảng 10. Vai trò kỹ thuật của nhóm

| Vai trò | Phần việc |
| --- | --- |
| TV1 | Client Next.js, form, kết quả/nguồn, REST/STOMP và nghiệm thu UI đại diện |
| TV2 | Backend, protocol, vòng đời/concurrency/idempotency, benchmark |
| TV3 | Nguồn sách, schema/review, lịch/Tam Thế và kiểm toán dữ liệu |

Theo tổ chức hiện tại, chủ dự án đảm nhiệm cả TV2 và TV3. Công cụ AI được dùng hỗ trợ thiết kế, mã nguồn, kiểm thử, phân tích và soạn tài liệu; các thành viên chịu trách nhiệm kiểm tra, hiểu và giải thích phần nộp. Không dùng sự tồn tại của công cụ như chứng cứ xác minh nguồn hoặc thay kết quả thực nghiệm.

## 15 Tài liệu tham khảo

[1] I. Fette và A. Melnikov. The WebSocket Protocol. RFC 6455, 2011. https://www.rfc-editor.org/rfc/rfc6455

[2] STOMP. STOMP Protocol Specification Version 1.2. https://stomp.github.io/stomp-specification-1.2.html

[3] Spring. Spring Framework 6.2 Reference, WebSocket STOMP Overview. https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/overview.html

[4] Oracle. Java SE 17 API, ThreadPoolExecutor. https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html

[5] Nhóm Huyền Cơ. X01.4, ma trận 18 lượt và audit cohort. 29/10/2026. docs/51-X01-BENCHMARK-RESULTS.md; artifact matrix trong Phụ lục A.

[6] Nhóm Huyền Cơ. X01.5, nghiệm thu quá tải/idempotency. 29/10/2026. docs/52-X01-OVERLOAD-IDEMPOTENCY-ACCEPTANCE.md; raw/control transcript và independent audit.

[7] Nhóm Huyền Cơ. X01.6, tổng hợp/phân tích và năm biểu đồ. 29/10/2026. docs/53-X01-BENCHMARK-ANALYSIS.md; docs/assets/x01/per-run.csv và aggregate.csv.

[8] Nhóm Huyền Cơ. Thiết kế N01 và mã CalculationDispatcher/CalculationSessions. docs/36-N01-CONCURRENCY-IDEMPOTENCY-HANDOFF.md; server/src/main/java/com/huyenco/websocket/.

[9] Nhóm Huyền Cơ. Hợp đồng JSON/STOMP v1.2. docs/02-API-CONTRACT.md; client/src/types/contract.ts; DTO Java và docs/examples/.

[10] Mai Hoa Dịch Số, bản scan người dùng cung cấp, 672 trang PDF; chưa xác minh đầy đủ ấn bản in. Hash MH 225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de. Hồ sơ thực thi: docs/04-MAIHOA-RULES.md, 28-TIME-OWNER-APPROVAL.md và 41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md.

[11] Nhóm Huyền Cơ. H01, phiên/owner/lịch sử và schema. docs/34-H01-SESSION-HISTORY-HANDOFF.md; migrations V11/V12 và JDBC repositories.

[12] Diễn Cầm Tam Thế Diễn Nghĩa, Dương Công Hầu, hiệu Khương Đức, bản scan 360 trang; thông tin ấn bản chưa xác minh đầy đủ. Hồ sơ dự án: docs/05-TAMTHE-RULES.md; 26-C01-CALENDAR-HANDOFF.md; 42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md.

[13] Nhóm Huyền Cơ. TV1 Phase 8, bằng chứng UI đại diện 8E/8F. docs/44-TV1-PHASE8A-ACCEPTANCE.md. Đây là hồ sơ nghiệm thu có phạm vi, không thay toàn bộ kiểm sản phẩm.

Các tài liệu Web [1–4] được truy cập ngày 29/10/2026. Dẫn trang sách trong kết quả dùng metadata theo từng mục nguồn; không suy một độ lệch trang chung cho cả cuốn.

## Phụ lục A Số liệu từng lượt và truy vết

Bảng A1. Giữ nguyên thứ tự chạy, không chọn lại lượt

| Lần | Client | Mode | Cohort | Med ms | P95 ms | Req/s |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | direct | 570 | 2,95 | 6,22 | 9,50 |
| 1 | 2 | bounded | 571 | 2,97 | 5,57 | 9,52 |
| 1 | 5 | bounded | 1.426 | 3,05 | 6,10 | 23,77 |
| 1 | 5 | direct | 1.425 | 3,32 | 6,71 | 23,75 |
| 1 | 20 | direct | 5.661 | 6,52 | 12,15 | 94,35 |
| 1 | 20 | bounded | 5.683 | 5,51 | 11,91 | 94,72 |
| 2 | 20 | bounded | 5.692 | 4,66 | 10,75 | 94,87 |
| 2 | 20 | direct | 5.680 | 5,36 | 11,20 | 94,67 |
| 2 | 5 | direct | 1.425 | 3,01 | 6,12 | 23,75 |
| 2 | 5 | bounded | 1.430 | 3,30 | 6,44 | 23,83 |
| 2 | 2 | bounded | 571 | 3,02 | 6,23 | 9,52 |
| 2 | 2 | direct | 570 | 2,96 | 6,06 | 9,50 |
| 3 | 5 | bounded | 1.429 | 2,88 | 6,22 | 23,82 |
| 3 | 5 | direct | 1.428 | 3,11 | 5,77 | 23,80 |
| 3 | 2 | direct | 570 | 3,04 | 6,24 | 9,50 |
| 3 | 2 | bounded | 570 | 2,90 | 6,58 | 9,50 |
| 3 | 20 | bounded | 5.682 | 5,75 | 11,99 | 94,70 |
| 3 | 20 | direct | 5.644 | 6,47 | 12,30 | 94,07 |

Ô 20/bounded/lần 1 có 5.683 request cohort; một dòng measurement muộn 0,022 ms được giữ tại boundary-exclusions.csv. P95 nearest-rank theo lượt; các bảng tổng hợp dùng median của ba chỉ số. Toàn bộ raw/snapshot/log là artifact local đã pin, không tự xuất hiện chỉ vì push source code lên GitHub.

Gốc raw X01.4: scripts/generated/x01_matrix_20261029_022047_427181/. Raw X01.5: scripts/generated/x01_reliability_20261029_103446_353616/. Bản phân tích dùng cho báo cáo: scripts/generated/x01_analysis_20261029_112956_819906/. Các manifest SHA-256 và report/evidence-index.json liên kết các tệp cần bàn giao.

Tái tính offline khi có đầy đủ artifact: python scripts/audit_x01_matrix.py; python scripts/audit_x01_reliability.py --evidence scripts/generated/x01_reliability_20261029_103446_353616; python scripts/summarize_x01_benchmark.py. Không đưa mật khẩu, cookie hoặc CSRF vào gói bằng chứng.

![Hình 2. Median, P95 và P99 theo từng lượt ở 2/5/20 Client. Dấu lớn là median ba chỉ số; chấm nhỏ là từng lượt; thanh min–max quan sát không phải CI. Direct màu xanh, bounded màu nâu; một SEND ngoài cửa sổ không thuộc cohort.](figures/01-latency.png)

![Hình 3. Throughput thành công và tỷ lệ so với trần nhịp gửi từ nghỉ 200 ms. Trần 5 × số Client request/s chưa kể xử lý/lập lịch. Dữ liệu không phải công suất cực đại; thanh min–max qua ba lượt.](figures/02-throughput.png)

![Hình 4. ECDF gộp request của ba lượt theo từng ô. Trục X log, toàn dải độ trễ được giữ; đường ngang ở 95%. ECDF gộp không thay median các P95 theo lượt và không coi từng request là một lượt độc lập.](figures/03-latency-ecdf.png)

![Hình 5. CPU và bộ nhớ được lấy mẫu của Java/Node. Java gồm startup/JIT/warm-up; Node chỉ sample trong cửa sổ. CPU là % một logical core, working set/RSS là MiB và peak được lấy mẫu; không phải heap used, không đo CPU PostgreSQL riêng.](figures/04-resources.png)

![Hình 6. Số kết quả thuộc cohort hoàn tất trong từng bin một giây ở 20 Client. Giữ cả ba lần, không làm mượt; không gồm readiness/warm-up/SEND muộn. Số đếm theo giây không chứng minh queue đầy hoặc giải thích nguyên nhân độ trễ.](figures/05-throughput-timeline.png)
