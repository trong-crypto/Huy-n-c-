# CONTENT-04 và CMS-DATA-04 · Duyệt đề xuất chỉnh sửa nguồn

V25 bổ sung nhật ký duyệt cho đề xuất sửa trang sách và nguồn thuật toán. Mỗi sự kiện liên kết tới đúng phiên bản bất biến của V24, lưu Admin thao tác, thời điểm UTC và ghi chú. Các đề xuất hiện có từ V24 bắt đầu ở trạng thái `DRAFT`.

| Trạng thái | Thao tác | Kết quả |
| --- | --- | --- |
| `DRAFT` | Gửi duyệt phiên bản đã lưu | `PENDING_REVIEW`, khóa sửa. |
| `PENDING_REVIEW` | Trả về, kèm lý do | `DRAFT`, có thể sửa hoặc gửi lại. |
| `PENDING_REVIEW` | Admin khác người soạn phê duyệt, kèm ghi chú đối chiếu | `APPROVED` cho đúng phiên bản. |
| `APPROVED` | Lưu nội dung mới | Tạo phiên bản `DRAFT` mới, giữ mốc đã phê duyệt gần nhất. |

Phê duyệt ghi nhận quyết định trong CMS. Khi duyệt, màn hình mở phiên bản đã lưu và metadata nguồn tại thời điểm lưu để đối chiếu. Quy trình [áp dụng sửa metadata sách V26](75-TV2-TV3-SOURCE-PROPOSAL-APPLICATION.md) bắt đầu sau khi phê duyệt.

## Hợp đồng API

Tiền tố `/api/v1/admin/sources/{kind}/{id}/proposal/workflow`. GET cần phiên Admin. POST cần thêm Origin hợp lệ, JSON UTF‑8, `X-HuyenCo-Request: 1` và `X-CSRF-Token`. Phản hồi dùng envelope Admin và `Cache-Control: no-store`.

| Tuyến | JSON |
| --- | --- |
| GET tiền tố | Đọc trạng thái hiện tại. |
| POST `.../submit-review` | `{"expectedVersion":1}` |
| POST `.../return-to-draft` | `{"expectedVersion":2,"note":"Đối chiếu lại trang in"}` |
| POST `.../approve` | `{"expectedVersion":2,"note":"Đã đối chiếu đúng nguồn và phiên bản"}` |

- Thành công trả `200` với `{version,draftVersion,status,approvedVersion,lastEvent}`. `approvedVersion` và `lastEvent` có thể là `null`. `lastEvent` gồm `sequence,revision,action,actorId,occurredAt,note`.
- Chuyển trạng thái lấy `expectedVersion` từ `version` của workflow. Sửa nội dung dùng `draftVersion` như [hợp đồng V24](73-TV2-TV3-SOURCE-EDIT-PROPOSAL-DRAFTS.md). Client đọc đúng phiên bản qua tuyến `/revisions/{version}` sau khi lấy trạng thái duyệt.
- Ghi chú duyệt hoặc lý do trả về bắt buộc, từ 1 đến 500 ký tự Unicode. Thiếu hoặc sai định dạng trả `400 INVALID_INPUT` với `error.reason: "note"`. Chưa có đề xuất trả `404 NOT_FOUND`. Tự phê duyệt trả `403 FORBIDDEN`.
- Phiên bản workflow cũ trả `409 VERSION_CONFLICT`. Chuyển sai trạng thái hoặc sửa bản đang chờ duyệt trả `409 INVALID_TRANSITION`. Màn hình cho tải lại trạng thái và giữ phần nội dung đang nhập.

Áp dụng và validate Flyway V25 trên PostgreSQL TEST trước khi mở chức năng qua `NEXT_PUBLIC_ADMIN_SOURCE_CATALOG=1`. V25 bổ sung ràng buộc duy nhất để nhật ký có khóa ngoại tới phiên bản đề xuất. Trigger bảo vệ các sự kiện đã ghi khỏi sửa và xóa.

## Nghiệm thu ngày 08/11/2026

- Sao lưu, migrate và validate V25 trên bản sao PostgreSQL TEST `huyenco_source_review_test_20261108_185637`. Dấu vân tay 31 bảng cũ khớp trước và sau migration, gồm 6 phiên bản đề xuất có sẵn từ V24.
- **39 kiểm tra HTTP đạt.** Kiểm Admin, Origin và CSRF, khóa sửa khi chờ duyệt, tự duyệt bị từ chối, trả về kèm lý do và phê duyệt với ghi chú cho cả hai loại nguồn. Hai yêu cầu phê duyệt đồng thời trả `200/409`, chỉ ghi một quyết định. Bản nháp mới vẫn trỏ được đến phiên bản đã duyệt trước đó.
- Trigger từ chối UPDATE và DELETE trực tiếp trên nhật ký. Năm bảng tri thức khớp dấu vân tay trước và sau ca API.
- **Chromium đạt với hai phiên Admin** qua Next.js, Backend và PostgreSQL thật. Người soạn không có nút phê duyệt, bản đang chờ duyệt bị khóa sửa, Admin thứ hai trả về và phê duyệt được. Tải lại trang đọc được quyết định và ghi chú đúng phiên bản.
- **2.251 kiểm thử Backend đạt**, 30 ca bỏ qua. **1.379 kiểm thử Client**, 62 fixture hợp đồng và kiểm kiểu TypeScript trên mã nguồn đạt.
