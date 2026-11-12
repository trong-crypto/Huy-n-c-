# Danh mục phương pháp bói

Quản trị viên mở **Quản lý phương pháp bói** để tìm theo tên hoặc mã, lọc theo nhóm và trạng thái, xem chi tiết, thêm, sửa hoặc xóa metadata. Trang sử dụng cờ Client `NEXT_PUBLIC_METHOD_GUIDES=1` và phiên Admin hiện có.

## Trạng thái hiển thị

| Trạng thái | Ý nghĩa |
| --- | --- |
| `LISTED` | Có bộ tính và đang hiển thị tại `/phuong-phap`. |
| `HIDDEN` | Có bộ tính và đã ẩn tại `/phuong-phap`. Biểu mẫu trực tiếp, bộ tính và lịch sử vẫn hoạt động. |
| `UNAVAILABLE` | Bản ghi biên tập chưa có bộ tính hoặc biểu mẫu. Có thể soạn nội dung trong Admin. |

V38 khởi tạo TIME, OBJECT_COUNT, LINES, TRUONG_XICH và TAM_THE. Mã và nhóm của năm phương pháp lõi cố định. Admin có thể sửa metadata và trạng thái hiển thị. Giới thiệu và hướng dẫn trong metadata hiển thị công khai cho mục `LISTED`. Mục **Hướng dẫn sử dụng** giữ quy trình biên tập và công bố riêng cho bốn mã đã được CMS hướng dẫn hỗ trợ.

## REST API

| Lệnh | Đường dẫn | Dữ liệu |
| --- | --- | --- |
| GET | `/api/v1/methods` | Chi tiết metadata của các mục `LISTED`. |
| GET | `/api/v1/admin/methods` | Danh sách phân trang. Bộ lọc tùy chọn `q`, `group`, `state`, `page`, `size`. |
| GET | `/api/v1/admin/methods/{code}` | Chi tiết phương pháp, nội dung và khả năng tích hợp. |
| POST | `/api/v1/admin/methods` | `code` và metadata. Trả 201. |
| PUT | `/api/v1/admin/methods/{code}` | `expectedVersion` và metadata. Trả chi tiết phiên bản mới. |
| DELETE | `/api/v1/admin/methods/{code}` | JSON chứa `expectedVersion`. Trả `data.deleted=true` khi thành công. |

Metadata gồm `group` (`MAI_HOA`, `TAM_THE` hoặc `OTHER`), `name`, `summary`, `listed` và ba trường tùy chọn `introduction`, `instructions`, `requiredInput`. Mã dài 2–32 ký tự, bắt đầu bằng A–Z và tiếp tục bằng A–Z, chữ số hoặc dấu gạch dưới. Mọi thao tác ghi yêu cầu cookie Admin, Origin hợp lệ, header `X-HuyenCo-Request` và CSRF.

## Bảo vệ dữ liệu

Phương pháp lõi chỉ có thể ẩn. Server chặn xóa nếu bài hướng dẫn, số liệu tính toán hoặc snapshot lịch sử tham chiếu mã phương pháp. Mã đã xóa được giữ trong nhật ký để tránh tái sử dụng. Tạo, sửa, ẩn, hiện và xóa đều được ghi vào Nhật ký quản trị với loại đối tượng `METHOD_CATALOG`. Cập nhật và xóa dùng `expectedVersion` để phát hiện thao tác trên bản ghi cũ.

Chạy Flyway V38 trước khi bật bản Backend và Frontend mới. Migration thêm bảng danh mục và bảng sự kiện, liên kết bài hướng dẫn với danh mục, đồng thời bổ sung sự kiện vào truy vấn nhật ký hiện có.
