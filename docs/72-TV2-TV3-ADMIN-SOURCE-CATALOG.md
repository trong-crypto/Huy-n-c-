# CONTENT-01 và CMS-DATA-02 · Danh mục dữ liệu nguồn cho Admin

Màn hình `/admin/sources` tra cứu các trang sách đã định danh trong PostgreSQL và nguồn thuật toán bên ngoài. Backend lấy dữ liệu từ `source_books`, `source_sections` và `external_sources`. Danh mục chỉ đọc và dùng schema hiện có.

## Hợp đồng API

Cả hai tuyến yêu cầu phiên Admin. Gọi cùng Origin qua Next.js. Khi request có Origin, Backend kiểm Origin được phép. Phản hồi dùng envelope `requestId, status, data, error` và `Cache-Control: no-store`.

| Tuyến | Đầu vào và phản hồi |
| --- | --- |
| `GET /api/v1/admin/sources` | Các bộ lọc tùy chọn `q`, `kind`, `page`, `size`. Trả `{items,page,size,totalElements,totalPages}`. |
| `GET /api/v1/admin/sources/{kind}/{id}` | Trả `{entry,book,rules,interpretations}`. |

`kind` nhận `BOOK_PAGE` hoặc `EXTERNAL_ALGORITHM`. Với trang sách, `id` là chuỗi số dương của mục trong database. Với thuật toán, `id` là mã nguồn, ví dụ `C01-VN-FIXED7`. Từ khóa tối đa 100 ký tự, tìm chuỗi con theo tên, ấn bản, mục, trang hoặc mã, có phân biệt dấu và bỏ qua hoa/thường. `page` bắt đầu từ 0. `size` mặc định 20 và tối đa 50. Danh sách sắp theo loại, tên, ấn bản, trang PDF và ID.

- `entry` gồm `kind`, `id` và `reference`. Dữ liệu tham chiếu có tên, phiên bản, mục, trang in/PDF, SHA‑256 và URL theo loại nguồn.
- `book` gồm tác giả, nhà xuất bản, năm và số trang PDF đối với trang sách. Nguồn thuật toán trả `book: null`. Các trường thiếu dữ liệu giữ giá trị `null`.
- `rules` gồm mã, mô-đun, phiên bản và trạng thái của quy tắc tham chiếu trực tiếp. `interpretations` đếm bản ghi diễn giải gốc theo cặp loại và trạng thái. Các trạng thái thuộc về bản ghi tham chiếu. Danh mục trả metadata và số lượng, không trả trường trích đoạn sách.
- Lỗi `400 INVALID_INPUT` dùng cho bộ lọc hoặc ID sai cú pháp. `401 INVALID_SESSION` yêu cầu phiên Admin. `403 CSRF_REJECTED` dùng khi Origin không hợp lệ. `404 NOT_FOUND` dùng cho ID hợp lệ nhưng không có dữ liệu.

## Bật trên máy TEST

Dùng Backend profile `db`, `AUTH_ENABLED=true`, PostgreSQL TEST V23 và Origin của Client trong `ALLOWED_ORIGINS`. Đặt biến sau trước khi chạy hoặc build Client.

```powershell
$env:NEXT_PUBLIC_ADMIN_SOURCE_CATALOG = '1'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:HUYENCO_API_URL = 'http://127.0.0.1:8080'
```

Thay cổng Backend theo môi trường đang chạy. Đăng nhập Admin, mở **Quản lý dữ liệu nguồn**, dùng bộ lọc loại hoặc tìm kiếm, chuyển trang và chọn một mục để xem chi tiết.

## Nghiệm thu ngày 08/11/2026

- Flyway validate thành công trên bản sao PostgreSQL TEST `huyenco_source_catalog_test_20261108_182437` ở V23.
- **72 kiểm tra HTTP đạt.** Đối chiếu chi tiết 33 mục trang sách, 1 nguồn thuật toán, 14 quy tắc và 3 nhóm bản ghi diễn giải trực tiếp với SQL. Kiểm phân trang, tìm kiếm, bộ lọc kết hợp, mã nguồn sai, mục không tồn tại, phiên khách/USER và Origin sai. Dấu vân tay năm bảng tri thức khớp trước và sau.
- **Chromium đạt** với Backend, Next.js và PostgreSQL thật. Phiên khách được yêu cầu đăng nhập. Admin chuyển trang, lọc và đọc được thông tin ấn bản, mở được chi tiết nguồn `C01-VN-FIXED7` và thấy quy tắc `LUNAR-CONVERSION`. Từ khóa không khớp cho trạng thái rỗng.
- **2.251 kiểm thử Backend đạt**, 30 ca bỏ qua. **1.379 kiểm thử Client**, 62 fixture hợp đồng và kiểm kiểu TypeScript trên mã nguồn đạt.

Kết quả này chốt phần danh mục đọc của CONTENT-01 và CMS-DATA-02. Từ V24, màn hình chi tiết có thể tiếp nhận bản nháp đề xuất theo [hợp đồng CONTENT-02](73-TV2-TV3-SOURCE-EDIT-PROPOSAL-DRAFTS.md).
