# Từ điển dữ liệu v1.0

TV3 sở hữu migration tại `server/src/main/resources/db/migration/`. TV1/TV2 không tự đổi schema.

| Bảng | Mục đích |
| --- | --- |
| `source_books` | Sách, tác giả, ghi chú bản scan, số trang PDF và SHA-256 file để định danh nguồn |
| `source_sections` | Chương/mục, nhãn trang in và số trang PDF (đếm từ 1) |
| `trigrams` | Tám quái, số Tiên thiên 1–8, Ngũ hành và ba hào |
| `hexagrams` | 64 tổ hợp thượng/hạ quái, sáu hào; V3 phân biệt nhãn cấu trúc `STRUCTURAL_LABEL` và tên truyền thống `CANONICAL_TITLE`, có trạng thái/người kiểm/trang nguồn |
| `hexagram_lines` | Từng hào 1–6 |
| `calculation_rules` | Mã quy tắc, phiên bản; trạng thái `DRAFT`, `SOURCE_LOCATED`, `SOURCE_AMBIGUOUS`, `BLOCKED_SOURCE_CONFLICT` hoặc `VERIFIED` |
| `interpretations` | Nội dung luận giải gắn nguồn |
| `tam_the_lookup_entries` | Bảng tra Tam Thế gắn quy tắc và nguồn; một khóa đầu vào có thể có nhiều `result_code`, mỗi ô có trạng thái và người nhập/kiểm |
| `tam_the_hour_anchors` | Mốc giờ theo từng tháng âm, chữ Chi in trong sách và giá trị nhóm chọn (migration V2) |

Với ô giờ tháng 5 của Tam Thế (05:20–07:19), migration V2 đã tạo các trường `source_branch="DAU"` (chữ in Dậu), `adopted_branch="DAN"` (Dần theo quyết định nhóm), `decision_status="TEAM_CORRECTION"`, lý do và trang nguồn; không ghi đè chữ in trong bản số hóa. Cập nhật 23/10: V4 đã chuyển riêng bản ghi tháng 5 sang VERIFIED theo xác nhận của chủ dự án về TV2; chữ gốc và giá trị áp dụng được giữ nguyên. Quy tắc TT-GIO-SINH tổng thể vẫn BLOCKED_SOURCE_CONFLICT cho đến khi kiểm đủ 12 tháng. Trạng thái `VERIFIED` của toàn bảng chỉ có sau kiểm đủ ô và review chéo, không tự suy ra từ quyết định sửa một chữ. Cách nhập và kiểm đếm có trong `docs/11-DATA-IMPORT.md`.

Mỗi nội dung và quy tắc `VERIFIED` phải truy được về đúng ấn bản, chương/mục/trang. Không lưu ngày sinh người dùng tại Server trong MVP.

Cập nhật B03 24/10: MH-TRIGRAM 1.0 đã VERIFIED theo manifest tám quái và biên bản 21; tổng ba rule Mai Hoa VERIFIED gồm TRIGRAM/MUTUAL/CHANGE. Không có schema/migration mới; V1–V5 giữ checksum. OBJECT_COUNT vẫn SOURCE_AMBIGUOUS trong DB, quyền chạy TEAM_DECISION thuộc catalog. Trạng thái tên quẻ VERIFIED theo S01 độc lập với trạng thái nguồn công thức.

Migration V1/V2 đã dùng trên DB. Sau khi nhóm đã dùng chung database, mọi thay đổi phải tạo migration phiên bản tiếp theo thay vì sửa migration cũ. V3 bổ sung truy vết nguồn cho 64 quẻ; xem `docs/13-TV3-HEXAGRAM-STRUCTURE.md`.


TV2/TV3 hiện cùng một người phụ trách. Quyền chạy tách trạng thái nguồn đã có ở catalog/registry A01. **S02/V6** thêm reviewed_at/verification_note và ràng buộc metadata duyệt vào tam_the_lookup_entries; không cấp VERIFIED bằng migration. Bảng này hiện có **111 ô: 60 Can Chi→hành VERIFIED, 51 ô công danh Số 11 SOURCE_LOCATED**. Khóa Can Chi dạng `STEM:GIAP|BRANCH:TY`, result_code là mã hành; description để NULL vì chưa duyệt mô tả nạp âm. Trạng thái kiểm duyệt cho interpretations và owner/history vẫn là schema dự kiến. Xem biên bản 22.
