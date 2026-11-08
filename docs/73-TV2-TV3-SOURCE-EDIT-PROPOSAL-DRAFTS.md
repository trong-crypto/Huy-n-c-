# CONTENT-02 · Bản nháp đề xuất chỉnh sửa nguồn

Tại `/admin/sources`, Admin chọn một mục và mở **Đề xuất chỉnh sửa** để lưu nội dung và lý do. Cả trang sách và nguồn thuật toán bên ngoài đều hỗ trợ thao tác này. Một mục nguồn có một luồng bản nháp chung. Mỗi lần lưu tạo phiên bản riêng, kèm ID Admin, thời điểm UTC và bản chụp metadata nguồn tại lúc lưu.

V24 bổ sung bảng `cms_source_proposal_revisions` với khóa ngoại tới đúng loại nguồn và tài khoản Admin. Trigger bảo vệ các phiên bản đã lưu khỏi sửa hoặc xóa trực tiếp. Khi hai Admin thao tác đồng thời, Backend khóa hàng nguồn để tuần tự hóa việc cấp số phiên bản và kiểm `expectedVersion`. Nội dung lưu thuộc bảng CMS riêng. Dữ liệu tri thức và kết quả nghiệp vụ tiếp tục đọc từ các bảng nguồn gốc.

## Hợp đồng API

Tiền tố là `/api/v1/admin/sources/{kind}/{id}/proposal`, với `kind` và `id` theo [danh mục nguồn](72-TV2-TV3-ADMIN-SOURCE-CATALOG.md). Mọi tuyến yêu cầu phiên Admin. POST/PUT dùng Origin hợp lệ, `X-HuyenCo-Request: 1`, `X-CSRF-Token` và JSON UTF‑8. Phản hồi dùng envelope Admin và `Cache-Control: no-store`.

| Yêu cầu | JSON và kết quả |
| --- | --- |
| GET tiền tố | `200` với phiên bản gần nhất. `404` khi chưa có bản nháp. |
| POST tiền tố | `{proposal, reason}`. `201` với phiên bản 1. |
| PUT tiền tố | `{expectedVersion, proposal, reason}`. `200` với phiên bản mới. |
| GET `.../proposal/revisions/{version}` | `200` với đúng phiên bản đã lưu. |

`proposal` bắt buộc, tối đa 2.000 ký tự. `reason` bắt buộc, tối đa 500 ký tự. Hai trường cho phép xuống dòng và dùng quy tắc Unicode của CONTENT-06. `expectedVersion` là số nguyên JSON dương và lấy từ bản nháp vừa đọc. Dữ liệu phản hồi gồm `kind, id, version, proposal, reason, sourceSnapshot, createdBy, createdAt`. `sourceSnapshot` chứa `entry` và `book` theo danh mục nguồn.

| Lỗi | Ý nghĩa |
| --- | --- |
| `400 INVALID_INPUT` | Body, trường hoặc ID không hợp lệ. Trường lỗi xác định được trả trong `error.reason`. |
| `401 INVALID_SESSION`, `403 CSRF_REJECTED` | Kiểm phiên Admin, Origin và CSRF theo hợp đồng hiện có. |
| `404 NOT_FOUND` | Thiếu mục nguồn hoặc phiên bản đề xuất. |
| `409 SOURCE_PROPOSAL_EXISTS`, `409 VERSION_CONFLICT` | Đã có bản nháp hoặc phiên bản vừa thay đổi. Giao diện yêu cầu tải phiên bản mới và giữ nội dung đang nhập. |

## Chạy trên TEST

Sao lưu PostgreSQL TEST, áp dụng và validate Flyway đến V24, rồi chạy Backend profile `db` với Auth bật. Client dùng cờ `NEXT_PUBLIC_ADMIN_SOURCE_CATALOG=1`. Chọn mục nguồn, mở đề xuất, nhập nội dung và lý do, lưu rồi tải lại trang để đối chiếu.

## Nghiệm thu ngày 08/11/2026

- Sao lưu và migrate bản sao PostgreSQL TEST `huyenco_source_proposal_test_20261108_184527` từ V23 đến V24. Flyway validate đạt.
- **42 kiểm tra HTTP đạt** qua Backend thật. Kiểm quyền Admin, Origin, CSRF, lỗi theo trường, giới hạn Unicode, đọc lại phiên bản cũ và bản chụp nguồn ở cả hai loại nguồn.
- Hai yêu cầu tạo đồng thời trả `201/409`. Hai yêu cầu sửa từ cùng phiên bản trả `200/409`. Sau ca API có đúng hai phiên bản của một trang sách và một phiên bản của một nguồn thuật toán. Trigger từ chối UPDATE và DELETE trực tiếp. Dấu vân tay năm bảng tri thức khớp trước và sau.
- **Chromium đạt** qua Next.js, Backend và PostgreSQL thật với hai phiên Admin riêng. Khi nhận `409`, Admin tải phiên bản mới và giữ nội dung đang nhập. Lưu và tải lại trang đọc đúng phiên bản 3 của mục thử.
- **2.251 kiểm thử Backend đạt**, 30 ca bỏ qua. **1.379 kiểm thử Client**, 62 fixture hợp đồng và kiểm kiểu TypeScript trên mã nguồn đạt.

Đây là mốc tạo, sửa và đọc lại bản nháp trên V24. Quy trình duyệt dùng [hợp đồng V25](74-TV2-TV3-SOURCE-EDIT-PROPOSAL-REVIEW.md).
