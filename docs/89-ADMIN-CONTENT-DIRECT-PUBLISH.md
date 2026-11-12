# Cập nhật nội dung Admin trực tiếp

## Chính sách hiện tại

Trong mô hình một Admin, thao tác **Lưu và cập nhật** ghi một phiên bản mới và đưa phiên bản đó lên nội dung công khai ngay trong cùng giao dịch. Admin không cần gửi duyệt, chờ duyệt hoặc bấm công bố lần thứ hai.

Áp dụng cho:

- Bài hướng dẫn phương pháp và nội dung website.
- Nghĩa tên quẻ do Admin biên tập.
- Luận giải chi tiết và bài thơ diễn nghĩa.
- Ghi nhận trực tiếp đề xuất/cập nhật thông tin nguồn; thay đổi tác giả hoặc nhà xuất bản được ghi vào metadata ấn bản ngay khi lưu. Đề xuất với nguồn thuật toán bên ngoài được ghi vào nhật ký, không sửa URL hay SHA-256 của nguồn.

## Ranh giới dữ liệu vẫn được giữ

- Mọi lần lưu vẫn tạo revision và sự kiện nhật ký bất biến, kèm Admin thực hiện và thời điểm.
- Luận giải chỉ cập nhật khi các nguồn gắn với nội dung đã ở trạng thái `VERIFIED`.
- Nghĩa tên vẫn yêu cầu mục `NAME_GLOSS` E01 đã được xác minh; thông tin trang in, PDF và SHA-256 nguồn được giữ kèm phiên bản.
- Ẩn/hiện nội dung vẫn là thao tác riêng của Admin.
- Duyệt hồ sơ tư vấn viên, yêu cầu tài khoản/mật khẩu và các quyền truy cập vẫn theo quy trình riêng; thay đổi này không tự cấp quyền.

## Triển khai

Migration `V39__single_admin_direct_content_publication.sql` gỡ ràng buộc bắt buộc Admin thứ hai cho việc công bố luận giải. Flyway áp dụng migration khi Backend khởi động theo cấu hình hiện có. Không cần chỉnh tay dữ liệu hoặc bảng trong PostgreSQL.

Các trạng thái `PENDING_REVIEW` và các endpoint duyệt cũ vẫn được giữ để đọc lịch sử và tương thích bản ghi cũ. Giao diện biên tập hiện tại không tạo thêm bước chờ duyệt.

