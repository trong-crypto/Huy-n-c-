# Huyền Cơ · Hợp đồng xác thực quản trị cần thống nhất

Phase 2 bắt đầu từ `8f2a525` trên nhánh `bmanh812`. Client có trang `/admin/login` để kiểm tra biểu mẫu và `/admin` để xem bố cục, trạng thái các module. Tích hợp đăng nhập quản trị đang chờ Backend.

## Hiện trạng tại commit nền

- `POST /api/v1/session` trong `HistoryController` cấp phiên ẩn danh cho lịch sử. Phản hồi gồm thời hạn và CSRF token. Cookie `huyenco_session` do Server cấp với HttpOnly và SameSite=Lax.
- `SessionService` xác minh phiên qua token và chủ sở hữu lịch sử. Phiên này không đại diện cho tài khoản hoặc vai trò ADMIN.
- `HistoryController` dùng 401 cho phiên lịch sử không hợp lệ và 403 cho lỗi CSRF. Hai trạng thái này chưa mô tả xác thực hay phân quyền quản trị.
- Các controller và migration hiện tại chưa có login, logout, API phiên Admin, tài khoản hoặc kiểm tra role ADMIN. Next.js hiện chỉ chuyển tiếp các API đã thống nhất cho website người dùng.

## API TV2 cần cung cấp

Các tên dưới đây là **đề xuất chức năng**, chưa phải endpoint đã tồn tại. TV2 và TV1 cần chốt đường dẫn, phương thức, schema và mã lỗi trước khi Client gọi API.

| Chức năng | Hợp đồng cần thống nhất |
| --- | --- |
| Đăng nhập | POST nhận tài khoản và mật khẩu, xác minh phía Server, cấp cookie phiên quản trị. Thống nhất lỗi sai thông tin và trường hợp tài khoản hợp lệ nhưng thiếu quyền. |
| Đọc phiên hiện tại | GET trả thông tin tối thiểu để hiển thị tên Admin, role, thời hạn và thông tin CSRF theo thiết kế đã duyệt. Trả 401 khi thiếu hoặc hết phiên, 403 khi thiếu quyền. |
| Đăng xuất | POST thu hồi phiên phía Server, xóa cookie quản trị và kiểm tra CSRF theo hợp đồng. |
| Bảo vệ API quản trị | Kiểm tra phiên và role ADMIN trên từng API quản trị. Thống nhất xử lý 401/403, Origin và CSRF cho các thao tác thay đổi dữ liệu. |

TV2 cần chốt cách tách cookie phiên quản trị với `huyenco_session` và cấu hình localhost. TV3 phối hợp về lưu tài khoản, role, phiên và dữ liệu kiểm thử. Tài khoản kiểm thử được cấp qua kênh riêng của nhóm.

## Đề xuất request và response để TV2/TV1 chốt

| Thao tác | Request đề xuất | Response thành công đề xuất |
| --- | --- | --- |
| Đăng nhập | JSON gồm `username` và `password` | HTTP 200, cookie Admin do Server cấp. Dữ liệu phiên gồm `displayName`, `role`, `expiresAt` và `csrfToken` nếu cơ chế CSRF đã thống nhất cần trường này. |
| Đọc phiên | GET kèm cookie Admin, không có body | HTTP 200, trả cùng cấu trúc dữ liệu phiên. Role do Server xác minh. |
| Đăng xuất | POST kèm cookie Admin và thông tin CSRF theo hợp đồng | HTTP 204, Server thu hồi phiên và hết hạn cookie Admin. |

- Thống nhất đường dẫn, tên và kiểu các trường, định dạng thời hạn, envelope JSON và mã lỗi ổn định. Hình dạng trên phục vụ thảo luận, chưa được Client sử dụng.
- Đề xuất 401 cho sai thông tin đăng nhập hoặc phiên thiếu, hết hạn hay đã thu hồi. Đề xuất 403 cho tài khoản hợp lệ nhưng thiếu role ADMIN hoặc yêu cầu không qua kiểm tra Origin/CSRF. Lỗi xác thực cần thông báo chung, tránh tiết lộ tài khoản nào tồn tại.
- Thống nhất tên, phạm vi đường dẫn, thời hạn và thuộc tính cookie Admin, cùng quy tắc Origin khi đăng nhập và cách cấp/gửi CSRF cho thao tác thay đổi dữ liệu. Backend thực thi kiểm tra quyền trên mọi API quản trị.

## Điều kiện tích hợp và nghiệm thu

TV1 sẽ thêm kiểu dữ liệu, Client gọi API và trạng thái loading/error sau khi hợp đồng được chốt. Khi có Backend TEST, chạy các ca đăng nhập đúng, sai mật khẩu, thiếu role, mở trực tiếp trang bảo vệ, hết phiên, đăng xuất và gọi API khi thiếu quyền. Kiểm tra thêm việc chuyển giữa Admin và website người dùng để xác nhận hai loại phiên hoạt động đúng phạm vi.
