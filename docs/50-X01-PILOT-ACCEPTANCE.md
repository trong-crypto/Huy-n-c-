# X01.3 — Nghiệm thu pilot 2 và 20 Client

**Ngày 29/10/2026, giờ Việt Nam. Trạng thái: PASS — sẵn sàng X01.4.** Đã chạy bốn lượt pilot thật, ngoài ma trận benchmark chính thức 18 lượt. Giữ nguyên dữ liệu, binary và các tham số đã chốt ở X01.2; chỉ đổi direct/bounded theo từng ô.

Cập nhật sau pilot: đã chạy ma trận18 lượt, kết quả và sai lệch ranh được công bố tại [biên bản51](51-X01-BENCHMARK-RESULTS.md). Các số trong tài liệu này tiếp tục chỉ là pilot.

## 1. Môi trường và lệnh đã chạy

- Database: `huyenco_benchmark_test_20261029_010531`, snapshot V12 theo biên bản 48.
- JAR giữ nguyên SHA-256 `71a9d31d11adda8f50330398e87ccad6029fe7782b0a5b6239eaabf1bad0ab39`, JDK 17.0.12, heap `-Xms256m -Xmx512m`.
- Spring profile db, Flyway tắt, Hikari read-only/pool 8. Bounded dùng 4 worker/queue 100; deadline 10 giây; TTL idempotency 60 giây, registry 10.000.
- Runner Node 24.21.0, cùng hash source/toolchain/package-lock cho bốn lượt. Cùng launch command, chỉ đổi calculation-mode theo ô đo.
- Loopback: Backend `127.0.0.1:18091`, Origin `http://127.0.0.1:3173`. Không đo LAN hoặc render UI.
- Workload LINES thật, UUID mới, tối đa một request chưa terminal/Client, nghỉ tối thiểu 200 ms; không cookie/reconnect/retry tự động.
- Mỗi lượt: readiness từng kết nối, **warm-up 2 giây, cửa sổ đo 5 giây**, thu nốt tối đa 15 giây. Khởi động Backend mới từ cùng JAR và dừng tiến trình do wrapper tạo sau mỗi lượt.

Lệnh đã dùng từ repository root, mật khẩu cấp qua môi trường chứ không ghi vào tài liệu:

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command '& .\scripts\run_x01_benchmark.ps1 -Action Pilot -Clients 2,20 -Mode both'
```

Thứ tự: 2 direct → 2 bounded → 20 direct → 20 bounded. Đây là một lượt pilot mỗi cấu hình, chưa có ba lần lặp hoặc thứ tự cân bằng của ma trận chính thức.

## 2. Kết quả pilot thực tế

Latency tính từ mốc gửi tới lúc nhận terminal tại cùng runner. Median/p95 dưới đây chỉ lấy COMPLETED hợp lệ của cohort 5 giây; p95 nearest-rank, làm tròn hai chữ số thập phân để trình bày.

| Client | Mode | Gửi / COMPLETED trong cohort | Median (ms) | P95 (ms) | Throughput trong cửa sổ (request/s) | Lỗi |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2 | direct | 46 / 46 | 4,80 | 7,54 | 9,2 | 0 |
| 2 | bounded | 46 / 46 | 4,45 | 8,19 | 9,2 | 0 |
| 20 | direct | 460 / 460 | 5,02 | 9,38 | 92,0 | 0 |
| 20 | bounded | 460 / 460 | 5,26 | 32,88 | 92,0 | 0 |

Không có terminal cohort đến sau cửa sổ trong bốn lượt này. Tỷ lệ COMPLETED hợp lệ 100%; không quan sát thấy SERVER_BUSY, timeout, lỗi DB/nguồn, publish/transport/protocol, sai phiên, terminal lặp hoặc kết quả sai.

Phân tách số lượng để không đưa warm-up/readiness vào số đo:

| Client / mode | Readiness | Warm-up | Cohort đo | Tổng COMPLETED | Tổng progress |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 direct | 2 | 20 | 46 | 68 | 272 |
| 2 bounded | 2 | 20 | 46 | 68 | 272 |
| 20 direct | 20 | 200 | 460 | 680 | 2.720 |
| 20 bounded | 20 | 200 | 460 | 680 | 2.720 |
| **Tổng** | **44** | **440** | **1.012** | **1.496** | **5.984** |

Throughput ghi nhận là mức đạt được với tải vòng kín/khoảng nghỉ 200 ms, không phải thông lượng cực đại. Nhịp gửi thực tế bằng nhịp hoàn tất trong cửa sổ ở bốn lượt này và đã được ghi trong raw/summary.

## 3. Kiểm độc lập và điều kiện qua pilot

- Đọc lại raw CSV, tính median/p95/throughput bằng Python độc lập và so summary Node: khớp; không trộn readiness/warm-up vào cohort.
- Kiểm thời điểm SEND nằm trong cửa sổ, latency bằng hiệu timestamp đơn điệu, cờ kết quả đến sau cửa sổ và phép đối soát các bộ đếm: đạt.
- Đủ peak 2/20 kết nối thật, HTTP upgrade 101, một STOMP connection/Client; không tự reconnect/resend. Mỗi request có UUID mới, đúng inputCase theo seed Client và sequence.
- Mỗi COMPLETED có bốn progress theo thứ tự. Kiểm hợp đồng, hình/mã ba quẻ, hào động, nguồn và đúng request/phiên do oracle/handler Node thực hiện trên response thật; auditor Python kiểm sổ ghi/timing/chỉ số, không dựng lại response từ CSV.
- Khoảng nghỉ tối thiểu quan sát được lần lượt: 200,264 / 200,493 / 200,173 / 200,034 ms, kể cả ranh warm-up/measurement.
- Hash/schema/count của TEST trước/sau từng lượt khớp baseline X01.1. Phiên/lịch sử vẫn 0/0. Không migrate/import/cấp approval hoặc ghi vào database nguồn.
- Mỗi lượt chỉ tạo tối đa 680 ID, thấp hơn registry 10.000. Tối đa 20 request chưa terminal; bài này chưa kích hoạt queue 100 đầy hoặc đo trực tiếp occupancy nội bộ. Không suy ra đã nghiệm thu overload/idempotency chỉ từ việc không có SERVER_BUSY.
- Bốn sampler tài nguyên exit 0, có mẫu CPU/RAM/OS thread. Các Java/sampler do wrapper tạo đã dừng.

CPU runner trong các khoảng lấy mẫu thuộc cửa sổ đo:

| Client / mode | CPU trung bình (% một logical core) | RSS lớn nhất (MiB) |
| --- | ---: | ---: |
| 2 direct | 2,74 | 103,53 |
| 2 bounded | 2,71 | 113,40 |
| 20 direct | 12,46 | 127,49 |
| 20 bounded | 10,08 | 128,22 |

Mẫu CPU cao nhất của runner khoảng 18,44% một core, không cho thấy CPU runner bão hòa trong pilot. Lấy mẫu không loại trừ được mọi tác động scheduler/timer. Histogram event loop của Node có resolution 20 ms, không phải latency request. Mẫu Server ghi toàn vòng đời Java, gồm khởi động/JIT; không đem CPU/RAM đó so như thể chỉ thuộc cửa sổ đo. OS thread cũng không phải số Java managed thread qua JMX.

## 4. Nhận xét và quyết định

**Cho phép chuyển sang X01.4 với cấu hình hiện tại.** Không phát hiện lỗi chặn về giao thức, sổ đo, dữ liệu hoặc lifecycle cần sửa trước ma trận chính thức.

Ở 20 Client, p95 bounded 32,88 ms cao hơn direct 9,38 ms trong pilot này. Đây là quan sát thực, chưa đủ kết luận phương án nào tốt hơn: mỗi cấu hình mới có một cửa sổ 5 giây với warm-up 2 giây. Giữ nguyên binary/workload/cấu hình và chạy ma trận 10 giây warm-up/60 giây đo × 3 lần theo tài liệu 47 để phân tích tiếp.

Các giới hạn còn nguyên: chưa đo cực đại/saturation, chưa có ma trận ba mức 2/5/20 đầy đủ, chưa thử queue đầy/TTL/replay/reconnect riêng, chưa suy rộng hiệu năng LINES sang lời luận chi tiết/Tam Thế/REST/history/UI. Backend/UI demo ở 18090/3173 được giữ hoạt động; tránh tạo tải UI khác khi chạy phép đo chính thức trên cùng máy.

## 5. Bằng chứng và tái lập

Thư mục pilot: `scripts/generated/x01_pilot_20261029_015503_004770/`.

- `runs.json`: kết quả bốn lượt, config và summary gốc.
- Bốn thư mục `pilot-<clients>-<mode>-r1/`: raw CSV, sự kiện, resource samples, môi trường, log, database_before/after.
- `analyze_pilot.py`: mã kiểm độc lập chỉ đọc artifact, không kết nối database hoặc khởi động tiến trình.
- `pilot_analysis.json`: đối chiếu, chỉ số tính lại và tài nguyên/giới hạn; `pilot_summary.csv`: bảng rút gọn.
- `scripts/generated/x01_ready_for_matrix.json`: checkpoint **READY_FOR_X01_4**, cùng database/JAR; số lượt benchmark chính thức thực hiện trong task này là 0.

Tính lại từ bằng chứng cục bộ:

```powershell
python .\scripts\generated\x01_pilot_20261029_015503_004770\analyze_pilot.py
```

Artifact `x01_*` được Git bỏ qua; file này là biên bản bàn giao, không chứa mật khẩu/cookie/CSRF. Pilot không thay thế 18 lượt chính thức. **Tiếp theo: X01.4 — chạy ma trận 2/5/20 × direct/bounded × 3 lần theo thứ tự đã chốt; chưa tự chạy ma trận trong task X01.3 này.**
