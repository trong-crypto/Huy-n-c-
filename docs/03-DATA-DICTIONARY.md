# Từ điển dữ liệu v1.0

TV3 sở hữu migration tại `server/src/main/resources/db/migration/`. TV1/TV2 không tự đổi schema.

| Bảng | Mục đích |
| --- | --- |
| `source_books` | Sách, tác giả, ghi chú bản scan, số trang PDF và SHA-256 file để định danh nguồn |
| `source_sections` | Chương/mục, nhãn trang in và số trang PDF (đếm từ 1) |
| `trigrams` | Tám quái, số Tiên thiên 1–8, Ngũ hành và ba hào |
| `hexagrams` | 64 quẻ, hai quái và sáu hào |
| `hexagram_lines` | Từng hào 1–6 |
| `calculation_rules` | Mã quy tắc, phiên bản; trạng thái `DRAFT`, `SOURCE_LOCATED`, `SOURCE_AMBIGUOUS`, `BLOCKED_SOURCE_CONFLICT` hoặc `VERIFIED` |
| `interpretations` | Nội dung luận giải gắn nguồn |
| `tam_the_lookup_entries` | Bảng tra Tam Thế gắn quy tắc và nguồn; một khóa đầu vào có thể có nhiều `result_code`, mỗi ô có trạng thái và người nhập/kiểm |

Mỗi nội dung và quy tắc `VERIFIED` phải truy được về đúng ấn bản, chương/mục/trang. Không lưu ngày sinh người dùng tại Server trong MVP.

Migration V1 là bản thiết kế trước khi có dữ liệu thật. Sau khi nhóm đã dùng chung database, mọi thay đổi phải tạo migration V2 trở đi thay vì sửa V1.

