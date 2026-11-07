# Báo cáo nhóm 12 — Huyền Cơ

File Word để nhóm kiểm tra và nộp: **[Nhom12_HuyenCo_Report.docx](Nhom12_HuyenCo_Report.docx)**. Bản cập nhật ngày 01/11/2026 có 29 trang, đã xuất bằng Microsoft Word và kiểm tra hình ảnh từng trang. Số đo X01 gốc vẫn thuộc ngày 29/10/2026.

[Bản Google Docs để nhóm góp ý](https://docs.google.com/document/d/1-PEE9Xkg6vWRlX2NRbQsIc0rk9z3CbGL3lJI5Tbs4lc) được chuyển từ Word đã kiểm tra. Google Docs cũ “Báo cáo LTM test” là mốc nội dung trước khi sắp lại 14 phần; khi nộp dùng file Word ở trên.

| Họ tên | MSSV |
| --- | --- |
| Đào Viết Trọng | B23DCCN846 |
| Doãn Duy Linh | B23DCCN482 |
| Bùi Ngọc Mạnh | B23DCCN526 |

## Nội dung và bằng chứng

- Các mục 1–7: giới thiệu, cơ sở liên quan, định nghĩa bài toán, giải pháp, kiến trúc, giao tiếp mạng và triển khai theo dàn ý `Các đầu mục BC.docx`.
- Mục 8–10: thiết lập thực nghiệm, kết quả và thảo luận tách riêng; bảng benchmark chỉ có một bản tổng hợp ở mục 9.2.
- Mục 11–14: đóng góp, giới hạn, hướng phát triển và tổng kết; `References` đặt sau mục 14.
- Phụ lục A–F: API/JSON, cách chạy TEST, fixture nghiệm thu, ma trận 18 lượt và năm biểu đồ, bằng chứng quá tải, đối chiếu nguồn.
- `HuyenCo_Report.md`: bản nội dung văn bản cùng mô hình dữ liệu với Word, thuận tiện xem diff. Bản Word có phân trang/định dạng riêng.
- `authors.json`: thông tin nhóm do chủ dự án cung cấp; chưa tự gán từng họ tên vào vai trò TV1/TV2/TV3.
- `figures/`: sơ đồ kiến trúc và hình đặt trong báo cáo. Hình benchmark chỉ bỏ tiêu đề/chú thích đã lặp lại trong Word; toàn bộ dữ liệu và nhãn trục được giữ. Bản hình đầy đủ nằm ở `docs/assets/x01/`.
- `evidence-index.json`: nguồn số liệu, SHA-256, trạng thái duyệt và kết quả kiểm báo cáo.
- `evidence/X01-Evidence.zip`: raw 18 lượt, các ca tin cậy, snapshot mã và phân tích đã dùng. `evidence/package-manifest.json` ghi SHA-256 của gói; trong ZIP có manifest cho từng file.

Giữ nguyên công bố **1 SEND muộn 0,022 ms**: 46.028 dòng gắn nhãn measurement, 46.027 request thuộc cửa sổ theo timestamp, đều COMPLETED hợp lệ. Không gọi bản chạy gốc là strict-window PASS tuyệt đối. Tại 20 Client, bounded giảm median khoảng 14,71% nhưng median P99 cao hơn khoảng 59%; báo cáo giữ cả kết quả này và giới hạn ba lượt/ô.

Gói bằng chứng không thay bản phân phối source chạy được. Gói không chứa JAR, database dump, PDF sách hoặc mật khẩu. Bản ghi gốc giữ nguyên byte; các đường dẫn tuyệt đối trong chúng là đường dẫn tại máy đo. Muốn chạy lại các auditor phụ thuộc JAR/DB phải chuẩn bị đúng môi trường theo tài liệu 47–53; giải nén ZIP một mình chưa tạo ra môi trường đó.

## Sửa và dựng lại trên máy hiện tại

Nội dung và dữ liệu gốc nằm trong `scripts/build_x01_report.py`; `scripts/restructure_x01_report.py` sắp nội dung theo 14 mục và phụ lục A–F; thông tin nhóm nằm trong `authors.json`. Script lấy số liệu từ checkpoint X01.6 và kiểm hash bản công bố. Không sửa CSV để làm đẹp kết quả.

Chạy từ gốc dự án, dùng Python/libraries của runtime Documents đã cấu hình trên máy này:

```powershell
& 'C:\Users\abc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\scripts\build_x01_report.py
if ($LASTEXITCODE -ne 0) { throw 'Dừng: chưa dựng được Word.' }
New-Item -ItemType Directory -Force .\scripts\generated\x01_report_qa_20261101 | Out-Null
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\export_x01_report_pdf.ps1 -InputFile .\report\Nhom12_HuyenCo_Report.docx -OutputPdf .\scripts\generated\x01_report_qa_20261101\Nhom12_HuyenCo_Report.pdf
if ($LASTEXITCODE -ne 0) { throw 'Dừng: chưa xuất được PDF kiểm tra.' }
& 'C:\Users\abc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\scripts\render_x01_report.py --docx .\report\Nhom12_HuyenCo_Report.docx --pdf .\scripts\generated\x01_report_qa_20261101\Nhom12_HuyenCo_Report.pdf --output .\scripts\generated\x01_report_qa_20261101\pages-shipping
```

Bước xuất cần Microsoft Word cài trên máy; chạy ẩn, chỉ mở/đóng báo cáo được chỉ định. Đường dẫn runtime bên trên là của máy hiện tại, không phải yêu cầu cài đặt trên mọi máy. PDF/PNG kiểm tra nằm trong `scripts/generated/`, không phải file nộp bổ sung. Sau bất kỳ lần dựng/sửa nào phải kiểm trang lại, cập nhật manifest/trạng thái duyệt và đóng gói bằng chứng lại; builder chủ động đặt trạng thái báo cáo về chờ duyệt.

## Trước khi nộp thật

Theo `Submission.md`, nhóm chỉ nộp **01 DOCX** trên Compilatio với tên đúng mẫu; file ở trên đã dùng số nhóm 12. Theo `Instruction.md`, mức similarity yêu cầu là **≤20%**. Việc kiểm Compilatio và nộp bài **chưa được thực hiện** trong X01.7; không có cam kết trước về điểm similarity.

Nhóm cần đọc lại nội dung, đối chiếu phân công thực tế, chạy kiểm Compilatio và xử lý kết quả, sau đó nộp một DOCX và bàn giao source đầy đủ theo hướng dẫn học phần. Hạn ghi trong `Submission.md`: **23:59 ngày 31/10/2026**. Nếu tiêu chí nghiệm thu yêu cầu tuyệt đối không SEND ngoài cửa sổ ở raw gốc, cần một ma trận mới và cập nhật báo cáo theo số liệu mới; không đổi nhãn bộ bằng chứng hiện tại.

Biên bản hoàn thành X01.7: [tài liệu 54](../docs/54-X01-REPORT-HANDOFF.md).
