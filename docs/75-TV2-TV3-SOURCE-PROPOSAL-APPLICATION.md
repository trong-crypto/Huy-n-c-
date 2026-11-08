# CONTENT-04 và CMS-DATA-04 · Áp dụng đề xuất sửa metadata sách

V26 cho phép Admin áp dụng có kiểm soát một thay đổi **Tác giả** hoặc **Nhà xuất bản** của một ấn bản. Đề xuất được tạo từ một trang nguồn, còn metadata dùng chung cho mọi trang thuộc ấn bản đó. Mỗi phiên bản đề xuất chứa tối đa một trường cần sửa.

## Thao tác trên Client

1. Trong Admin → Nguồn, mở trang nguồn và chọn **Đề xuất chỉnh sửa**. Điền nội dung, lý do, trường metadata và giá trị mới trên một dòng.
2. Lưu bản nháp và gửi duyệt. Admin khác người soạn đối chiếu nội dung, trường, giá trị và bản chụp nguồn, rồi phê duyệt đúng phiên bản.
3. Chọn **Xem trước áp dụng**. So sánh ấn bản, giá trị trước khi sửa, giá trị hiện tại và giá trị đã duyệt.
4. Chọn **Xác nhận áp dụng**. Kết quả hiển thị Admin áp dụng, thời điểm và giá trị hiện tại. Nếu nguồn đã thay đổi, tạo phiên bản đề xuất mới dựa trên nguồn hiện tại và gửi duyệt lại.

Đề xuất cũ hoặc đề xuất chỉ ghi văn bản vẫn xem và duyệt được. Để áp dụng metadata từ đề xuất đó, tạo phiên bản mới có trường và giá trị cụ thể rồi gửi duyệt. Thay đổi có hiệu lực khi xác nhận thành công. Trạng thái xét duyệt vẫn là `APPROVED`, còn thông tin áp dụng nằm trong nhật ký riêng.

## Hợp đồng API và PostgreSQL

Giữ luồng đề xuất và duyệt của [V24](73-TV2-TV3-SOURCE-EDIT-PROPOSAL-DRAFTS.md) và [V25](74-TV2-TV3-SOURCE-EDIT-PROPOSAL-REVIEW.md).

- Khi tạo hoặc sửa đề xuất `BOOK_PAGE`, gửi cặp tùy chọn `bookField` (`AUTHOR` hoặc `PUBLISHER`) và `bookValue` (1–300 ký tự Unicode sau khi bỏ khoảng trắng đầu cuối, một dòng). Cả hai trường đi cùng nhau. Giá trị trùng với dữ liệu nguồn, giá trị rỗng và cặp trường trên `EXTERNAL_ALGORITHM` trả `400 INVALID_INPUT`. Phản hồi phiên bản có thêm `bookChange`, bằng `null` hoặc `{field,value}`.
- GET `/api/v1/admin/sources/{kind}/{id}/proposal/workflow/application` trả phiên bản workflow, phiên bản đề xuất, mã ấn bản, tên sách, nhãn ấn bản, trường, giá trị trước, sau, hiện tại, cờ `stale` và thông tin `applied` (Admin, thời điểm UTC), nếu có. Phản hồi dùng envelope Admin và `Cache-Control: no-store`.
- POST cùng tuyến nhận duy nhất `{"expectedVersion":3}` với `expectedVersion` lấy từ workflow đã xem trước. Yêu cầu phiên Admin, Origin hợp lệ, `X-HuyenCo-Request: 1`, `X-CSRF-Token` và JSON UTF-8. Thành công trả `200` với giá trị đã áp dụng và thông tin nhật ký.
- `409 VERSION_CONFLICT` báo phiên bản workflow đã đổi. `409 INVALID_TRANSITION` báo đề xuất chưa đủ điều kiện áp dụng. `409 SOURCE_CHANGED` báo bản chụp nguồn đã lệch. `409 SOURCE_ALREADY_APPLIED` báo phiên bản đã được áp dụng.
- Khi ghi, Server khóa trang nguồn và ấn bản, đọc lại trạng thái xét duyệt, so sánh bản chụp, cập nhật đúng một cột trong `source_books` và chèn một dòng vào `cms_source_proposal_applications` trong cùng giao dịch. Trigger PostgreSQL bảo vệ dòng nhật ký khỏi sửa hoặc xóa. Trình áp dụng chỉ nhận hai trường metadata kể trên. Quy tắc, nội dung luận giải và trạng thái xác minh nguồn có quy trình riêng.

Bật màn hình với `NEXT_PUBLIC_ADMIN_SOURCE_CATALOG=1` cùng cấu hình Admin hiện có sau khi migrate và validate V26 trên môi trường đích.

## Nghiệm thu ngày 08/11/2026

- Trên bản sao PostgreSQL TEST `huyenco_source_apply_test_20261108_200632`, Flyway migrate và validate V26 thành công. Dấu vân tay dữ liệu cũ của 32 bảng khớp trước và sau migration, gồm 10 phiên bản đề xuất.
- 57 kiểm tra HTTP đạt. Hai yêu cầu áp dụng cùng phiên bản cho kết quả `200/409` và một dòng nhật ký. Đề xuất còn lại trên cùng ấn bản bị từ chối khi bản chụp đã cũ. PostgreSQL từ chối sửa và xóa dòng nhật ký.
- Tám ca hồi quy công khai khớp trước và sau khi áp dụng, gồm ba phương pháp Mai Hoa, hai ca Tam Thế, hai phép lịch và tra cứu quẻ. Bảy bảng tri thức đối chiếu giữ nguyên dấu vân tay.
- Hai phiên Admin độc lập trên Chromium đã soạn, gửi duyệt, phê duyệt, xem trước và áp dụng giá trị nhà xuất bản. Tải lại trang đọc được giá trị và thông tin áp dụng.
- 2.251 kiểm thử Backend đạt, 30 ca được bỏ qua trong bộ Maven. 1.379 kiểm thử Client, 62 fixture hợp đồng và kiểm kiểu TypeScript đạt.
