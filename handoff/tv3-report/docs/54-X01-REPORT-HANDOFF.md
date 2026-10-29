# X01.7 — Bàn giao báo cáo nhóm 12

Ngày hoàn thành: 29/10/2026. Trạng thái: **DONE cho việc viết, tích hợp bằng chứng và kiểm dàn trang báo cáo**. Không đồng nghĩa đã nộp Compilatio hoặc đã đạt strict-window ở bộ raw X01.4.

## 1. File bàn giao

- [Báo cáo Word nhóm 12](../report/Nhom12_HuyenCo_Report.docx): 19 trang, tên `Nhom12_HuyenCo_Report.docx` đúng mẫu học phần.
- [Hướng dẫn báo cáo](../report/README.md), [nội dung văn bản](../report/HuyenCo_Report.md), [thông tin tác giả](../report/authors.json), [chỉ mục nguồn và kiểm tra](../report/evidence-index.json).
- [Gói bằng chứng X01](../report/evidence/X01-Evidence.zip), [manifest gói](../report/evidence/package-manifest.json): giữ raw, snapshot và phân tích để bàn giao cùng source. Không dùng ZIP thay file DOCX nộp Compilatio.

| Họ tên | MSSV |
| --- | --- |
| Đào Viết Trọng | B23DCCN846 |
| Doãn Duy Linh | B23DCCN482 |
| Bùi Ngọc Mạnh | B23DCCN526 |

Thông tin do chủ dự án cung cấp. Chưa có xác nhận gán từng tên vào TV1/TV2/TV3, vì vậy báo cáo mô tả trách nhiệm theo vai trò mà không tự gán tên.

## 2. Nội dung đã tích hợp

| Phần báo cáo | Vị trí | Bằng chứng chính |
| --- | --- | --- |
| Experimental Setup | Mục 8, trang 6–7 | TEST V12, phần cứng/runtime/JAR pin, direct/bounded, 18 lượt, tải LINES và phương pháp đo |
| Results | Mục 9, trang 8–9 | Sáu ô tổng hợp; khoảng P95; 7 tình huống tin cậy; phạm vi tài nguyên và DB |
| Discussion | Mục 10, trang 10 | Đánh đổi median/P99, giới hạn tải vòng kín, nguyên nhân queue từ chối có bằng chứng riêng |
| Novelty/Contributions, Limitations, Future Work | Mục 11–13, trang 11–12 | Phạm vi đóng góp kỹ thuật; giới hạn dữ liệu nguồn và thực nghiệm; việc còn lại |
| Conclusion, vai trò, sử dụng AI | Mục 14, trang 12 | Kết luận có giới hạn, phân công theo vai trò, công khai công cụ hỗ trợ |
| References | Mục 15, trang 13 | 13 mục có dẫn trong bài; RFC/STOMP/Spring/JDK và hồ sơ nguồn dự án |
| Dữ liệu và hình | Phụ lục A–B, trang 14–19 | Bảng đủ 18 lượt; đường dẫn artifact; năm biểu đồ có chú thích |

Ngoài phần X01, báo cáo có abstract/keywords/introduction/background/problem/approach/architecture/network communication/implementation theo cấu trúc paper trong `Instruction.md`. Không tự thêm giảng viên, mã đề tài hoặc thông tin ấn bản chưa được cung cấp/xác minh.

## 3. Kết quả và giới hạn được giữ nguyên

1. Raw giữ 46.028 dòng mang nhãn measurement; cohort theo SEND timestamp có **46.027 COMPLETED hợp lệ/0 lỗi**. Một SEND muộn **0,022 ms** ở 20/bounded/r1 được giữ trong raw và công bố; `strictSendWindowSatisfied=false`.
2. Tổng hợp dùng median/min–max của ba chỉ số theo lượt, không gọi min–max là confidence interval. ECDF gộp được ghi rõ phạm vi, không thay percentile theo lượt.
3. 20 Client: bounded giảm median khoảng **14,71%**, P95 khoảng **1,96%**, throughput tăng khoảng **0,39%**; median P99 tăng khoảng **59%**. Không kết luận bounded tốt hơn toàn bộ phân bố hoặc đo được công suất tối đa.
4. Tải là STOMP LINES không lời luận, mỗi Client một request chờ, nghỉ 200 ms; 192 cặp input seed, không phải toàn bộ 384 tổ hợp chức năng.
5. Java CPU/bộ nhớ bao gồm vòng đời được lấy mẫu; Node dùng sample trong cửa sổ; không đo CPU PostgreSQL riêng. Không suy rộng sang UI, LAN/WAN hay mọi chức năng.
6. X01.5 có **7/7 tình huống đạt**, tách khỏi 18 lượt hiệu năng. Ca queue có kiểm soát dùng TEST và khóa ngắn đã ROLLBACK; đây không phải tải người dùng tự nhiên.
7. X01.7 chỉ đọc artifact, viết báo cáo và đóng gói; không kết nối/migrate/nhập DB, không chạy lại ma trận, không đổi byte raw hoặc đóng dấu các quy tắc sách chưa xác minh.

Nguồn nguyên thủy: [51](51-X01-BENCHMARK-RESULTS.md), [52](52-X01-OVERLOAD-IDEMPOTENCY-ACCEPTANCE.md), [53](53-X01-BENCHMARK-ANALYSIS.md) và `docs/assets/x01/publication-manifest.json`. Tài liệu 53/manifest đã duyệt được giữ nguyên hash; checkpoint X01.6 còn ghi “next X01.7” là trạng thái lịch sử tại thời điểm đó.

## 4. Kiểm tra bàn giao

- Đối chiếu group 12, ba tên/MSSV và tên file với thông tin chủ dự án.
- Đối chiếu bảng sáu ô và phụ lục 18 lượt với CSV đã duyệt; kiểm tổng cohort, dòng ngoài ranh, độ đúng và phạm vi chỉ số.
- Kiểm DOCX hợp lệ, 11 bảng, 6 hình có mô tả, heading/references và các dẫn nguồn.
- Xuất đúng DOCX qua Microsoft Word chạy ẩn, render bằng pipeline Documents/Poppler và xem đủ **19/19 trang**; nhãn trục đầy đủ, không có trang trắng, bảng/hình không chồng/cắt.
- Lưu SHA-256 báo cáo, hình và trang kiểm tra ở `report/evidence-index.json`; kiểm hash từng file khi đóng gói ZIP.
- Giữ các thay đổi có sẵn trong working tree, không commit/push hoặc upload hộ nhóm.

Checkpoint máy hiện tại: `scripts/generated/x01_report_completed.json`. PDF/PNG dùng QA nằm trong `scripts/generated/x01_report_qa_20261029/`; file nộp vẫn chỉ là Word.

## 5. Việc còn lại trước nộp

Theo `Submission.md` và `Instruction.md` do chủ dự án cung cấp, nhóm cần tự đọc/xác nhận bản cuối, kiểm **Compilatio similarity ≤20%**, nộp một DOCX và bàn giao source chạy được/README/Drive hoặc USB theo quy định. Hạn ghi trong học phần: **23:59 ngày 31/10/2026**. Chưa chạy Compilatio hoặc nộp bài; việc viết xong báo cáo không xác nhận hai bước đó đã đạt.

Nếu cần tiêu chí tuyệt đối không SEND ngoài cửa sổ ở bản đo gốc, chạy một ma trận mới với runner đã sửa rồi cập nhật số liệu và hình. Bộ X01 hiện tại được hoàn thành hồ sơ với sai lệch đã công bố, không đổi thành strict-window PASS.
