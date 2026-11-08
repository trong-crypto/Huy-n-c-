# CONTENT-05 · Nghiệm thu quyền truy cập CMS

Phạm vi kiểm là REST của hai mô-đun CMS đang hoạt động, gồm bài hướng dẫn phương pháp và nghĩa tên quẻ `NAME_GLOSS`. Dùng Backend hiện tại với profile `db`, Auth bật, HTTP loopback và một bản sao PostgreSQL TEST đã validate V23. Tài khoản và nội dung ghi trong ca kiểm đều là dữ liệu tổng hợp.

## Ma trận quyền và Origin/CSRF

- **401 trên cả 20 tuyến.** Khách, USER, CONSULTANT, Admin đã đăng xuất, Admin hết hạn và token CUSTOMER được gửi dưới tên cookie Admin đều nhận `INVALID_SESSION`. Ca đăng xuất dùng API. Ca hết hạn đặt hạn trong quá khứ cho đúng phiên tổng hợp trên TEST.
- **403 trên cả 20 tuyến khi Origin sai.** Với 12 tuyến ghi, thiếu Origin, thiếu CSRF, CSRF lấy từ một Admin khác, CSRF lấy từ phiên khác của cùng Admin hoặc thiếu `X-HuyenCo-Request: 1` đều nhận `CSRF_REJECTED`.
- **403 riêng khi tự công bố nghĩa tên quẻ.** Admin soạn phiên bản nhận `FORBIDDEN`. Admin thứ hai công bố thành công với cùng dữ liệu yêu cầu.
- **Admin hợp lệ.** GET đọc được chỉ với cookie Admin, không gửi Origin, CSRF hoặc header ghi. POST/PUT dùng đúng Origin, header ghi và CSRF của phiên gửi. Ca ghi được chạy với dữ liệu và trạng thái hợp lệ để đối chiếu với ca từ chối trên cùng tuyến.

Mỗi ca kiểm xác nhận HTTP status, mã lỗi, envelope, `requestId` và `Cache-Control: no-store` của tuyến Admin. Trước và sau nhóm yêu cầu bị từ chối trên từng tuyến, so sánh số dòng và dấu vân tay của năm bảng CMS cùng bảng `interpretations`. Truy vấn đối chiếu chỉ đọc. Cả sáu bảng khớp ở tất cả các nhóm từ chối.

## Kết quả theo tuyến

Mọi đường dẫn dưới đây có tiền tố `/api/v1`. Với bảng thứ nhất, `G` là `/admin/method-guides/{methodCode}`. Với bảng thứ hai, `H` là `/admin/hexagrams/{code}`.

| Bài hướng dẫn phương pháp | Admin hợp lệ | Số ca bị từ chối |
| --- | ---: | ---: |
| GET `/admin/method-guides` | 200 | 7 |
| GET `G` | 200 | 7 |
| GET `G/events` | 200 | 7 |
| POST `/admin/method-guides` | 201 | 12 |
| PUT `G/draft` | 200 | 12 |
| POST `G/submit-review` | 200 | 12 |
| POST `G/return-to-draft` | 200 | 12 |
| POST `G/publish` | 200 | 12 |
| PUT `G/visibility` | 200 | 12 |

| Nghĩa tên quẻ | Admin hợp lệ | Số ca bị từ chối |
| --- | ---: | ---: |
| GET `/admin/hexagrams` | 200 | 7 |
| GET `H` | 200 | 7 |
| GET `H/gloss-draft` | 200 | 7 |
| GET `H/gloss-draft/revisions/{version}` | 200 | 7 |
| GET `H/gloss-draft/workflow` | 200 | 7 |
| POST `H/gloss-draft` | 201 | 12 |
| PUT `H/gloss-draft` | 200 | 12 |
| POST `H/gloss-draft/workflow/submit-review` | 200 | 12 |
| POST `H/gloss-draft/workflow/return-to-draft` | 200 | 12 |
| POST `H/gloss-draft/workflow/publish` | 200 | 13 |
| PUT `H/gloss-draft/workflow/visibility` | 200 | 12 |

Ngoài ma trận Admin, API công khai xác nhận nghĩa tên sau công bố, rồi xác nhận nghĩa tên và bài hướng dẫn đã ẩn không còn xuất hiện. Dữ liệu thử dùng phương pháp `LINES` và quẻ `H_CAN_KHAM`.

## Kết quả nghiệm thu

Lượt ngày 08/11/2026 đạt 241 yêu cầu HTTP, trong đó có 201 ca từ chối gồm 120 phản hồi `401` và 81 phản hồi `403`. Tiến trình kiểm thử trả mã thoát 0. Ma trận chạy trên Backend loopback với PostgreSQL TEST `huyenco_content05_test_20261108_174507`. Nội dung website và đề xuất sửa dữ liệu nguồn nằm ngoài hai mô-đun đã có API CMS được nghiệm thu ở đây.
