# Bàn giao bản nháp nghĩa tên quẻ

CONTENT-02 và CMS-DATA-01/03 trong phạm vi `NAME_GLOSS`. Admin chọn quẻ và trang nguồn để lưu đề xuất nghĩa tên. PostgreSQL lưu từng phiên bản riêng với ID Admin, thời điểm và thông tin trang nguồn tại lúc lưu. Đây là mốc V21. Hợp đồng và hướng dẫn kiểm thử gửi duyệt, trả về và công bố trên V22 nằm trong [tài liệu 67](67-TV2-TV3-HEXAGRAM-GLOSS-PUBLICATION.md).

## Hợp đồng API

Gọi cùng Origin qua cookie phiên Admin. POST và PUT cần JSON UTF-8, `X-HuyenCo-Request: 1`, `X-CSRF-Token` của phiên Admin và Origin hợp lệ. Các tuyến cùng tiền tố `/api/v1/admin/hexagrams/{code}/gloss-draft`, dùng envelope `requestId, status, data, error` và `Cache-Control: no-store`.

| Yêu cầu | Đầu vào và kết quả |
| --- | --- |
| `GET .../gloss-draft` | `200`, phiên bản mới nhất. `404 NOT_FOUND` khi chưa có bản nháp. |
| `POST .../gloss-draft` | `{content, sourceSectionId}`. `201`, bản nháp phiên bản 1. |
| `PUT .../gloss-draft` | `{expectedVersion, content, sourceSectionId}`. `200`, phiên bản vừa lưu. |
| `GET .../gloss-draft/revisions/{version}` | `200`, nội dung và nguồn của phiên bản đã lưu. |

Ví dụ body tạo bản nháp. Giá trị `sourceSectionId` dưới đây là ví dụ. Lấy ID thực từ `nameGloss.source.sectionId` hoặc `nameSource.sectionId` của API danh mục trong tài liệu 65.

```json
{
  "content": "Đề xuất nghĩa tên để đối chiếu",
  "sourceSectionId": "42"
}
```

`content` là văn bản thuần một dòng, 1–500 ký tự Unicode sau khi bỏ khoảng trắng hai đầu. `sourceSectionId` là chuỗi số nguyên dương. Server kiểm trang nguồn tồn tại, có thông tin ấn bản, nhãn trang in, trang PDF và SHA-256. Liên kết trang nguồn ghi nhận căn cứ biên tập để người duyệt đối chiếu ở bước sau.

Phản hồi thành công trả `data: {hexagramCode, category, status, version, content, sourceSectionId, source, createdBy, createdAt}`. `category` là `NAME_GLOSS`, `status` của mọi phiên bản ở bước này là `DRAFT`. `source` gồm `bookId, title, edition, section, printedPage, pdfPage, sha256`. `createdAt` theo ISO 8601 UTC.

| HTTP | Mã lỗi |
| --- | --- |
| 400 | `INVALID_INPUT` khi request sai. `INVALID_SOURCE` khi trang nguồn không đủ dữ liệu truy vết. |
| 401 | `INVALID_SESSION` |
| 403 | `CSRF_REJECTED` khi Origin hoặc CSRF không hợp lệ. |
| 404 | `NOT_FOUND` khi thiếu quẻ hoặc phiên bản bản nháp. |
| 409 | `GLOSS_DRAFT_EXISTS` khi tạo trùng. `VERSION_CONFLICT` khi sửa từ phiên bản cũ. |
| 503 | `DATABASE_UNAVAILABLE` hoặc `KNOWLEDGE_DATA_INCOMPLETE`. |
| 500 | `INTERNAL_ERROR`. |

Với 409, Client giữ nội dung đang nhập và cho Admin chọn tải phiên bản mới. Khi lưu, gửi `expectedVersion` bằng `version` vừa đọc của bản nháp. Các phiên bản cũ có thể đọc theo số phiên bản từ 1 đến phiên bản mới nhất.

Quy tắc trả tên trường lỗi trong `error.reason` được bổ sung tại [CONTENT-06](71-TV2-TV3-CONTENT06-CMS-VALIDATION.md).

## PostgreSQL và môi trường TEST

V21 tạo bảng `cms_hexagram_gloss_draft_revisions`. Khoá chính gồm mã quẻ và phiên bản. Mỗi phiên bản có khóa ngoại đến quẻ, trang nguồn và tài khoản Admin. Trigger bảo vệ phiên bản cũ khỏi UPDATE và DELETE. Giao dịch lưu khóa hàng quẻ trước khi xác định phiên bản kế tiếp. API công khai tiếp tục đọc bảng `interpretations`.

Backend TEST tại `http://127.0.0.1:18123`, database `huyenco_gloss_draft_test_20261108`. Migrate/validate đến V21 rồi chạy profile `db` với Auth bật. Cấu hình quyền Admin và Origin theo tài liệu 63. Gửi duyệt và công bố sẽ dùng hợp đồng riêng ở bước tiếp theo.

### Kết quả ngày 08/11/2026

- Flyway migrate và validate V21 thành công. Database giữ đủ 64 nghĩa tên `VERIFIED`.
- 13 kiểm thử Java và 48 yêu cầu HTTP trên PostgreSQL TEST đạt. Kiểm phân quyền, Origin, CSRF, nội dung, nguồn, phiên bản và đọc lại.
- Hai yêu cầu tạo đồng thời trả `201/409`. Hai yêu cầu sửa từ cùng phiên bản trả `200/409`. PostgreSQL lưu đúng bốn phiên bản của hai quẻ trong lượt kiểm.
- Đọc lại bản cũ khớp nội dung, người tạo và trang nguồn đã lưu. Sửa tạm nhãn trang nguồn trên TEST xác nhận bản cũ giữ nhãn ban đầu. UPDATE và DELETE trực tiếp phiên bản cũ bị trigger từ chối.
- Phản hồi E02 của quẻ Tỉnh và dấu vân tay năm bảng tri thức khớp trước và sau kiểm thử. Các phiên bản nháp giữ trong database TEST để đối chiếu.
