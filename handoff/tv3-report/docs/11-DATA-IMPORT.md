# Huyền Cơ — Hướng dẫn nạp dữ liệu hai sách vào PostgreSQL (TV3)

## Chạy tự động bằng một lệnh (Windows)

Từ PowerShell tại thư mục gốc dự án, chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_all.ps1
```

Script yêu cầu nhập mật khẩu PostgreSQL ở chế độ ẩn (không ghi vào file), kiểm tra database `huyenco`, chạy Flyway V1–V4 qua Maven Wrapper khi còn thiếu, kiểm tra hai PDF, nhập bộ seed hiện có, bổ sung 64 cấu trúc quẻ/384 hào, nhập 64 tên có nguồn rồi kiểm toán dữ liệu. Nó chỉ dừng tiến trình Maven do chính script khởi tạo. Nếu Flyway không chạy thành công, xem `scripts/generated/migration_stdout.log` và `scripts/generated/migration_stderr.log`. Lệnh `-ExecutionPolicy Bypass` chỉ áp dụng cho tiến trình PowerShell mới chạy script, không thay đổi chính sách toàn máy. **Không chạy song song hai phiên nhập**.

Các mục bên dưới giải thích từng công đoạn để khắc phục lỗi khi cần; có thể dùng script một lệnh thay cho việc thực hiện từng công đoạn thủ công.

## 1. Phạm vi của bộ nhập hiện tại

Nguồn là đúng hai bản PDF scan tại thư mục Downloads trên máy thành viên 3. Script `scripts/import_book_knowledge.py` đọc tệp để kiểm số trang và SHA-256, sau đó sinh các bản ghi đã được **định vị và ghi lại trong `docs/04-MAIHOA-RULES.md` và `docs/05-TAMTHE-RULES.md`**. Nội dung trong ảnh scan chưa được tự nhận dạng và xác minh toàn bộ.

| Bảng | Nội dung do script chuẩn bị | Số bản ghi |
| --- | --- | ---: |
| `source_books` | Hai đầu sách cùng dấu SHA-256 tệp nguồn | 2 |
| `source_sections` | Mục sách kèm trang in và trang PDF | 17 |
| `calculation_rules` | Quy tắc / chỗ còn mơ hồ hoặc xung đột | 14 |
| `trigrams` | Tám quái, số Tiên thiên, ba hào và Ngũ hành | 8 |
| `tam_the_hour_anchors` | Mốc giờ Dần của 12 tháng âm, bảo lưu chữ in tháng 5 | 12 |
| `tam_the_lookup_entries` | 51 giao điểm hành mệnh/tháng/loại nghề từ *Số 11* | 51 |

Tổng: **104 bản ghi của bộ seed sách** trong sáu bảng. Sau khi chạy `import_all.ps1`, script còn nạp **64 cấu trúc quẻ và 384 hào**; `interpretations` vẫn chưa được nạp. Bộ 64 tên quẻ đã có trang nguồn ở `data/hexagram_names.csv` và nhập ở SOURCE_LOCATED, chờ TV2 review. 60 Can Chi nạp âm, 120 ô *Số 13*, 36 phần giờ cùng bảng luận giải tài lộc và tình duyên còn cần trích dẫn và hai người đối chiếu. Không xem dữ liệu chưa nhập là lời luận giải của sách.

`SOURCE_LOCATED` nghĩa là **đã định vị trang nguồn**, chưa được kiểm duyệt đầy đủ. `SOURCE_AMBIGUOUS` và `BLOCKED_SOURCE_CONFLICT` có nghĩa là **chưa đủ căn cứ để áp dụng như quy tắc đã xác minh**. Bộ seed không tự gán `VERIFIED`. Ngày 23/10/2026, chủ dự án thông báo TV2 đã xác nhận `MH-MUTUAL`, `MH-CHANGE` và **riêng mốc giờ tháng 5**. Flyway V4 ghi nhận ba bản ghi này ở trạng thái `VERIFIED`, có `reviewer`, `reviewed_at` và ghi chú. Đây là xác nhận qua chủ dự án, chưa có biên bản ký trực tiếp của TV2. Tháng 5 bảo lưu `source_branch=DAU`, `adopted_branch=DAN`, `decision_status=TEAM_CORRECTION`, nguồn trang in 15 / PDF 14. Trước V4, mốc tháng 5 mang trạng thái `BLOCKED_SOURCE_CONFLICT`; sau V4 là `VERIFIED`. Quy tắc `TT-GIO-SINH` tổng thể vẫn `BLOCKED_SOURCE_CONFLICT` do 11 tháng còn lại chưa kiểm đủ.

## 2. Tạo bảng bằng Flyway trước khi nhập

Đã có PostgreSQL và database `huyenco`. Mở PowerShell trong thư mục gốc của repo, đặt biến môi trường `DB_URL=jdbc:postgresql://127.0.0.1:5432/huyenco`, `DB_USERNAME=postgres`, `DB_PASSWORD` là mật khẩu **được nhập cục bộ**. Bật Maven profile `database` và Spring profile `db` để Flyway chạy lần lượt:

- `server/src/main/resources/db/migration/V1__create_knowledge_tables.sql`
- `server/src/main/resources/db/migration/V2__tam_the_hour_anchors.sql`
- `server/src/main/resources/db/migration/V3__hexagram_provenance.sql`
- `server/src/main/resources/db/migration/V4__verify_tv2_reviewed_rules.sql`

Lệnh trong thư mục `server/`:

```powershell
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/huyenco'
$env:DB_USERNAME = 'postgres'
$secret = Read-Host 'Mật khẩu PostgreSQL' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
.\mvnw.cmd -Pdatabase spring-boot:run '-Dspring-boot.run.profiles=db'
```

Khi Server khởi chạy thành công và Flyway đã áp dụng V1–V4, có thể dừng Server bằng `Ctrl+C`. V3 chỉ thêm trường nguồn/kiểm duyệt cho bảng quẻ, không sinh dữ liệu trước khi có tám quái; bước nạp cấu trúc quẻ chạy **sau** bộ seed tám quái. V4 kiểm tra nguồn và ba bản ghi đã được TV2 xác nhận trước khi cập nhật VERIFIED. V4 dành cho database đã nhập bộ seed; database hoàn toàn mới cần áp dụng V1–V3, nhập seed, rồi mới chạy V4. Không chạy migration bằng pgAdmin thủ công rồi bật Flyway như cơ sở dữ liệu mới, vì Flyway sẽ không có lịch sử migration tương ứng.

## 3. Kiểm tra nguồn và chuẩn bị SQL

Sau khi đã dừng Server, trở về thư mục gốc của repo trong PowerShell (hoặc mở một PowerShell khác):

```powershell
python scripts/import_book_knowledge.py
python scripts/import_book_knowledge.py --sql-output scripts/generated/huyenco_book_seed.sql
```

Hai lệnh trên chỉ kiểm tra và xuất tệp, **chưa chạm đến database**. Script mặc định tìm hai PDF ở `C:\Users\abc\Downloads\`. Nếu tệp ở chỗ khác, thêm `--pdf-dir 'D:\DuongDan\DenSach'`. Tệp SQL sinh ra dùng `BEGIN/COMMIT` và `ON CONFLICT DO NOTHING` để không nhân đôi bản ghi khi nhập lại cùng phiên bản.

## 4. Nhập tự động vào PostgreSQL

Trong PowerShell có biến `DB_PASSWORD` từ bước 2, đặt thêm `PGPASSWORD` bằng chính biến vừa nhập (không đưa mật khẩu vào mã nguồn, git hoặc tệp SQL). Nếu đã mở cửa sổ PowerShell mới, nhập lại mật khẩu ở cửa sổ đó theo hai dòng gán `$secret` và `$env:DB_PASSWORD` ở bước 2:

```powershell
$env:PGPASSWORD = $env:DB_PASSWORD
python scripts/import_book_knowledge.py --apply
```

Mặc định kết nối `127.0.0.1:5432`, user `postgres`, database `huyenco`. Có thể đổi qua `--host`, `--port`, `--user`, `--database`; `psql` từ thư mục cài PostgreSQL trên Windows sẽ được tự phát hiện khi chưa có trong `PATH`. Script dừng khi thiếu bảng hoặc có lỗi SQL; PostgreSQL rollback cả transaction nhập.

Trong pgAdmin, mở Query Tool của `huyenco` và kiểm đếm:

```sql
SELECT 'source_books' AS table_name, COUNT(*) AS rows FROM source_books
UNION ALL SELECT 'source_sections', COUNT(*) FROM source_sections
UNION ALL SELECT 'calculation_rules', COUNT(*) FROM calculation_rules
UNION ALL SELECT 'trigrams', COUNT(*) FROM trigrams
UNION ALL SELECT 'tam_the_hour_anchors', COUNT(*) FROM tam_the_hour_anchors
UNION ALL SELECT 'tam_the_lookup_entries', COUNT(*) FROM tam_the_lookup_entries
ORDER BY table_name;

SELECT a.lunar_month, a.first_hour_start, a.source_branch,
       a.adopted_branch, a.decision_status, a.verification_status,
       s.pdf_page, s.printed_page_label
FROM tam_the_hour_anchors a
JOIN source_sections s ON s.id = a.source_section_id
ORDER BY a.lunar_month;
```

Nếu đây là database mới, kỳ vọng sáu bảng lần lượt có 2, 17, 14, 8, 12, 51 bản ghi. Database đã có dữ liệu của nhóm có thể có số lớn hơn. Sau khi sử dụng, xóa mật khẩu khỏi phiên PowerShell bằng `Remove-Item Env:DB_PASSWORD, Env:PGPASSWORD`.

## 5. Việc tiếp theo của thành viên 3

Ưu tiên lần lượt: (1) bàn giao 64 tên đã nhập cho TV2 review theo `14-TV3-HEXAGRAM-NAMES.md`; (2) nhập 60 ô Can Chi/nạp âm; (3) kiểm toàn bộ 120 ô *Số 13*; (4) nhập 36 phần giờ và các nhóm luận giải còn thiếu; (5) mỗi nhóm dữ liệu có người nhập, người đối chiếu và ca kiểm thử biên. Chỉ đổi `verification_status` thành `VERIFIED` sau khi TV2 cùng TV3 đối chiếu đúng trang sách và cập nhật nhật ký quyết định. Không dùng kết quả OCR chưa duyệt để cho Server tự luận giải.

## 6. Trạng thái thực thi và kiểm toán

Ngày 23/10/2026 người dùng đã chạy `scripts/import_all.ps1` trên PowerShell máy cá nhân. Đầu ra xác nhận `HOAN THANH` và sáu bảng có 14, 2, 17, 12, 51, 8 bản ghi như dự kiến (**104 bản ghi**). Đây là bằng chứng bộ seed có trước V4; không chứng minh rằng V4 đã chạy. Chỉ kết quả kiểm toán trực tiếp PostgreSQL và bảng `flyway_schema_history` mới xác nhận được trạng thái `VERIFIED` trên database.

Kiểm toán bộ seed và trang sách: `python scripts/audit_tv3.py` (không cần DB). Đối chiếu độc lập với PostgreSQL hiện hành: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit_tv3.ps1` (hỏi mật khẩu ẩn, chỉ SELECT). Kết quả tại `scripts/generated/tv3_audit_report.md`. Đối chiếu nguồn trực quan, ca biên và điểm chờ kiểm chéo ở `docs/12-TV3-SOURCE-REVIEW.md`.

64 cấu trúc quẻ và 384 hào theo tổ hợp 8 quái được chuẩn bị ở `scripts/seed_hexagram_structure.py`, hướng dẫn ở `docs/13-TV3-HEXAGRAM-STRUCTURE.md`. Tên truyền thống đã được nhập có nguồn và chờ review độc lập; lời luận giải vẫn chờ nhập. Không đánh đồng SOURCE_LOCATED với VERIFIED.

Cập nhật bước tên quẻ 23/10/2026: đã nhập thành công 64 tên, thêm bốn mục nguồn (`source_sections=21`), giữ 64 quẻ/384 hào; kiểm toán DB 0 FAIL/3 PENDING. Chạy riêng bằng `scripts/import_hexagram_names.ps1`, xem bảng đối chiếu `docs/14-TV3-HEXAGRAM-NAMES.md`.
