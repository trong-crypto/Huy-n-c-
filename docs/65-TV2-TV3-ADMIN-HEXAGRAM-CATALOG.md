# Bàn giao API Admin tra cứu quẻ và nguồn

Phần tra cứu 64 quẻ thuộc CONTENT-01 và CMS-DATA-02. API cung cấp danh sách, bộ lọc và chi tiết chỉ đọc cho Admin trên schema V20. Dữ liệu lấy từ quẻ và nghĩa tên E01 hiện có.

## Hợp đồng cho TV1

Gọi qua cùng Origin với cookie phiên Admin. GET kiểm Origin nếu request gửi trường này. Phản hồi dùng `Cache-Control: no-store` và envelope `requestId, status, data, error`. Để tích hợp màn hình Admin, thêm tuyến chuyển tiếp `/api/v1/admin/hexagrams/:path*` từ Next.js tới Backend.

| Yêu cầu | Phản hồi |
| --- | --- |
| `GET /api/v1/admin/hexagrams` | `data: {items, page, size, totalElements, totalPages}`. |
| `GET /api/v1/admin/hexagrams/H_KHAM_TON` | `data: {hexagram, linesBottomUp, nameSource, nameGloss}`. |

Danh sách nhận các query tùy chọn `q`, `upperTrigramCode`, `lowerTrigramCode`, `nameStatus`, `glossStatus`, `page` và `size`. Bộ lọc kết hợp theo AND. `q` tìm tên có dấu hoặc không dấu và mã quẻ theo quy tắc E02, tối đa 100 ký tự. Mã quái gồm `CAN, DOAI, LY, CHAN, TON, KHAM, CAN2, KHON`. Sắp xếp mã quẻ tăng dần. Trang bắt đầu từ 0, kích thước mặc định 20, tối đa 100.

`nameStatus` và `glossStatus` nhận `DRAFT`, `SOURCE_LOCATED`, `SOURCE_AMBIGUOUS`, `BLOCKED_SOURCE_CONFLICT`, `VERIFIED`. Riêng `glossStatus` có thêm `MISSING` khi quẻ chưa có bản ghi nghĩa tên.

- Mỗi phần tử danh sách và `hexagram` trong chi tiết gồm `code, name, nameKind, nameStatus, upperTrigramCode, lowerTrigramCode, glossStatus`.
- `linesBottomUp` gồm 6 giá trị boolean theo thứ tự hào 1 đến hào 6, từ dưới lên.
- `nameSource` và `nameGloss.source` có dạng `{sectionId, reference}`. `sectionId` là ID trang/mục trong database ở dạng chuỗi. `reference` có mã sách, tiêu đề, thông tin ấn bản, mục, trang in, trang PDF và SHA-256 nếu có. ID database dùng để đối chiếu trong cùng một database, còn mã sách và trang dùng để dẫn nguồn.
- `nameGloss` gồm `category, content, verificationStatus, sourceOrder, printedSourceLabel, reviewer, reviewedAt, verificationNote, source, publiclyVisible`. Nếu thiếu bản ghi, trường này trả `null`. `category` có giá trị `NAME_GLOSS`. `publiclyVisible` dùng đúng điều kiện công bố của E02. Admin có thể thấy dữ liệu chờ duyệt cùng trạng thái tương ứng.

Ví dụ Tỉnh (`H_KHAM_TON`) có nghĩa tên **Giếng nước**, nhãn in **Ích**, thứ tự 48, trang PDF 271 và trang in 278. Hai phần `nameSource` và `nameGloss.source` truy vết riêng. Trạng thái E01 chỉ áp dụng cho nghĩa tên ngắn của quẻ. Lời luận chi tiết và các thao tác soạn, duyệt, công bố qua CMS thuộc mốc khác.

| HTTP | Mã lỗi |
| --- | --- |
| 400 | `INVALID_INPUT` khi bộ lọc hoặc mã quẻ sai cú pháp |
| 401 | `INVALID_SESSION` khi thiếu phiên Admin |
| 403 | `CSRF_REJECTED` khi Origin không hợp lệ |
| 404 | `NOT_FOUND` khi mã hợp lệ nhưng không có quẻ |
| 503 | `DATABASE_UNAVAILABLE` hoặc `KNOWLEDGE_DATA_INCOMPLETE` |
| 500 | `INTERNAL_ERROR` |

## Môi trường TEST

Backend `http://127.0.0.1:18122` chạy profile `db` với Auth bật. Database TEST riêng `huyenco_admin_hexagrams_test_20261108` có schema V20 và bộ E01 đã duyệt. Bật Auth và cấp tài khoản Admin TEST theo tài liệu 63.

### Kết quả ngày 08/11/2026

- 7 kiểm thử Java đạt, gồm ca JDBC thật kiểm hồi quy E02. 107 yêu cầu HTTP trên Backend TEST đạt, bao gồm quyền Admin, Origin, tìm kiếm, phân trang và query không hợp lệ.
- Đối chiếu cả 64 phản hồi chi tiết với PostgreSQL và CSV E01 đã kiểm SHA-256 theo manifest. Tên, nghĩa ngắn, nhãn in, thứ tự, trang in/PDF và liên kết nguồn khớp. Đây là đối chiếu với bộ nguồn đã duyệt của dự án.
- Tạo tạm hai tình huống trong database TEST. Admin thấy bản nháp và nhận trạng thái `MISSING` cho quẻ thiếu nghĩa. E02 công khai trả danh sách nghĩa rỗng ở cả hai tình huống. Dấu vân tay năm bảng tri thức khớp trước khi chạy và sau khi phục hồi dữ liệu thử.
