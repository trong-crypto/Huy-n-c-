# D01 - Dữ liệu công danh Tam Thế: nhập và đối chiếu nguồn

Ngày: **24/10/2026**. Nguồn: PDF Tam Thế 360 trang đã dùng trong S02/S03; SHA-256 `7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d`.

## 1. Phạm vi công việc

- Đối chiếu **51 giao điểm** thuộc ba nhóm nghề Số 11, PDF 32 / trang in 33.
- Chép và đối chiếu **120 ô** bảng nghề Số 13, PDF 35 / trang in 36, và **12 đoạn** giải nghĩa PDF 35-36 / trang in 36-37.
- Sửa một lỗi nhập seed Số 11 đã được đọc lại trên ảnh phóng lớn; giữ riêng nhãn cột và tiêu đề đoạn Số 13.
- Bổ sung provenance cho nội dung bằng Flyway V7; nhập có transaction, sao lưu, kiểm dữ liệu được bảo vệ và chạy lại không nhân đôi.

**VERIFIED ở đây xác nhận dữ liệu và phép tra đã khớp các trang scan trong phạm vi ghi nhận**, không xác nhận dự đoán là sự thật và không tự hoàn thành TamTheService, lịch hoặc toàn bộ F04. Tài lộc/tình duyên, giờ sinh và 64 lời giải quẻ giữ task/trạng thái riêng.

## 2. Hai lượt đọc nguồn

Người/công cụ thực hiện cả hai lượt: **Codex**. Không ghi là hai người kiểm độc lập và không mượn danh TV2 ký duyệt. Quyền triển khai/đối chiếu trong phạm vi TV2-TV3 do chủ dự án đã giao trong hội thoại.

1. Đọc toàn trang để chép danh sách tháng, hàng Can và các đoạn. Các file `*_source.csv`, `*_matrix.csv`, `*_texts.csv` lưu bản chép.
2. Dựng lại PDF 32/35/36 bằng Poppler ở kích thước cạnh dài 3200; đọc lại Số 11 theo từng hành, Số 13 theo từng cột rồi đối chiếu từng đoạn đầy đủ. File `*_review.csv` lưu chiều đọc khác; manifest khóa hash bản chép và bản review.
3. Kiểm 120 ô theo cả hai chiều và phép rút gọn, kiểm 51 khóa nghề với seed, kiểm hash từng đoạn và trang bảng/trang nội dung. Kiểm bằng chương trình không thay lượt đọc ảnh.

Ảnh lượt hai: `work/d01/TT-32-review.png`, `TT-35-review.png`, `TT-36-review.png` và các crop trong cùng thư mục (ignored). Dữ liệu/mốc review được lưu trong Git; sách gốc không chép vào repo.

Khoảng trắng, ngắt dòng và dấu câu được chuẩn hóa để lưu nội dung một dòng. Giữ từ ngữ trong nguồn, kể cả cách viết cũ như “tánh”, “đờn”, “quí”, “bổn phượng”; không hiện đại hóa thành lời dự đoán mới.

## 3. Số 11: sửa đúng ô mệnh Thủy

Ảnh PDF 32 ghi dòng câu/chài của Thủy là **2, 4, 6, 8, 11**. Seed trước D01 chép **2, 4, 6, 9, 11**. Tháng 9 là lỗi nhập trước đây, không phải lỗi cần sửa trong bản sách.

Quyết định D01: thay giao điểm `ELEMENT:THUY|MONTH:09 / CAU_CHAI` bằng `ELEMENT:THUY|MONTH:08 / CAU_CHAI`. Seed cơ sở được sửa cùng lúc để lần bootstrap sau giữ đúng dữ liệu. Tổng số giao điểm vẫn 51.

Importer chỉ xử lý dòng cũ nếu đúng toàn bộ nội dung gốc, editor `AUTO_FROM_DOCS`, trạng thái SOURCE_LOCATED, không reviewer/metadata duyệt. Dòng đã VERIFIED hoặc đã bị sửa sẽ bị từ chối. Nếu seed đã tạo tháng 8 trước đó, chỉ bỏ dòng tháng 9 cũ đủ điều kiện; giữ bản ghi tháng 8 và metadata duyệt hiện có.

Không gộp nhiều nghề của cùng một hành/tháng thành một dòng. Ví dụ **Kim tháng 10** có cả MUA_BAN, CAU_CHAI, LAM_THO; **Thủy tháng 8** có MUA_BAN và CAU_CHAI. Không có giao điểm không được diễn đạt thành lời khẳng định người dùng không có nghề nghiệp.

## 4. Số 13: tra bảng và giữ nhãn gốc

Khóa `STEM:<CAN>|MONTH:<01..12>`, mã kết quả ổn định theo cột nguồn `CAREER13_C01` ... `CAREER13_C12`. Không dùng tên có thể khác chính tả làm khóa kỹ thuật.

Tra tháng trong hàng Can, sau đó lấy cột chứa tháng. Công thức cũ dấu cộng sai chiều. Sau đối chiếu đủ 120 ô, `floorMod(lunarMonth - 1 - stemIndex, 12)` khớp bảng; Giáp=0...Quý=9. Importer vẫn dùng bảng chép tường minh làm dữ liệu chính, công thức chỉ là kiểm nhất quán.

Ca chuẩn: **Giáp tháng 1 -> C01; Ất tháng 1 -> C12; Ất tháng 2 -> C01; Quý tháng 1 -> C04**.

### Nhãn khác nhau giữa bảng và các đoạn ngay sau bảng

| Cột | Nhãn bảng PDF35 | Tiêu đề đoạn | Trang đoạn PDF/in |
| --- | --- | --- | --- |
| 2 | Trùng Tổ | Trùng Tế | 35/36 |
| 4 | Đã Thết | Đã Thiết | 36/37 |
| 5 | Sự Thoát | Sư Thuật | 36/37 |
| 12 | Thứ Tác | Thủ Tất | 36/37 |

**Chốt liên kết biên tập theo thứ tự nguồn**: có đúng 12 cột và 12 đoạn liên tiếp theo cùng thứ tự; các cột còn lại khớp tiêu đề/ngữ cảnh tương ứng. Bốn trường hợp được ghi `POSITIONAL_EDITORIAL_LINK`. Giữ nguyên cả hai nhãn, không tuyên bố hai từ là cùng chính tả hoặc đã sửa bản in. Đây là liên kết theo vị trí có ghi căn cứ; phạm vi duyệt là bản chép và liên kết đó, không là việc khôi phục nguyên bản trước lỗi in.

`title` giữ nhãn cột, `source_content_heading` giữ tiêu đề đoạn, `description` là đoạn được chép. Khi D03/TV1 trình bày các mục khác nhãn, cần hiển thị cả nhãn bảng và tiêu đề nguồn; không âm thầm đổi nội dung thành một tên chuẩn mới.

Ba đoạn đầu nằm PDF35; chín đoạn còn lại PDF36. Mỗi bản ghi có FK riêng cho trang bảng và trang đoạn, metadata duyệt ghi hàng/cột, cách liên kết và phạm vi.

## 5. File dữ liệu và schema

| File | Vai trò |
| --- | --- |
| `data/tam_the_career11_source.csv` | 15 danh sách theo nghề/hành, giữ thứ tự tháng trong bản in |
| `data/tam_the_career11_review.csv` | Lượt hai, nhóm theo hành để kiểm 51 giao điểm |
| `data/tam_the_career13_matrix.csv` | 10 hàng Can x 12 ô tháng từ trang bảng |
| `data/tam_the_career13_column_review.csv` | Lượt hai đọc 12 cột x 10 Can |
| `data/tam_the_career13_texts.csv` | 12 nhãn bảng, tiêu đề đoạn, toàn văn ngắn và trang riêng |
| `data/tam_the_career_review.json` | Hash, reviewer thực tế, phạm vi, lỗi nhập đã sửa và căn cứ liên kết |

V7 thêm vào `tam_the_lookup_entries`: `content_source_section_id`, `source_table_label`, `source_content_heading`. Ràng buộc yêu cầu đủ bộ provenance khi khai báo nguồn đoạn. Không sửa checksum V1-V6 và không cấp VERIFIED trong migration.

Dữ liệu đã có sau áp dụng: 51 ô nghề Số 11 + 120 ô Số 13 + 60 ánh xạ hành S02 = **231 ô tra**, 12 đoạn nội dung được gắn vào 120 ô phù hợp; không phải 120 đoạn khác nhau. Hai rule công danh được duyệt riêng. Thêm một mục nguồn PDF36, tổng mục nguồn 22 ở baseline hiện tại.

## 6. Nhập, duyệt và kiểm lại

`import_all.ps1` đã có bước D01 sau S02, trước kiểm toán. Bootstrap DB mới vẫn đi V1-V3 -> seed -> V4/latest -> dữ liệu mở rộng; V7 chỉ thêm cột.

Lệnh kiểm nguồn/dry run tại repo root:

```powershell
python .\scripts\import_tam_the_career.py
```

Khi đã có V7 và biến môi trường `PGPASSWORD`, có thể chạy riêng:

```powershell
python .\scripts\import_tam_the_career.py --apply
python .\scripts\import_tam_the_career.py --apply --review
```

Trước mỗi lần áp dụng, importer sao lưu các ô/rule/mục nguồn liên quan vào `scripts/generated/db-backups/` (ignored). Transaction kiểm edition/hash, trang, nội dung và metadata; không ghi đè dữ liệu đổi khác hoặc cấp lại duyệt cho bản ghi đã bị sửa. Chạy lại giữ nguyên nội dung và reviewed_at.

Các lệnh nâng trạng thái trên chỉ áp dụng biên bản/hash đã khóa trong D01. Thay CSV, manifest hoặc PDF cần lượt review mới; không sửa hash để vượt cổng duyệt.

## 7. Kết quả thực hiện

Đã áp dụng vào **`huyenco` lúc 17:34 ngày 24/10/2026 (UTC+7)** bằng `import_all.ps1`, sau khi sao lưu đầy đủ bằng `pg_dump -Fc`. File `scripts/generated/db-backups/before-d01-full-20261024-173358.dump` đã được kiểm danh mục bằng `pg_restore -l`; các importer cũng lưu backup JSON trước khi ghi. Backup và log chứa dữ liệu cục bộ, không đưa vào Git.

| Bằng chứng | Kết quả |
| --- | --- |
| PostgreSQL thật | Flyway V1-V7; 22 mục nguồn; 231 ô tra Tam Thế |
| Công danh Số 11 | 51 giao điểm VERIFIED; Thủy câu/chài tháng 8 đúng nguồn, không còn ô tháng 9 cũ |
| Công danh Số 13 | 120 ô VERIFIED, gắn 12 đoạn đã đối chiếu; giữ riêng nhãn bảng/tiêu đề đoạn và nguồn PDF35/36 |
| Quy tắc | TT-CONG-DANH-11 và TT-CONG-DANH-13 VERIFIED trong phạm vi biên bản này |
| Kiểm toán DB thật | 42 kiểm tra: 40 PASS, 0 FAIL, 2 PENDING |
| Python | 38 kiểm thử đạt; gồm phát hiện thay ô/đoạn/hash/reviewer và kiểm audit âm tính |
| Java có DB | 434 kiểm thử, 0 lỗi, 0 bỏ qua; đọc dữ liệu công danh và hồi quy kho tri thức |
| Bootstrap database trống | Hai lần nhập có dữ liệu và reviewed_at giống nhau; DB tạm được xóa sau kiểm |
| Bảo vệ dữ liệu D01 | 5 trường hợp thay dữ liệu đã duyệt bị chặn; 3 trường hợp ô legacy đã kiểm, gồm từ chối sửa ô VERIFIED |

Bằng chứng cục bộ: `scripts/generated/d01_bootstrap.log`, `d01_python.log`, `d01_live_import.log`, `tv3_audit_report.md` và các backup. 60 ô S02, 64 quẻ, 384 hào và dữ liệu ngoài phạm vi D01 vẫn được giữ lại.

Hai nhóm PENDING còn lại: **nghĩa/lời giải 64 quẻ** (`interpretations` vẫn 0) và **dữ liệu Tam Thế còn thiếu** (36 phần giờ, tài lộc, tình duyên, 11 mốc giờ chưa duyệt toàn bảng). D01 hoàn thành phần dữ liệu công danh; F04 còn cần C01/D02/D03 và tích hợp UI của TV1. **Task tiếp theo: C01 — lịch Âm-Dương/Can Chi.**
