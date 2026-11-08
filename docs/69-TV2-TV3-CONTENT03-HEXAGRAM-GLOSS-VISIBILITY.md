# CONTENT-03 · Ẩn và hiện nghĩa tên quẻ đã công bố

Phạm vi là nghĩa tên quẻ `NAME_GLOSS` trong màn hình `/admin/readings`. Bất kỳ Admin có phiên hợp lệ đều có thể ẩn hoặc hiện lại một mục đã được công bố. Quy tắc Admin công bố phải khác người soạn tiếp tục áp dụng khi duyệt phiên bản mới.

| Tình huống | Trang tra cứu công khai |
| --- | --- |
| Chưa có bản công bố CMS | Hiển thị nghĩa tên E01 nếu đã được duyệt. Nút ẩn/hiện chỉ có sau lần công bố đầu tiên. |
| Có bản công bố và mục đang hiện | Hiển thị nghĩa tên của phiên bản đã công bố gần nhất. |
| Admin ẩn mục | Quẻ vẫn xuất hiện, kèm tên, sáu hào và nguồn tên. API chi tiết trả `interpretations: []`. |
| Công bố phiên bản mới khi mục đang ẩn | Mục vẫn ẩn. Admin có thể mở lại bằng thao tác hiện. |
| Admin hiện lại | Hiển thị phiên bản đã công bố gần nhất. Bản nháp và bản chờ duyệt tiếp tục chỉ dành cho Admin. |

V23 mở rộng nhật ký V22 bằng hai sự kiện `HIDE` và `SHOW`. Mỗi sự kiện ghi Admin, thời điểm, số thứ tự và phiên bản công bố tại lúc thao tác. Sự kiện mới nhất của nhóm này quyết định mức hiển thị cho cả mục. Trạng thái duyệt của bản nháp được tính riêng. Các bản đã công bố từ V22 mặc định hiện.

## Hợp đồng và cấu hình

`PUT /api/v1/admin/hexagrams/{code}/gloss-draft/workflow/visibility` cần phiên Admin, Origin hợp lệ, `X-HuyenCo-Request: 1` và `X-CSRF-Token`. Ví dụ JSON ẩn mục.

```json
{"expectedVersion":5,"visible":false}
```

- `expectedVersion` lấy từ `version` của workflow. Mỗi thao tác ghi thành công tăng số này. `draftVersion` tiếp tục dùng riêng khi lưu nội dung bản nháp.
- GET workflow và PUT thành công trả thêm `visible` và `lastVisibilityEvent`. `lastEvent` vẫn là sự kiện duyệt gần nhất. `lastVisibilityEvent` có thể là `null`. Khi chưa có bản công bố CMS, `visible=false` và nghĩa tên công khai có thể đến từ E01.
- `409 VERSION_CONFLICT` khi dùng phiên bản cũ. `409 INVALID_TRANSITION` khi chưa có bản công bố hoặc trạng thái yêu cầu trùng trạng thái hiện tại. Body sai trả `400 INVALID_INPUT`. Phản hồi quyền và CSRF dùng hợp đồng Admin hiện có.
- API chi tiết Admin vẫn cung cấp nghĩa tên đã công bố và trả `nameGloss.publiclyVisible=false` khi mục bị ẩn. API tra cứu công khai giữ nguyên cấu trúc phản hồi.

Áp dụng Flyway đến V23 trước khi bật Client. Tiếp tục dùng cờ `NEXT_PUBLIC_ADMIN_HEXAGRAM_GLOSSES=1` và cấu hình cùng Origin theo [tài liệu 67](67-TV2-TV3-HEXAGRAM-GLOSS-PUBLICATION.md). Màn hình yêu cầu xác nhận thao tác ẩn/hiện. Nếu gặp `409`, tải trạng thái mới rồi thực hiện lại khi cần.

## Nghiệm thu ngày 08/11/2026

- Flyway migrate và validate V23 trên bản sao `huyenco_gloss_visibility_test_20261108`. Bốn bản công bố V22, nhật ký cũ, phiên bản nháp và dữ liệu E01 khớp dấu vân tay sau migration. Bản công bố kiểm soát từ V22 vẫn hiển thị.
- 45 kiểm tra HTTP đạt trên Backend và PostgreSQL thật. Hai yêu cầu ẩn đồng thời trả `200/409`, chỉ ghi một sự kiện. Kiểm quyền Admin, Origin, CSRF, xung đột giữa ẩn và công bố, công bố khi đang ẩn và hiện đúng phiên bản đã duyệt. Dấu vân tay năm bảng tri thức khớp trước và sau lượt kiểm.
- Hai phiên Admin và một phiên khách trên Chromium xác nhận ẩn/hiện, tải lại sau `409` và hiển thị ở trang tra cứu. Quẻ `H_CAN_CHAN` giữ bản công bố 3 và bản nháp chờ duyệt 4 qua cả hai thao tác.
- 2.251 kiểm thử Backend đạt, 30 ca bỏ qua. 1.375 kiểm thử Client và 62 fixture hợp đồng hiện có đạt. Kiểm kiểu TypeScript trên mã nguồn đạt.
