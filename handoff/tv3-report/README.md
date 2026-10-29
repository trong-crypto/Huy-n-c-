# Bàn giao dữ liệu viết báo cáo — TV3, nhóm 12

Ngày gom: **29/10/2026**. Thư mục này gom bằng chứng kiểm thử hiện có, dữ liệu đầu vào, biểu đồ, tài liệu học phần và bản báo cáo đã tạo để thành viên 3 viết/đối chiếu báo cáo sau khi kéo GitHub.

Các file được **sao chép nguyên byte**, giữ nguyên bản gốc ở dự án. `MANIFEST.json` ghi đường dẫn nguồn, SHA-256, dung lượng, thời điểm sửa file và loại bằng chứng. Trong lần gom này không chạy lại kiểm thử hoặc truy cập database.

## 1. TV3 bắt đầu từ đâu?

| Mục đích | Mở file/thư mục |
| --- | --- |
| Yêu cầu cấu trúc paper, thực nghiệm và chấm điểm | [Instruction.md](course/Instruction.md) |
| Quy định tên file, Compilatio và nộp bài | [Submission.md](course/Submission.md) |
| Báo cáo Word 19 trang hiện có để tham khảo/tiếp tục biên tập | [Nhom12_HuyenCo_Report.docx](report/Nhom12_HuyenCo_Report.docx) |
| Nội dung báo cáo ở dạng Markdown | [HuyenCo_Report.md](report/HuyenCo_Report.md) |
| Thiết lập và kế hoạch benchmark 2/5/20 Client | [Tài liệu 47](docs/47-X01-BENCHMARK-2-5-20-PLAN.md) |
| Database TEST và baseline | [Tài liệu 48](docs/48-X01-TEST-DATABASE-BASELINE.md) |
| Runner và Backend dùng khi đo | [Tài liệu 49](docs/49-X01-RUNNER-BACKEND-HANDOFF.md) |
| Kết quả chính thức 18 lượt và sai lệch ranh | [Tài liệu 51](docs/51-X01-BENCHMARK-RESULTS.md) |
| Quá tải/idempotency | [Tài liệu 52](docs/52-X01-OVERLOAD-IDEMPOTENCY-ACCEPTANCE.md) |
| Phân tích, giới hạn và gợi ý thảo luận | [Tài liệu 53](docs/53-X01-BENCHMARK-ANALYSIS.md) |
| Phạm vi bản báo cáo đã hoàn thành | [Tài liệu 54](docs/54-X01-REPORT-HANDOFF.md) |

Đọc 47/48/49 để viết **Experimental Setup**; dùng 51/52 và CSV để viết **Results**; dùng 53 để đối chiếu **Discussion/Limitations**. Những tài liệu 01–46 còn lại mô tả phạm vi, giao thức, dữ liệu sách, các module và nghiệm thu chức năng trước X01.

## 2. Các thư mục đã gom

| Thư mục | Nội dung và cách dùng |
| --- | --- |
| [`docs/assets/x01/`](docs/assets/x01/) | Bộ **đã duyệt**: `per-run.csv` đủ 18 lượt, `aggregate.csv` sáu ô, `differences.csv`, `boundary-exclusions.csv`, `timeline.csv`; năm hình PNG/SVG và manifest công bố |
| [`raw/benchmark/`](raw/benchmark/) | **Toàn bộ 18 lượt chính thức**; mỗi thư mục `benchmark-<N>-<mode>-r<lần>` có `runner/raw.csv`, `runner/summary.json`, `runner/events.jsonl`, log, mẫu CPU/RAM, cấu hình và snapshot DB |
| [`raw/reliability/`](raw/reliability/) | Records/events, log, control transcript, audit và snapshot cho X01.5 quá tải/idempotency |
| [`raw/analysis-final/`](raw/analysis-final/) | Bản phân tích X01.6 **đã chốt**, gồm `analysis.json`, audit, checksum và mã phân tích snapshot |
| [`raw/functional/`](raw/functional/) | Các file nghiệm thu/đối soát đã có từ A02, B01–B04, C01, D01–D04, E01/E02, H01, M02/M03 và V12; xem prefix tên file và các biên bản tương ứng |
| [`raw/checkpoints/`](raw/checkpoints/) | Checkpoint kết thúc, target và mốc công việc X01; mỗi checkpoint giữ trạng thái tại lúc nó được tạo |
| [`raw/pilot/`](raw/pilot/) | Pilot X01.3, dùng xác nhận điều kiện trước ma trận chính thức |
| [`raw/preflight/`](raw/preflight/) | Các lượt kiểm tra môi trường/smoke, gồm cả lần trước/sau sửa runner |
| [`raw/preparation/`](raw/preparation/) | Lịch sử chuẩn bị/kiểm database TEST |
| [`raw/backend-build/`](raw/backend-build/) | Manifest/hash của Backend đã đo |
| [`raw/analysis-drafts/`](raw/analysis-drafts/) | Các bản phân tích trung gian để lưu lịch sử. **Số liệu viết báo cáo lấy ở `docs/assets/x01/` và `raw/analysis-final/`.** |
| [`raw/report-qa/`](raw/report-qa/) | Hồ sơ kiểm cấu trúc/số liệu/dàn trang báo cáo |
| [`tests/backend/surefire-reports/`](tests/backend/surefire-reports/) | Snapshot các XML/TXT/dumpstream Maven đang có; thời điểm từng file được ghi trong manifest |
| [`tests/backend/source/`](tests/backend/source/), [`tests/frontend/source/`](tests/frontend/source/), [`scripts/tests/`](scripts/tests/) | Mã test để đối chiếu điều kiện kiểm; sự tồn tại của mã test tự nó chưa chứng minh một lần chạy đã PASS |
| [`scripts/`](scripts/), [`client/scripts/`](client/scripts/) | Snapshot công cụ kiểm toán, nhập dữ liệu, smoke và runner |
| [`docs/examples/`](docs/examples/) | Fixtures/hợp đồng JSON để minh họa request/response |
| [`data/`](data/) | CSV/JSON đầu vào và hồ sơ nguồn tri thức đã dùng trong dự án |
| [`report/`](report/) | Word, Markdown, thông tin ba tác giả, hình và gói `evidence/X01-Evidence.zip` đã có |
| [`course/`](course/) | Bốn file học phần do chủ dự án cung cấp, lưu nguyên văn để đối chiếu yêu cầu |

Các đường dẫn tuyệt đối nằm bên trong raw/log là đường dẫn ở máy đo. Bản sao đã đổi vị trí theo bảng trên; tra trường `source` trong `MANIFEST.json` để tìm vị trí gốc. Ví dụ `scripts/generated/x01_matrix_.../` ở máy đo tương ứng `raw/benchmark/` trong gói này.

## 3. Quy tắc dùng số liệu khi viết

1. Ma trận chính thức có **18 lượt = 2/5/20 Client × direct/bounded × 3 lần**. Pilot và smoke được ghi riêng, không cộng vào ma trận.
2. Raw có 46.028 dòng gắn nhãn measurement; cohort theo timestamp có **46.027 COMPLETED hợp lệ/0 lỗi**. Giữ công bố **1 SEND muộn 0,022 ms** và `strictSendWindowSatisfied=false`.
3. 20 Client: bounded giảm median khoảng **14,71%**, P95 khoảng **1,96%**, throughput tăng khoảng **0,39%**; median P99 cao hơn khoảng **59%**. Trình bày đầy đủ cả đánh đổi này.
4. Tổng hợp dùng median/min–max của ba lượt; min–max không phải confidence interval. Tải chính là LINES, nghỉ 200 ms, tối đa một request chờ mỗi Client; kết quả có phạm vi tương ứng.
5. X01.5 có 7 tình huống tin cậy đạt; kết quả này tách khỏi ma trận latency/throughput.
6. Các log chức năng/Maven được tạo ở nhiều thời điểm, có thể chứa lượt kiểm lặp, cảnh báo hoặc lỗi đã xử lý. Ghi đúng lần chạy/biên bản; không cộng các tổng test chồng lặp thành một lượt duy nhất và không tự gọi mọi file lịch sử là PASS.
7. Phân biệt `SOURCE_VERIFIED` với `TEAM_DECISION` và ghi giới hạn ấn bản sách theo hồ sơ dự án. Bản gom dữ liệu không thay đổi trạng thái phê duyệt nguồn.

Các công cụ trong gói là bản lưu để đối chiếu. Chạy lại hệ thống/auditor cần mã dự án chính, runtime, JAR pin và PostgreSQL TEST theo tài liệu bàn giao. JAR, database dump/backup, PDF sách, ảnh trang sách và ảnh/PDF dàn trang trung gian được giữ ở máy gốc; chúng không phải số liệu cần đưa vào báo cáo này.

## 4. Kiểm tra sau khi kéo GitHub

Từ gốc repository, dùng Python 3.10 trở lên, chỉ cần thư viện chuẩn:

```powershell
python .\handoff\tv3-report\verify.py
```

Kết quả phải có `status: PASS`, `missing: 0`, `changed: 0`. Script kiểm toàn bộ file trong manifest, không truy cập database. Khi biên tập, nên tạo một bản Word mới và giữ các file bằng chứng để đối chiếu; sửa trực tiếp file có hash sẽ được verifier phát hiện.

File `.gitignore` riêng trong gói cho phép đưa các log đã rà soát lên Git. Bản scan không thấy trường credential thực tế hoặc URL chứa mật khẩu thật; các URL tài khoản giả trong test bảo mật dùng miền example được giữ nguyên để đúng test nguồn.

## 5. Chủ dự án đưa gói này lên GitHub

Từ gốc repository, chọn riêng thư mục bàn giao để tránh gom nhầm các thay đổi khác đang làm:

```powershell
git status --short
git add -- handoff/tv3-report
git diff --cached --stat
git commit -m "docs: hand off test evidence for TV3 report"
git push origin HEAD
```

`git push origin HEAD` đẩy lên **nhánh đang đứng**; dùng `git branch --show-current` để biết tên nhánh và gửi đúng tên đó cho TV3. Nếu nhóm yêu cầu `main`, thực hiện quy trình merge/push main của nhóm sau khi xem nội dung commit. Lần gom này chưa stage, commit hoặc push hộ chủ dự án.

TV3 kéo nhánh đã được nhóm thống nhất, mở README này rồi chạy verifier. Quy định nộp một DOCX/Compilatio và thời hạn nằm ở `course/Submission.md`; việc bàn giao bằng chứng chưa thực hiện nộp bài.
