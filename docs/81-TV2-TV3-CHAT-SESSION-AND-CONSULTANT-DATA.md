# CHAT-04 và CHAT-DATA-01 · Phiên Chat và hồ sơ tư vấn viên

## Quyền truy cập v1

| Bên truy cập | Quyền dự kiến trong luồng tư vấn |
| --- | --- |
| `USER` có phiên tài khoản hợp lệ | Xem danh bạ và tạo yêu cầu tư vấn. Quyền xem và gửi tin trong phòng sẽ được kiểm theo quan hệ tham gia. |
| `CONSULTANT` có phiên hợp lệ, tài khoản `ACTIVE` và hồ sơ `APPROVED` | Dùng màn hình tư vấn viên. Quyền xử lý yêu cầu và phòng sẽ được giới hạn vào phần đã phân cho tài khoản. |
| Khách, phiên H01 ẩn danh, hoặc chỉ có phiên `ADMIN` | Chưa có phiên Chat tài khoản hợp lệ. Admin tiếp tục quản lý hồ sơ qua các tuyến Admin. |

Server xác định tài khoản và vai trò hiện hành từ cookie `huyenco_account_session` thuộc realm `CUSTOMER` và PostgreSQL. Header, query hoặc payload do Client gửi không cấp vai trò. Cookie H01 và cookie Admin vẫn thuộc các luồng hiện có. Việc đăng xuất, khóa, hết hạn hoặc thu hồi phiên có hiệu lực từ lần kiểm tiếp theo. Hồ sơ tư vấn viên được kiểm lại ngay cả khi phiên tài khoản vẫn còn hạn.

## C10 · Kiểm tra phiên REST

`GET /api/v1/auth/chat/session`, không nhận query. Dùng cùng Origin của Client qua proxy `/api/v1/auth/:path*` khi bật `NEXT_PUBLIC_ACCOUNT_HISTORY=1`. Server chỉ kiểm Origin khi header đó có mặt. Mọi phản hồi dùng envelope REST và `Cache-Control: no-store`. Thành công trả `200` với đúng ba trường trong `data`:

```json
{
  "accountId": "550e8400-e29b-41d4-a716-446655440001",
  "role": "USER",
  "expiresAt": "2026-11-09T09:00:00Z"
}
```

| HTTP | Mã | Điều kiện |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Có query ngoài hợp đồng. |
| 401 | `INVALID_SESSION` | Thiếu cookie tài khoản, cookie lỗi hoặc lặp, phiên hết hạn/thu hồi, hoặc tài khoản không hoạt động. Cookie Admin và H01 riêng lẻ cũng dẫn đến lỗi này. |
| 403 | `CSRF_REJECTED` | Origin được gửi nhưng ngoài danh sách hoặc không hợp lệ. |
| 403 | `FORBIDDEN` | Phiên CONSULTANT hợp lệ nhưng hồ sơ chưa đủ điều kiện. |
| 503 | `DATABASE_UNAVAILABLE` | Kho tài khoản hoặc hồ sơ không truy cập được. |

GET là thao tác chỉ đọc. Các tuyến ghi về sau cần dùng Origin cho phép, `X-HuyenCo-Request: 1` và `X-CSRF-Token` của phiên CUSTOMER, lấy qua `/api/v1/auth/session`. C10 không cấp token hay tạo phiên mới.

### Quyền STOMP

Xem [CHAT-05](#chat-05) để biết endpoint, xác thực CONNECT và quy tắc kiểm quyền theo phòng.

## Dữ liệu dùng cho CHAT-01

Dùng quan hệ hiện có `consultant_profiles.account_id → accounts.id`, mỗi tài khoản có tối đa một hồ sơ. Tiêu chí duy nhất để hiện trong danh bạ là tài khoản có `role=CONSULTANT`, `status=ACTIVE` và hồ sơ `review_status=APPROVED`. Duyệt hồ sơ và cấp vai trò là hai thao tác riêng.

| Trường công bố | Nguồn | Ghi chú |
| --- | --- | --- |
| `consultantId` | `consultant_profiles.account_id` | UUID định danh hồ sơ qua quan hệ một-một. |
| `displayName` | `accounts.display_name` | Tên dùng để hiển thị. |
| `summary` | `consultant_profiles.summary` | Giới thiệu thuộc hồ sơ đã duyệt. Hồ sơ cũ có thể trả `null`. Client hiển thị dạng văn bản. |

Định danh đăng nhập, mật khẩu băm, token phiên, lý do từ chối, người và thời điểm duyệt thuộc dữ liệu nội bộ. Cột `availability` sẽ cần nguồn trạng thái riêng nếu nhóm bổ sung sau. Trạng thái `ACTIVE` hiện chỉ cho biết tài khoản được phép hoạt động.

`ChatConsultantProfiles` dùng chung tiêu chí cho danh sách, chi tiết và xác thực tư vấn viên ở C10. Các tuyến này dùng schema V18/V19 đang có trong V28.

<a id="chat-01"></a>
## CHAT-01 · Danh bạ và chi tiết (C1/C2)

Cả hai tuyến yêu cầu phiên CUSTOMER còn hiệu lực với vai trò `USER`. Tài khoản CONSULTANT dùng C10 cho luồng làm việc của tư vấn viên. Với Client, bật `NEXT_PUBLIC_ACCOUNT_HISTORY=1` để gọi qua proxy cùng Origin. GET không yêu cầu token CSRF, nhưng Origin nếu được gửi phải thuộc danh sách cho phép. Tất cả phản hồi dùng envelope REST và `Cache-Control: no-store`.

| ID | Tuyến | Đầu vào | `data` khi HTTP 200 |
| --- | --- | --- | --- |
| C1 | `GET /api/v1/chat/consultants` | `page` đánh số từ 0, mặc định 0. `size` từ 1 đến 50, mặc định 20. Mỗi tham số xuất hiện tối đa một lần. | `items`, `page`, `size`, `totalElements`, `totalPages`. Mỗi phần tử trong `items` có đúng ba trường đã chốt. |
| C2 | `GET /api/v1/chat/consultants/{consultantId}` | UUID dạng chuẩn 8-4-4-4-12, không nhận query. | Một hồ sơ gồm đúng `consultantId`, `displayName` và `summary`. |

C1 sắp xếp theo tên hiển thị của PostgreSQL rồi theo UUID để phân trang ổn định khi trùng tên. Trang vượt phạm vi trả `items: []` và vẫn giữ tổng hồ sơ đủ điều kiện. Khi danh bạ trống, `totalElements` và `totalPages` đều bằng 0. `summary` có thể là `null`. C1/C2 chưa công bố trạng thái online hoặc khả năng nhận tư vấn tức thời.

Ví dụ trường `data` của C1 với `?page=0&size=1`. Phần tử trong `items` cũng là cấu trúc `data` của C2.

```json
{
  "items": [{
    "consultantId": "550e8400-e29b-41d4-a716-446655440001",
    "displayName": "Tư vấn viên mẫu",
    "summary": "Giới thiệu đã duyệt."
  }],
  "page": 0,
  "size": 1,
  "totalElements": 1,
  "totalPages": 1
}
```

| HTTP | Mã | Điều kiện |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Query ngoài hợp đồng, giá trị lặp, trang/kích thước không hợp lệ hoặc UUID sai định dạng. |
| 401 | `INVALID_SESSION` | Phiên tài khoản thiếu, không hợp lệ, đã hết hạn hoặc bị thu hồi. |
| 403 | `FORBIDDEN` | Vai trò hiện tại không có quyền xem danh bạ. |
| 403 | `CSRF_REJECTED` | Origin đã gửi không được phép. |
| 404 | `NOT_FOUND` | UUID hợp lệ nhưng hồ sơ vắng mặt hoặc không đủ điều kiện công bố. Dùng cùng mã và thông báo cho cả hai trường hợp. |
| 503 | `DATABASE_UNAVAILABLE` | Kho tài khoản hoặc danh bạ không truy cập được. |

## Bàn giao tiếp

- **Client:** `/tu-van` dùng C1 để hiển thị danh bạ và giới thiệu đã duyệt. `/tu-van` và `/tu-van-vien` dùng C10 và [C3–C5](#chat-02) cho luồng tạo và đọc hội thoại theo vai trò.
- **TV2:** dùng lại kiểm quyền theo phòng khi triển khai CHAT-05.

<a id="chat-data-02"></a>
## CHAT-DATA-02 · Người tham gia và quyền theo phòng

Flyway V29 tạo `chat_conversations`. Mỗi phòng có UUID riêng, một `user_account_id` tham chiếu tài khoản, một `consultant_account_id` tham chiếu hồ sơ tư vấn viên và `created_at`. Khóa ngoại chặn hồ sơ hoặc tài khoản không tồn tại và chặn xóa người tham gia còn được tham chiếu. Ràng buộc cấm một tài khoản giữ cả hai vị trí. Hai chỉ mục theo người tham gia và thời điểm tạo hỗ trợ danh sách C4. Việc đổi vai trò hoặc thay đổi trạng thái tài khoản/hồ sơ giữ nguyên quan hệ lịch sử.

`ChatRoomAccess.requireParticipant(request, conversationId)` xác minh phiên CUSTOMER và quyền ở cùng một snapshot PostgreSQL. `USER` chỉ khớp với vị trí người yêu cầu, `CONSULTANT` chỉ khớp với vị trí tư vấn viên được phân và vẫn phải có hồ sơ đã duyệt. Server trả cùng lỗi `NOT_FOUND` cho phiên hợp lệ ngoài phòng và phòng không tồn tại. Thiếu phiên, phiên bị thu hồi hoặc tài khoản bị khóa trả `INVALID_SESSION`. Tư vấn viên mất điều kiện hồ sơ nhận `FORBIDDEN`. Đây là kiểm quyền từng người tham gia, nên người còn đủ điều kiện vẫn có thể truy cập theo vị trí của mình.

Khi triển khai C3, Server phải lấy người yêu cầu từ phiên `USER` và kiểm tra tư vấn viên đủ điều kiện trong cùng giao dịch tạo phòng. Khóa ngoại chỉ bảo đảm sự tồn tại của tài khoản/hồ sơ. Việc kiểm vai trò và trạng thái hồ sơ ở thời điểm tạo hoặc đọc là trách nhiệm của Server. C4 lọc ngay trong truy vấn theo tài khoản và vị trí đã xác thực. C5 phải kiểm quyền và đọc nội dung phòng trong cùng giao dịch. CHAT-05 sẽ áp dụng kiểm quyền tương ứng vào REST và STOMP.

<a id="chat-data-03"></a>
## CHAT-DATA-03 · Lưu và truy xuất hội thoại

`ChatConversations` dùng bảng `chat_conversations` của V29/V30. `create(request, consultantId)` xác minh phiên CUSTOMER, Origin, `X-HuyenCo-Request: 1` và CSRF. Server lấy UUID người yêu cầu từ phiên `USER`, kiểm tư vấn viên `CONSULTANT + ACTIVE + APPROVED` trong cùng giao dịch và lưu phòng `PENDING`. UUID và thời điểm tạo do Server cấp. Tư vấn viên vắng mặt hoặc không đủ điều kiện đều trả `NOT_FOUND`.

`list(request, page, size)` lọc theo tài khoản và vị trí trong phòng ngay trong PostgreSQL. Trang bắt đầu từ 0, kích thước từ 1 đến 50. Thứ tự là `created_at DESC, id DESC` và số lượng được tính trong cùng snapshot với dữ liệu trang. `detail(request, conversationId)` đọc phòng bằng điều kiện thành viên trong cùng truy vấn. Phòng ngoài quyền và phòng không tồn tại cùng trả `NOT_FOUND`. Người tham gia còn đủ quyền vẫn đọc được phòng `ENDED`.

Kết quả nội bộ gồm UUID phòng, UUID hai người tham gia, thời điểm tạo và trạng thái vòng đời từ V30. Phần đọc dùng chung ánh xạ trạng thái với `ChatConversationLifecycle`.

<a id="chat-02"></a>
## CHAT-02 · Tạo và đọc hội thoại (C3–C5)

Bật `NEXT_PUBLIC_ACCOUNT_HISTORY=1` để dùng proxy cùng Origin. Ba tuyến dùng phiên CUSTOMER và envelope `{requestId, status, data, error}` với `Cache-Control: no-store`. `requestId` của envelope do Server cấp cho từng phản hồi. UUID đầu vào dùng dạng chuẩn 8-4-4-4-12, không phân biệt hoa thường.

| ID | Tuyến | Đầu vào | Thành công |
| --- | --- | --- | --- |
| C3 | `POST /api/v1/chat/conversations` | Chỉ `USER`. Origin cho phép, `X-HuyenCo-Request: 1` và `X-CSRF-Token` từ phiên CUSTOMER. Không nhận query. Body `application/json` UTF-8 tối đa 1.024 byte, đúng hai trường UUID `requestId` và `consultantId`. | `201 Created` khi tạo, kèm `Location` tương đối đến C5. `200 OK` khi gửi lại yêu cầu đã lưu. `data` là hội thoại. |
| C4 | `GET /api/v1/chat/conversations` | `USER` hoặc `CONSULTANT` đủ điều kiện. `page` từ 0 đến 2147483647, mặc định 0. `size` từ 1 đến 50, mặc định 20. Mỗi tham số xuất hiện tối đa một lần. | `200 OK`. `data` gồm `items`, `page`, `size`, `totalElements`, `totalPages`. |
| C5 | `GET /api/v1/chat/conversations/{conversationId}` | `USER` hoặc `CONSULTANT` đủ điều kiện và đúng vị trí trong phòng. Không nhận query. | `200 OK`. `data` là hội thoại. |

Ví dụ body C3:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440010",
  "consultantId": "550e8400-e29b-41d4-a716-446655440001"
}
```

Ví dụ `data` cho hội thoại mới:

```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440002",
  "userId": "550e8400-e29b-41d4-a716-446655440003",
  "consultantId": "550e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2026-11-09T03:00:00Z",
  "status": "PENDING",
  "startedAt": null,
  "endedAt": null,
  "endReason": null,
  "endedByAccountId": null
}
```

Client tạo `requestId` mới cho mỗi yêu cầu tư vấn mới và giữ nguyên UUID đó khi gửi lại. V31 lưu khóa theo `(userId, requestId)`. Gửi lại cùng tư vấn viên trả cùng phòng với trạng thái hiện tại, kể cả khi tư vấn viên đã rời danh bạ. Gửi lại cùng khóa với tư vấn viên khác trả `409 REQUEST_ID_CONFLICT`. Khóa có hiệu lực chừng nào phòng còn được lưu. Phòng đã có từ V30 giữ nguyên và vẫn đọc được. Các tài khoản khác nhau có thể dùng cùng UUID yêu cầu.

C4 trả các phòng mà phiên được phép xem theo `createdAt DESC, conversationId DESC`. Trang vượt phạm vi có `items: []` và giữ số lượng. C5 trả cùng lỗi `404 NOT_FOUND` cho phòng ngoài quyền và phòng vắng mặt. GET kiểm Origin nếu có. Việc nhận, từ chối, hủy và kết thúc sẽ có hợp đồng riêng ở C6/C9.

| HTTP | Mã | Điều kiện |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Query lạ/lặp, phân trang hoặc UUID sai, body thiếu, thừa trường, sai định dạng hoặc vượt giới hạn. |
| 401 | `INVALID_SESSION` | Phiên CUSTOMER thiếu, sai, hết hạn hoặc bị thu hồi. |
| 403 | `FORBIDDEN` | Vai trò không được tạo yêu cầu hoặc tư vấn viên mất điều kiện hồ sơ. |
| 403 | `CSRF_REJECTED` | Origin hoặc header bảo vệ ghi không hợp lệ. |
| 404 | `NOT_FOUND` | Tư vấn viên không đủ điều kiện khi tạo phòng mới, hoặc phòng vắng mặt/ngoài quyền. |
| 409 | `REQUEST_ID_CONFLICT` | UUID yêu cầu đã lưu cho tư vấn viên khác của cùng người dùng. |
| 503 | `DATABASE_UNAVAILABLE` | Không thể truy cập kho dữ liệu. Có thể gửi lại C3 với cùng UUID. |

### Chạy giao diện tư vấn

Bật `NEXT_PUBLIC_ACCOUNT_HISTORY=1` trên Client, trỏ `HUYENCO_API_URL` đến Backend dùng profile `db`, `AUTH_ENABLED=true` và PostgreSQL V31. Đặt `ALLOWED_ORIGINS` theo đúng Origin của Client và dùng cùng hostname khi đăng nhập và mở trang tư vấn.

- Với `USER`, vào `/tu-van`, chọn tư vấn viên và bấm **Gửi yêu cầu tư vấn**. Client lấy CSRF từ phiên CUSTOMER, tải lại danh sách rồi mở phòng vừa lưu. Nếu kết quả tạo phòng chưa xác định, gửi lại trong cùng trang dùng UUID yêu cầu cũ.
- Với `CONSULTANT` có hồ sơ đã duyệt, vào `/tu-van-vien` và mở một hội thoại được phân. **Tải lại phòng** cập nhật trạng thái từ Server. Khi phát hiện phiên hết hạn hoặc mất quyền, trang đóng phòng và ẩn danh sách.
- Các thao tác nhận, từ chối, hủy và kết thúc xuất hiện trong phòng theo vai trò và trạng thái hiện tại. Gửi nhận và đọc lịch sử tin nhắn cần C7/C8.

<a id="chat-06"></a>
## CHAT-06 · Thay đổi trạng thái phòng (C6/C9)

`POST /api/v1/chat/conversations/{conversationId}/transition` dùng cùng proxy, phiên CUSTOMER, Origin, `X-HuyenCo-Request: 1` và `X-CSRF-Token` như C3. Không nhận query. Body JSON UTF-8 tối đa 1.024 byte gồm đúng một trường `action`. C6 dùng `{"action":"ACCEPT"}` hoặc `{"action":"DECLINE"}`. C9 dùng `{"action":"CANCEL"}` hoặc `{"action":"END"}`. Bảng vòng đời bên dưới mô tả vai trò được phép và trạng thái đích.

Thành công trả HTTP 200, `Cache-Control: no-store` và envelope REST. `data` gồm `conversationId`, `status`, `startedAt`, `endedAt`, `endReason`, `endedByAccountId` theo định dạng của C5. Gửi lại cùng thao tác bởi cùng người thực hiện trả trạng thái đã lưu nếu phòng vẫn phản ánh thao tác đó. `409 INVALID_TRANSITION` nghĩa là trạng thái hiện tại không cho phép thao tác. Client tải lại C4/C5 khi gặp xung đột.

Các lỗi chung gồm `400 INVALID_INPUT`, `401 INVALID_SESSION`, `403 CSRF_REJECTED` và `503 DATABASE_UNAVAILABLE`. Người ngoài phòng và phòng vắng mặt cùng trả `404 NOT_FOUND`. Người trong phòng dùng thao tác sai vai trò hoặc tư vấn viên mất điều kiện nhận `403 FORBIDDEN`. Hai bên còn đủ quyền đọc được phòng đã kết thúc qua C4/C5.

<a id="chat-data-05"></a>
## CHAT-DATA-05 · Vòng đời hội thoại

Flyway V30 bổ sung `status`, `started_at`, `ended_at`, `end_reason` và `ended_by_account_id`. Phòng V29 và yêu cầu mới đều bắt đầu ở `PENDING`. Server ghi thời điểm mở, thời điểm kết thúc và tài khoản thực hiện. PostgreSQL ràng buộc các trường này theo từng trạng thái và bảo đảm thứ tự thời gian.

| Thao tác | Người thực hiện | Từ | Đến | `end_reason` |
| --- | --- | --- | --- | --- |
| `ACCEPT` | Tư vấn viên được phân | `PENDING` | `ACTIVE` | |
| `DECLINE` | Tư vấn viên được phân | `PENDING` | `ENDED` | `DECLINED` |
| `CANCEL` | Người gửi yêu cầu | `PENDING` | `ENDED` | `CANCELLED` |
| `END` | Một trong hai người tham gia | `ACTIVE` | `ENDED` | `COMPLETED` |

Khi nối với C7, chỉ phòng `ACTIVE` đủ điều kiện gửi tin. Quyền đọc phòng vẫn theo người tham gia khi `ENDED`. Mất kết nối hoặc đóng trang không đổi trạng thái. Client có thể ánh xạ ba mã trạng thái sang `pending`, `active`, `ended` đang dùng và dùng `end_reason` để hiển thị lý do.

`ChatConversationLifecycle.transition` xác minh cookie CUSTOMER, Origin, `X-HuyenCo-Request: 1` và token CSRF, sau đó khóa hàng của phòng theo đúng vị trí người tham gia. Hai thao tác xung đột được tuần tự hóa.

<a id="chat-data-04"></a>
## CHAT-DATA-04 · Lưu tin nhắn và chống trùng

Flyway V32 thêm bảng `chat_messages` và bộ đếm `last_message_sequence` cho từng phòng. Tin lưu gồm UUID Server, UUID phòng, tài khoản gửi do Server xác định, UUID Client, số thứ tự, nội dung và thời điểm ghi. Số thứ tự bắt đầu từ 1 trong mỗi phòng và dùng làm cursor đọc tăng dần. Server chỉ cấp số mới khi ghi tin mới. Tăng bộ đếm và ghi tin nằm trong cùng giao dịch.

| Trường hợp | Kết quả lớp dữ liệu |
| --- | --- |
| Tin mới từ người được phân trong phòng `ACTIVE` | Ghi tin, trả bản ghi chuẩn với `created=true`. |
| Cùng phòng, cùng người gửi, cùng `clientMessageId`, cùng nội dung | Trả bản ghi cũ với `created=false`, kể cả khi phòng đã kết thúc nếu tin còn trong thời hạn lưu. |
| Cùng phạm vi mã nhưng nội dung khác | `MESSAGE_ID_CONFLICT`. |
| Tin mới trong phòng chờ hoặc đã kết thúc | `ROOM_NOT_ACTIVE`. |
| Người ngoài phòng hoặc phòng vắng mặt | Cùng lỗi `NOT_FOUND`. |

Nội dung là văn bản có tối đa 2.000 đơn vị UTF-16 theo giới hạn Client, phải chứa ký tự khác khoảng trắng và là Unicode hợp lệ. Backend giữ nguyên nội dung nhận được để so sánh yêu cầu lặp. C7 cần tái xác thực phiên và vai trò cho mỗi lần SEND trước khi gọi `ChatMessages.append`. Lớp lưu lấy người gửi từ danh tính Server đã xác thực và kiểm quyền theo phòng. Việc lưu tin và kết thúc phòng khóa cùng một hàng để thứ tự thực thi quyết định tin có được chấp nhận hay không.

ACK nghiệp vụ C7 chỉ được phát sau khi giao dịch lưu đã commit. ACK dùng lại `clientMessageId`, `messageId`, `conversationId`, `sequence` và thời điểm của bản ghi chuẩn. Nếu `created=false`, chỉ trả ACK cho bên gửi và không phát lại tin tới người nhận. STOMP receipt xác nhận ở tầng giao thức.

`ChatMessages.readAfter` kiểm phiên và quyền theo phòng, rồi đọc theo `sequence > afterSequence`. [Hợp đồng C8](#chat-07) sử dụng lớp này và áp dụng thời hạn lưu CHAT-DATA-07.

<a id="chat-05"></a>
## CHAT-05 · Phân quyền WebSocket theo phòng

Khi Backend chạy profile `db` và bật `AUTH_ENABLED=true`, Chat dùng WebSocket riêng `/api/v1/ws/chat`. Handshake yêu cầu Origin trong danh sách và cookie CUSTOMER `huyenco_account_session`. CONNECT dùng đúng một header STOMP `X-CSRF-Token` lấy từ phiên tài khoản. Server gắn danh tính với kết nối sau khi kiểm CONNECT. Client không gửi hoặc chọn tài khoản/vai trò cho mỗi frame.

| Frame | Đích cho phép | Kiểm quyền |
| --- | --- | --- |
| SEND | `/app/chat/rooms/{conversationId}/send` | Phiên còn hiệu lực, đúng người tham gia theo vai trò hiện hành. |
| SUBSCRIBE | `/user/queue/chat/rooms/{conversationId}` | Cùng điều kiện, nhận qua hàng đợi riêng của kết nối. |
| MESSAGE do Server chuyển ra | Hàng đợi riêng của phòng | Kiểm lại phiên và quyền ngay trước khi giao để chặn cả subscription đã mở. |

`conversationId` dùng UUID dạng chuẩn chữ thường. Đích broker vật lý và đích tính quẻ không được dùng trên socket Chat. Socket tính quẻ vẫn theo allowlist cũ. Từ chối frame bằng lỗi STOMP chung `STOMP_FRAME_REJECTED` và đóng kết nối. Server không tiết lộ phòng có tồn tại hay không. Cookie bị thu hồi, hết hạn, đổi vai trò, khóa tài khoản hoặc mất điều kiện hồ sơ sẽ bị phát hiện khi có frame cần kiểm hoặc lúc Server chuẩn bị giao dữ liệu.

CHAT-03 dùng ranh giới này cho luồng gửi nhận bên dưới. C8 kiểm quyền ở từng yêu cầu REST và áp dụng chính sách CHAT-DATA-07.

<a id="chat-03"></a>
## CHAT-03 · Gửi nhận tin và ACK nghiệp vụ (C7)

Sau CONNECT, mỗi bên đăng ký `/user/queue/chat/rooms/{conversationId}` trước khi gửi tin. Client gọi SEND tới `/app/chat/rooms/{conversationId}/send` với JSON `{"clientMessageId":"550e8400-e29b-41d4-a716-446655440001","text":"Xin chào"}`. Chỉ hai trường này được phép. UUID Client được tạo cho một tin và phải được giữ nguyên cùng nội dung nếu gửi lại.

| `type` trong JSON | Bên nhận | Các trường kèm theo |
| --- | --- | --- |
| `ACK` | Kết nối đã gửi, sau khi giao dịch PostgreSQL commit | `conversationId`, `clientMessageId`, `messageId`, `sequence`, `createdAt` |
| `MESSAGE` | Kết nối của người còn lại đang đăng ký phòng | `conversationId`, `messageId`, `senderAccountId`, `sequence`, `text`, `createdAt` |
| `ERROR` | Kết nối đã gửi | `conversationId`, `clientMessageId` (UUID hoặc `null`), `code` |

`sequence` là chuỗi số thập phân và `createdAt` là thời điểm UTC ISO 8601. Xem [bảng mã lỗi C7 tại CHAT-09](#chat-09). Lỗi phân quyền trên STOMP dùng `STOMP_FRAME_REJECTED` như CHAT-05. Mỗi tiến trình Server cho phép tối đa bốn thao tác ghi tin đồng thời tại handler. Nếu đã nhận ACK, tin đã được lưu. Nếu mất kết nối trước ACK, Client có thể thử lại cùng mã và nội dung để nhận cùng kết quả trong thời hạn lưu. Sự kiện gửi trực tiếp phụ thuộc kết nối người nhận. Đồng bộ phần tin bỏ lỡ thuộc C8 và CHAT-08.

Proxy cùng Origin `/api/v1/ws/chat` bật cùng `NEXT_PUBLIC_ACCOUNT_HISTORY=1`. Client dùng luồng gửi và đồng bộ tại CHAT-08.

<a id="chat-data-07"></a>
## CHAT-DATA-07 · Thời hạn lưu và bảo vệ nội dung

Tin nhắn được lưu trong **30 ngày (720 giờ)** kể từ `created_at` của PostgreSQL, kể cả khi cuộc trò chuyện vẫn mở. Ở thời điểm hết hạn, tin bị loại khỏi lịch sử ngay cả khi tác vụ nền chưa xóa hàng. Lịch sử vẫn kiểm phiên CUSTOMER, vai trò và quan hệ tham gia ở mỗi lần đọc, kể cả khi phòng đã kết thúc.

V33 thêm chỉ mục hỗ trợ dọn tin. Khi chạy profile `db` với `AUTH_ENABLED=true`, Backend dọn tối đa 1.000 tin mỗi lượt và đợi 60 giây giữa các lượt. Nếu tác vụ lỗi, Server ghi thông báo chung và thử lại ở lượt sau. Tin mới và tin còn hạn được giữ nguyên. Log nghiệp vụ Chat ghi mã lỗi hoặc định danh phục vụ chẩn đoán và loại bỏ nội dung tin, cookie cùng token CSRF.

Mỗi lần dọn vừa xóa bản ghi tin vừa giữ bộ khóa `conversation_id`, `sender_account_id`, `client_message_id` trong một câu lệnh nguyên tử. Bảng khóa chỉ giữ định danh cần chống gửi lại và tự xóa theo phòng. Gửi lại mã đã hết hạn trả `MESSAGE_EXPIRED` cả trước và sau khi dọn. Bộ đếm phòng giữ nguyên, nên cursor có thể nhảy qua số thứ tự đã hết hạn và Client vẫn đọc được tin mới hơn.

Thông tin phòng và bộ khóa chống trùng được giữ trong vòng đời bản ghi phòng. Chính sách 30 ngày áp dụng cho nội dung trong PostgreSQL đang chạy. Bản sao lưu độc lập, dữ liệu đã chuyển tới Client và vòng đời xóa phòng thuộc phạm vi vận hành riêng.

<a id="chat-07"></a>
## CHAT-07 · API lịch sử tin nhắn (C8)

`GET /api/v1/chat/conversations/{conversationId}/messages?afterSequence=0&size=50`. Client dùng cùng Origin qua proxy cuộc trò chuyện khi bật `NEXT_PUBLIC_ACCOUNT_HISTORY=1`. GET dùng cookie CUSTOMER, kiểm Origin nếu có và trả `Cache-Control: no-store`. Chỉ hai người tham gia còn đủ quyền mới được đọc, kể cả sau khi kết thúc phòng. Tin hết hạn không xuất hiện.

| Tham số | Quy tắc |
| --- | --- |
| `afterSequence` | Tùy chọn, mặc định `0`. Chuỗi thập phân chuẩn từ `0` đến `9223372036854775807`. Chỉ trả tin có số thứ tự lớn hơn. |
| `size` | Tùy chọn, mặc định `50`, tối thiểu `1` và tối đa `100`. |

Response `200` dùng envelope REST. `data.items` tăng dần theo số thứ tự. Mỗi tin gồm `conversationId`, `messageId`, `senderAccountId`, `sequence`, `text`, `createdAt`. Số thứ tự và `data.nextAfterSequence` là chuỗi thập phân. `createdAt` là UTC ISO 8601. Tin lịch sử dùng cùng trường với nội dung sự kiện `MESSAGE` của C7, bỏ trường `type`.

Lần đầu đọc, dùng cursor `0`. Khi `data.hasMore=true`, gọi lại với `data.nextAfterSequence` để lấy trang tiếp theo. Trang rỗng giữ nguyên cursor. Khi không còn trang, Client có thể dùng lại cursor cho lượt đồng bộ sau. Số thứ tự có thể có khoảng trống do tin hết hạn. Khi kết hợp lịch sử và sự kiện trực tiếp, Client đối chiếu `messageId` để loại trùng. Luồng tự đồng bộ khi reconnect thuộc CHAT-08.

UUID, tham số lặp, tham số lạ, kích thước hoặc cursor sai trả `400 INVALID_INPUT`. Thiếu hoặc mất phiên trả `401 INVALID_SESSION`. Origin sai trả `403 CSRF_REJECTED`, tư vấn viên mất điều kiện trả `403 FORBIDDEN`. Phòng không có và phòng ngoài quyền cùng trả `404 NOT_FOUND`. Kho dữ liệu không truy cập được trả `503 DATABASE_UNAVAILABLE`.

<a id="chat-08"></a>
## CHAT-08 · Kết nối lại và đồng bộ tin

Khi mở phòng đang hoạt động, Client tải lịch sử bằng C8 và đăng ký hàng đợi của phòng qua C7. Mỗi lần mở lại socket đều kiểm C10 và lấy CSRF từ phiên CUSTOMER. Client gửi frame rỗng tới `/app/chat/rooms/{conversationId}/sync` sau SUBSCRIBE và đọc bù khi nhận `READY`. Client cũng đọc bù nếu nhận sequence vượt quá tin kế tiếp. Phòng đã kết thúc chỉ dùng C8. Xem [hợp đồng WebSocket hiện hành](02-API-CONTRACT.md#chat-tư-vấn-và-thông-báo-thời-gian-thực).

Chỉ kết quả C8 tiến cursor đọc bù. Tin WebSocket và ACK hợp nhất theo `messageId` rồi sắp xếp theo `sequence`, giữ chính xác cả số thứ tự lớn. Khi chưa có ACK, Client giữ bản nháp trong trang và báo trạng thái chưa xác định. Người dùng có thể chủ động gửi lại cùng nội dung và cùng mã. Client không tự gửi lại. Đổi phòng, hết phiên hoặc mất quyền sẽ hủy các yêu cầu đang chạy và dọn dữ liệu của phòng cũ khỏi màn hình.

<a id="chat-09"></a>
## CHAT-09 · Hợp đồng bàn giao C1–C10

[Fixture Chat v1](examples/chat-v1.json) gồm 21 mẫu JSON cho danh bạ, phiên, tạo và chuyển trạng thái phòng, SEND, ACK, tin trực tiếp, lịch sử và lỗi. Client chạy `npm run check:contract` để đối chiếu fixture với kiểu dùng trong ứng dụng. Backend dùng `ChatContractExamplesTest` để kiểm mẫu với các record truyền qua mạng.

| Định danh | Bên cấp và phạm vi |
| --- | --- |
| `requestId` trong envelope REST | Server cấp cho từng phản hồi, dùng truy vết lỗi. |
| `requestId` trong body C3 | Client cấp cho lần tạo phòng và giữ nguyên khi thử lại. Server kiểm trùng theo USER. |
| `conversationId`, `messageId` | Server cấp cho phòng và tin đã lưu. C7 và C8 dùng cùng mã tin. |
| `clientMessageId` | Client cấp cho một lần gửi. Khóa chống trùng gồm phòng, người gửi và mã này. ACK và lỗi có mã dùng để đối chiếu đúng tin đang chờ. |
| `sequence`, `nextAfterSequence` | Chuỗi thập phân từ BIGINT. Số thứ tự có phạm vi từng phòng, cursor có thể bằng `0`. |

| Kênh | Phản hồi | Xử lý Client |
| --- | --- | --- |
| REST C1–C6 và C8–C10 | `200 COMPLETED`. C3 trả `201` khi tạo và `200` khi thử lại. | Dùng `data`. Envelope thành công có `error: null`. |
| REST lỗi đầu vào | `400 INVALID_INPUT` | Sửa đầu vào. |
| REST lỗi truy cập | `401 INVALID_SESSION`, `403 CSRF_REJECTED` hoặc `FORBIDDEN`, `404 NOT_FOUND` | Xác thực lại hoặc đóng dữ liệu ngoài quyền. Dùng cùng `404` cho phòng không tồn tại và phòng ngoài quyền. |
| REST xung đột | `409 REQUEST_ID_CONFLICT` tại C3, `409 INVALID_TRANSITION` tại C6/C9 | Kiểm lại yêu cầu hoặc tải lại trạng thái. |
| REST lỗi máy chủ | `500 INTERNAL_ERROR`, `503 DATABASE_UNAVAILABLE` | Báo lỗi và cho phép thử lại theo quy tắc của thao tác. Envelope lỗi có `data: null`. |
| C7 ACK nghiệp vụ | Frame STOMP `MESSAGE` chứa JSON `type: "ACK"` | Xác nhận tin đúng `clientMessageId` sau commit. Lượt thử lại nhận ACK cũ. |
| C7 lỗi nghiệp vụ | Frame STOMP `MESSAGE` chứa JSON `type: "ERROR"`. Mã gồm `INVALID_INPUT`, `ROOM_NOT_ACTIVE`, `MESSAGE_ID_CONFLICT`, `MESSAGE_EXPIRED`, `SERVER_BUSY`, `DATABASE_UNAVAILABLE` và `NOT_FOUND` nếu phòng không còn khớp lúc lưu. | Chỉ cập nhật trạng thái tin đang chờ nếu mã Client khớp. `clientMessageId: null` là lỗi chưa có mã để đối chiếu. |
| STOMP lỗi giao thức hoặc quyền | Frame STOMP `ERROR` với header `message: STOMP_FRAME_REJECTED` | Kết nối bị đóng. Xác thực lại trước khi mở lại socket. |

STOMP receipt thuộc tầng giao thức. Client chỉ đánh dấu đã lưu khi nhận ACK nghiệp vụ đúng mã tin. Kiểm chứng kỹ thuật thực hiện trên máy local. Nhóm xác nhận hợp đồng tại lượt bàn giao và nghiệm thu Phase 6.

<a id="chat-data-06"></a>
## CHAT-DATA-06 · Dữ liệu TEST cho nghiệm thu Chat 1:1

Chuẩn bị một bản PostgreSQL có seed và Flyway V33 trên loopback. Tên database phải là `huyenco_chat_fixture_test` hoặc tên đó kèm một hậu tố chữ thường/số sau dấu gạch dưới. Khi cần dựng bản sao, dùng [quy trình TEST riêng](82-HUYENCO-LAN-DEMO.md#tạo-database-test-mới-nếu-cần). Chạy từ thư mục gốc repo sau khi đóng gói Backend với JDK 17:

```powershell
Push-Location server
try { .\mvnw.cmd -Pdatabase -DskipTests package } finally { Pop-Location }
python -X utf8 .\scripts\prepare_chat_test_fixtures.py --database huyenco_chat_fixture_test --port 5432 --user postgres
```

Script hỏi mật khẩu PostgreSQL bằng ô nhập ẩn nếu tiến trình chưa có `PGPASSWORD`. Dùng `--psql` hoặc `--java` nếu cần chỉ định đường dẫn chương trình. Dữ liệu được ghi trong một giao dịch sau khi xác minh tên database và schema. Mỗi lần chạy tạo một nhóm dữ liệu độc lập với mã mới. Script in JSON chứa UUID phòng, tên đăng nhập và mật khẩu ngẫu nhiên của ba tài khoản. Giữ đầu ra trong kênh nội bộ của nhóm. PostgreSQL chỉ lưu hash Argon2id. Một tài khoản ADMIN đã khóa làm chủ thể duyệt hồ sơ trong dữ liệu tổng hợp.

| Dữ liệu | Dùng trong nghiệm thu |
| --- | --- |
| `accounts.user` | Đăng nhập ở `/tu-van`, tạo yêu cầu, gửi tin và đọc lịch sử. |
| `accounts.consultant` | Đăng nhập ở `/tu-van-vien`, chấp nhận hoặc từ chối yêu cầu được phân và gửi tin. |
| `accounts.outsider` | Đăng nhập hợp lệ với vai trò USER. Danh sách hội thoại rỗng. Đọc phòng/lịch sử nhận cùng `404 NOT_FOUND` như UUID vắng mặt. SEND và SUBSCRIBE ngoài phòng bị từ chối. |
| `rooms.active` | Phòng đang hoạt động với hai tin mẫu, số thứ tự `1` và `2`. Dùng để kiểm C7, C8 và reconnect. |
| `rooms.pending` | Phòng đang chờ để kiểm nhận, từ chối hoặc hủy. Dùng C3 tạo phòng mới khi cần lặp các nhánh loại trừ nhau. |

Chạy Backend profile `db` với `AUTH_ENABLED=true`, kết nối đúng database vừa tạo fixture và cho phép Origin của Client. Bật `NEXT_PUBLIC_ACCOUNT_HISTORY=1` và `HUYENCO_API_URL` trỏ về Backend TEST như hướng dẫn bàn giao. Dùng ba profile trình duyệt tách cookie. Dùng bản sao TEST mới nếu cần danh bạ và phòng ở trạng thái ban đầu. Các nhóm dữ liệu từ lượt trước vẫn tồn tại trong bản sao cũ.

## Nghiệm thu ngày 09/11/2026

<a id="ph6-ph-01"></a>
### PH6-PH-01 · Nghiệm thu Chat 1:1 trên localhost

Chạy Next.js qua proxy cùng Origin, Backend JDK 17 và PostgreSQL TEST V33 khôi phục riêng. Dùng dữ liệu từ script CHAT-DATA-06 và ba phiên Chromium tách cookie. Kiểm kỹ thuật trên localhost đạt. Xác nhận bàn giao giữa TV1/TV2/TV3 là bước riêng của nhóm.

| Phạm vi | Kết quả |
| --- | --- |
| Phiên và danh bạ | C10 trả đúng tài khoản và vai trò của ba phiên. USER đọc được chi tiết tư vấn viên qua C2 và chọn từ danh bạ. CONSULTANT gọi C2 bị từ chối với `403`. |
| Vòng đời phòng | Tạo, nhận, từ chối, hủy và kết thúc qua giao diện. Ca hủy trên trạng thái cũ sau khi tư vấn viên chấp nhận nhận `409` và tải lại thành `ACTIVE`. Người tham gia đọc lại trạng thái và lịch sử sau khi kết thúc. |
| Gửi nhận và lịch sử | Hai người trao đổi qua STOMP. C8 đọc lại đúng tin, đúng thứ tự. |
| Ngắt socket và mất ACK | Tin gửi lúc người dùng mất kết nối được đọc bù. Trong ca ACK bị chặn sau khi Server lưu, Client giữ bản nháp và chỉ gửi lại khi người dùng bấm. Hai lượt SEND có cùng mã và nội dung, PostgreSQL có một hàng, bên nhận hiển thị một tin. |
| Quyền theo phòng | USER ngoài phòng có danh sách rỗng, nhận `404` khi đọc C5/C8 và bị chặn SEND/SUBSCRIBE. Thu hồi phiên đang mở làm Client dọn nội dung phòng. |
| Hồi quy nghiệp vụ | Mai Hoa LINES và Tam Thế CAREER trả kết quả qua STOMP tính quẻ. H01 lưu và đọc kết quả theo tài khoản, tài khoản khác nhận `404`. Admin đọc được metrics, cookie CUSTOMER bị từ chối. |

Hồi quy tự động đạt 63 tệp fixture, 1.394 ca Client và 2.295 ca Backend. Backend bỏ qua 30 ca, không có lỗi. TypeScript được kiểm trên mã nguồn với cấu hình loại các tệp kiểu Next.js từ lượt chạy cũ.

### CHAT-DATA-06

Script từ chối tên database chính. Trên PostgreSQL TEST V28, script cũng từ chối ghi và số tài khoản giữ nguyên. Sau khi nâng bản sao lên V33, chạy hai lượt tạo hai nhóm độc lập. Ba tài khoản của một nhóm đăng nhập và qua C10 đúng vai trò. Hai người tham gia đọc được phòng và hai tin mẫu. Tài khoản ngoài phòng thấy danh sách rỗng và nhận `404` ở C5/C8, đồng thời bị từ chối SEND/SUBSCRIBE. Một lượt gửi hợp lệ qua STOMP nhận ACK, bên kia nhận cùng mã tin và C8 đọc lại tin ở số thứ tự `3`.

### CHAT-09

TypeScript đối chiếu 63 tệp fixture, gồm tệp Chat với 21 mẫu. Cả 1.394 ca Client và 2.295 ca Backend đạt, Backend bỏ qua 30 ca và không có lỗi. Hai ca Java kiểm mẫu theo record truyền qua mạng. Hai ca Client kiểm trình đọc sự kiện Chat, gồm ACK sai phòng, sai mã, số thứ tự vượt giới hạn và nhầm mã lỗi giao thức. Hồi quy REST/STOMP chạy trên PostgreSQL TEST V33.

### CHAT-08

Hai phiên Chromium tách biệt qua proxy Next.js, Backend và PostgreSQL TEST V33 đã kiểm nhận tin trực tiếp, ngắt riêng socket USER, gửi từ CONSULTANT trong lúc ngắt, kết nối lại và đọc bù. Lịch sử trên giao diện có đúng hai tin theo thứ tự PostgreSQL. Thu hồi phiên đang mở khiến giao diện dọn nội dung phòng. Bộ Client có 1.392 ca đạt. Ca Client mô phỏng thêm ACK thất lạc, gửi lại đúng payload cũ theo yêu cầu người dùng, bỏ frame của socket cũ và phòng khác. TypeScript trên mã nguồn đạt với cấu hình kiểm thử bỏ qua các thư mục kiểu Next.js được sinh từ các lượt chạy trước.

### CHAT-07

HTTP thật qua Tomcat đọc được cùng bản ghi đã giao qua STOMP sau khi kết thúc phòng. Các ca REST với PostgreSQL TEST V33 kiểm tin hết hạn, cursor vượt ngưỡng an toàn của JavaScript, trang rỗng, trang tiếp theo, quyền USER/CONSULTANT, Origin sai, phiên bị thu hồi và phản hồi đồng nhất cho phòng vắng mặt hoặc ngoài quyền. Cả 20 ca `ChatRoomAccessDatabaseTest` và 24 ca kiểm tra proxy Next.js đạt. Tích hợp hiển thị và đồng bộ lịch sử trên Client thuộc bước kế tiếp.

### CHAT-DATA-07

PostgreSQL TEST riêng nâng từ V32 lên V33 và giữ nguyên phòng có sẵn. Hai ca tích hợp mới kiểm tin hết hạn bị ẩn trước khi dọn, khóa chống trùng chặn tạo lại sau khi dọn, thứ tự và tin còn hạn giữ nguyên, và lô 1.001 bản ghi được dọn qua hai lượt. Cả 18 ca `ChatRoomAccessDatabaseTest` đạt, bao gồm hồi quy gửi/nhận STOMP và quyền theo phòng. Bộ Backend JDK 17 có 2.291 ca đạt, 30 ca bỏ qua và 0 lỗi.

### CHAT-03

Hai kết nối WebSocket/STOMP thật qua Tomcat và PostgreSQL TEST V32 đã kiểm USER và CONSULTANT gửi nhận hai chiều. Khi nhận ACK, truy vấn từ kết nối PostgreSQL khác đọc được bản ghi theo đúng UUID. Gửi lại trả ACK cũ, người nhận không nhận thêm bản sao và số bản ghi không tăng. Các ca bổ sung kiểm lỗi JSON, xung đột mã, phòng chờ và thử lại sau khi phòng đã kết thúc. Backend JDK 17 có 2.289 ca đạt, 30 ca bỏ qua và 0 lỗi. Cả 24 ca kiểm tra rewrite của Next.js đạt. Khung gửi trên giao diện sẽ được tích hợp theo hợp đồng C7.

### CHAT-05

Kiểm thử qua WebSocket/STOMP thật với Tomcat và PostgreSQL TEST V32. USER và CONSULTANT đúng phòng vượt qua kiểm SEND. Kiểm từ chối thiếu cookie, Origin ngoài danh sách, CSRF sai, đích vật lý và SEND/SUBSCRIBE ngoài phòng. Một bản tin giả lập của broker đến đúng subscription. Khi phiên đã bị thu hồi, lần giao tiếp theo chỉ trả lỗi và không lộ nội dung. Tư vấn viên bị khóa cũng bị từ chối trên socket đang mở. Cả 15 ca `ChatRoomAccessDatabaseTest` đạt.

### CHAT-DATA-04

Flyway nâng bản sao PostgreSQL TEST từ V31 lên V32. Phòng có sẵn giữ nguyên dữ liệu và bắt đầu với bộ đếm bằng 0. Cả 14 ca `ChatRoomAccessDatabaseTest` đạt, gồm hai ca mới kiểm chống trùng đồng thời, số thứ tự và cursor, xung đột nội dung, quyền theo phòng, hai vai trò và đọc lại sau khi phòng kết thúc. Bộ Backend JDK 17 có 2.287 ca đạt, 30 ca bỏ qua và 0 lỗi.

### CHAT-06

12 ca `ChatRoomAccessDatabaseTest` đạt trên PostgreSQL TEST V31. Ca REST mới kiểm cả bốn thao tác, CSRF, vai trò và quyền theo phòng, nhận lại yêu cầu chấp nhận với thời điểm cũ, xung đột `409` và đọc lại phòng đã kết thúc. Backend JDK 17 có 2.285 ca đạt, 30 ca bỏ qua và 0 lỗi.

Hai phiên Chromium qua Next.js và Backend TEST V31 đã kiểm tư vấn viên chấp nhận và từ chối, người dùng hủy và kết thúc, tải lại trạng thái sau khi thao tác trên dữ liệu cũ nhận `409`, và đọc lại phòng đã kết thúc từ phía tư vấn viên. Ba lý do kết thúc khớp PostgreSQL. Dữ liệu giả lập đã được dọn. Bộ Client có 1.389 ca đạt khi chạy với bốn tiến trình.

### CHAT-02

Flyway nâng PostgreSQL TEST riêng từ V30 lên V31. Cả 11 ca `ChatRoomAccessDatabaseTest` đạt qua Spring và PostgreSQL, gồm ba ca REST mới kiểm `201`/`200`, gửi đồng thời chỉ lưu một phòng, xung đột UUID, cách ly tài khoản và phòng, phân trang, phiên/CSRF và JSON sai hợp đồng. Bộ Backend JDK 17 có 2.284 ca đạt, 30 ca bỏ qua và 0 lỗi. Bộ kiểm tra proxy Next.js có 23 ca đạt.

Chromium với Next.js, Backend và PostgreSQL TEST V31 đã kiểm khách thấy yêu cầu đăng nhập, USER thấy tư vấn viên đã duyệt, chọn và tạo đúng một phòng `PENDING`, CONSULTANT đọc được phòng được phân. Dữ liệu giả lập đã được dọn sau lượt thử. Bộ Client có 1.387 ca đạt, gồm kiểm gửi lại dùng cùng UUID, xóa dữ liệu màn hình khi phiên bị thu hồi và từ chối sai vai trò.

### CHAT-DATA-03

Tám ca `ChatRoomAccessDatabaseTest` đạt trên PostgreSQL TEST riêng sau khi Flyway áp dụng V30. Hai ca mới kiểm tạo và đọc lại phòng qua `PENDING → ACTIVE → ENDED`, phân trang khi trùng thời điểm tạo, lọc theo vai trò, lỗi ngoài phòng, CSRF và việc thu hồi điều kiện hồ sơ. Bộ Backend JDK 17 có 2.281 ca đạt, 30 ca bỏ qua và 0 lỗi. Dùng cùng ba biến `HUYENCO_CHAT_ROOM_TEST_DB_*` nêu ở phần CHAT-DATA-02.

### CHAT-DATA-05

Flyway nâng bản sao PostgreSQL TEST từ V29 lên V30. Phòng giả lập tạo trước khi migrate giữ nguyên UUID, hai người tham gia và thời điểm tạo, đồng thời nhận `PENDING` với các trường mở/kết thúc rỗng. Ba ca vòng đời mới đạt, gồm quyền và CSRF, tính hợp lệ của dữ liệu, yêu cầu lặp và hai thao tác nhận/hủy chạy đồng thời. Bộ Backend JDK 17 có 2.279 ca đạt, 30 ca bỏ qua và 0 lỗi.

### CHAT-DATA-02

Ba ca tích hợp PostgreSQL đạt sau khi Flyway nâng bản sao TEST có seed từ V28 lên V29. Đã kiểm hai thành viên đúng phòng, cách ly giữa hai phòng, phiên H01/Admin, Origin sai, khóa tài khoản, thu hồi phiên, đổi vai trò, mất duyệt hồ sơ và ràng buộc khóa ngoại. `ChatRoomAccessDatabaseTest` chạy với `HUYENCO_CHAT_ROOM_TEST_DB_URL`, `HUYENCO_CHAT_ROOM_TEST_DB_USERNAME` và `HUYENCO_CHAT_ROOM_TEST_DB_PASSWORD`. URL phải dùng `127.0.0.1` và database tên `huyenco_chat_room_test` hoặc tên đó kèm hậu tố chữ/số sau dấu gạch dưới. Ca kiểm thử dùng dữ liệu giả lập và rollback sau mỗi ca.

### CHAT-01

48 kiểm tra HTTP, gồm các bước chuẩn bị tài khoản, đạt trên PostgreSQL TEST riêng khôi phục từ bản V28 có seed. Flyway xác nhận 28 migration. Bộ ca gồm danh bạ trống, phân trang và tên trùng, danh sách và chi tiết cùng ba trường, giới thiệu `null`, UUID sai và hồ sơ bị ẩn. Đã kiểm phiên USER, CONSULTANT, ADMIN, H01, Origin sai và hiệu lực khi khóa tài khoản. Backend JDK 17 có 2.273 ca đạt, 30 ca bỏ qua và 0 lỗi. Bộ kiểm tra rewrite của Next.js có 22 ca đạt. Lượt Chromium V31 của CHAT-02 đã kiểm màn hình danh bạ C1.

### CHAT-04 và CHAT-DATA-01

46 kiểm tra HTTP đạt trên PostgreSQL TEST `huyenco_chat_foundation_test_20261109_003702`. C10 trả đúng ba trường cho USER và CONSULTANT đủ điều kiện. Kiểm thiếu phiên, cookie lặp, cookie H01/Admin, Origin sai và query giả vai trò. Hồ sơ thiếu hoặc mất trạng thái APPROVED bị từ chối, phiên bị thu hồi khi đổi vai trò, đăng xuất, hết hạn hoặc khóa cũng bị từ chối. Đối chiếu bốn bảng dữ liệu nguồn và quẻ trước khi chạy nghiệp vụ xác nhận bản sao giữ nguyên dữ liệu tri thức.
