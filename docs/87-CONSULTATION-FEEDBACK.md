# Báo cáo và đánh giá tư vấn

Migration V41 tạo `consultation_reports`, `consultation_ratings`, lý do khóa trong tài khoản và lịch sử khóa. Sao lưu database trước khi chạy Flyway migrate; không sửa checksum các migration đã áp dụng.

## Hành vi và quyền

- Người tham gia được báo cáo đối phương, một báo cáo mỗi phòng/người gửi. Admin nhận thông báo sau khi giao dịch lưu thành công. Người bị báo cáo không xem được nội dung báo cáo.
- Nhóm lý do: HARASSMENT, INAPPROPRIATE, FRAUD, PRIVACY, SPAM, OTHER. OTHER bắt buộc mô tả; tối đa 2000 ký tự.
- Chỉ người dùng của một phòng kết thúc với COMPLETED được đánh giá 1–5 sao. Mỗi phòng có một đánh giá, gửi lại không làm tăng lượt. Không sửa sao đã gửi. Không đánh giá phòng bị từ chối hoặc hủy. Bỏ qua không tạo điểm 0; có thể đánh giá lại bằng nút trong phòng đã kết thúc.
- Sau khi người dùng kết thúc cuộc tư vấn, mở hộp đánh giá; chọn sao rồi gửi hoặc bỏ qua. Điểm trung bình và số lượt hiển thị khi tải lại danh bạ hoặc danh sách tài khoản admin. Chưa có lượt thì hiển thị “Chưa có đánh giá”.
- Admin lọc báo cáo, xem tin nhắn còn trong thời hạn lưu trữ (50 tin/trang), ghi chú và chuyển trạng thái PENDING / REVIEWING / RESOLVED / DISMISSED. Ngoài PENDING cần ghi chú. Thao tác khóa riêng tại chi tiết tài khoản, có kiểm tra phiên bản và lý do bắt buộc.
- Khóa tài khoản thu hồi phiên. Khi đăng nhập đúng mật khẩu hoặc truy cập bằng phiên chưa hết hạn của tài khoản bị khóa, trả ACCOUNT_SUSPENDED cùng lý do và email `ddaotrondz2005@gmail.com`. Sai mật khẩu vẫn trả lỗi chung, không tiết lộ lý do khóa. Mở khóa xóa lý do hiện hành, giữ lịch sử.

## API

Giữ envelope requestId/status/data/error hiện có, cookie cùng origin. Mọi thao tác ghi yêu cầu CSRF.

| Endpoint | Dữ liệu / kết quả |
|---|---|
| GET /api/v1/chat/conversations/{id}/feedback | reported:boolean, stars:0..5 của chính người truy cập |
| POST /api/v1/chat/conversations/{id}/reports | reason, description; saved:true |
| PUT /api/v1/chat/conversations/{id}/rating | stars:1..5; saved:true |
| GET /api/v1/admin/reports?status=PENDING&page=0 | items, totalElements, totalPages, page; 20 mục/trang |
| GET /api/v1/admin/reports/{id}/messages?page=0 | items: sequence,text,created_at,sender_name |
| PUT /api/v1/admin/reports/{id} | status, note; saved:true |
| PUT /api/v1/admin/accounts/{id}/status | expectedVersion,status,reason (bắt buộc khi LOCKED) |

Danh bạ tư vấn viên và tài khoản admin bổ sung averageRating:number|null, ratingCount:number. Tài khoản admin bổ sung lockReason:string|null. Bộ đếm được tính từ dữ liệu lưu, không dựa vào trình duyệt. Không truy cập được phòng người khác; admin không thể đánh giá thay người dùng.
