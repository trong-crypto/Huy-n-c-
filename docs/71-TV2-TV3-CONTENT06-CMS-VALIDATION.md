# CONTENT-06 · Kiểm tra đầu vào và phản hồi lỗi CMS

Phạm vi là thao tác biên tập, duyệt và ẩn/hiện của hai mô-đun đang hoạt động, gồm bài hướng dẫn phương pháp và nghĩa tên quẻ `NAME_GLOSS`. Backend kiểm tra đầu vào, còn Client dùng cùng quy tắc độ dài cho các trường văn bản và hiển thị lỗi cạnh ô tương ứng.

## Quy tắc đầu vào

| Mô-đun | Trường | Giới hạn và định dạng |
| --- | --- | --- |
| Bài hướng dẫn | `title` | Bắt buộc, một dòng, 1–120 ký tự Unicode. |
| Bài hướng dẫn | `body`, `editorNote`, `reason` | Nội dung 1–6.000 ký tự. Ghi chú biên tập tùy chọn, tối đa 500. Lý do trả về 1–500. Các trường này cho phép tab và xuống dòng. |
| Nghĩa tên quẻ | `content`, `reason`, `verificationNote` | Bắt buộc khi thao tác tương ứng cần trường đó, một dòng, 1–500 ký tự. |
| Nghĩa tên quẻ | `printedSourceLabel` | Bắt buộc khi công bố, một dòng, 1–120 ký tự. |
| Nghĩa tên quẻ | `sourceSectionId` | Chuỗi số nguyên dương biểu diễn được dưới dạng `long`, không có số 0 đứng đầu. Trang nguồn phải đủ dữ liệu đối chiếu. |
| Cả hai | `expectedVersion`, `visible` | Phiên bản là số nguyên dương kiểu JSON number trong phạm vi `int`. Giá trị hiển thị là JSON boolean. |

Độ dài đếm theo điểm mã Unicode sau khi bỏ khoảng trắng hai đầu. Ký tự điều khiển ngoài ngoại lệ đã nêu và surrogate đơn lẻ bị từ chối. Backend kiểm kích thước yêu cầu trước khi phân tích JSON, tối đa 32 KiB cho bài hướng dẫn và 8 KiB cho nghĩa tên. JSON sai, UTF‑8 sai, khóa lặp, dữ liệu theo sau JSON và trường ngoài hợp đồng đều bị từ chối.

## Phản hồi và hiển thị trên Client

Cả hai mô-đun dùng envelope hiện có gồm `requestId, status, data, error` và trả `Cache-Control: no-store` ở các tuyến Admin.

| HTTP và mã lỗi | Ý nghĩa và xử lý |
| --- | --- |
| `400 INVALID_INPUT` | `error.reason` chứa tên trường lỗi nếu xác định được. Lỗi cấp yêu cầu như JSON hỏng trả `reason: null`. |
| `400 INVALID_SOURCE` | Trả `reason: "sourceSectionId"` nếu trang không tồn tại hoặc thiếu dữ liệu đối chiếu. Admin có thể sửa lựa chọn và gửi lại. |
| `409 VERSION_CONFLICT`, `INVALID_TRANSITION`, `GUIDE_EXISTS`, `GLOSS_DRAFT_EXISTS` | Hiển thị thông báo ở cấp biểu mẫu. Tải lại trạng thái trước khi thử lại. Client giữ nội dung đang nhập. |

Client chỉ dùng tên trường đã biết để chọn thông báo tiếng Việt và liên kết ô nhập qua `aria-invalid` và `aria-describedby`. Các lỗi khác hiển thị ở cấp biểu mẫu. Nội dung và thông báo đều được dựng dưới dạng văn bản.

## Nghiệm thu ngày 08/11/2026

- **60 kiểm tra HTTP đạt** trên Backend loopback và PostgreSQL TEST `huyenco_content06_test_20261108_175415`. Kiểm 33 ca trả đúng tên trường và 13 ca lỗi cấp yêu cầu hoặc xung đột. Dấu vân tay sáu bảng đối chiếu khớp trước và sau mỗi yêu cầu bị từ chối.
- Kiểm các giá trị Unicode đúng giới hạn và vượt giới hạn, trường thiếu, sai kiểu, trang nguồn sai, JSON sai và chuyển trạng thái sai. Nghĩa tên có văn bản Unicode đúng giới hạn được công bố và đọc lại đúng qua API công khai.
- **2.251 kiểm thử Backend đạt**, 30 ca bỏ qua. **1.378 kiểm thử Client và 62 fixture hợp đồng đạt**, cùng kiểm kiểu TypeScript trên mã nguồn. Ba ca Client bổ sung kiểm giới hạn Unicode, liên kết lỗi với trường và giữ nội dung khi xung đột. Các ca giao diện chạy bằng Vitest với phản hồi HTTP mô phỏng theo hợp đồng.
