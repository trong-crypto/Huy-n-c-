# Phạm vi v1.0

## Bắt buộc

- Mai Hoa Dịch Số: lập quẻ theo thời gian; phương pháp số vật đếm được chỉ kích hoạt sau khi giải quyết điểm mơ hồ của ấn bản. Quẻ chủ, hào động, quẻ hỗ, quẻ biến, Thể–Dụng và Ngũ hành theo trạng thái từng quy tắc ở `04-MAIHOA-RULES.md`. Biến thể “hai con số” chưa có căn cứ tại mục đã đối chiếu và không thuộc chức năng tính thật v1.0.
- Diễn Cầm Tam Thế: Ngũ hành theo tuổi Can Chi, giờ theo tháng âm và 36 phần giờ, nghề nghiệp theo hành/tháng hoặc Thiên Can/tháng; chỉ kích hoạt ô bảng đã nhập, kiểm và có nguồn theo `05-TAMTHE-RULES.md`.
- Tra cứu 8 quái, 64 quẻ; chuyển lịch và Can Chi tại Server; kết quả có nguồn.
- STOMP WebSocket, JSON thống nhất, trả riêng theo phiên Client.

## Sau MVP

- Lịch sử tối đa 10 kết quả trên trình duyệt nếu hai module chính hoàn thành.

## Ngoài phạm vi

Tài khoản/đăng nhập, thanh toán, chatbot AI, quản lý người dùng, lưu ngày sinh tại Server. Nội dung luận giải thuộc tri thức văn hóa/tín ngưỡng truyền thống, không phải dự đoán khoa học.

## Phân công

| Thành viên | Sở hữu | Bàn giao |
| --- | --- | --- |
| TV1 | Next.js, form, STOMP Client, hiển thị, lỗi Client | Giao diện, luồng gửi/nhận, kiểm thử Client |
| TV2 | Spring Boot, STOMP, xử lý đồng thời, Mai Hoa | Server, thuật toán đã xác minh, kiểm thử mạng |
| TV3 | Schema, nguồn sách, lịch/Can Chi, Tam Thế | Migration, dữ liệu có nguồn, kiểm thử quy tắc |

