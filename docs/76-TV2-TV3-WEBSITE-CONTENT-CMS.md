# Phase 3 · CMS nội dung website

## Phạm vi V27

| Mục trên màn hình Admin | Nơi lưu và hiển thị |
| --- | --- |
| Giới thiệu | `INTRODUCTION`. Khi có bản công bố, trang chủ thêm khối Giới thiệu sau phần mở đầu. |
| Hướng dẫn sử dụng | `USAGE_GUIDE`. Bản công bố hiển thị ở khu vực `#huong-dan` trên trang chủ. Hướng dẫn mặc định tiếp tục hiển thị khi mục chưa được công bố hoặc API tạm thời lỗi. |
| Mô tả phương pháp | Liên kết đến `/admin/methods`. Mô tả từng phương pháp dùng workflow và dữ liệu của [CMS bài hướng dẫn](57-TV2-TV3-METHOD-GUIDE-CMS-CONTRACT.md). |

V27 khởi tạo hai mục biên tập ở trạng thái trống. Nội dung website dùng văn bản thuần. Bản mới có hiệu lực khi Admin khác người soạn xác nhận duyệt và công bố.

## API

Tuyến Admin dùng tiền tố `/api/v1/admin/website-content/{sectionCode}`. GET yêu cầu phiên Admin và kiểm tra Origin nếu có. Yêu cầu ghi cần Origin được cho phép, `X-HuyenCo-Request: 1`, `X-CSRF-Token` và JSON UTF-8. Phản hồi dùng envelope Admin và `Cache-Control: no-store`.

| Tuyến | Dữ liệu gửi hoặc nhận |
| --- | --- |
| GET tiền tố | Đọc `{sectionCode,version,status,working,published}`. Ban đầu `EMPTY`, `version=0`. |
| PUT `/draft` | `{expectedVersion,title,body,editorNote?}`. Lần đầu dùng `expectedVersion=0`. Tiêu đề tối đa 120 ký tự, nội dung 6.000, ghi chú 500. |
| POST `/submit-review` | `{expectedVersion}`. Chuyển bản nháp đã lưu sang chờ duyệt và khóa sửa. |
| POST `/return-to-draft` | `{expectedVersion,reason}`. Lý do bắt buộc, tối đa 500 ký tự. |
| POST `/publish` | `{expectedVersion}`. Duyệt và công bố đúng phiên bản đang chờ. Admin soạn bị từ chối bằng `403 FORBIDDEN`. |
| GET `/events?page=0&size=20` | Nhật ký phân trang mới nhất trước, gồm phiên bản quản trị, bản nội dung, thao tác, Admin, thời điểm UTC và lý do trả về nếu có. |
| GET `/api/v1/website-content` | Khách nhận `{items}` chỉ gồm bản đã công bố. Mỗi bản có `sectionCode,revision,title,body,publishedAt`. Danh sách có thể rỗng. |

`400 INVALID_INPUT` báo dữ liệu sai. Lỗi trường CMS gửi tên trường trong `error.reason`. `409 VERSION_CONFLICT` báo màn hình đang dùng phiên bản cũ. `409 INVALID_TRANSITION` báo thao tác không hợp lệ với trạng thái hiện tại. Mỗi thao tác tăng phiên bản quản trị. Bản nội dung được đánh số theo phiên bản tại lần lưu nháp nên số bản có thể cách quãng.

V27 thêm ba bảng riêng. PostgreSQL khóa một mục khi ghi. Bản nội dung, cập nhật trạng thái và sự kiện được lưu trong cùng giao dịch. Khi lưu hoặc gửi duyệt bản mới, liên kết tới bản công bố trước vẫn có hiệu lực. Trigger bảo vệ bản nội dung và sự kiện khỏi cập nhật hoặc xóa.

## Bật trên môi trường TEST

Migrate và validate Flyway tới V27, bật profile `db` và Auth. Đặt `NEXT_PUBLIC_WEBSITE_CONTENT=1`, `NEXT_PUBLIC_API_BASE_URL=/api/v1`, trỏ `HUYENCO_API_URL` tới Backend và cho phép Origin của Client. Bật thêm `NEXT_PUBLIC_METHOD_GUIDES=1` nếu cần chỉnh bài hướng dẫn phương pháp từ liên kết trong màn hình CMS. Dùng hai Admin TEST để soạn và công bố.

## Nghiệm thu ngày 08/11/2026

- PostgreSQL TEST `huyenco_website_cms_test_20261108_213313` migrate từ V26 lên V27 và validate thành công. Dấu vân tay 33 bảng cũ khớp trước và sau migration.
- 63 kiểm tra HTTP đạt. Hai yêu cầu lưu đồng thời trả `200/409`. Phân quyền, Origin, CSRF, khóa sửa khi chờ duyệt, giữ bản công bố cũ và từ chối tự công bố đều đạt. Trigger từ chối sửa và xóa các bản nội dung cùng sự kiện đã ghi.
- Chromium đạt với hai phiên Admin và một phiên khách. Sau khi tải lại trang chủ, khách đọc đúng bản đã công bố của cả hai mục. Văn bản chứa thẻ HTML được hiển thị như chữ.
- 2.251 kiểm thử Backend đạt, 30 ca bỏ qua. 1.380 kiểm thử Client, 62 fixture hợp đồng và kiểm kiểu TypeScript đạt.
