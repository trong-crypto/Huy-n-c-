# Hợp đồng quản trị bài hướng dẫn phương pháp

Phiên bản 1.0 · Phạm vi đầu tiên của Phase 3 · Schema, API và giao diện bài hướng dẫn đã nghiệm thu trên localhost.

Mỗi phương pháp hiện có có thể có một bài hướng dẫn biên tập. Admin soạn bài, gửi duyệt, công bố và quản lý hiển thị. Website đọc bài đã công bố. Danh mục phương pháp, thuật toán lập quẻ, dữ liệu giải nghĩa, dữ liệu nguồn đã duyệt và lịch sử tài khoản tiếp tục dùng các mô hình riêng.

## Phạm vi và đối chiếu giao diện TV1

- Mã phương pháp hợp lệ gồm `TIME`, `OBJECT_COUNT`, `LINES` thuộc nhóm `MAI_HOA` và `TAM_THE` thuộc nhóm `TAM_THE`. Backend giữ danh sách mã cố định như danh mục Client hiện có. `methodCode` chỉ định vị trí bài hướng dẫn và được đặt một lần khi tạo.
- Biểu mẫu dùng `title` và `body` theo giới hạn hiện có là 120 và 6.000 ký tự. Thêm `editorNote` tùy chọn, tối đa 500 ký tự để ghi chú biên tập hoặc tài liệu tham khảo nội bộ. Ghi chú không xuất hiện ở API công khai và không có tác dụng xác minh nguồn.
- Trường “Hiển thị đề xuất” của bản xem trước chuyển thành thao tác **Hiện bài hướng dẫn** hoặc **Ẩn bài hướng dẫn** sau khi có bản công bố. Website vẫn hiển thị phương pháp và mô tả danh mục có sẵn. Bài hướng dẫn là phần nội dung bổ sung, và khi ẩn thì khối hướng dẫn biến mất.
- Form “Soạn mô tả mới” cần chọn một mã phương pháp chưa có bài. Nếu đã có bài, mở bài hiện tại để sửa hoặc tạo bản nháp tiếp theo. Bản đầu này áp dụng cho module **Phương pháp**. Các module giải nghĩa, dữ liệu nguồn và nội dung website có thể dùng thiết kế này làm tham chiếu khi được mở phạm vi riêng.

## Quy trình và quyền

| Thao tác | Điều kiện | Kết quả |
| --- | --- | --- |
| Tạo bài | Mã hợp lệ và chưa có bài | Tạo bản nội dung số 1, trạng thái `DRAFT`. Bài chưa hiển thị. |
| Lưu bản nháp | Đang `DRAFT`, hoặc bài đã công bố và không có bản đang biên tập | Tạo phiên bản nội dung mới. Bản đã công bố tiếp tục phục vụ website. |
| Gửi duyệt | Có bản `DRAFT` | Chuyển sang `PENDING_REVIEW`. Đóng chỉnh sửa trong thời gian chờ duyệt. |
| Trả về bản nháp | Đang `PENDING_REVIEW` | Quay lại `DRAFT` với nguyên nội dung. Lưu lý do để đối chiếu trong nhật ký. |
| Duyệt và công bố | Đang `PENDING_REVIEW` | Chuyển bản chờ duyệt thành bản công bố trong một giao dịch. Lần công bố đầu đặt `visible=true`. Các lần sau giữ trạng thái hiện/ẩn đã chọn. |
| Hiện hoặc ẩn | Có bản công bố và trạng thái hiển thị được yêu cầu khác trạng thái hiện tại | Cập nhật hiển thị của bản đã công bố. Giữ nguyên phiên bản nội dung và bản đang biên tập. |

Một Admin có thể soạn, gửi duyệt và công bố trong MVP. Nhật ký ghi từng thao tác và người thực hiện. Trạng thái đang biên tập và bản công bố được trả riêng, nên giao diện có thể hiển thị đồng thời “Chờ duyệt” và “Đang hiện”. Mỗi bài có tối đa một bản đang biên tập. Bản đã công bố là ảnh chụp bất biến.

Tất cả tuyến quản trị yêu cầu phiên `ADMIN` qua cookie Admin của Auth v1.0. Với request có `Origin`, Backend kiểm danh sách Origin được cho phép. Mọi thao tác ghi yêu cầu Origin hợp lệ, JSON UTF-8, `X-HuyenCo-Request: 1` và `X-CSRF-Token` của phiên Admin. `401 INVALID_SESSION` áp dụng khi thiếu hoặc hết phiên Admin, kể cả khi có cookie khách hàng. `403` dùng cho quyền thao tác hoặc kiểm tra Origin/CSRF thất bại. Client gọi cùng origin qua Next.js, dùng `credentials: "same-origin"`, và hiển thị quyền dựa trên kết quả xác thực của Server.

## API

Tiền tố quản trị là `/api/v1/admin/method-guides`. Tất cả phản hồi quản trị dùng `Cache-Control: no-store`. Tiền tố công khai là `/api/v1/method-guides`.

| Phương thức và đường dẫn | Request | Phản hồi thành công |
| --- | --- | --- |
| `GET /api/v1/admin/method-guides` | Query tùy chọn `q`, `group`, `status`, `page`, `size` | `200`, trang `items, page, size, totalElements, totalPages`. |
| `GET /api/v1/admin/method-guides/{methodCode}` | Mã phương pháp | `200`, chi tiết quản trị. |
| `GET /api/v1/admin/method-guides/{methodCode}/events` | `page`, `size` tùy chọn | `200`, trang nhật ký của bài, mới nhất trước. |
| `POST /api/v1/admin/method-guides` | `{methodCode, title, body, editorNote?}` | `201`, chi tiết sau khi tạo bản nháp đầu tiên. |
| `PUT /api/v1/admin/method-guides/{methodCode}/draft` | `{expectedVersion, title, body, editorNote?}` | `200`, chi tiết sau khi lưu bản nháp mới. |
| `POST /api/v1/admin/method-guides/{methodCode}/submit-review` | `{expectedVersion}` | `200`, chi tiết đang chờ duyệt. |
| `POST /api/v1/admin/method-guides/{methodCode}/return-to-draft` | `{expectedVersion, reason}` | `200`, chi tiết bản nháp được trả về. |
| `POST /api/v1/admin/method-guides/{methodCode}/publish` | `{expectedVersion}` | `200`, chi tiết sau khi duyệt và công bố. |
| `PUT /api/v1/admin/method-guides/{methodCode}/visibility` | `{expectedVersion, visible}` | `200`, chi tiết sau khi đổi hiển thị. |
| `GET /api/v1/method-guides` | Không có query | `200`, `{items: PublicGuide[]}` chỉ gồm bài đã công bố và đang hiện. |

- `page` bắt đầu từ 0, mặc định 0. `size` từ 1 đến 50, mặc định 20. `q` tối đa 100 ký tự, tìm chuỗi con không phân biệt hoa/thường trên mã hoặc tiêu đề đang biên tập và đã công bố. `group` dùng `MAI_HOA` hoặc `TAM_THE`. `status` lọc theo `DRAFT`, `PENDING_REVIEW` hoặc `PUBLISHED`. Nếu có bản đang biên tập, trạng thái của bản đó là trạng thái dùng để lọc. Danh sách sắp `updatedAt DESC, methodCode ASC`. Nhật ký sắp `version DESC`.
- `title`, `body`, `editorNote` và `reason` là văn bản thuần. Bỏ khoảng trắng đầu/cuối. Tiêu đề và nội dung sau chuẩn hóa phải khác rỗng. Lý do trả về dài 1–500 ký tự. Khi lưu bản nháp, bỏ qua `editorNote` hoặc gửi chuỗi rỗng có nghĩa là xóa ghi chú. Có thể giữ xuống dòng và tab trong nội dung hoặc ghi chú nhiều dòng. Từ chối ký tự điều khiển khác và chuỗi Unicode không hợp lệ. Server và Client đếm độ dài theo đơn vị UTF-16 để khớp biểu mẫu hiện có. JSON tối đa 32 KiB. Từ chối khóa trùng, trường ngoài hợp đồng, query không hỗ trợ hoặc sai kiểu.
- `expectedVersion` là số nguyên dương trong phạm vi `INTEGER` của PostgreSQL và bằng `version` của phản hồi quản trị mà Admin đang xem. Mọi ghi sau khi tạo phải so phiên bản trước khi sửa trạng thái. Với xung đột, TV1 giữ dữ liệu đang nhập, thông báo và tải bản mới khi người dùng chọn. Các yêu cầu ghi không được tự gửi lại.

### Dữ liệu phản hồi

Dùng envelope chung `{requestId, status, data, error}`, `status` là `COMPLETED` hoặc `FAILED`. Khi thất bại, `data=null` và `error` có `code` cùng `message`. Với `INVALID_INPUT` do một trường cụ thể, `error.reason` chứa tên trường đầu tiên không hợp lệ. Mốc thời gian trả dạng UTC ISO 8601.

- `GuideSummary` dùng trong danh sách quản trị và gồm `methodCode, group, title, status, visible, version, updatedAt`. `title` lấy bản đang biên tập trước, sau đó mới tới bản công bố.
- `GuideDetail` gồm các trường `GuideSummary` và `working, published`. `working` là `{revision, title, body, editorNote}` hoặc `null`. `published` là `{revision, title, body, editorNote, publishedAt}` hoặc `null`. `editorNote` trả chuỗi hoặc `null`.
- `GuideEvent` gồm `version, action, revision, actorId, occurredAt, reason`. `reason` có giá trị khi trả về bản nháp và `revision` là bản nội dung liên quan đến thao tác. API nhật ký chỉ trả UUID người thực hiện, thời điểm và nội dung ghi chú cần thiết.
- `PublicGuide` chỉ gồm `methodCode, title, body, revision, publishedAt`, theo thứ tự mã. Website render `title` và `body` như văn bản. Lượt đầu dùng `no-store` cho danh sách công khai để trạng thái công bố/ẩn có hiệu lực ở lần tải tiếp theo. Nếu chưa có bài hoặc bài ẩn, API trả danh sách không chứa mã đó.

Ví dụ Admin lưu bản nháp với `PUT /api/v1/admin/method-guides/OBJECT_COUNT/draft`.

```json
{
  "expectedVersion": 3,
  "title": "Cách lập quẻ theo số vật",
  "body": "Đếm số vật và chọn giờ Chi trước khi gửi yêu cầu.",
  "editorNote": "Rà lại nhãn giờ Chi trên biểu mẫu."
}
```

| HTTP | Mã | Điều kiện |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Request sai cấu trúc, mã phương pháp ngoài danh mục hoặc giá trị vượt giới hạn. |
| 401 | `INVALID_SESSION` | Thiếu phiên Admin hợp lệ. |
| 403 | `CSRF_REJECTED`, `FORBIDDEN` | Kiểm tra Origin/CSRF hoặc quyền thao tác thất bại. |
| 404 | `NOT_FOUND` | Mã hợp lệ nhưng chưa có bài ở tuyến quản trị đang gọi. |
| 409 | `GUIDE_EXISTS` | Tạo bài cho phương pháp đã có bài. |
| 409 | `VERSION_CONFLICT` | `expectedVersion` cũ. |
| 409 | `INVALID_TRANSITION` | Trạng thái hiện tại không cho phép thao tác. |

Quy tắc văn bản Unicode và lỗi theo trường dùng chung với nghĩa tên quẻ tại [CONTENT-06](71-TV2-TV3-CONTENT06-CMS-VALIDATION.md).
| 503 / 500 | `DATABASE_UNAVAILABLE` / `INTERNAL_ERROR` | Kho dữ liệu không khả dụng hoặc lỗi xử lý. |

## Schema PostgreSQL

[Migration V15](../server/src/main/resources/db/migration/V15__method_guide_cms.sql) tạo ba bảng bên dưới và đã được áp dụng trên `huyenco_test_tv1_20261107`. Xem [biên bản TEST](55-TV2-TV3-TEST-ENVIRONMENT-20261107.md#migration-quản-trị-nội-dung-v15).

| Bảng | Cột và ràng buộc |
| --- | --- |
| `cms_method_guides` | `method_code VARCHAR(16) PK` với CHECK theo bốn mã, `version INTEGER NOT NULL CHECK(version > 0)`, `working_revision INTEGER NULL`, `working_status VARCHAR(16) NULL` thuộc `DRAFT/PENDING_REVIEW`, `published_revision INTEGER NULL`, `published_at TIMESTAMPTZ NULL`, `visible BOOLEAN NOT NULL DEFAULT FALSE`, `created_at, updated_at TIMESTAMPTZ NOT NULL`. Hai cột working có mặt cùng nhau. Hai cột published có mặt cùng nhau. `visible=true` yêu cầu có bản công bố. Có ít nhất một con trỏ working hoặc published. |
| `cms_method_guide_revisions` | PK `(method_code, revision)`, `revision INTEGER CHECK(revision > 0)`, FK `method_code` về bài, `title VARCHAR(120) NOT NULL`, `body TEXT NOT NULL` dài tối đa 6.000 ký tự, `editor_note VARCHAR(500) NULL`, `created_by UUID NOT NULL REFERENCES accounts(id)`, `created_at TIMESTAMPTZ NOT NULL`. Nội dung của một dòng bất biến từ lúc chèn. |
| `cms_method_guide_events` | PK `(method_code, version)`, FK `method_code` về bài, FK `(method_code, revision)` về bản nội dung, `action VARCHAR(24) NOT NULL` thuộc `CREATE/SAVE_DRAFT/SUBMIT_REVIEW/RETURN_TO_DRAFT/PUBLISH/SHOW/HIDE`, `actor_id UUID NOT NULL REFERENCES accounts(id)`, `occurred_at TIMESTAMPTZ NOT NULL`, `reason VARCHAR(500) NULL`, bắt buộc có nội dung khi `RETURN_TO_DRAFT` và rỗng DB ở thao tác khác. Nhật ký chỉ thêm dòng. |

- Hai con trỏ phiên bản trong bảng bài có FK ghép `(method_code, revision)` để ngăn trỏ sang bài khác. Hai con trỏ phải khác nhau nếu cùng có giá trị. FK của con trỏ dùng `DEFERRABLE INITIALLY DEFERRED` để chèn bài cùng phiên bản đầu tiên trong một giao dịch. Khóa ngoại đến tài khoản giữ ID tác giả và người thao tác. PostgreSQL từ chối cập nhật hoặc xóa trực tiếp các dòng phiên bản và nhật ký.
- Tạo bài với `version=1, working_revision=1, working_status='DRAFT'`. Mọi thao tác ghi thành công tăng `version` và ghi đúng một sự kiện. Lưu nháp tạo `revision` mới theo số lớn nhất của bài cộng một. Gửi duyệt, trả về nháp, công bố và hiện/ẩn giữ nguyên nội dung phiên bản. Công bố chuyển con trỏ working sang published và xóa cả hai trường working.
- Mỗi thao tác giữ khóa trên bài trong giao dịch, so `expectedVersion`, kiểm điều kiện chuyển trạng thái, rồi ghi nội dung, con trỏ và nhật ký cùng nhau. Khóa duy nhất trên mã xử lý hai yêu cầu tạo đồng thời. Public GET nối bằng FK published và chỉ chọn `visible=true`.
- Migration tạo bảng rỗng, giữ dữ liệu hiện có làm đường cơ sở. TV3 sao lưu TEST V14, chạy Flyway trên TEST rồi đối chiếu dữ liệu nghiệp vụ và lịch sử trước/sau. Nội dung thử dùng fixture riêng.

## Thứ tự triển khai và nghiệm thu

1. **TV3** đã tạo migration V15, kiểm khóa ngoại trên TEST và rollback dữ liệu kiểm schema. **TV2** triển khai kiểm phiên Admin và quyền tại một điểm dùng chung cho các tuyến quản trị, rồi triển khai CRUD và công bố theo hợp đồng. Tạo fixture API khi bắt đầu kiểm các endpoint.
2. **TV2–TV3** kiểm tạo, sửa, gửi duyệt, trả về, công bố, ẩn/hiện và nhật ký. Dùng hai request có cùng phiên bản để xác nhận chỉ một thao tác ghi thành công. Kiểm thiếu phiên, cookie khách hàng, sai CSRF và từ chối công bố trực tiếp từ bản nháp.
3. **TV1** dùng `methodCode` để ghép danh mục và form, hiển thị riêng trạng thái biên tập và bản công bố. Mở website khi có bản sửa chờ duyệt để xác nhận nội dung công khai vẫn là bản đã công bố trước đó. Kiểm lại luồng lập quẻ và lịch sử tài khoản theo lịch nghiệm thu chung.

## Bàn giao Backend trên TEST

Ngày 07/11/2026, API chạy ở `http://127.0.0.1:18106` với profile `db`, `AUTH_ENABLED=true` và database riêng `huyenco_cms_api_test_20261107` ở Flyway V15. Database này sao chép schema và dữ liệu tri thức từ TEST chung. Các bảng tài khoản, lịch sử và CMS ban đầu rỗng. Lượt kiểm để lại bài mẫu và nhật ký trong database CMS riêng để đối chiếu.

- **51 yêu cầu HTTP đạt**, gồm đăng nhập Admin, từ chối khách và tài khoản thường, kiểm Origin và CSRF, bản nháp, trả duyệt, công bố, hiện/ẩn, phân trang và nhật ký. Hai Admin lưu cùng `expectedVersion` nhận một `200` và một `409 VERSION_CONFLICT`. Kết thúc lượt kiểm có hai bản nội dung và mười sự kiện của bài mẫu.
- API công khai giữ nguyên bản đã công bố khi bản mới chờ duyệt. Sau khi ẩn bài, API công khai bỏ bài khỏi danh sách. Công bố phiên bản mới vẫn giữ trạng thái ẩn cho đến khi Admin bật lại.
- **8 ca Java hồi quy** cho phiên lịch sử và WebSocket đạt.

## Bàn giao giao diện trên TEST

Next.js đã chuyển tiếp các tuyến Auth và CMS cùng origin. Khi build và chạy Client, đặt `NEXT_PUBLIC_METHOD_GUIDES=1`, `HUYENCO_API_URL` trỏ Backend TEST và `NEXT_PUBLIC_API_BASE_URL=/api/v1`. Lượt thử bật cả `NEXT_PUBLIC_ACCOUNT_HISTORY=1`. Địa chỉ giao diện là `http://127.0.0.1:18107`, Backend dùng `127.0.0.1:18108` với Origin của Client được phép và database `huyenco_cms_api_test_20261107`.

- Vào `/admin/login` bằng tài khoản Admin của database TEST đó. Khi chạy trên máy này, nếu cần tự tạo tài khoản để kiểm, đăng ký tên riêng `cms-admin-test` tại `/dang-ky`. Trong pgAdmin, kết nối database CMS TEST rồi chạy câu lệnh bên dưới. Nó chỉ cấp role cho tài khoản USER có đúng định danh trên database CMS TEST. Sau đó dùng chính mật khẩu vừa đặt để đăng nhập tại `/admin/login`.
- `/admin/methods` đã có giao diện cho nháp, duyệt, công bố, hiện/ẩn và nhật ký. Khi gặp `VERSION_CONFLICT`, Admin có thể tải phiên bản mới và tiếp tục với nội dung đang nhập. Trang `/phuong-phap` hiển thị bài đã công bố theo từng phương pháp.
- Build Next.js và **50 ca Client liên quan** đạt. Chrome đã kiểm mở trang khi thiếu phiên, đăng nhập, tạo nháp, trả duyệt, công bố, xung đột giữ bản nhập, ẩn/hiện, nhật ký và đăng xuất. Bài mẫu trình duyệt nằm trong database CMS TEST riêng. Kiểm qua thiết bị thứ hai và các module Admin ngoài bài hướng dẫn vẫn thuộc các mốc riêng.

```sql
UPDATE accounts
SET role = 'ADMIN'
WHERE current_database() = 'huyenco_cms_api_test_20261107'
  AND identifier_normalized = 'cms-admin-test'
  AND role = 'USER'
RETURNING identifier_normalized, role;
```

[Bàn giao Phase 3 của TV1](TV1-TO-TV2-TV3-HANDOFF.md#phase-3) · [Hợp đồng Auth Admin](56-TV2-TV3-ACCOUNT-AUTH-CONTRACT.md)
