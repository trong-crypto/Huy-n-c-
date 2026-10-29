# S02 — Bảng 60 Can Chi và hành mệnh

Ngày đối chiếu: 24/10/2026. **Trạng thái: DONE trong phạm vi S02; đã áp dụng vào huyenco.** Phạm vi TV2–TV3: dữ liệu, metadata kiểm chứng, nhập/kiểm PostgreSQL; không chỉnh giao diện TV1.

## 1. Nguồn và phạm vi xác minh

Nguồn: PDF Diễn Cầm Tam Thế Diễn Nghĩa người dùng cung cấp, 360 trang; SHA256 `7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d`. **Số 4, trang PDF 11 / trang in 12** có 30 dòng, mỗi dòng hai Can Chi cùng hành, tổng 60 ánh xạ. Danh tính ấn bản in chưa được xác minh đầy đủ.

Lượt một chép thành `data/tam_the_year_elements.csv` (60 dòng). Lượt hai mở lại ảnh gốc theo từng vùng, đối chiếu hai cột Can Chi và cột mạng với `data/tam_the_year_element_review.csv` (30 cặp). Kiểm chu kỳ 10 Can/12 Chi, đủ 60 khóa duy nhất; mỗi hành xuất hiện 12 lần. Kiểm cấu trúc chỉ hỗ trợ phát hiện lỗi nhập; bằng chứng hành từng ô là ảnh trang gốc.

Reviewer thực tế: **Codex source review 2026-10-24 (same-tool second pass)**. Hai lượt do cùng công cụ AI thực hiện; không ghi thành hai người kiểm độc lập hoặc xác nhận mới từ TV2.

Chỉ duyệt **Can Chi → hành mệnh theo cột “mạng”**. Các tên nạp âm Hán Việt, phần mô tả bên phải, chuyển lịch, giờ sinh, công danh, tài lộc/tình duyên không nằm trong phạm vi duyệt S02.

### Điểm bất nhất giữ nguyên chứng cứ

Dòng nguồn 28 (Mậu Ngọ/Kỷ Mùi) in **mạng Hỏa**, phần mô tả bên phải lại ghi **“cây lựu đá”**, lặp với dòng 29 (Canh Thân/Tân Dậu, mạng Mộc). S02 lấy Hỏa theo đúng cột hành, không sửa scan, không đổi Hỏa thành Mộc, không tự thay mô tả bằng nội dung từ sách khác. Mô tả này được ghi nhận ở biên bản; `description` của 60 bản ghi nhập để NULL. S03 cần xử lý riêng phạm vi lời giải và các điểm bất nhất.

Chuẩn hóa mã: chữ “Mẹo/Mèo” trong trang nguồn dùng `MAO`; Tý dùng `TY`, Tỵ dùng `TI`; tên Can Nhâm dùng `NHAM`. Tên hiển thị chuẩn hóa dấu/viết hoa, không đổi khóa nghiệp vụ theo tuổi số trong bảng neo 1969 của sách. S02 chưa triển khai dịch ngày Dương sang năm âm; C01 xác định năm âm trước khi tra bảng này.

## 2. Dữ liệu PostgreSQL

Dùng `tam_the_lookup_entries`, gắn đúng rule **TAM_THE / TT-NGU-HANH / 1.0** và mục nguồn **TT-NGU-HANH / PDF11 / in12**:

| Trường | Quy ước |
| --- | --- |
| lookup_key | `STEM:GIAP\|BRANCH:TY`, thứ tự và tên trường cố định |
| result_code | KIM / MOC / THUY / HOA / THO |
| title | Tên Can Chi và hành đã chuẩn hóa, ví dụ Giáp Tý — Kim |
| description | NULL; không nhập lời mô tả chưa được duyệt |
| verification_status | SOURCE_LOCATED khi nhập; VERIFIED sau áp dụng biên bản lượt hai |
| editor/reviewer | Ghi đúng công cụ/ngày nhập và lượt kiểm thực tế |
| reviewed_at | Thời điểm áp dụng duyệt vào DB; ngày review nguồn cố định trong ghi chú |
| verification_note | Dòng/cột L hoặc R trong nguồn, phạm vi STEM_BRANCH_ELEMENT và giới hạn |

V6 chỉ thêm `reviewed_at`, `verification_note` và ràng buộc metadata khi VERIFIED cho ô tra cứu; không duyệt dữ liệu trong migration. Giữ checksum V1–V5. 51 ô Số 11 có trước vẫn SOURCE_LOCATED và không bị sửa bởi S02.

## 3. Nhập, duyệt và bảo vệ dữ liệu

`scripts/import_tam_the_year_elements.py` mặc định chỉ tạo SQL/dry run; `--apply` nhập SOURCE_LOCATED; `--apply --review` áp dụng đúng biên bản đã lưu. Hai file CSV có hash cố định; PDF phải đúng hash. Dữ liệu thay đổi cần đợt review mới.

Transaction khóa bảng liên quan, kiểm rule/module/version, trang/nhãn nguồn, metadata reviewer và các ô đã có. Không ghi đè nội dung khác, reviewer khác hoặc tự duyệt lại ô đã bị đổi. Trước mỗi lần áp dụng lưu backup metadata của rule và 60 ô trong `scripts/generated/db-backups/` (ignored). Chạy lại giữ nguyên bản ghi và thời điểm duyệt. Không lưu mật khẩu vào file.

`import_all.ps1` gọi hai bước sau seed và migration mới nhất, trước kiểm toán. Nhập xong nâng riêng TT-NGU-HANH và 60 ô của nó sang VERIFIED; các rule Tam Thế khác giữ trạng thái cũ. Quyền tra hành mệnh không chứng minh TamTheService đã có đầy đủ thuật toán hoặc sẵn sàng trả lời luận.

## 4. Ca chuẩn

| Can Chi | Hành theo cột nguồn | Dòng / cột |
| --- | --- | --- |
| Giáp Tý | Kim | 1 / L |
| Ất Sửu | Kim | 1 / R |
| Bính Dần | Hỏa | 2 / L |
| Kỷ Dậu | Thổ | 23 / R |
| Mậu Ngọ, Kỷ Mùi | Hỏa | 28 / L,R; mô tả bên phải chưa duyệt |
| Canh Thân, Tân Dậu | Mộc | 29 / L,R |
| Nhâm Tuất, Quý Hợi | Thủy | 30 / L,R |

Tổ hợp không thuộc vòng 60 như Giáp Sửu không có bản ghi. Khi C01/D03 tích hợp phải xác định Can Chi năm âm trước; không lấy năm Dương ngay trước Tết hoặc tuổi cố định 1969 để tra thay.

## 5. Kiểm tra và phần còn lại

Kiểm file/hash/trang/khóa/chu kỳ; nguồn review khác giá trị nhập bị từ chối; kiểm SQL trên DB tạm với đổi hành, reviewer, trang nguồn hoặc thiếu một ô; chạy bootstrap hai lần so toàn bộ bản ghi; Java đọc 60 ô từ PostgreSQL và registry dùng đúng trạng thái nguồn. Kết quả thực chạy ở phần hoàn tất dưới đây.

Sau S02, database vẫn còn thiếu 120 ô Số 13, 36 phần giờ, nội dung tài lộc/tình duyên và nội dung tra cứu 64 quẻ; 51 ô Số 11 cùng 11 mốc giờ cần review. Chuyển lịch và lịch sử người dùng còn task riêng. S03 là công việc nguồn tiếp theo; không tuyên bố database toàn hệ thống đã hoàn thành.

## 6. Kết quả thực chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Python | **32/32** đạt, gồm CSV sửa nội dung/hash, thiếu/trùng khóa, sai dòng/trang/Chi, sai ô và audit không chấp nhận dữ liệu sai/chưa duyệt |
| Java trên PostgreSQL tạm | **433 test, 0 failure/error, 0 skip**; có đọc đủ 60 khóa/giá trị/metadata, registry TT-NGU-HANH và các hồi quy Mai Hoa/mạng |
| Bootstrap DB trống | Chạy hai lần, toàn bộ bản ghi/thời điểm duyệt giữ nguyên; có sáu migration và 111 ô tra; DB tạm đã xóa |
| Chốt kiểm chứng S02 | Cả bốn ca sửa hành/người duyệt/trang nguồn hoặc xóa một ô đều bị từ chối bằng đúng lỗi dự kiến; dữ liệu giao dịch được rollback |
| Database huyenco | V6 áp dụng thành công; **60 ô + TT-NGU-HANH VERIFIED**; **51 ô Số 11 vẫn SOURCE_LOCATED** |
| Kiểm toán DB thật | **39 kiểm tra, 0 FAIL, 2 nhóm PENDING** cho các dữ liệu còn thiếu; không xóa cảnh báo để làm đẹp kết quả |
| Giao diện | Không sửa file giao diện hoặc mã Client trong S02 |

Bằng chứng cục bộ (ignored): `scripts/generated/s02_bootstrap.log`, `s02_bootstrap_result.json`, `s02_live_import.log`, `tv3_audit_report.md`; báo cáo Java ở `server/target/surefire-reports/`. SQL dài được gửi qua stdin để chạy trên Windows; không truyền mật khẩu trên dòng lệnh helper.

Các ca đọc trực tiếp huyenco xác nhận Giáp Tý→KIM, Kỷ Dậu→THO, Mậu Ngọ→HOA và Canh Thân→MOC cùng nguồn PDF11/in12. Đây là tra hành theo Can Chi đầu vào, chưa phải chức năng luận giải Tam Thế đầu cuối. Không khởi động Server hoặc sửa lịch/TamTheService trong S02; chưa commit/merge thay đổi.
