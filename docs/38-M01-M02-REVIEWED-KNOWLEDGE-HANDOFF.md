# M01 và phần dữ liệu M02 — biên bản bàn giao

**Triển khai vào huyenco26/10 đã xong theo [43](43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md):** có V12 và cùng bộ M01 đã duyệt như TEST, không đổi hash/review; dữ liệu nền giữ nguyên. Các dòng chỉ có trên TEST/huyenco V11 ở biên bản giai đoạn dữ liệu này là lịch sử. M03/D04 trên DB chính đã nghiệm thu bằng code mới, không cần sửa runtimeEnabled của hồ sơ M01.

**Cập nhật sau D04 ngày26/10:** cả service Mai Hoa M03 và Tam Thế EXTENDED D04 đã chạy thật theo [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md)/[42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md). D04 kiểm720 tổ hợp và giữ nguyên bundle/seed/review; không còn gate IMPLEMENTATION_UNAVAILABLE trên service đã nối đúng TEST V12. Biên bản này giữ đúng lịch sử giai đoạn dữ liệu; DB huyenco vẫn V11, I02/T02 còn làm.

**Cập nhật sau M03 ngày26/10:** Mai Hoa đã có service thật theo [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md); chốt IMPLEMENTATION_UNAVAILABLE của Mai Hoa trong mốc M02 bên dưới đã được thay. Tam Thế EXTENDED còn D04. Bundle M01/hash/review và runtimeEnabled=false giữ nguyên hồ sơ lịch sử; code M03 kiểm snapshot DB rồi cấp quyền theo scoped rule, không sửa dữ liệu nguồn để bật tính năng. Biên bản này tiếp tục mô tả đúng lượt nhập dữ liệu trước M03.

**26/10/2026: M01 và phần schema/import M02 đã chạy đạt trên PostgreSQL TEST.** Đây là biên bản giai đoạn dữ liệu. **Cập nhật tiếp: phần DTO/validator/shared guards/fixtures M02 đã hoàn thành ở [40](40-M02-CONTRACT-HANDOFF.md)**; input mới hợp lệ được nhận rồi trả IMPLEMENTATION_UNAVAILABLE chờ service M03/D04. Giao diện thuộc TV1. Kế hoạch ở [37](37-DETAILED-INTERPRETATION-EXPANSION-PLAN.md); hợp đồng đang áp dụng ở [39](39-DETAILED-READINGS-CONTRACT.md). Các dòng “chưa chạy Server/DTO” trong bằng chứng dưới đây phản ánh đúng lượt dữ liệu trước kiểm hợp đồng40.

## 1. Sản phẩm đã làm

| Thành phần | Đã hoàn thành | Giới hạn |
| --- | --- | --- |
| Mai Hoa | 20 mẫu luận: GENERAL/CAREER/WEALTH/LOVE × 5 quan hệ | Diễn giải biên tập có nguồn; không gọi là 64 bài luận hay 384 lời hào nguyên văn |
| Sang hèn | 12 đoạn diễn giải, 144 khóa Chi năm–tháng âm | Phép riêng ở PDF43–44; không phải lấp 60 khóa thiếu của bảng Lộc |
| Điền sản | 7 đoạn diễn giải, 60 khóa hành mệnh–tháng âm | Phép riêng ở PDF49–50, bảo tồn nhãn Phú/Phá |
| Quyết định | 7 hồ sơ về quan hệ, chọn Thể, giai đoạn, mùa, nhãn và tham chiếu | Phần quy ước dự án vẫn mang TEAM_DECISION; không đổi MH-THE-DUNG 1.0 thành VERIFIED |
| Database | V12 thêm bốn bảng; importer có kiểm nguồn, sao lưu, transaction và chống sửa bản ghi đã duyệt | Chỉ áp dụng mới ở TEST; không mở catalog runtime hoặc thay đổi bảng nghiệp vụ cũ |

Hồ sơ đọc được bằng máy: [dữ liệu M01](../data/m01_reviewed_readings.json) và [manifest](../data/m01_readings_manifest.json). SHA-256 văn bản UTF-8 chuẩn hóa xuống dòng: `e3c460cdfe1a96546b243155205d12e8a27c1e45882452344a7dafa778e295b6`. Các mẩu nội dung có `sourceStatus=VERIFIED`, `basis=SOURCE_VERIFIED`, `textKind=EDITORIAL_PARAPHRASE`, trang nguồn và review riêng. Hai lượt nhìn ảnh đều do **cùng Codex**, không phải hai người xác minh độc lập.

Hồ sơ S04 được giữ nguyên ở SOURCE_SURVEY_ONLY. M01 là hồ sơ mới, không sửa lịch sử khảo sát để làm như dữ liệu đã được duyệt ngay từ đầu. Chốt hash bảo vệ bộ chép đã đối chiếu; kiểm hash/đếm khóa không thay việc đọc sách.

## 2. Nguồn và cách xử lý mâu thuẫn

Mai Hoa dùng PDF đúng SHA `225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de`. Đã nhìn ảnh toàn trang lượt hai ở PDF131–135/in137–141, 150–151/in156–157, 156–158/in162–164, 224–225/in231–232, 227–228/in234–235. Tam Thế dùng SHA `7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d`; đã nhìn lại PDF43–44/in44–45 và PDF49–50/in50–51 ở độ phân giải cao. Ảnh làm việc ở `work/m01/review/`, được bỏ qua bởi Git; cần hai PDF gốc để kiểm lại.

| Điểm | Quyết định đã ghi | Điều chưa được khẳng định |
| --- | --- | --- |
| Chọn Thể/Dụng | Phía không có hào động là Thể; giữ Thể gốc khi xét Dụng biến | Chưa tìm được câu tổng quát bao phủ sáu vị trí theo ấn bản; ví dụ Cách chỉ là căn cứ hỗ trợ. Quy tắc này là TEAM_DECISION/CALCULATION |
| Hai quái hỗ | Xét riêng cả hai so Thể gốc; gắn vai trò theo vị trí | Không gộp điểm, không chọn một phía để che mâu thuẫn; câu dịch PDF228 không được sửa mất |
| Quan hệ có chiều | Dùng nguyên văn PDF132, đối chiếu từng mục cầu danh/cầu tài/hôn nhân | Không dùng câu dịch PDF134 nhầm đảng Thể/Dụng để tạo thuật toán điểm số |
| Mùa | Quy ước tháng âm: 1–2 Xuân, 4–5 Hạ, 7–8 Thu, 10–11 Đông; 3/6/9/12 Thổ. Nhuận giữ cùng số | Đây không phải thuật toán tiết khí đã xác minh. LINES/OBJECT_COUNT thiếu thời điểm thì bỏ phần mùa, không lấy ngày máy |
| Sang hèn | Lưu bảng Hoa cái / Vong sát / Tướng linh / Thiên an và tiêu đề Hao Cái / Vong Thần / Tướng Tinh / Phiên An riêng; nối theo cột | Không tuyên bố đính chính của nhà xuất bản. Bản diễn giải Hao Cái/Tướng Tinh chỉ dùng phần đọc rõ, không đoán token/chữ khó đọc |
| Điền sản | Lưu nhãn bảng Phú và tiêu đề đoạn Phá, nối cột 6; dùng hành mệnh TT-NGU-HANH đã duyệt | Bản in vẫn dẫn Số 6; dự án dùng Số 4 là quyết định nối dữ liệu, không phải câu in đã xác minh |

Mọi bản diễn giải chỉ trình bày nội dung quan niệm trong nguồn; không suy ra ngày gặp người yêu, chức danh, số tiền, xác suất hoặc sự kiện chắc chắn từ câu hỏi tự do. Các mâu thuẫn biên tập phải đi theo kết quả runtime sau này, không chỉ cất trong database.

## 3. Schema và nhập dữ liệu

V12 tạo `reading_source_bundles` (hồ sơ review và quyết định đầy đủ), `mai_hoa_reading_templates`, `tam_the_supplement_results`, `tam_the_supplement_mappings`. Chọn bảng riêng để có thể triển khai phiên bản mới mà không sửa 447 dòng Tam Thế đang phục vụ Client cũ hoặc giả rằng các quy tắc mới đã có trong catalog. Khóa ngoại buộc kết quả/ánh xạ thuộc đúng bundle và phép tra; JSON nguồn lưu nguyên nhãn, trang, loại văn bản và review. Không lưu 204 đoạn lặp lại khi chỉ có 19 đoạn nguồn.

Importer [import_m02_readings.py](../scripts/import_m02_readings.py) mặc định dry run. `--apply` yêu cầu đích DB rõ ràng, hai PDF khớp hash, Flyway V12 thành công, credential trong biến môi trường và `pg_dump` toàn DB thành công. Toàn bộ import chạy một transaction, khóa bảng, giới hạn thời gian chờ. Rerun chỉ nhận dữ liệu giống hệt; nếu nội dung/metadata/nguồn bị sửa hoặc một bundle đang có bị xóa thiếu, dừng và rollback. Không tự ghi đè, không tự "sửa" dữ liệu đã duyệt. Lỗi giữa chừng không để lại nửa bộ dữ liệu.

Wrapper [import_m02.ps1](../scripts/import_m02.ps1) sao lưu **trước schema** rồi migrate đến V12, sau đó importer sao lưu lần nữa trước nhập. Không ghi mật khẩu vào file. Database đích phải tồn tại; với một DB trống cần chạy bootstrap bản nền trước. Maven dùng cache offline; nếu thiếu dependency thì giải quyết môi trường trước, không bỏ migration/guard.

Dry run từ repo root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_m02.ps1
```

Áp dụng có đích rõ ràng, ví dụ TEST đã tạo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_m02.ps1 -Apply -DbName huyenco_m02_test_20261026
```

Không cần chạy lại ngay: bộ dữ liệu đã có trên TEST nêu trên. Chưa chạy wrapper lên `huyenco`; chờ M03/D04/T02 kiểm nghiệp vụ mở rộng trước khi áp dụng vào DB dự án. Backup ở `scripts/generated/db-backups/` bị bỏ qua bởi Git, có thể chứa dữ liệu riêng nếu người dùng chọn DB có lịch sử; không bàn giao backup đó cho TV1.

## 4. Bằng chứng đã chạy

- `check_m01_readings.py --pdf-dir ...`: hai PDF khớp hash, 20 mẫu/19 đoạn/204 khóa, nhãn và quyết định đúng manifest.
- 11 kiểm hồi quy Python đạt: cấm tự nâng quy ước thành source verified, thiếu review/trang, giả review độc lập, sửa nhãn/chủ đề/ô bảng, JSON trùng khóa và sửa dữ liệu kèm cập nhật manifest.
- Database mới `huyenco_m02_test_20261026`, PostgreSQL18: bootstrap từ trống hai lần bằng `import_all.ps1`, mỗi lần nối importer M02. Tất cả bản ghi và thời điểm duyệt giống hệt sau lần hai.
- Số dòng V12: bundle **1**, mẫu Mai Hoa **20**, đoạn Tam Thế **19**, ánh xạ **204** = Sang hèn144 + Điền sản60.
- **8/8** ca sửa nguồn/nội dung/reviewer/hash/nhãn/ô hoặc xóa thiếu bị chặn, **3/3** ca dữ liệu sai bị CHECK từ chối. Tất cả được rollback; snapshot cuối vẫn giống trước thử lỗi.
- Audit bản nền trên TEST: **54 PASS / 0 FAIL / 0 PENDING**. Audit này chỉ kiểm phạm vi cũ; kiểm dữ liệu mới nằm trong báo cáo M02 riêng.
- Phiên và lịch sử trên TEST đều **0**. Không sao chép hoặc sửa database `huyenco`. Chưa chạy Server, chưa nghiệm thu STOMP/lịch sử cho DTO mới và chưa kiểm UI TV1.
- Wrapper PowerShell đã chạy dry run và apply lặp trên TEST: backup trước schema, Flyway xác thực12 migration rồi no-op, importer so sánh dữ liệu đạt. Flyway11.7.2 có cảnh báo phạm vi hỗ trợ mới kiểm tới PostgreSQL17, trong khi máy dùng18.6; migration/import trên TEST này thành công, chưa thay dependency Flyway trong đợt dữ liệu.

Kết quả máy: `scripts/generated/m02_database_test_report.json`; snapshot SHA `4543343a82c7eefb161b15bd359284c3dae350617a362aa56bcac0d180195f86`. Báo cáo và log test được bỏ qua bởi Git. Tạo TEST khác để lặp lại độc lập, script từ chối tên đã tồn tại:

```powershell
# PGPASSWORD lấy qua prompt/biến môi trường riêng, không đưa vào lệnh hoặc file Git.
python .\scripts\test_m02_database.py --database huyenco_m02_test_recheck
```

## 5. Phần tiếp theo

Phần DTO/validation/shared types/fixtures M02 đã hoàn thành và kiểm theo40. **Tiếp theo M03** nối lời luận Mai Hoa vào STOMP/H01/N01; D04 nối Sang hèn/Điền sản và giữ tình trạng Lộc không có giao điểm. T02 kiểm1536 tổ hợp Mai Hoa,720 năm–tháng Tam Thế và nguồn/session/history trên TEST; I02 do TV1. Hoàn thành schema/hợp đồng không thay nghiệm thu service thật.
