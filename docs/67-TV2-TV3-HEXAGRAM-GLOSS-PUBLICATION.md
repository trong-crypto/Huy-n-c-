# Duyệt và công bố nghĩa tên quẻ

CONTENT-04 và CMS-DATA-04 trong phạm vi `NAME_GLOSS`. Bản nháp tiếp tục được lưu theo từng phiên bản như tài liệu 66. Một Admin khác người soạn đối chiếu nguồn, xác nhận nhãn in và ghi chú trước khi công bố.

Từ V23, Admin có thể điều khiển mức hiển thị của nghĩa tên đã công bố theo [hợp đồng CONTENT-03](69-TV2-TV3-CONTENT03-HEXAGRAM-GLOSS-VISIBILITY.md). Các ca nghiệm thu bên dưới ghi nhận mốc V22.

| Trạng thái hiện tại | Thao tác | Trạng thái kế tiếp |
| --- | --- | --- |
| `DRAFT` | Gửi duyệt | `PENDING_REVIEW` |
| `PENDING_REVIEW` | Trả về, kèm lý do | `DRAFT` |
| `PENDING_REVIEW` | Công bố, kèm nhãn in và ghi chú | `PUBLISHED` |
| `PUBLISHED` | Lưu chỉnh sửa thành phiên bản mới | `DRAFT` |

Bản đang chờ duyệt được khóa chỉnh sửa. Khi có bản nháp mới hoặc bản mới đang chờ duyệt, người dùng vẫn đọc được bản đã công bố gần nhất. Trước lần công bố đầu tiên, API tra cứu trả nghĩa tên E01. V22 bổ sung nhật ký chỉ ghi nối tiếp và liên kết sự kiện công bố tới đúng phiên bản V21. API công khai lấy nội dung và trang nguồn từ phiên bản đó, giữ số thứ tự E01 và định dạng phản hồi E02. Trạng thái `VERIFIED` chỉ áp dụng cho nghĩa tên đã được Admin duyệt.

## Hợp đồng API cho Client

Các tuyến dưới đây có tiền tố `/api/v1/admin/hexagrams/{code}/gloss-draft/workflow`. Cần phiên Admin. POST cần JSON, Origin hợp lệ, `X-HuyenCo-Request: 1` và `X-CSRF-Token`. Phản hồi dùng envelope của API Admin và `Cache-Control: no-store`.

| Yêu cầu | JSON gửi lên |
| --- | --- |
| `GET` tiền tố trên | Đọc trạng thái mới nhất. |
| `POST .../submit-review` | `{"expectedVersion":1}` |
| `POST .../return-to-draft` | `{"expectedVersion":2,"reason":"Đối chiếu lại trang nguồn"}` |
| `POST .../publish` | `{"expectedVersion":2,"printedSourceLabel":"Nhãn theo bản in","verificationNote":"Đã đối chiếu đúng ấn bản và trang nguồn"}` |

Các số trong ví dụ minh họa cách gửi trường. Luôn lấy `expectedVersion` từ phản hồi mới nhất cho thao tác tương ứng.

- GET và các thao tác thành công trả `200` với `data: {version, draftVersion, status, publishedVersion, lastEvent}`. `publishedVersion` và `lastEvent` có thể là `null`.
- `lastEvent` gồm `sequence, revision, action, actorId, occurredAt, reason, printedSourceLabel, verificationNote`. Các trường ghi chú có thể là `null` theo loại sự kiện.
- POST chuyển trạng thái dùng `version` của workflow. PUT nội dung theo tài liệu 66 dùng phiên bản nháp `draftVersion`. Nhãn trạng thái hiển thị trên giao diện lấy từ workflow. API phiên bản nháp luôn mô tả nội dung biên tập.
- Lý do và ghi chú dài tối đa 500 ký tự mỗi trường. Nhãn in dài tối đa 120 ký tự. Người duyệt kiểm đúng trang nguồn của phiên bản đang chờ.
- `400 INVALID_INPUT` khi body sai. `401 INVALID_SESSION` khi thiếu phiên Admin. `403 CSRF_REJECTED` khi Origin/CSRF sai và `403 FORBIDDEN` khi người soạn tự công bố. `404 NOT_FOUND` khi quẻ chưa có bản nháp hoặc không tồn tại.
- `409 VERSION_CONFLICT` yêu cầu tải lại workflow hoặc bản nháp tương ứng. `409 INVALID_TRANSITION` khi thao tác sai trạng thái, sửa bản chờ duyệt hoặc quẻ thiếu mục E01 đã duyệt để đối chiếu.

## PostgreSQL và nghiệm thu

Áp dụng và validate Flyway đến V22 trước khi chạy Backend với profile `db`. Ca ngày 08/11/2026 dùng `huyenco_gloss_workflow_test_20261108`, bản sao PostgreSQL TEST V21 với tài khoản và nội dung giả lập, trên loopback cổng 18124.

- Bộ kiểm thử Backend báo 2.280 ca, gồm 2.250 ca đạt và 30 ca bỏ qua, không có lỗi. Ca nghiệm thu riêng thực hiện 37 kiểm tra HTTP qua tạo nháp, gửi duyệt, trả về, chỉnh sửa và hai lần công bố. Ca lỗi kiểm quyền Admin, CSRF, tự công bố, thao tác sai trạng thái, body và phiên bản cũ.
- Hai yêu cầu công bố đồng thời cùng phiên bản trả `200/409`. Lượt nghiệm thu hoàn chỉnh lưu sáu sự kiện cho quẻ được kiểm và đọc lại được phiên bản cũ.
- API công khai chỉ đổi sau từng lần công bố, trả đúng nguồn và ghi chú. Dấu vân tay của năm bảng tri thức gốc khớp trước và sau ca kiểm. PostgreSQL TEST vẫn giữ dữ liệu giả lập để đối chiếu.

## Nghiệm thu PH3-PH-01 cho nghĩa tên quẻ

Chạy Backend với profile `db` trên PostgreSQL TEST đã validate V22. Bật `AUTH_ENABLED=true` và thêm Origin chính xác của Client vào `ALLOWED_ORIGINS`. Cấp hai tài khoản Admin TEST theo tài liệu 63. Tại thư mục `client`, khởi động lại Next.js với cấu hình dưới đây. Nếu chạy bản đóng gói, thiết lập cờ `NEXT_PUBLIC_*` trước khi build.

```powershell
$env:HUYENCO_API_URL = 'http://127.0.0.1:18134'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:NEXT_PUBLIC_ADMIN_HEXAGRAM_GLOSSES = '1'
npm run dev -- --hostname 127.0.0.1 --port 18133
```

Mở `http://127.0.0.1:18133/admin/readings` và đăng nhập. Hai Admin dùng hai hồ sơ trình duyệt hoặc hai phiên cookie độc lập. Màn hình đưa ra trang nguồn tên quẻ, trang nguồn nghĩa tên hiện có và nguồn đã lưu trong phiên bản, tùy dữ liệu của quẻ được chọn.

| Ca | Kết quả trên Chromium và PostgreSQL TEST ngày 08/11/2026 |
| --- | --- |
| Bảo vệ màn hình | Phiên khách được yêu cầu đăng nhập. Hai Admin đăng nhập và thao tác trong các phiên độc lập. |
| Sửa cạnh tranh | Admin thứ hai lưu phiên bản 2. Thao tác lưu từ phiên bản 1 nhận `409`. Tải lại vẫn giữ nội dung đang nhập, sau đó lưu thành phiên bản 3. |
| Gửi duyệt và trả về | Bản chờ duyệt khóa chỉnh sửa. Admin thứ hai trả về kèm lý do, rồi người soạn gửi duyệt lại. |
| Công bố | Người soạn không thấy thao tác công bố. Admin thứ hai xác nhận nhãn in và ghi chú rồi công bố phiên bản 3. Trang tra cứu công khai nhận nghĩa mới cùng nhãn in. |
| Bản công bố tồn tại song song | Khi phiên bản 4 chờ duyệt, trang tra cứu vẫn trả phiên bản 3. Kiểm tra bảng `interpretations` cho thấy dữ liệu E01 gốc khớp trước và sau. |

Ca trình duyệt dùng quẻ `H_CAN_CHAN` trong `huyenco_gloss_workflow_test_20261108`. 1.375 kiểm thử Vitest và 62 fixture hợp đồng hiện có đạt. Kiểm kiểu TypeScript trên mã nguồn đạt với cấu hình kiểm tách các thư mục sinh của những lần chạy Next.js trước.

Kết quả PH3-PH-01 ở đây áp dụng cho nghĩa tên quẻ. Các mô-đun CMS khác được theo dõi trong bảng bàn giao.
