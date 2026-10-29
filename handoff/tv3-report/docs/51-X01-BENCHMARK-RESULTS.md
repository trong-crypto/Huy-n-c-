# X01.4 — Kết quả ma trận 18 lượt direct/bounded

**Cập nhật sau X01.6 ngày29/10:** quá tải/idempotency7/7 tình huống đạt tại [52](52-X01-OVERLOAD-IDEMPOTENCY-ACCEPTANCE.md); CSV18lượt/sáu ô, năm biểu đồ và thảo luận đầy đủ tại [53](53-X01-BENCHMARK-ANALYSIS.md). Tiếp theo X01.7 báo cáo nộp; các số liệu và window deviation X01.4 bên dưới giữ nguyên.

**Ngày 29/10/2026, giờ Việt Nam. Đã chạy đủ 18 lượt chính thức; cohort đã đối chiếu độc lập, có một sai lệch ranh thời gian được công bố tại mục 3.** Không đánh dấu toàn bộ task X01 hoàn thành: overload/idempotency X01.5 và biểu đồ/thảo luận X01.6 còn riêng.

## 1. Thiết lập thực nghiệm

- Thời gian thực thi ma trận: **02:20:47 → 02:44:49 UTC+07:00**, khoảng 24 phút 02 giây. Warm-up + cửa sổ đo thuần là 21 phút; phần còn lại gồm startup, kiểm tra, thu nốt và khoảng nghỉ.
- 2/5/20 kết nối STOMP độc lập × direct/bounded × 3 lần. Giữ đúng thứ tự cân bằng đã chốt trong tài liệu 47; không chạy song song các ô, không tự retry hoặc thay thế lượt.
- Mỗi lượt có readiness từng kết nối, **warm-up 10 giây, cửa sổ 60 giây**, thu nốt tối đa 15 giây; nghỉ cố định 5 giây giữa các lượt sau khi Java/sampler do wrapper tạo đã dừng.
- Workload Mai Hoa LINES thật, không lời luận chi tiết; input/seed cố định, UUID mới, tối đa một request chưa terminal/Client và khoảng nghỉ tối thiểu 200 ms. Không cookie, không POST session/history và không tự reconnect/resend.
- Database `huyenco_benchmark_test_20261029_010531`, V12; Flyway tắt; Hikari read-only/pool 8. Snapshot tri thức/schema khớp X01.1 trước/sau mỗi lượt và sau toàn ma trận.
- Backend JAR SHA-256 `71a9d31d11adda8f50330398e87ccad6029fe7782b0a5b6239eaabf1bad0ab39`, JDK 17.0.12, heap `-Xms256m -Xmx512m`; bounded worker 4/queue 100, deadline 10 giây, TTL idempotency 60 giây/max 10.000. Chỉ thay mode điều phối.
- Cùng Node/toolchain/guard/source trong cả 18 lượt, có hash và bản snapshot mã đã đo. Cổng benchmark loopback 18091, Origin 127.0.0.1:3173. Backend/UI demo ở 18090/3173 được giữ hoạt động; không đo render UI hoặc LAN.
- Máy Windows 11, Intel Core i7-13620H (10 core/16 logical processor), RAM hệ thống báo khoảng 25,46 GB; runner và Backend/DB cùng máy. Thông tin chi tiết tại artifact môi trường của các lượt và biên bản 48/49.

## 2. Số liệu sau đối chiếu cohort

Cohort được định nghĩa trước thí nghiệm: request có thời điểm SEND trong **[measurement.start, measurement.end)**. Một SEND ngoài ranh được giữ trong raw nhưng không thuộc cohort; xem mục 3.

Các cột latency/throughput dưới đây là **median của ba chỉ số theo từng lượt**, không phải percentile tính gộp toàn bộ request. P95 mỗi lượt dùng nearest-rank trên COMPLETED hợp lệ; throughput chỉ tính kết quả thuộc cohort nhận trong cửa sổ, đơn vị request/giây.

| Client | Mode | Request cohort, tổng 3 lượt | Median latency (ms) | Median P95 (ms) | Khoảng P95 của 3 lượt (ms) | Median throughput (request/s) |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| 2 | direct | 1.710 | 2,96 | 6,22 | 6,06–6,24 | 9,50 |
| 2 | bounded | 1.712 | 2,97 | 6,23 | 5,57–6,58 | 9,52 |
| 5 | direct | 4.278 | 3,11 | 6,12 | 5,77–6,71 | 23,75 |
| 5 | bounded | 4.285 | 3,05 | 6,22 | 6,10–6,44 | 23,82 |
| 20 | direct | 16.985 | 6,47 | 12,15 | 11,20–12,30 | 94,35 |
| 20 | bounded | 17.057 | 5,51 | 11,91 | 10,75–11,99 | 94,72 |

**46.027 request cohort hợp lệ đều COMPLETED, 0 lỗi**, không quan sát thấy sai phiên/kết quả, timeout, SERVER_BUSY, transport/protocol hoặc terminal lặp. Không có terminal của cohort hợp lệ đến sau cửa sổ trong ma trận này.

Đối soát số lượng đầy đủ:

| Nhóm | Số lượng |
| --- | ---: |
| Readiness | 162 |
| Warm-up | 7.640 |
| Nhãn measurement trong raw/summary Node gốc | 46.028 |
| SEND ngoài cửa sổ, loại khỏi cohort theo timestamp | 1 |
| Cohort 60 giây hợp lệ sau đối chiếu | 46.027 |
| Tổng raw COMPLETED, gồm readiness/warm-up/SEND ngoài ranh | 53.830 |
| Tổng progress raw | 215.320 |

Tổng raw vẫn đối soát được: `162 + 7.640 + 46.027 + 1 = 53.830`. Không xóa raw hoặc thay nhãn/summary gốc để làm các số lượng trùng nhau.

## 3. Sai lệch ranh thời gian và cách xử lý

Auditor phát hiện **đúng một SEND trong 18 lượt** được ghi nhận muộn **0,022 ms (22 microsecond)** sau ranh 60 giây: **20 Client/bounded/lần 1, client-8**. Vòng lặp đã xét điều kiện thời gian trước khi tạo body/record; thời điểm ghi SEND có thể vượt ranh trong khoảng công việc ngắn giữa hai bước đó.

- Ràng buộc lịch gửi nghiêm ngặt chưa đạt ở đúng một điểm này. Trạng thái audit được ghi rõ **`COHORT_AUDIT_PASS_WITH_WINDOW_DEVIATION`**, `strictSendWindowSatisfied=false`; không báo là 18 lượt đều đạt chặn lịch gửi tuyệt đối.
- Cohort được xác định lại đồng nhất cho mọi lượt bằng timestamp SEND theo quy tắc [start,end) đã có trước phép đo, không dựa vào latency, kết quả tốt/xấu hoặc mode.
- Giữ nguyên toàn bộ CSV, JSON summary, log và thứ tự 18 lượt. Dòng ngoài ranh vẫn nằm trong bằng chứng và danh sách `excludedBoundaryRequests`.
- Ở lượt bị ảnh hưởng, nhãn measurement gốc có 5.684 request; cohort đúng có **5.683**. Throughput **94,716667 request/s** và p95 **11,9088 ms** không đổi. Median sửa từ **5,5139** thành **5,5143 ms**. Không thay một lượt đo bằng lượt khác.
- Sau khi kết thúc ma trận, đã lưu snapshot mã runner/guard khớp toàn bộ hash của bản đã đo. Sau đó thêm chốt deadline ngay trước `publish` và lấy timestamp SEND tại chốt này, để yêu cầu hết cửa sổ không được publish/ghi vào cohort.
- Bản sửa có **12 test Node đạt**, gồm hai regression cho trường hợp serialize vượt ranh và thời điểm tại final publish gate; **3 test Python về cohort/tài nguyên đạt**. Bốn kiểm thử khói 2/20 Client × hai mode với bản sửa đều đạt, không có SEND ngoài cửa sổ, DB không đổi. Đây là hồi quy riêng, không được đưa vào hoặc thay thế 18 lượt chính thức.

Kết luận ở tài liệu này dựa trên **cohort timestamp đã đối chiếu**, kèm công bố sai lệch lịch gửi. Nếu tiêu chí đánh giá yêu cầu tuyệt đối không có SEND ngoài cửa sổ ở bản đo gốc, bộ dữ liệu này không đạt tiêu chí kiểm soát đó và cần một ma trận mới với runner đã sửa. Không che sai lệch bằng việc làm tròn timestamp hoặc sửa raw.

## 4. Kiểm chứng tính đúng và môi trường

- Đủ sáu ô cấu hình, mỗi ô ba lần; thứ tự đúng tài liệu 47. Đủ peak 2/5/20 HTTP upgrade 101 và một STOMP connection/Client.
- Mỗi COMPLETED nhận đủ bốn progress đúng thứ tự, đúng request/phiên và oracle LINES. Auditor Python kiểm lại inputCase/seed, timestamp, sổ đếm và median/p95/throughput độc lập; tính đúng nghiệp vụ được kiểm trên response thật bởi oracle Node đã pin.
- 18 cặp database_before/after đều khớp snapshot X01.1; phiên/lịch sử vẫn 0/0; JAR/source Backend không đổi. Không migrate/import/cấp approval hay ghi vào huyenco/TEST nguồn.
- Health/readiness trước/sau đều UP/READY. Các Java/sampler do wrapper tạo đều đã dừng.
- Khoảng nghỉ 200 ms qua warm-up/measurement được kiểm trên raw. Registry upper bound lớn nhất theo tổng ID một lượt là **6.652**, dưới 10.000; không có telemetry occupancy nội bộ để khẳng định queue/registry đã chạm giới hạn.
- CPU runner trung bình trong các khoảng lấy mẫu cửa sổ đo khoảng **1,28–7,16% một logical core**; mẫu cao nhất khoảng **21,81% một core**. RSS Node lớn nhất khoảng **170,65 MiB**. Không thấy CPU bộ sinh tải bão hòa trong các mẫu này.
- RSS Java lớn nhất khoảng **402,27 MiB**, số CPU/OS thread của Server được ghi theo toàn vòng đời, gồm startup/JIT. Không dùng các mẫu đó như số đo chỉ thuộc cửa sổ 60 giây và không coi OS thread là Java managed thread qua JMX.

## 5. Nhận xét trong phạm vi đã đo

Hai mode phục vụ thành công toàn bộ cohort tại mức tải đã chọn. Ở 20 Client, median latency theo lượt của bounded thấp hơn direct trong bộ số liệu này; median throughput và p95 gần nhau, các khoảng đo ba lần có chồng lấn. Ở mức 2/5 Client, chênh lệch latency nhỏ và không đồng nhất theo mọi chỉ số. Chưa có cơ sở khẳng định bounded nhanh hơn trong mọi tình huống hoặc khác biệt có ý nghĩa thống kê.

Tải vòng kín có khoảng nghỉ 200 ms giới hạn nhịp gửi; khoảng 94–95 request/s ở 20 Client **không phải thông lượng cực đại của Server**. Không suy rộng LINES sang lời luận chi tiết, TIME/Tam Thế, REST/history hoặc 20 người thao tác UI thật. Cả hai mode cùng có N01 idempotency, nên bảng này không tách riêng lợi ích idempotency.

Ma trận này không chứa bài queue đầy/replay/TTL/reconnect: tối đa 20 request chưa terminal, trong khi bounded có 4 worker/queue 100. Các bài đó đã kiểm riêng trong **X01.5** ở52; **X01.6** đã bổ sung biểu đồ, phân tích tài nguyên và Discussion từ raw ở53. Task X01 toàn bộ chưa đóng.

## 6. Bằng chứng và cách tính lại

Thư mục gốc: `scripts/generated/x01_matrix_20261029_022047_427181/`.

| Artifact | Nội dung |
| --- | --- |
| `matrix_progress.json`, `matrix_results.json` | Thứ tự, config, 18 summary gốc, fingerprint, trạng thái kết thúc |
| `benchmark-<clients>-<mode>-r<repeat>/` | Raw CSV/events/resources/log/environment, DB before/after của từng lượt |
| `matrix_analysis.json`, `matrix_summary.csv` | Số liệu tính lại theo cohort timestamp; giữ cả labelled/out-of-window counts |
| `runtime_source_snapshot/`, `runtime_snapshot_manifest.json` | Mã đã đo được lưu sau ma trận, xác nhận hash trùng các pin ghi trong ma trận; tách với bản runner sửa sau đó |
| `analysis_source/audit_x01_matrix.py` | Bản mã kiểm cohort độc lập |
| `postfix_regression.json` | Liên kết bốn lượt khói sau sửa; không thay thế lượt chính thức |
| `scripts/generated/x01_matrix_completed.json` | Checkpoint hoàn tất kèm window deviation, không phải PASS kiểm soát lịch gửi tuyệt đối |

Tính lại chỉ số từ raw và snapshot mã gốc, không cần mật khẩu DB:

```powershell
python .\scripts\audit_x01_matrix.py --evidence .\scripts\generated\x01_matrix_20261029_022047_427181
```

Lệnh controller dùng cho ma trận đã hoàn tất là `python .\scripts\run_x01_matrix.py`, với PGPASSWORD trong môi trường. Công cụ từ chối tự đăng ký lại một ma trận đã có; mọi lần đo mới phải có quyết định và thư mục bằng chứng riêng. Artifact `x01_*`/work/JAR được Git bỏ qua; biên bản và mã công cụ có thể bàn giao, không có mật khẩu/cookie/CSRF trong tài liệu này.
