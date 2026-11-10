# Huyền Cơ – Bàn giao tập trung từ TV1 đến TV2 và TV3

- **Kho mã** `trong-crypto/Huy-n-c-` · **Nhánh làm việc** `bmanh812`.
- **Phạm vi** Từ Phase 2 đến Phase 8 của đợt nâng cấp. Nghiệm thu trên trình duyệt máy tính và môi trường localhost.
- **Đầu mối** TV1 phụ trách Client và tích hợp. TV2 phụ trách Backend. TV3 phụ trách cơ sở dữ liệu và dữ liệu.

## Mục lục

1. [Phase 2 – Xác thực quản trị](#phase-2)
   - [Hiện trạng và căn cứ](#hien-trang)
   - [Công việc TV2](#cong-viec-tv2)
   - [Công việc TV3](#cong-viec-tv3)
   - [Công việc phối hợp](#phoi-hop)
   - [Hợp đồng API cần thống nhất](#hop-dong-api)
   - [Tiêu chí nghiệm thu](#nghiem-thu)
2. [Phase 3 – Quản lý nội dung Admin](#phase-3)
3. [Phase 4 – Dashboard và quản lý tài khoản](#phase-4)
4. [Phase 5 – Phương pháp bổ sung](#phase-5)
5. [Phase 6 – Chat trực tiếp với tư vấn viên](#phase-6)
6. [Phase 7 – Integration Readiness](#phase-7)
   - [Phase 7B – Môi trường TEST và kiểm thử live](#phase-7b)
7. [Bàn giao cuối từ TV1 đến TV2 và TV3](#final-tv1-handoff)
8. [Phase 8 – Kiểm thử và nghiệm thu cuối](#phase-8)
   - [Phase 8A.1 – Xác thực khách hàng](#phase-8a1)
9. [Các phase tiếp theo](#phase-tiep-theo)
10. [Bảng theo dõi công việc](#theo-doi)
11. [Quy tắc cập nhật](#cap-nhat)

<a id="phase-2"></a>
## Phase 2 – Xác thực quản trị (Admin Authentication)

**Trạng thái `PARTIAL – WAITING FOR BACKEND`.**

<a id="hien-trang"></a>
### Hiện trạng và căn cứ

- **TV1 đã hoàn thiện** trang `/admin/login`, kiểm tra biểu mẫu, bố cục Admin, thanh bên, đầu trang, bảng điều khiển cơ bản tại `/admin` và các bài kiểm thử giao diện. Mốc bàn giao frontend là `13cc086`.
- **Đang chờ tích hợp** đăng nhập với Backend thật, kiểm tra quyền `ADMIN`, đăng xuất, xử lý hết phiên và nghiệm thu xác thực/phân quyền. Các bài kiểm thử giao diện hiện có chỉ xác nhận hành vi phía Client.
- **Backend trên nhánh `bmanh812` tại `13cc086`** có `POST /api/v1/session` trong `HistoryController` và các API lịch sử H01. `SessionService` xác minh cookie `huyenco_session` và quyền sở hữu lịch sử. Cookie do Server cấp với `HttpOnly` và `SameSite=Lax`. Phản hồi bootstrap phiên có `expiresAt` và `csrfToken`. H01 dùng `401` cho phiên không hợp lệ và `403` cho kiểm tra CSRF/Origin thất bại. Phiên này đại diện cho chủ sở hữu ẩn danh, chưa gắn với tài khoản hoặc vai trò `ADMIN`.
- **Đối chiếu tài liệu với mã** cho thấy tình trạng chờ Admin Auth trong tài liệu cũ phù hợp với bản mã đã đọc. Chưa thấy API đăng nhập, đọc phiên quản trị, đăng xuất hay kiểm tra vai trò `ADMIN` trong Backend tại mốc này. Migration V11 tạo `anonymous_sessions` và `interpretation_history`. Các migration đến V12 chưa có bảng tài khoản hoặc vai trò Admin. Nếu TV2/TV3 đã làm trên nhánh khác, cần xác nhận bằng nhánh, commit và hợp đồng tương ứng.

[Bàn giao Admin Auth gốc](https://github.com/trong-crypto/Huy-n-c-/blob/50cba56a19d6e90be5f3aef01a4e67b91c8da92d/docs/TV1-PHASE2-ADMIN-AUTH-HANDOFF.md) · [Hợp đồng API hiện tại](02-API-CONTRACT.md) · [Hợp đồng H01](34-H01-SESSION-HISTORY-HANDOFF.md) · [HistoryController](../server/src/main/java/com/huyenco/history/HistoryController.java) · [Migration V11](../server/src/main/resources/db/migration/V11__anonymous_sessions_and_history.sql)

<a id="cong-viec-tv2"></a>
### A. Công việc TV2 – Backend

1. **AUTH-01 – Đăng nhập tài khoản.** Xác minh định danh, mật khẩu và quyền tại Server. Chốt cách phục vụ form khách hàng và form quản trị, dữ liệu phiên trả về và hành vi khi tài khoản không có quyền dùng cổng quản trị. Với thông tin sai, trả lỗi chung để tránh tiết lộ tài khoản nào tồn tại. Loại thông tin bí mật khỏi phản hồi và log.
2. **AUTH-02 – Đọc phiên tài khoản hiện tại.** Xác minh cookie và trạng thái phiên. Trả tên hiển thị, vai trò được Server xác minh, thời hạn và dữ liệu CSRF nếu hợp đồng yêu cầu. Xử lý phiên thiếu, hết hạn hoặc đã thu hồi.
3. **AUTH-03 – Đăng xuất.** Thu hồi phiên phía Server, làm hết hạn cookie của phiên tài khoản tương ứng và kiểm tra CSRF theo hợp đồng. Phiên cũ phải bị từ chối khi dùng lại.
4. **AUTH-04 – Phân quyền quản trị.** Phân biệt `ADMIN`, `USER` và các vai trò được nhóm thống nhất. Kiểm tra quyền trên từng API quản trị và từ chối yêu cầu thiếu quyền. Client dùng thông tin vai trò để hiển thị giao diện. Quyết định cấp quyền thuộc Backend.
5. **AUTH-05 – Cookie, phiên và CSRF.** Thống nhất cookie riêng cho Admin, thời hạn, thuộc tính và phạm vi cookie, cách kiểm tra Origin khi đăng nhập, cách cấp/gửi CSRF và cách bảo vệ thao tác ghi. Kiểm tra tương thích với Next.js trên localhost và phiên lịch sử H01.
6. **AUTH-06 – Phản hồi lỗi.** Chốt cấu trúc JSON, mã lỗi ổn định và thông báo an toàn. Phân biệt dữ liệu sai (`400`), thông tin đăng nhập/phiên không hợp lệ (`401`), thiếu quyền hoặc lỗi Origin/CSRF (`403`) và lỗi nội bộ (`500`) khi phù hợp.
7. **AUTH-07 – Đăng ký công khai.** Server chỉ cấp vai trò `USER`. Chốt định danh username/email, trường tên hiển thị, độ dài, chính sách mật khẩu, xác minh email nếu áp dụng, lỗi trùng định danh và việc cấp phiên sau đăng ký. Từ chối yêu cầu tự cấp quyền nâng cao.

<a id="cong-viec-tv3"></a>
### B. Công việc TV3 – Cơ sở dữ liệu và dữ liệu

1. **DATA-01 – Dữ liệu tài khoản.** Chốt bảng tài khoản, tên hiển thị, định danh username/email, chuẩn hóa và ràng buộc duy nhất cho định danh. Chốt với TV2 quan hệ tài khoản–phiên và dữ liệu cần lưu cho hết hạn hoặc thu hồi nếu thiết kế dùng phiên lưu trong cơ sở dữ liệu.
2. **DATA-02 – Vai trò người dùng.** Đề xuất cách lưu vai trò/quyền, tối thiểu phân biệt `ADMIN` và `USER`. Tính đến khả năng thêm `CONSULTANT` khi phase tương ứng xác nhận nhu cầu.
3. **DATA-03 – Bảo mật dữ liệu tài khoản.** Thống nhất với TV2 cách băm mật khẩu phù hợp và cấu trúc lưu giá trị băm. Chỉ lưu giá trị băm theo thiết kế đã duyệt. Cấp thông tin bí mật qua kênh riêng, tách khỏi mã nguồn và tài liệu.
4. **DATA-04 – Tài khoản kiểm thử.** Nhóm cấp tài khoản `ADMIN` riêng và chuẩn bị tài khoản `USER`, `CONSULTANT` cho môi trường TEST trên localhost. Cung cấp thông tin đăng nhập qua kênh riêng của nhóm.
5. **DATA-05 – Tương thích dữ liệu cũ.** Chốt migration bảo toàn lịch sử và quyền sở hữu H01. Nếu nhóm duyệt lịch sử gắn tài khoản, thống nhất quan hệ bản ghi–tài khoản và kiểm quyền trên nhiều thiết bị trước khi di chuyển dữ liệu. Xác nhận Mai Hoa, Tam Thế và Lịch sử tiếp tục hoạt động trên cơ sở dữ liệu TEST sau thay đổi.

<a id="phoi-hop"></a>
### Công việc phối hợp

- **PH2-PH-01 – Thiết kế tài khoản, vai trò và phiên.** TV2 và TV3 thống nhất nơi lưu tài khoản, vai trò, cách lưu/thu hồi phiên và cách tách dữ liệu Admin khỏi phiên H01 trước khi chốt migration.
- **PH2-PH-02 – Chốt hợp đồng tích hợp.** TV2 và TV1 thống nhất các API trong bảng dưới. TV3 xác nhận dữ liệu tài khoản, vai trò và tài khoản TEST có thể đáp ứng hợp đồng.
- **PH2-PH-03 – Nghiệm thu trên localhost.** TV2 cung cấp Backend TEST và hợp đồng. TV3 chuẩn bị dữ liệu/tài khoản và bằng chứng bảo toàn lịch sử. TV1 tích hợp và chạy các ca trên trình duyệt. Cả nhóm ghi kết quả tại mục nghiệm thu.

<a id="hop-dong-api"></a>
### C. Hợp đồng API cần thống nhất

Các phương thức, trường và mã phản hồi bên dưới là đề xuất để TV2 và TV1 chốt. Các endpoint xác thực tài khoản chưa được xác nhận.

| ID | Chức năng | HTTP Method | Endpoint | Request | Response | Auth/CSRF | Người phụ trách | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Đăng nhập tài khoản | `POST` đề xuất | TBD – Chờ TV2 thống nhất | Định danh username/email và mật khẩu, tên trường TBD | `200` đề xuất, cấp cookie phiên tương ứng và trả dữ liệu phiên. `400`/`401`/`403` khi phù hợp. | Chốt kiểm tra Origin và cơ chế chống CSRF khi đăng nhập. | TV2, TV1 đối chiếu | `TODO` |
| AUTH-02 | Đọc phiên tài khoản | `GET` đề xuất | TBD – Chờ TV2 thống nhất | Cookie tài khoản, không có body | `200` đề xuất, trả dữ liệu phiên và vai trò. `401` khi thiếu/hết phiên và `403` khi thiếu quyền. | Chốt cách cấp hoặc làm mới thông tin CSRF nếu có. | TV2, TV1 đối chiếu | `TODO` |
| AUTH-03 | Đăng xuất tài khoản | `POST` đề xuất | TBD – Chờ TV2 thống nhất | Cookie tài khoản và thông tin CSRF theo hợp đồng | `204` đề xuất, thu hồi phiên và làm hết hạn cookie. Chốt hành vi nếu phiên đã hết hạn. | Origin/CSRF theo hợp đồng. | TV2, TV1 đối chiếu | `TODO` |
| AUTH-04 | Kiểm tra quyền Admin | Theo từng API | TBD – Chờ TV2 thống nhất | Cookie Admin và dữ liệu theo thao tác | Phản hồi theo từng API. `401` khi phiên không hợp lệ, `403` khi phiên hợp lệ nhưng thiếu quyền hoặc lỗi CSRF. | Backend bắt buộc xác minh phiên và vai trò `ADMIN`. Áp dụng CSRF cho thao tác ghi. | TV2 | `TODO` |
| AUTH-07 | Đăng ký USER | `POST` đề xuất | TBD – Chờ TV2 thống nhất | Tên hiển thị, định danh và mật khẩu, tên trường TBD | Chốt mã HTTP, DTO, lỗi trùng và hành vi sau đăng ký. Quyền `USER` do Server gán. | Chốt Origin, CSRF và cơ chế giới hạn yêu cầu nếu áp dụng. | TV2, TV1 đối chiếu | `TODO` |

`AUTH-04` là quy tắc bảo vệ các API quản trị. Việc cung cấp endpoint kiểm tra quyền riêng chỉ được quyết định khi nhóm chốt hợp đồng.

**Dữ liệu Client cần và các điểm cần xác nhận**

- Dữ liệu phiên tối thiểu gồm tên hiển thị (`displayName`), vai trò (`role`), thời hạn (`expiresAt`) và thông tin CSRF (`csrfToken`) nếu thiết kế yêu cầu Client gửi token. Chốt tên, kiểu, định dạng thời gian và cấu trúc JSON. Chốt có dùng cấu trúc phản hồi `{requestId,status,data,error}` của REST hiện tại cho Admin hay không.
- Chốt tên cookie Admin, `HttpOnly`, `SameSite`, `Path`, `Secure`, vòng đời phiên và việc làm hết hạn cookie khi đăng xuất. Chốt quy tắc Origin, proxy cùng nguồn của Next.js và cấu hình localhost. Admin Auth cần phân biệt cookie quản trị với `huyenco_session` và giữ nguyên quyền sở hữu H01.
- Chốt nguồn cấp CSRF, tên header, vòng đời token và cách Client xử lý token thiếu/sai. Chốt mã lỗi máy đọc được để Client phân biệt thiếu quyền với lỗi CSRF trong nhóm `403`.
- Với `400`, Client hiển thị lỗi đầu vào phù hợp. Với `401` khi đăng nhập, hiển thị thông báo chung. Với `401` trên trang quản trị đang dùng, xóa trạng thái phiên Admin trong Client và yêu cầu đăng nhập lại. Với `403`, hiển thị thiếu quyền hoặc lỗi CSRF theo mã lỗi đã chốt. Với `500`, hiển thị lỗi chung và chỉ dùng mã yêu cầu để đối chiếu log nếu Server cung cấp.

<a id="nghiem-thu"></a>
### D. Tiêu chí nghiệm thu Phase 2

| Ca | Kiểm tra với Backend và dữ liệu TEST thật | Kết quả cần đạt | Trạng thái |
| --- | --- | --- | --- |
| NT-01 | Đăng nhập tài khoản `ADMIN`, tải lại trang và mở trực tiếp trang quản trị | Phiên được cấp, API đọc phiên xác nhận vai trò, UI hiển thị đúng | Chưa chạy |
| NT-02 | Nhập sai mật khẩu | Bị từ chối theo hợp đồng, thông báo chung, không cấp phiên Admin | Chưa chạy |
| NT-03 | Gọi trực tiếp API quản trị khi chưa đăng nhập | Backend trả `401`, kể cả khi bỏ qua UI | Chưa chạy |
| NT-04 | Dùng phiên `USER` hợp lệ gọi API quản trị | Backend trả `403`, dữ liệu quản trị được bảo vệ | Chưa chạy |
| NT-05 | Đăng xuất rồi dùng lại phiên cũ | Cookie Admin hết hạn, Server từ chối phiên cũ | Chưa chạy |
| NT-06 | Đọc phiên/gọi API khi phiên hết hạn | Backend trả `401`, Client yêu cầu đăng nhập lại | Chưa chạy |
| NT-07 | Gửi thao tác ghi thiếu hoặc sai CSRF và thử Origin bị từ chối | Backend từ chối theo hợp đồng và thao tác không ghi dữ liệu | Chưa chạy |
| NT-08 | Chuyển qua lại giữa Admin và website người dùng | REST, STOMP Mai Hoa/Tam Thế và phiên H01 tiếp tục hoạt động đúng | Chưa chạy |
| NT-09 | Đối chiếu lịch sử TEST trước và sau tích hợp/migration nếu có | Bản ghi cũ còn đọc được đúng chủ sở hữu, dữ liệu không bị mất | Chưa chạy |

Chỉ ghi `PASS` khi có kết quả thực tế kèm mốc commit, môi trường và bằng chứng đã che thông tin bí mật.

<a id="phase-3"></a>
## Phase 3 – Quản lý nội dung Admin (Admin Content Management)

Phạm vi đầu tiên đã có [hợp đồng quản trị bài hướng dẫn phương pháp](57-TV2-TV3-METHOD-GUIDE-CMS-CONTRACT.md) để TV2 và TV3 triển khai. Các bảng bên dưới ghi phạm vi bàn giao ban đầu của toàn Phase 3.

Danh sách, chi tiết quẻ và nguồn nghĩa tên cho Admin được bàn giao trong [tài liệu 65](65-TV2-TV3-ADMIN-HEXAGRAM-CATALOG.md).

Tạo, sửa và đọc lại các phiên bản bản nháp nghĩa tên được bàn giao trong [tài liệu 66](66-TV2-TV3-HEXAGRAM-GLOSS-DRAFTS.md).

**Trạng thái `PARTIAL – WAITING FOR BACKEND`.** TV1 đã bổ sung giao diện phương pháp, quẻ và lời giải nghĩa, dữ liệu nguồn, nội dung website và xem trước quy trình duyệt. Danh sách/chi tiết quẻ dùng API công khai `GET /api/v1/hexagrams` và `GET /api/v1/hexagrams/{code}` để đối chiếu. Danh mục phương pháp dựa trên các phương pháp đã có trong Client. Form chỉ xem trước trên trang, chưa ghi dữ liệu. Trạng thái nội dung quản trị và phiên bản nguồn phải đến từ Backend.

### A. Công việc TV2 – Backend

| ID | Phạm vi | Endpoint |
| --- | --- | --- |
| CONTENT-01 | Danh sách/chi tiết phương pháp, quẻ và giải nghĩa, nguồn, nội dung website. | Phương pháp theo tài liệu 57, quẻ theo tài liệu 65, nguồn theo [tài liệu 72](72-TV2-TV3-ADMIN-SOURCE-CATALOG.md). Giới thiệu và Hướng dẫn sử dụng theo [hợp đồng V27](76-TV2-TV3-WEBSITE-CONTENT-CMS.md). |
| CONTENT-02 | Tạo/chỉnh sửa bản nháp nghĩa tên và tiếp nhận đề xuất chỉnh sửa nguồn. | Nghĩa tên theo tài liệu 66. Đề xuất nguồn theo [hợp đồng V24](73-TV2-TV3-SOURCE-EDIT-PROPOSAL-DRAFTS.md). |
| CONTENT-03 | Admin ẩn/hiện nghĩa tên đã công bố. Kiểm phiên bản khi thao tác cạnh tranh. | Đã nghiệm thu phạm vi `NAME_GLOSS` trên V23 theo [hợp đồng ẩn/hiện](69-TV2-TV3-CONTENT03-HEXAGRAM-GLOSS-VISIBILITY.md). |
| CONTENT-04 | Gửi duyệt, trả về và công bố nghĩa tên quẻ. Gửi duyệt, trả về và phê duyệt đề xuất sửa nguồn. Xem trước và áp dụng metadata sách đã duyệt. | Nghĩa tên theo tài liệu 67. Duyệt đề xuất nguồn theo [hợp đồng V25](74-TV2-TV3-SOURCE-EDIT-PROPOSAL-REVIEW.md). Áp dụng tác giả hoặc nhà xuất bản theo [hợp đồng V26](75-TV2-TV3-SOURCE-PROPOSAL-APPLICATION.md). |
| CONTENT-05 | Bảo vệ API quản trị bằng phiên Admin, quyền phù hợp và CSRF cho thao tác ghi. | Đã nghiệm thu 20 tuyến bài hướng dẫn phương pháp và nghĩa tên quẻ. Xem [ma trận quyền](70-TV2-TV3-CONTENT05-CMS-ACCESS-AUDIT.md). |
| CONTENT-06 | Kiểm tra đầu vào ở Server và Client, giới hạn Unicode, lỗi theo trường và lỗi xung đột phiên bản/trạng thái. | Đã nghiệm thu bài hướng dẫn phương pháp và nghĩa tên quẻ. Xem [hợp đồng validation](71-TV2-TV3-CONTENT06-CMS-VALIDATION.md). |

### B. Công việc TV3 – Cơ sở dữ liệu và dữ liệu

1. **CMS-DATA-01 – Lưu nội dung.** Đề xuất định danh và cấu trúc lưu bản nháp, mô tả phương pháp, nội dung giải nghĩa và các khu vực website.
2. **CMS-DATA-02 – Liên kết dữ liệu nguồn.** Bảo toàn định danh nguồn, xuất xứ, trang tham chiếu và trạng thái đối chiếu. Phân biệt dữ liệu nguồn gốc với đề xuất biên tập.
3. **CMS-DATA-03 – Phiên bản và lịch sử.** Chốt cách lưu bản sửa, người sửa và thời điểm. Cung cấp dữ liệu phiên bản để TV2 phát hiện cập nhật cạnh tranh, nhất là với dữ liệu nguồn quan trọng.
4. **CMS-DATA-04 – Trạng thái duyệt.** Chốt cách lưu bản nháp, bản chờ duyệt và bản công bố. Giữ khả năng đọc bản đã công bố trong khi có bản sửa chờ duyệt. Chỉ thêm `REJECTED`/`ARCHIVED` sau khi nhóm xác nhận.
5. **CMS-DATA-05 – Bảo toàn dữ liệu.** Rà soát tác động của migration nếu có lên dữ liệu nguồn, 64 quẻ, Mai Hoa, Tam Thế và lịch sử H01. Đối chiếu trên cơ sở dữ liệu TEST trước nghiệm thu.

### C. Phối hợp và tiêu chí nghiệm thu

- TV2/TV3 chốt hợp đồng lưu và phiên bản, quan hệ nguồn, quyền duyệt và các chuyển trạng thái `DRAFT → PENDING_REVIEW → PUBLISHED`. TV1 đối chiếu dữ liệu hiển thị, lỗi và trạng thái tải/rỗng trên giao diện trước khi kết nối API.
- Nghiệm thu trên localhost bằng tài khoản TEST sau khi Auth Phase 2 sẵn sàng. Kiểm tra danh sách/chi tiết, lọc, tạo/sửa và đọc lại từ cơ sở dữ liệu, ẩn/hiện, dữ liệu không hợp lệ, xung đột phiên bản, `401`/`403` và CSRF. Kiểm tra gửi duyệt/công bố và xác nhận website người dùng chỉ đọc nội dung đã công bố.
- Đối chiếu dữ liệu cũ và chạy regression Client, REST, STOMP, Session/History. Ghi kết quả và mốc commit khi có bằng chứng. Nghiệm thu API quản trị, ghi dữ liệu và duyệt/công bố hiện `BLOCKED`.

<a id="phase-4"></a>
## Phase 4 – Dashboard và quản lý tài khoản

**Trạng thái `PARTIAL – BACKEND PENDING`.** TV1 đã bổ sung giao diện thống kê, tài khoản, tư vấn viên và nhật ký. Backend ở mốc `5f57d0f` có health/readiness công khai và phiên H01 dành cho lịch sử ẩn danh. Cần API quản trị có phân quyền để đọc số liệu hoặc dữ liệu tài khoản. Giao diện hiện ở trạng thái chờ, các bản xem trước trong kiểm thử chỉ minh họa cách hiển thị. Tên trường và vai trò dùng trong giao diện chưa phải hợp đồng truyền dữ liệu.

### API TV2 cần cung cấp hoặc thống nhất

| ID | Phạm vi hợp đồng | Endpoint |
| --- | --- | --- |
| ADM-01 | Tổng số người dùng, lượt tính, phân nhóm theo phương pháp, nội dung chờ duyệt, số tư vấn viên và trạng thái dịch vụ nếu hỗ trợ. Chốt cửa sổ thống kê, cách đếm, múi giờ và phân biệt số 0 với dữ liệu chưa có. | TBD – Chờ TV2 thống nhất |
| ADM-02 | Danh sách và chi tiết tài khoản với định danh, tên hiển thị, vai trò, trạng thái và quyền được phép xem. Chốt các trường tối thiểu và phạm vi dữ liệu theo quyền. | TBD – Chờ TV2 thống nhất |
| ADM-03 | Tìm kiếm, lọc vai trò/trạng thái và phân trang ổn định cho danh sách. Chốt điều kiện tìm, cách sắp xếp, kích thước trang và metadata. | TBD – Chờ TV2 thống nhất |
| ADM-04 | Thay đổi trạng thái tài khoản, khóa/mở khóa nếu được cấp quyền. Chốt hiệu lực với phiên đang hoạt động và phản hồi sau khi cập nhật. | TBD – Chờ TV2 thống nhất |
| ADM-05 | Đọc và thay đổi vai trò `USER`, `ADMIN`, `CONSULTANT` nếu thống nhất. Server quyết định quyền, quy tắc tự đổi vai trò và bảo vệ tài khoản quản trị cuối cùng. | TBD – Chờ TV2 thống nhất |
| ADM-06 | Danh sách, chi tiết và duyệt/từ chối hồ sơ tư vấn viên. Tách trạng thái tài khoản khỏi trạng thái duyệt. Chốt lý do từ chối, tìm kiếm, lọc và phân trang nếu hỗ trợ. | TBD – Chờ TV2 thống nhất |
| ADM-07 | Đọc nhật ký quản trị nếu nhóm thống nhất phạm vi, với thời gian, thao tác, đối tượng và kết quả. Chốt lọc/phân trang, chính sách đọc và dữ liệu cần che. | TBD – Chờ TV2 thống nhất |
| ADM-08 | Bảo vệ toàn bộ API bằng phiên quản trị và quyền theo thao tác. Chốt lỗi `401`/ `403`, CSRF khi ghi, validation và xử lý xung đột cập nhật. | Áp dụng cho mọi API quản trị |

### TV3 và phối hợp nghiệm thu

TV3 rà soát dữ liệu tài khoản theo Phase 2, cách tổng hợp lượt tính, dữ liệu vai trò và trạng thái, hồ sơ tư vấn viên, lưu nhật ký và dữ liệu TEST. TV2/TV3 thống nhất cách ghi thời gian, định danh và trường được phép hiển thị. TV1 chỉ kết nối khi hợp đồng, Auth và dữ liệu TEST sẵn sàng.

Nghiệm thu trên localhost bằng tài khoản TEST. Đối chiếu số liệu với dữ liệu gốc, kiểm tra tìm kiếm/lọc/phân trang, chi tiết và trạng thái sau khi tải lại, duyệt/từ chối tư vấn viên, và nhật ký nếu có. Kiểm tra người thiếu quyền bị từ chối và thao tác ghi cần CSRF. Đối chiếu các luồng H01, Mai Hoa, Tam Thế và Admin Phase 3. Dữ liệu TEST dùng tài khoản tổng hợp, tránh đưa thông tin nhạy cảm vào fixture.

<a id="phase-5"></a>
## Phase 5 – Phương pháp bổ sung

**Trạng thái `PHASE 5 PARTIAL – METHOD/CONTRACT PENDING`.** Danh mục Client đã có, tích hợp phương pháp mới vẫn `BLOCKED`. Góp ý giảng viên đề nghị mở rộng cách tra cứu nhưng chưa nêu tên phương pháp được duyệt. Đối chiếu mốc `101c6ce`, nhật ký quyết định, phạm vi, hợp đồng và các bàn giao hiện có chưa thấy phương pháp bổ sung nào được phê duyệt hoặc có Backend riêng chờ giao diện.

| Phân loại | Kết quả rà soát |
| --- | --- |
| Đã có Client và Backend | Mai Hoa `TIME`, `OBJECT_COUNT`, `LINES` qua `/app/mai-hoa/calculate`. M03 là luận giải mở rộng của các phương pháp này. Tam Thế `CAREER`, `WEALTH`, `LOVE` qua `/app/tam-the/calculate`, với chế độ Tài lộc `LEGACY`/`EXTENDED` đã có. |
| Có Backend nhưng chưa có UI, hoặc đã phê duyệt nhưng chưa có Backend | Chưa tìm thấy phương pháp mới thuộc hai nhóm này trong tài liệu và mã nguồn đã đối chiếu. |
| Công cụ hỗ trợ | REST đổi lịch/Can Chi, thư viện 64 quẻ và H01 lịch sử. H01 hiện lưu và đọc snapshot của `MAI_HOA` và `TAM_THE` theo owner. |

[Phạm vi](01-SCOPE.md) · [Nhật ký quyết định](07-DECISION-LOG.md) · [Hợp đồng v1.2](02-API-CONTRACT.md) · [Bàn giao M03](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md) · [Bàn giao D04](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md)

### Phương án để nhóm xem xét

| Phương án | Phần có thể dùng lại | Phụ thuộc TV2/TV3 |
| --- | --- | --- |
| Hỗ trợ nhập quẻ đã lập bên ngoài qua `LINES` | Biểu mẫu, ba quẻ, tiến trình và lịch sử đang có nếu người dùng cung cấp đúng sáu hào và một hào động. Đây chỉ là hướng dẫn nhập liệu dùng lại thuật toán `LINES` hiện có. | Thấp nếu chỉ hướng dẫn nhập kết quả đã có. Nếu bổ sung nhập kết quả từng lần gieo hoặc tự gieo, TV2/TV3 cần duyệt cách quy đổi, xử lý số hào động và ca chuẩn trước khi chọn hợp đồng. |
| Luồng Lục Hào độc lập | Có thể tái sử dụng hiển thị sáu hào, mã 64 quẻ và transport STOMP sau khi có hợp đồng. | Cao. TV2 cần bộ quy tắc riêng, schema đầu vào/kết quả và xử lý trường hợp hợp đồng một hào động hiện tại không biểu diễn được. TV3 cần nguồn, bảng tra theo phạm vi được duyệt và ca kiểm độc lập. |
| Bát Tự theo tiết khí | Có thể dùng lại phần nhập ngày giờ và cách hiển thị nguồn. | Cao. C01 hiện dùng quy ước Can Chi theo lịch âm; TV2/TV3 cần duyệt quy ước tiết khí, dữ liệu mốc và ca sát ranh trước khi chốt đầu vào/kết quả. |

Các phương án trên đang ở mức đề xuất. Thuật toán, mã phương pháp, endpoint và schema mở rộng đều `TBD`. Danh mục public chỉ liên kết đến biểu mẫu hiện có, dùng chung mô tả với trang chủ và danh mục Admin. Giữ nguyên bộ kiểm tra payload, `requestId`, tiến trình, timeout, hành vi reconnect và H01 cho hai tuyến đang chạy.

### Điều kiện tích hợp

- **TV1/TV2/TV3** ghi phương pháp được chọn, nguồn/quy ước, người xác nhận, giới hạn và ca chuẩn vào nhật ký. Nếu có phản hồi cụ thể của giảng viên, đính kèm làm căn cứ.
- **TV2** sau khi phương pháp được chốt mới xác định DTO và runtime validation, đích STOMP hoặc REST, kết quả kèm căn cứ, tiến trình/lỗi, timeout/retry và quyền lưu lịch sử. Nếu mở H01, cần thống nhất cách đọc snapshot cũ và kiểm quyền theo owner.
- **TV3** xác nhận nguồn có thể sử dụng, phiên bản, phạm vi dữ liệu và ca chuẩn độc lập. Nếu mở H01, chốt cấu trúc lưu snapshot, phiên bản và tương thích dữ liệu cũ với TV2. Fixture chỉ dùng cho kiểm thử và không chứa dữ liệu cá nhân thật.
- **TV1** chỉ mở biểu mẫu mới sau khi có thuật toán Backend và hợp đồng đã xác nhận. Nghiệm thu trên localhost với dữ liệu hợp lệ/sai, đối chiếu kết quả, progress, lỗi, timeout, ngắt kết nối và lưu/xem lại nếu hỗ trợ. Chạy hồi quy Mai Hoa, Tam Thế, C01, E02, H01 và Admin Phase 2–4.

<a id="phase-6"></a>
## Phase 6 – Chat trực tiếp với tư vấn viên

**Trạng thái kỹ thuật `PASS_LOCAL_TEST`.** `/tu-van` và `/tu-van-vien` đã được nghiệm thu qua Next.js, Backend và PostgreSQL TEST V33. Nhóm còn bước xác nhận bàn giao. [Biên bản PH6-PH-01](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#ph6-ph-01)

Bảng dưới ghi lại mốc lịch sử trước khi triển khai Phase 6.

| Hạ tầng | Hiện trạng ở `b2e1f5d` | Phụ thuộc còn thiếu |
| --- | --- | --- |
| STOMP tính quẻ | Server cho phép hai đích SEND Mai Hoa/Tam Thế và ba hàng đợi riêng cho kết quả, lỗi, tiến trình tính quẻ. | Chat cần đích và chính sách xác thực riêng. Giữ nguyên các đích tính quẻ. |
| Phiên H01 | Cookie chủ sở hữu ẩn danh, ràng buộc với lịch sử và CSRF của H01. | Chốt mô hình đăng nhập hoặc khách được cấp phiên chat riêng và cách Server xác thực vai trò. |
| Auth/Chat | Chưa có hợp đồng hay triển khai tài khoản `USER`/`CONSULTANT`, danh bạ tư vấn viên, phòng chat, lịch sử tin hoặc đích STOMP chat trong mã đã rà soát. | TV2 xác nhận quyền vào phòng và hợp đồng. TV3 cung cấp dữ liệu theo quyết định được duyệt. |

[Hợp đồng v1.2](02-API-CONTRACT.md) · [Phiên H01](34-H01-SESSION-HISTORY-HANDOFF.md)

### Hợp đồng cần thống nhất với TV2

Các dòng `TBD` chờ xác nhận hợp đồng. REST phân biệt thiếu hoặc hết phiên (`401`) với thiếu quyền (`403`). Các task STOMP cần trả lỗi theo phạm vi phiên và quyền phòng.

| ID | Chức năng | Method / đích | Request cần chốt | Response cần chốt | Quyền và lỗi cần chốt | Định danh cần chốt | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Danh sách tư vấn viên | `GET /api/v1/chat/consultants` | `page`, `size` | Trang hồ sơ đủ điều kiện với ba trường công bố | Phiên CUSTOMER vai trò USER. HTTP 400/401/403/503 | Consultant UUID | [Hợp đồng C1/C2](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-01) |
| C2 | Chi tiết tư vấn viên | `GET /api/v1/chat/consultants/{consultantId}` | Consultant UUID | `consultantId`, `displayName`, `summary` | Quyền như C1. HTTP 404 chung cho hồ sơ vắng mặt hoặc ẩn | Consultant UUID | [Hợp đồng C1/C2](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-01) |
| C3 | Tạo yêu cầu tư vấn | `POST /api/v1/chat/conversations` | `requestId`, `consultantId` | Hội thoại mới `201`, gửi lại trả phòng cũ `200` | USER, Origin và CSRF. Cùng UUID yêu cầu cho tư vấn viên khác trả `409`. | UUID yêu cầu của Client và UUID phòng của Server | [Hợp đồng C3–C5](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-02) |
| C4 | Danh sách hội thoại được phép xem | `GET /api/v1/chat/conversations` | `page`, `size` | Trang hội thoại thuộc tài khoản hoặc được phân | Lọc theo phiên, vai trò và vị trí tham gia trong truy vấn | Conversation UUID | [Hợp đồng C3–C5](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-02) |
| C5 | Chi tiết cuộc trò chuyện | `GET /api/v1/chat/conversations/{conversationId}` | Conversation UUID | Người tham gia và trạng thái vòng đời | `404` chung cho phòng vắng mặt hoặc ngoài quyền | Conversation UUID | [Hợp đồng C3–C5](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-02) |
| C6 | Chấp nhận hoặc từ chối | `POST /api/v1/chat/conversations/{conversationId}/transition` | `action=ACCEPT` hoặc `DECLINE` trong JSON | Trạng thái và thời điểm sau xử lý | CONSULTANT được phân, Origin và CSRF. Xung đột trạng thái trả `409`. | Conversation UUID | [Hợp đồng C6/C9](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-06) |
| C7 | Gửi và nhận tin nhắn | WebSocket `/api/v1/ws/chat`. Đích SEND/SUBSCRIBE trong CHAT-05 | `clientMessageId`, `text` | ACK sau commit, MESSAGE riêng tới người còn lại, ERROR riêng về bên gửi | Kiểm phiên và quyền phòng ở SEND, SUBSCRIBE và trước khi giao dữ liệu | Conversation ID, client message ID, server message ID, sequence | [Hợp đồng C7](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-03). Client đã nối ở CHAT-08. |
| C8 | Đọc lịch sử tin nhắn | `GET /api/v1/chat/conversations/{conversationId}/messages` | `afterSequence`, `size` | `items`, `nextAfterSequence`, `hasMore` | Kiểm phiên, quyền phòng và thời hạn lưu. Ngoài phòng cùng lỗi 404 với phòng không tồn tại | Conversation ID, message ID, cursor dạng chuỗi | [Hợp đồng C8](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-07). Client đã nối ở CHAT-08. |
| C9 | Hủy yêu cầu hoặc kết thúc hội thoại | `POST /api/v1/chat/conversations/{conversationId}/transition` | `action=CANCEL` hoặc `END` trong JSON | Trạng thái sau xử lý và quyền đọc lại qua C5 | USER được hủy khi chờ. Hai người tham gia được kết thúc khi đang tư vấn. Origin và CSRF. | Conversation UUID | [Hợp đồng C6/C9](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-06) |
| C10 | Kiểm tra phiên và quyền | `GET /api/v1/auth/chat/session` | Cookie phiên CUSTOMER | `accountId`, `role`, `expiresAt` | Kiểm USER/CONSULTANT, hồ sơ đã duyệt, Origin và hiệu lực phiên | Account UUID | [REST C10 và chính sách STOMP](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md) |

Khi mất kết nối, Client giữ bản nháp và báo nếu chưa nhận ACK. Khi kết nối lại, Client xác minh phiên, đăng ký hàng đợi, đọc bù qua C8 và loại trùng theo mã tin Server. Người dùng có thể chủ động gửi lại cùng mã và nội dung. [Luồng và nghiệm thu CHAT-08](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-08)

### Điều kiện nghiệm thu phối hợp

Chuẩn bị hai tài khoản TEST trên localhost gồm một USER và một CONSULTANT. Kiểm tra tạo yêu cầu, phân công/chấp nhận nếu hỗ trợ, mở phòng, gửi hai chiều và nhận ACK, đọc lịch sử, kết thúc và kết nối lại. Dùng tài khoản hoặc phòng ngoài quyền để thử từ chối REST và SUBSCRIBE/SEND. Đối chiếu mất mạng giữa lúc gửi để kiểm tra tin đến muộn, trùng, chưa rõ ACK và phiên hết hạn. Chạy hồi quy Mai Hoa, Tam Thế, H01 và Admin. Chỉ ghi live PASS sau khi có bằng chứng từ Server thật.

<a id="phase-7"></a>
## Phase 7 – Integration Readiness

**`PHASE 7A PARTIAL – DEPENDENCIES PENDING`.** Audit ngày 07/11/2026 trên `bmanh812`, mốc `05b4909`. Bằng chứng 8E/8F dưới đây thuộc lượt nghiệm thu trước của kế hoạch gốc. Lượt 7A đánh giá lại mã nguồn hiện tại và tách riêng kết quả Client với kết quả live.

### Môi trường và hợp đồng đã đối chiếu

| Lớp | Có trong mã nguồn | Kiểm tra hiện tại |
| --- | --- | --- |
| Client | Next.js, proxy REST cùng origin cho E02/C01/H01 và cấu hình URL STOMP riêng. UI Admin/chat Phase 2–6 hiện có trạng thái chờ. | Kiểm thử desktop cách ly với yêu cầu mạng được chặn hoặc thay bằng fixture. |
| Backend | Spring Boot 3.5.16, Java 17 là mức target của project. GET `/api/v1/health` và `/api/v1/readiness`. Profile Maven `database`, Spring `db` và datasource từ cấu hình môi trường. | Cả hai GET tại `127.0.0.1:8080` trả lỗi kết nối curl 7, HTTP `000`. Readiness chưa xác minh. |
| PostgreSQL | Migration trong repo đến V12, gồm V11 cho H01 và V12 cho dữ liệu luận giải. Lượt 8E/8F trước đã chạy trên `huyenco_test_tv1`. | Dịch vụ `postgresql-x64-16` báo Running. Kết nối đến database TEST, schema, seed và phiên bản Flyway hiện tại `NOT TESTED`. |
| REST | E02 GET `/api/v1/hexagrams` và `/{code}`. C01 POST `/api/v1/calendar/convert` và `/api/v1/calendar/can-chi`. H01 POST `/api/v1/session`, GET/POST `/api/v1/history`, GET/DELETE `/api/v1/history/{id}`. | REST nghiệp vụ và H01 `NOT RUN` do Backend chưa nghe cổng kiểm tra. |
| WebSocket/STOMP | Handshake `/ws`, SEND `/app/mai-hoa/calculate` hoặc `/app/tam-the/calculate`. SUBSCRIBE `/user/queue/results`, `/user/queue/errors`, `/user/queue/progress`. Spring kiểm các đích này ở inbound interceptor. | Không có REST tính Mai Hoa/Tam Thế trong contract hiện tại. Progress, result, error, timeout và reconnect live `NOT RUN` ở lượt 7A. |
| Session và quyền | H01 xác định owner ẩn danh từ cookie `huyenco_session`. Server kiểm owner, Origin/CSRF và custom header theo contract. H01 trả `401 INVALID_SESSION`, `403 CSRF_REJECTED` và `404 NOT_FOUND` khi truy cập bản ghi ngoài owner. | Kiểm H01 live, gồm save/read/delete và ca lỗi, `NOT RUN` trong lượt này. H01 chỉ cấp quyền trong phạm vi lịch sử ẩn danh. |
| Tài khoản, Admin và chat | Mã Backend tại mốc audit chưa có đăng nhập/đọc phiên/đăng xuất tài khoản, kiểm vai trò ADMIN/CONSULTANT, CRUD quản trị, thống kê, quản lý tư vấn viên hoặc chat REST/STOMP. | `BLOCKED`. Các route chat giữ khóa và bỏ qua bootstrap H01. |

[Contract v1.2](02-API-CONTRACT.md) · [Cấu hình localhost TEST](https://github.com/trong-crypto/Huy-n-c-/blob/50cba56a19d6e90be5f3aef01a4e67b91c8da92d/docs/35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md) · [Bằng chứng live 8E/8F](44-TV1-PHASE8A-ACCEPTANCE.md) · [Ca chuẩn D01–D12](45-TV1-DEMO-SCRIPT.md)

### Ma trận tích hợp 13 module

`VERIFIED LIVE` ghi bằng chứng đã có ở 8E/8F trong phạm vi ca nêu rõ. Cột kiểm thử 7A cho biết lần này đã chạy gì. `READY FOR INTEGRATION` áp dụng cho giao diện độc lập đã sẵn sàng. `PARTIAL` ghi phần dùng được và phần chờ. `BLOCKED` chỉ phụ thuộc chưa đáp ứng. `NOT TESTED` dùng cho điều kiện chưa kiểm chứng. Fixture và UI smoke không thay bằng chứng Backend thật.

| # | Module | Frontend | API Backend và DB | Xác thực / phân quyền | Dữ liệu TEST | Trạng thái và kiểm thử 7A | Phụ trách và điều kiện nghiệm thu |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Trang chủ và điều hướng | Trang chủ, danh mục phương pháp, các liên kết public | UI độc lập với dữ liệu nghiệp vụ. Shell có bootstrap H01 ở các trang public cũ | Không cần tài khoản để xem trang | Không cần DB để kiểm UI | `READY FOR INTEGRATION`. Desktop UI smoke | TV1 kiểm liên kết, route active và bố cục desktop |
| 2 | Mai Hoa | Form TIME, OBJECT_COUNT, LINES, tiến trình, ba quẻ, luận chi tiết | STOMP thật. Kho quy tắc, lịch và dữ liệu M03/V12 trong repo | Phiên socket để định tuyến. Cookie H01 cần khi lưu kết quả | Fixture D01–D05. DB TEST từng dùng ở 8F | `VERIFIED LIVE` 8F cho ca chuẩn và M03 đại diện. 7A live `NOT RUN` | TV1/TV2 kiểm progress, terminal và lỗi theo requestId. TV3 xác nhận seed/rule |
| 3 | Tam Thế | Form ngày giờ sinh, category và Tài lộc mở rộng | STOMP thật. Bảng D03/D04 và V12 trong repo | Phiên socket để định tuyến. Cookie H01 cần khi lưu | Fixture D06. DB TEST từng dùng ở 8F | `VERIFIED LIVE` 8F cho D04 đại diện. 7A live `NOT RUN` | TV1/TV2 kiểm LEGACY/EXTENDED theo ca đã chốt. TV3 kiểm dữ liệu và no-match nguồn |
| 4 | Tra cứu 64 quẻ | Danh sách, tìm/lọc, phân trang và chi tiết | REST E02 thật. Kho quẻ, hào và nghĩa tên trong schema | Đọc công khai, không yêu cầu tài khoản | Bộ 64 quẻ từng kiểm ở 8F, có fixture | `VERIFIED LIVE` 8F đủ 64 mã và chi tiết đại diện. 7A fixture, live `NOT RUN` | TV3 xác nhận seed, TV2/TV1 đối chiếu 64 mã và ca tìm/lọc |
| 5 | Lịch/Can Chi | Đổi lịch hai chiều và tra Can Chi | REST C01 thật. Bảng lịch/nguồn và quy tắc C01/V8 | Công khai, không yêu cầu tài khoản | Fixture D08/D09, DB TEST từng dùng ở 8F | `VERIFIED LIVE` 8F cho round-trip, Can Chi có/không giờ. 7A live `NOT RUN` | TV2/TV3 kiểm quy ước UTC+7 và ca biên, TV1 kiểm form/response |
| 6 | Lịch sử H01 | Lưu, danh sách/tìm kiếm, chi tiết, xóa | REST H01 thật, V11 phiên ẩn danh và snapshot lịch sử | Cookie owner, kiểm quyền theo bản ghi, CSRF khi ghi/xóa | Hai owner TEST đã dùng ở 8E. Lượt mới cần dữ liệu do lượt test tạo | `VERIFIED LIVE` 8E cho hai owner, save/read/delete, CSRF và từ chối chéo. 7A live `NOT RUN` | TV1/TV2 kiểm lại 401/403/404, tạo và dọn đúng bản ghi test. TV3 xác nhận TEST và dataset nhiều trang |
| 7 | Admin Login/Logout | Trang login, validation, phiên và logout chờ tích hợp | API phiên tài khoản và dữ liệu xác thực chưa có | Phiên tài khoản, role ADMIN và CSRF | Chưa xác nhận tài khoản ADMIN TEST | `BLOCKED` | TV2 AUTH-01–06, TV3 DATA-01–05. Kiểm đúng/sai thông tin, hết phiên, logout và quyền |
| 8 | Quản lý nội dung | Form và preview. Đọc quẻ công khai để đối chiếu | E02 có thật ở phần đọc quẻ. CRUD, trạng thái và công bố thiếu API, lưu trữ và versioning | ADMIN/CSRF cho quản trị | Có fixture quẻ. Chưa có dữ liệu nội dung quản trị TEST | `PARTIAL` cho giao diện và đọc quẻ. CRUD/duyệt `BLOCKED` | TV2 CONTENT-01–06, TV3 CMS-DATA-01–05. Tạo/sửa/đọc lại và duyệt/công bố trên TEST |
| 9 | Admin Dashboard | Thẻ chỉ số, bảng và trạng thái chờ dữ liệu | Chưa có API hoặc dữ liệu thống kê Admin đã chốt | ADMIN theo quyền thống kê | Chỉ có dữ liệu tổng hợp trong test UI | `BLOCKED` | TV2 ADM-01, TV3 ADM-DATA-02. Đối chiếu tổng, phân nhóm và ranh giới số 0/thiếu dữ liệu |
| 10 | Người dùng và phân quyền | Danh sách/chi tiết, bộ lọc, preview đề xuất | Chưa có API tài khoản/role và dữ liệu thực tương ứng | ADMIN theo quyền đọc/đổi trạng thái/role và CSRF | Chưa xác nhận tài khoản TEST theo role | `BLOCKED` | TV2 ADM-02–05/08, TV3 ADM-DATA-01/03/06. Kiểm role, phân trang và cập nhật có lưu |
| 11 | Quản lý tư vấn viên | Hồ sơ, bộ lọc, preview duyệt/từ chối | Chưa có API danh sách, duyệt hoặc dữ liệu hồ sơ | ADMIN cho quản lý. CONSULTANT là vai trò riêng | Chưa xác nhận hồ sơ/tài khoản TEST | `BLOCKED` | TV2 ADM-06, TV3 ADM-DATA-04/06. Kiểm trạng thái tài khoản và duyệt độc lập |
| 12 | Chat 1:1 | Hai route riêng, composer khóa, trạng thái phòng/kết nối | REST C1/C2/C10 sẵn sàng cho tích hợp danh bạ. Phòng, tin nhắn và STOMP còn chờ | Quyền từng phòng và quan hệ thành viên | Chưa xác nhận hai tài khoản trao đổi qua một phòng | `BLOCKED` cho nghiệm thu Chat 1:1 | Kiểm hai chiều, ACK, lịch sử, ngoài quyền, kết thúc và reconnect |
| 13 | Phương pháp bói mới | Danh mục dùng chung cho các phương pháp hiện có | Quy tắc, API/STOMP, dữ liệu và H01 cho phương pháp mới đều TBD | Quyền theo hợp đồng tương lai | Chưa có ca chuẩn của phương pháp được duyệt | `BLOCKED` cho tích hợp phương pháp mới | Cả nhóm chốt phương pháp và nguồn. TV2/TV3 bàn giao hợp đồng và ca chuẩn trước khi TV1 tích hợp |

**Giới hạn của bằng chứng cũ.** 8F có progress, kết quả và hai phiên cách ly. Fault injection live cho timeout, mất mạng, reconnect và terminal đến muộn/trùng vẫn chờ kiểm. 8E xác nhận CSRF 403 và đọc/xóa chéo owner 404 trong phạm vi ca đã chạy. Bộ nghiệm thu Client vẫn cần ca 401, hết phiên và phân trang lịch sử nhiều trang. Lượt 7A không tạo phiên, ghi hoặc xóa dữ liệu TEST.

### Kết quả kiểm thử Phase 7A

| Loại | Kết quả |
| --- | --- |
| Kiểm tra tĩnh và build | TypeScript, production build cách ly và `git diff --check` đạt. |
| Unit, component và fixture | Vitest 1.361/1.361, calculation 12/12 và contract fixtures 62/62 đạt. Ca lỗi, timeout, reconnect và cách ly phòng trong bộ kiểm Client là bằng chứng mock hoặc component. |
| Desktop localhost | Chromium 1280, 1440 và 1920 px đạt smoke. Kiểm điều hướng public và Admin, tra quẻ qua fixture và hai trang chat giữ khóa, không gọi API/WS. |
| Live 7A | `NOT RUN` cho các ca REST/STOMP nghiệp vụ và H01 do không kết nối được Backend ở cổng 8080. Auth/Admin/chat và phương pháp mới giữ các phụ thuộc `BLOCKED` trong ma trận. |

### Rà soát hạ tầng Client

- REST kiểm envelope và DTO lúc nhận, gắn timeout, abort khi hủy và bỏ kết quả cũ. Mặc định API công khai không kèm cookie. H01 dùng same-origin, CSRF cho thao tác ghi và không tự retry ghi.
- STOMP tính quẻ có timeout kết nối và timeout tổng cho từng yêu cầu. Client giữ một request đang chờ, lọc theo socket/generation, requestId và type, xử lý progress đúng thứ tự. Ngắt kết nối giải phóng request, unmount hủy subscription/socket, reconnect thiết lập lại subscription mà không tự gửi lại yêu cầu.
- H01 bootstrap và theo dõi hạn của phiên owner. Khi gặp lỗi phiên/CSRF, Client vô hiệu hóa trạng thái tương ứng. Chat chưa có adapter mạng. UI chỉ kiểm subscription nội bộ, lọc roomId, loại tin trùng và hủy khi mất kết nối hoặc đổi phòng.
- Các route nghiệp vụ cũ và hợp đồng hiện tại được giữ nguyên. Chưa có lỗi Client được xác nhận cần sửa trong audit này.

### Ưu tiên TV2 và TV3

| Ưu tiên | TV2 | TV3 | Điều kiện chuyển bước |
| --- | --- | --- | --- |
| P0 | Bàn giao Backend TEST, bằng chứng datasource/readiness và hợp đồng login/session/logout, role, cookie, Origin/CSRF. Chốt mô hình Auth chat riêng. | Xác nhận DB TEST tách biệt, schema/seed đúng, tài khoản ADMIN/USER/CONSULTANT và ca thiếu quyền sau khi thống nhất mô hình. | Chạy được hồi quy lõi. Phiên, quyền và lỗi 401/403 được kiểm trước mọi API ghi quản trị hoặc chat. |
| P1 | Cung cấp CRUD/duyệt nội dung, tài khoản, hồ sơ tư vấn viên và Chat REST/STOMP có quyền từng phòng, ACK và reconnect. | Chốt schema nội dung, hồ sơ và hội thoại. Cung cấp fixtures, snapshot, versioning và dữ liệu TEST phù hợp. | Tích hợp theo hợp đồng đã xác nhận, có ca đọc lại từ DB và kiểm từ chối ngoài quyền. |
| P2 | Bàn giao thống kê nâng cao, nhật ký và API phương pháp mới khi được duyệt. | Chốt nguồn số liệu, lưu nhật ký và quy tắc/dữ liệu phương pháp mới. | Cần quyết định phạm vi, dữ liệu tham chiếu và ca chuẩn. |

Kiểm tra lại các luồng lõi song song với việc chốt P0 khi Backend TEST đã sẵn sàng, vì chúng dùng contract v1.2/H01 hiện hữu. Admin/chat vẫn phụ thuộc Auth tài khoản và quyền riêng, nên chỉ tích hợp sau cổng P0.

### Kịch bản nghiệm thu Phase 7B

1. **Preflight TEST.** Ghi SHA Client/Backend, PID/port, datasource TEST, phiên bản schema và seed, Origin, Flyway tắt, GET health và readiness đều HTTP 200 với readiness `READY`. Dừng trước thao tác ghi nếu chưa xác minh môi trường.
2. **Luồng lõi.** Chạy D01–D09. Mai Hoa TIME/OBJECT_COUNT/LINES và Tam Thế gửi STOMP, kiểm requestId/type, progress và terminal, cùng ít nhất một lỗi nghiệp vụ. Tra quẻ qua đủ các trang, tìm/lọc/chi tiết. Đổi lịch hai chiều và kiểm Can Chi có/không giờ.
3. **H01 hai owner TEST.** Dùng hai context riêng. Tạo phiên, tính, lưu, đọc/list và kiểm lỗi 401/403, ngoài owner 404. Nếu được xác nhận phạm vi TEST, xóa đúng ID do lượt đó tạo, đối chiếu 404 sau xóa và ghi bằng chứng cleanup. Kiểm phân trang khi có dataset được duyệt.
4. **Lỗi mạng có kiểm soát.** Dùng context TEST riêng để tái hiện timeout, mất kết nối và reconnect. Đối chiếu không tự SEND lại, tin cũ không làm thay đổi kết quả mới và hai context cách ly. Ghi riêng ca lỗi nào mới chạy ở mock.
5. **Admin và chat khi có hợp đồng.** Sau khi P0 đạt, kiểm login, phiên, logout và role/CSRF trước Admin CRUD, dashboard và tư vấn viên. Dùng USER/CONSULTANT TEST để kiểm chat hai chiều, ACK/chống trùng, reconnect/lịch sử, kết thúc và từ chối REST/SEND/SUBSCRIBE ngoài phòng.
6. **Ghi kết quả.** Lưu ca, SHA, môi trường, kỳ vọng, kết quả và loại bằng chứng. Giữ `BLOCKED`/`NOT RUN` cho phần chưa đủ điều kiện. Che cookie, token và dữ liệu hội thoại trong bằng chứng.

<a id="phase-7b"></a>
### Phase 7B – Môi trường TEST và kiểm thử live

**`PHASE 7B BLOCKED – TEST ENVIRONMENT UNAVAILABLE`** · 07/11/2026 · nhánh `bmanh812`, mốc `d09b509`. PostgreSQL tiếp nhận kết nối ở cổng 5432. Cổng xác thực database TEST chưa đạt, nên lượt này dừng trước khởi động Backend và các ca nghiệp vụ live.

| Hạng mục | Bằng chứng 7B | Kết luận và xử lý |
| --- | --- | --- |
| Spring Boot và cổng | Không thấy tiến trình `java.exe`/`javaw.exe` hay listener 8080 ở thời điểm kiểm tra. GET `/api/v1/health` và `/api/v1/readiness` tại `127.0.0.1:8080` đều báo curl 7 và mã `000` do curl in khi không nhận HTTP response. | Backend chưa chạy tại thời điểm kiểm tra. Không có HTTP response để kết luận lỗi readiness. TV1/TV2 chỉ khởi động Backend TEST sau khi qua cổng DB. |
| Java, Maven và log | Java theo PATH là JDK 8. JDK 25.0.1 có sẵn và `mvnw.cmd -v` xác nhận Maven Wrapper 3.9.16 chạy bằng JDK 25. Log V12 lưu trữ ghi nhận một lượt khởi động thành công trước đây. Chưa có log startup mới gắn với lượt 7B. | Dùng `JAVA_HOME` riêng trong tiến trình khởi động. JDK 8 là rủi ro cấu hình khi chạy bằng mặc định, chưa có bằng chứng đó là nguyên nhân dừng lần trước. |
| Profile và datasource | Repo dùng Maven profile `database`, Spring profile `db`, các biến `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`. Phiên kiểm tra chưa có cấu hình datasource hiệu lực cho một Backend đang chạy. `application-db.yml` mặc định bật Flyway. | TV1/TV2 ghim JDBC URL và role TEST đã xác minh, tắt Flyway bằng `SPRING_FLYWAY_ENABLED=false` và `--spring.flyway.enabled=false`. Không suy từ config nguồn rằng một JVM đang dùng đúng datasource. |
| PostgreSQL TEST | PostgreSQL 16 đang Running, `pg_isready` tại `127.0.0.1:5432` trả `accepting connections`, exit 0. Một kết nối `psql -w` chỉ đọc đến `huyenco_test_tv1` với `huyenco_tv1_test` trả exit 2, `fe_sendauth: no password supplied`. | PostgreSQL đã trả yêu cầu xác thực. Chưa có mật khẩu được cung cấp cho tiến trình nên chưa xác minh đăng nhập, database đích, owner/quyền, schema, Flyway V1–V12 và seed/H01. Không có bằng chứng mật khẩu sai hay database/role không tồn tại. |
| Cấu hình Client | Kiểm tên và đích cấu hình runtime local. REST dùng proxy cùng origin `/api/v1` đến localhost cổng 8080 và STOMP trỏ localhost cổng 8080 với path `/ws`. | Chưa thấy lệch đích trong cấu hình local đã rà. Kiểm Origin thực tế và WebSocket handshake sau khi Backend khởi động. |
| API TV2/TV3 | Đầu nhánh GitHub `main` ở `94bfbee`. So sánh Backend và dữ liệu giữa mốc đó với nhánh TV1 không có khác biệt. Kiểm các nhánh đã công bố và mã nguồn tại mốc 7B. | Chưa xác nhận triển khai hoặc hợp đồng mới cho xác thực tài khoản, Admin hay chat. Giữ nguyên các đầu việc Phase 2–6 và các điều kiện tích hợp tương ứng. |

### Kết quả live 7B

| Nhóm ca | Trạng thái | Phạm vi còn chờ |
| --- | --- | --- |
| Health / readiness | **FAIL ở kết nối HTTP** | Hai probe đã thực hiện. Chưa có response HTTP từ Spring Boot và chưa kiểm readiness DB/schema/seed. |
| REST tra quẻ, lịch và Can Chi | `NOT RUN` | Chờ Backend TEST đạt readiness. |
| STOMP Mai Hoa, Tam Thế | `NOT RUN` | Chờ handshake, ca TIME/OBJECT_COUNT/LINES, luận đại diện, ba nhóm Tam Thế và EXTENDED, progress/result/error và cách ly request. |
| H01, session, CSRF và quyền owner | `NOT RUN` | Chờ datasource TEST được xác minh. Lượt này chưa tạo phiên hoặc tạo/xóa bản ghi. |
| 401/403/404, timeout, disconnect/reconnect và chống gửi trùng | `NOT RUN` với Backend thật | Chạy trên môi trường TEST riêng. Kết quả Client/mock được ghi riêng. |
| Admin và chat | `BLOCKED` | Thiếu Auth tài khoản, phân quyền Server, API quản trị và Chat REST/STOMP, dữ liệu và tài khoản TEST theo vai trò. |

Lượt 7B chưa có ca **PASS LIVE**. [Bằng chứng 8E/8F ngày 27/10/2026](44-TV1-PHASE8A-ACCEPTANCE.md) vẫn áp dụng trong phạm vi ca lịch sử đã ghi.

### Regression 7B

| Loại | Kết quả |
| --- | --- |
| PASS STATIC | TypeScript, production build trong bản sao cách ly và `git diff --check`. |
| PASS MOCK / component / fixture | Vitest 1.361/1.361, calculation 12/12, contract fixtures 62/62. Timeout, ngắt kết nối, phản hồi muộn và cleanup trong bộ Client giữ phạm vi kiểm thử mô phỏng. |
| PASS LIVE | Chưa có ca ở lượt 7B. |

### Điều kiện mở lại cổng nghiệm thu

1. **TV3 hoặc người quản lý TEST** xác nhận JDBC đích `jdbc:postgresql://127.0.0.1:5432/huyenco_test_tv1` và role `huyenco_tv1_test` còn được cấp quyền cho Phase 7B. Cung cấp cách nhập mật khẩu qua prompt ẩn hoặc nguồn bí mật được duyệt. Tránh gửi mật khẩu trong chat, lệnh, log hoặc Git.
2. **TV1 kiểm chỉ đọc trên đúng TEST.** Dùng `psql -X -W` với host, port, database và role tường minh, `default_transaction_read_only=on`, timeout và `ON_ERROR_STOP`. Xác minh `current_database()`, `current_user`, owner, schema, quyền đọc và các bảng H01/V12. Đối chiếu lịch sử migration V1–V12 và đếm dữ liệu nguồn/seed theo biên bản 38/43, gồm 64 quẻ, 384 hào và bộ V12 1 bundle, 20 mẫu, 19 đoạn, 204 ánh xạ. Chỉ đọc metadata và số đếm cần thiết.
3. **TV1/TV2 khởi động TEST theo hướng dẫn 35** sau khi cổng DB đạt. Dùng JDK 25, Maven `database`, Spring `db`, datasource TEST đã xác minh, Origin `http://127.0.0.1:3173`, bind `127.0.0.1:8080` và tắt Flyway bằng cả môi trường lẫn override CLI. Xác minh PID/listener, health HTTP 200 và readiness HTTP 200 với `READY`, database UP, schema/seed READY trước khi chạy nghiệp vụ.
4. **TV1 chạy kịch bản 7B ở phần 7A.** Kiểm REST/STOMP trước, sau đó H01 hai phiên và lỗi. Chỉ tạo và xóa bản ghi thuộc chính lượt TEST sau khi xác minh datasource và quyền. Tách kết quả live khỏi fixture.
5. **TV2/TV3** bàn giao Auth và dữ liệu TEST theo role trước Admin/chat. Cung cấp SHA, hợp đồng API, cookie/CSRF, quyền theo phòng và quy trình đối chiếu dữ liệu. TV1 chỉ mở các tính năng khi có bằng chứng trên Server thật.

[Hướng dẫn tích hợp](https://github.com/trong-crypto/Huy-n-c-/blob/50cba56a19d6e90be5f3aef01a4e67b91c8da92d/docs/35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md) · [Dữ liệu V12](38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md) · [Biên bản V12](43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md)

<a id="final-tv1-handoff"></a>
## Bàn giao cuối từ TV1 đến TV2 và TV3

Kho mã `trong-crypto/Huy-n-c-` · nhánh `bmanh812` · commit nền trước lượt bàn giao `8e064c6749a4fc30b4a3d0652ff28f992e5c64eb`. Tại thời điểm audit, `origin/main` ở `94bfbee`, nhánh TV1 trước 9 commit, sau 0 commit và khác 45 file. Mốc bàn giao Phase 8A là commit chứa mục này trên nhánh TV1. Sau khi fetch, dùng `git rev-parse origin/bmanh812` để lấy SHA của đầu nhánh. [Nhánh bàn giao bmanh812](https://github.com/trong-crypto/Huy-n-c-/tree/bmanh812)

| Phase | Phạm vi TV1 đã bàn giao | Phần tiếp theo |
| --- | --- | --- |
| 1 · `8f2a525` | `COMPLETE` cho website người dùng desktop, điều hướng và 404. | Kiểm hồi quy UI ở lần tích hợp kế tiếp. |
| 2 · `13cc086` | Form đăng nhập, dashboard cơ bản và khung Admin. | Auth tài khoản và quyền ADMIN còn chờ TV2/TV3. |
| 3 · `5f57d0f` | Quản lý phương pháp, quẻ/giải nghĩa, dữ liệu nguồn, nội dung website và preview duyệt. Đọc dữ liệu quẻ công khai qua E02. | CRUD, lưu bản nháp và công bố đang chờ Backend. |
| 4 · `101c6ce` | Dashboard, người dùng/role, tư vấn viên và nhật ký ở mức giao diện. | API, quyền và dữ liệu quản trị thật đang chờ TV2/TV3. |
| 5 · `b2e1f5d` | Danh mục phương pháp dùng chung ở `/phuong-phap`. | Phương pháp mới, nguồn và hợp đồng chờ nhóm chốt. |
| 6 · `05b4909` | Hai trang chat `/tu-van`, `/tu-van-vien` và kiểm thử trạng thái nội bộ. | Auth/Chat Backend, quyền theo phòng và gửi/nhận thật còn chờ. |
| 7A · `d09b509` | Đã bàn giao audit 13 module và kế hoạch tích hợp. | Các ca live 7A là `NOT RUN`. |
| 7B · `8e064c6` | Đã bàn giao kiểm toán môi trường. | `BLOCKED – TEST ENVIRONMENT UNAVAILABLE`. Backend cổng 8080 chưa phản hồi và lần thử PostgreSQL thiếu mật khẩu TEST. |

Backend cũ có STOMP Mai Hoa/Tam Thế và REST tra quẻ, lịch/Can Chi, phiên và lịch sử H01 theo hợp đồng v1.2. Bằng chứng live 8E/8F của kế hoạch gốc giữ phạm vi trong [biên bản nghiệm thu trước](44-TV1-PHASE8A-ACCEPTANCE.md). Các API tài khoản, quản trị và chat của đợt nâng cấp vẫn chờ bàn giao.

### Thứ tự TV2 và TV3 thực hiện

| Ưu tiên | TV2 – Backend và hợp đồng | TV3 – Database và dữ liệu | Bằng chứng cần trước khi TV1 tích hợp |
| --- | --- | --- | --- |
| P0 · Môi trường TEST | Xác nhận hướng dẫn chạy, JDK, Maven/Spring profile, health/readiness, REST, STOMP và Origin. Phối hợp ghim datasource TEST và tắt Flyway cho lần kiểm trên schema đã có. | Xác nhận host/port/database, JDBC URL, role/quyền và nguồn cấp mật khẩu qua prompt ẩn. Đối chiếu V1–V12, seed và nguồn đã duyệt, xác nhận dữ liệu TEST tách biệt. Chuẩn bị backup và quy trình kiểm soát migration cho các thay đổi tương lai. | Kiểm chỉ đọc đúng DB/role, schema/seed đúng, health 200 và readiness 200/READY. Tham chiếu INT-01 và mục 7B. |
| P0 · Auth tài khoản | Triển khai đăng ký USER, login, đọc phiên, logout và phân quyền ADMIN/USER/CONSULTANT. Chốt cookie, CSRF/Origin, hết phiên, 401/403 và quyền từng API. Tách Auth khỏi H01. Chốt chính sách đăng nhập/khách cho chat. | Chốt tài khoản, role, quan hệ account-session và dữ liệu xác thực theo thiết kế. Cấp tài khoản TEST ADMIN/USER/CONSULTANT và ca thiếu quyền. Bảo toàn dữ liệu và owner H01. | AUTH-01–07, DATA-01–05, CHAT-04. Kiểm đăng ký USER, đúng/sai role, hết phiên, logout và từ chối CSRF. |
| P1 · Admin Content | API quản lý phương pháp, quẻ/giải nghĩa, nguồn, nội dung website và bản nháp. Chốt duyệt/công bố, đổi trạng thái, validation, versioning và quyền theo thao tác. | Lưu bản nháp/bản công bố, liên kết nguồn, phiên bản, lịch sử sửa, trạng thái duyệt và ca đối chiếu TEST. | CONTENT-01–06 và CMS-DATA-01–05. Ghi, đọc lại đúng phiên bản và chỉ phát nội dung đã công bố. |
| P1 · Dashboard, người dùng và tư vấn viên | API chỉ số cơ bản, danh sách/chi tiết tài khoản, tìm/lọc/phân trang, trạng thái và role. API hồ sơ, duyệt tư vấn viên. Nhật ký và chỉ số nâng cao khi phạm vi được chốt. | Cung cấp số liệu đối chiếu, hồ sơ và trạng thái duyệt, dataset tìm kiếm/phân trang, dữ liệu nhật ký nếu được chốt. | ADM-01–08 và ADM-DATA-01–06. Kiểm số liệu, truy cập theo role và cập nhật có lưu. |
| P1 · Chat | Danh sách/hồ sơ tư vấn viên, tạo/đọc/kết thúc hội thoại, REST lịch sử, STOMP hai chiều. Kiểm quyền từng phòng tại REST/SEND/SUBSCRIBE. Chốt ACK nghiệp vụ, định danh chống trùng, reconnect và cách đọc phần tin còn thiếu. | Lưu conversation, message, người tham gia, trạng thái, định danh và thứ tự tin, lịch sử và thời hạn lưu. Chuẩn bị hai tài khoản TEST và ca ngoài quyền. | CHAT-01–09 và CHAT-DATA-01–07. Hai chiều, quyền, ACK, chống trùng, lịch sử, kết thúc và kết nối lại đạt trên TEST. |
| P2 · Phương pháp bổ sung | Chỉ triển khai sau khi nhóm duyệt phương pháp, thuật toán, API, quy tắc lỗi/tiến trình và H01 nếu hỗ trợ. | Chỉ chuẩn bị nguồn, phiên bản, dữ liệu và ca chuẩn sau quyết định phạm vi. | METHOD-01 và METHOD-DATA-01. Hướng dẫn nhập quẻ qua LINES dùng lại thuật toán hiện có. |

TV1 có thể chạy lại các luồng lõi khi môi trường TEST đạt. Việc mở Admin và chat phụ thuộc Auth, hợp đồng và dữ liệu của từng module. Các endpoint còn `TBD` và công việc `BLOCKED`/`TODO` giữ nguyên ở các bảng Phase 2–7.

### Gói TV2/TV3 bàn giao lại

Với từng module, ghi ngay trong file này hoặc liên kết đến bằng chứng kỹ thuật ở đúng mục.

1. Nhánh, commit SHA và phạm vi Backend/Database đã triển khai.
2. HTTP method, endpoint hoặc STOMP destination, kèm request DTO và response DTO thực tế.
3. Xác thực, quyền theo thao tác, cookie/CSRF/Origin, mã lỗi và điều kiện kết nối lại nếu có.
4. Migration nếu có, seed, dữ liệu TEST và cách cấp quyền truy cập an toàn.
5. Hướng dẫn khởi động localhost, kết quả kiểm thử thật, giới hạn và điều kiện TV1 cần biết khi tích hợp.

Chỉ đổi thành `READY FOR TV1` khi có đủ hợp đồng, mã và bằng chứng chạy. `DONE` cần kết quả nghiệm thu theo tiêu chí của module.

<a id="phase-8"></a>
## Phase 8 – Kiểm thử và nghiệm thu cuối

### Phase 8A – Frontend, kiểm tĩnh và mock

**`COMPLETE` trong phạm vi Frontend/Static/Mock** · 07/11/2026. Đã rà soát các route người dùng, Admin và chat từ Phase 1–6. Lượt này cập nhật hướng dẫn demo, bàn giao và phạm vi H01 trong README. Không phát hiện lỗi runtime cần sửa qua các ca đã kiểm.

| Loại kiểm tra | Kết quả Phase 8A |
| --- | --- |
| Static/build | TypeScript và production build cách ly đạt. |
| Unit, component và fixture | Vitest 1.361/1.361 trên 44 file, calculation 12/12 và contract fixtures 62/62 đạt. Kiểm validation và tiến trình/lỗi tính quẻ, timeout, reconnect, dọn subscription và phân tách phòng bằng test Client. |
| UI Desktop localhost | Chromium 1280/1440/1920 px đạt. Kiểm route public/Admin/chat, 404, form và validation, loading/rỗng của lịch sử, lỗi tra quẻ và retry, preview Admin, focus bàn phím, Hủy/Escape không phát DELETE, bố cục và nút khóa. Tra quẻ và lịch sử dùng fixture, các đường mạng Backend bị chặn hoặc cô lập. |
| Live mới | `NOT RUN`. Dữ liệu và Backend TEST vẫn chờ xác minh theo Phase 7B. |

Rà soát lịch sử Git Phase 1–7, thay đổi Phase 8A và các đường gửi của Client không phát hiện credential thật. Admin Login chỉ kiểm biểu mẫu và xóa giá trị mật khẩu sau lần kiểm hợp lệ. Hai route chat tách khỏi provider H01, không phát API/WS. Dashboard dùng dấu trống khi thiếu số liệu. Khi phiên H01 mất hiệu lực, Client ẩn dữ liệu riêng tư của phiên cũ, không tự xóa bản ghi Server hay phát lại thao tác ghi chưa rõ kết quả. Cách ly phòng trong Client là lớp kiểm tra bổ sung. Server vẫn phải xác minh quyền.

### Demo Desktop trên localhost

1. Từ checkout nhánh `bmanh812`, vào `client/`, chạy `npm.cmd ci`. Dùng Node theo yêu cầu trong [README Client](../client/README.md). Chạy build trong bản sao nếu workspace có thay đổi local cần giữ.
2. Để demo Frontend khi Backend vắng mặt, chọn một cổng loopback chắc chắn đang trống, ví dụ 18081. Trong PowerShell chạy Client, đặt `HUYENCO_API_URL=http://127.0.0.1:18081`, `NEXT_PUBLIC_WS_URL=ws://127.0.0.1:18081/ws` và `NEXT_PUBLIC_API_BASE_URL=/api/v1`. Chạy `npm.cmd run dev -- --hostname 127.0.0.1 --port 3173`. Các biến chỉ áp dụng cho terminal chạy demo. Mở `http://127.0.0.1:3173`.
3. Demo độc lập từ trang chủ, danh mục phương pháp và 404. Mở form Mai Hoa/Tam Thế, tra quẻ, lịch và H01 để minh họa điều hướng và trạng thái lỗi/kết nối khi thiếu Backend. Trong Admin, kiểm validation, xem trước nội dung và các chỉ số chưa có dữ liệu. Mở hai trang chat để chỉ rõ điều kiện mở khóa. Dữ liệu fixture chỉ thuộc lượt kiểm thử riêng.
4. Để demo live, xác minh datasource TEST và health/readiness trước, rồi đặt hai đích REST/STOMP về Backend TEST. Dùng cùng hostname và Origin được cho phép. Chạy [D01–D12](45-TV1-DEMO-SCRIPT.md) và các cổng dưới đây. Dùng dữ liệu thuộc lượt TEST cho các thao tác ghi/xóa.

<a id="phase-8a1"></a>
### Phase 8A.1 – CUSTOMER AUTHENTICATION – ADDITIONAL FRONTEND HANDOFF

**Frontend đã triển khai · Tích hợp tài khoản `BLOCKED`.** Hai route `/dang-ky` và `/dang-nhap` hiển thị trong điều hướng công khai. Biểu mẫu kiểm trường bắt buộc, email khi nhập dạng email và mật khẩu xác nhận. Chế độ xem trước chỉ xác nhận đã kiểm dữ liệu nhập. Hai route không khởi tạo H01. `/admin/login` giữ luồng riêng. Tại commit nền `01a84d0`, đối chiếu controller, proxy và [hợp đồng REST](02-API-CONTRACT.md) chỉ thấy phiên H01 phục vụ lịch sử ẩn danh. Đăng ký, đăng nhập, đọc phiên và đăng xuất tài khoản đều chờ API.

- **TV2** dùng lại AUTH-01–06 và bổ sung AUTH-07. Chốt đăng ký, đăng nhập, đọc phiên, đăng xuất, nguồn xác định role và việc có cần API role riêng hay không. Chốt tên cookie, CSRF/Origin, DTO và mã lỗi, bảo vệ từng API Admin theo role. Thống nhất đích điều hướng sau khi Server xác minh quyền, gồm `USER` về website công khai, `ADMIN` vào `/admin`, `CONSULTANT` vào workspace khi quyền được xác nhận. Nếu duyệt liên kết H01, chốt cách xác minh chủ sở hữu và cấp quyền xem lịch sử theo tài khoản.
- **TV3** dùng lại DATA-01–05 cho bảng tài khoản, định danh duy nhất, băm mật khẩu, vai trò, quan hệ account/session, tài khoản quản trị do nhóm cấp và tài khoản `USER`/`CONSULTANT` TEST. Bàn giao kế hoạch migration bảo toàn H01 và quy tắc gắn lịch sử với tài khoản nếu nhóm duyệt.
- **Nghiệm thu phối hợp** qua PH2-PH-03. Kiểm đăng ký được cấp `USER`, xử lý định danh trùng/sai, đăng nhập theo vai trò Server, từ chối truy cập Admin hoặc workspace tư vấn khi thiếu quyền, đọc phiên sau tải lại, hết phiên, đăng xuất, CSRF/Origin và tính độc lập của H01. Kiểm liên kết lịch sử và truy cập từ nhiều thiết bị chỉ khi có thiết kế và dữ liệu TEST được duyệt.

### Phase 8B – Tích hợp live và nghiệm thu cuối

**`BLOCKED – TV2/TV3 DEPENDENCIES PENDING`.** Kết quả 8E/8F cũ chỉ dùng làm tham chiếu. Các cổng dưới đây cần bằng chứng mới trên môi trường đã xác minh.

| Cổng | Tiêu chí và chủ trì | Trạng thái |
| --- | --- | --- |
| 1 · Database TEST | TV3/TV1 xác minh đúng database, role, schema V1–V12 và seed bằng kiểm tra chỉ đọc. | `BLOCKED` · chờ credential TEST được cung cấp an toàn. |
| 2 · Backend | TV2/TV1 kiểm PID/listener, datasource TEST, Origin, Flyway tắt, health 200 và readiness 200/READY. | `BLOCKED` · phụ thuộc cổng 1. |
| 3 · REST/STOMP và H01 | TV1/TV2 kiểm lại luồng lõi, hai owner, timeout/reconnect, CSRF, 401/403/404 và cleanup đúng bản ghi TEST. | `BLOCKED` · phụ thuộc cổng 2. |
| 4 · Auth và quyền | TV2/TV3 bàn giao đăng ký USER, login/session/logout, role, cookie/CSRF và kiểm thiếu quyền. TV1 đối chiếu trên UI khách hàng và Admin. | `BLOCKED` · chờ AUTH-01–07 và dữ liệu TEST theo role. |
| 5 · Admin và tài khoản | TV1/TV2/TV3 kiểm CRUD, phiên bản, duyệt/công bố, số liệu, tài khoản và tư vấn viên. | `BLOCKED` · chờ cổng 4 và API/dữ liệu Admin. |
| 6 · Chat | TV1/TV2/TV3 kiểm trao đổi hai chiều, quyền từng phòng, ACK, lịch sử, chống trùng và reconnect. | `BLOCKED` · chờ cổng 4 và Chat REST/STOMP có thật. |
| 7 · Regression và demo cuối | Cả nhóm chạy kiểm tĩnh, mock, hồi quy live, diễn tập Desktop và ghi kết quả theo SHA/môi trường. | `BLOCKED` · chờ các cổng live liên quan. |

Checklist trước khi đóng nghiệm thu gồm chạy lại build/typecheck/Vitest/calculation/contract, kiểm desktop 1280/1440/1920 px, ghi bằng chứng cho ca thành công và ca từ chối, xác minh phạm vi dữ liệu TEST đã dọn, rồi cập nhật đúng `BLOCKED`/`NOT RUN` ở phần còn thiếu.

<a id="phase-tiep-theo"></a>
## Các phase tiếp theo

| Phase | Phạm vi dự kiến | Trạng thái |
| --- | --- | --- |
| 7B | Nghiệm thu tích hợp trên localhost | Chờ Backend TEST và các hợp đồng còn thiếu theo từng cổng |
| 8B | Tích hợp live và nghiệm thu cuối | Chờ các cổng Phase 8B |

Phase 9 là tùy chọn và chưa nằm trong phạm vi cam kết triển khai.

<a id="theo-doi"></a>
## Bảng theo dõi công việc

`TODO` — chưa thực hiện · `IN PROGRESS` — đang thực hiện · `BLOCKED` — đang bị chặn · `READY FOR TV1` — Backend/dữ liệu đã sẵn sàng để TV1 tích hợp · `TESTING` — đang nghiệm thu · `DONE` — đã hoàn thành và kiểm chứng.

| ID | Phase | Công việc | Người phụ trách | Mức ưu tiên | Trạng thái | Phụ thuộc | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | 2, 8A.1 | Đăng nhập tài khoản | TV2 | Cao | `TODO` | DATA-01, DATA-02, DATA-03, AUTH-05 | Chốt định danh, dữ liệu phiên và quyền dùng từng cổng |
| AUTH-02 | 2, 8A.1 | Đọc phiên tài khoản | TV2 | Cao | `TODO` | AUTH-05, DATA-02 | Chốt role, thời hạn và hành vi khi hết phiên |
| AUTH-03 | 2, 8A.1 | Đăng xuất tài khoản | TV2 | Cao | `TODO` | AUTH-05 | Thu hồi phiên và hết hạn cookie |
| AUTH-04 | 2 | Phân quyền quản trị | TV2 | Cao | `TODO` | AUTH-02, DATA-02 | Kiểm tra quyền tại Backend |
| AUTH-05 | 2 | Cookie, phiên, Origin và CSRF | TV2 | Cao | `TODO` | PH2-PH-01 | Tách Admin và H01 |
| AUTH-06 | 2 | Cấu trúc và mã lỗi | TV2 | Cao | `TODO` | PH2-PH-02 | Phân biệt lỗi phiên, quyền và CSRF |
| AUTH-07 | 8A.1 | Đăng ký công khai USER | TV2 | Cao | `TODO` | DATA-01–03, AUTH-05–06, PH2-PH-02 | Endpoint TBD. Chốt định danh, mật khẩu, trùng tài khoản và xác minh email nếu áp dụng |
| DATA-01 | 2 | Thiết kế dữ liệu tài khoản | TV3 | Cao | `TODO` | PH2-PH-01 | Xác định ràng buộc và quan hệ tài khoản–phiên |
| DATA-02 | 2 | Lưu vai trò người dùng | TV3 | Cao | `TODO` | PH2-PH-01 | Tối thiểu `ADMIN` và `USER` |
| DATA-03 | 2 | Bảo mật dữ liệu tài khoản | TV3 | Cao | `TODO` | PH2-PH-01 | Thống nhất băm mật khẩu với TV2 |
| DATA-04 | 2 | Tài khoản TEST | TV3 | Cao | `TODO` | DATA-01, DATA-02, DATA-03 | Cấp thông tin thử nghiệm qua kênh riêng |
| DATA-05 | 2 | Tương thích dữ liệu cũ | TV3 | Cao | `TODO` | PH2-PH-01 | Xác định migration và đối chiếu lịch sử |
| PH2-PH-01 | 2 | Chốt thiết kế tài khoản, vai trò và phiên | TV2, TV3 | Cao | `TODO` | Rà soát Backend và dữ liệu hiện có | Ghi quyết định kỹ thuật trước migration |
| PH2-PH-02 | 2 | Chốt hợp đồng API | TV2, TV1, TV3 | Cao | `TODO` | PH2-PH-01 | Xác nhận endpoint, schema, lỗi và cơ chế bảo mật |
| PH2-PH-03 | 2, 8A.1 | Tích hợp và nghiệm thu localhost | TV1, TV2, TV3 | Cao | `BLOCKED` | AUTH-01–07, DATA-04–05, PH2-PH-02 | Chờ Backend và dữ liệu TEST |
| CONTENT-01 | 3 | Đọc danh sách và chi tiết quản trị | TV2 | Cao | `PASS_LOCAL_TEST` | CMS-DATA-01, CMS-DATA-02 | Phương pháp theo tài liệu 57, quẻ theo tài liệu 65, nguồn theo tài liệu 72. Giới thiệu và Hướng dẫn sử dụng theo [tài liệu 76](76-TV2-TV3-WEBSITE-CONTENT-CMS.md). |
| CONTENT-02 | 3 | Tạo và sửa bản nháp | TV2 | Cao | `PASS_LOCAL_TEST` (nghĩa tên và đề xuất sửa nguồn) | CMS-DATA-01–03, CONTENT-05 | `NAME_GLOSS` theo tài liệu 66. Đề xuất nguồn, bảo toàn dữ liệu và xung đột phiên bản theo [tài liệu 73](73-TV2-TV3-SOURCE-EDIT-PROPOSAL-DRAFTS.md) |
| CONTENT-03 | 3 | Ẩn/hiện và đổi trạng thái | TV2 | Cao | `PASS_LOCAL_TEST` (nghĩa tên) | CMS-DATA-04, CONTENT-05 | API, nhật ký V23 và nghiệm thu Chromium theo [tài liệu 69](69-TV2-TV3-CONTENT03-HEXAGRAM-GLOSS-VISIBILITY.md) |
| CONTENT-04 | 3 | Duyệt và công bố | TV2 | Cao | `PASS_LOCAL_TEST` (nghĩa tên và duyệt đề xuất nguồn) | CMS-DATA-03–04, CONTENT-05 | Nghĩa tên theo tài liệu 67. Duyệt đề xuất nguồn, khóa sửa và chống tự duyệt theo [tài liệu 74](74-TV2-TV3-SOURCE-EDIT-PROPOSAL-REVIEW.md) |
| CONTENT-05 | 3 | Xác thực, phân quyền và CSRF | TV2 | Cao | `PASS_LOCAL_TEST` (hai mô-đun CMS đang hoạt động) | AUTH-01–06 | 20 tuyến và 201 ca từ chối trên PostgreSQL TEST V23 theo [biên bản](70-TV2-TV3-CONTENT05-CMS-ACCESS-AUDIT.md) |
| CONTENT-06 | 3 | Kiểm tra dữ liệu và chuẩn hóa phản hồi | TV2 | Cao | `PASS_LOCAL_TEST` (hai mô-đun CMS đang hoạt động) | CMS-DATA-01–04 | 60 kiểm tra HTTP trên TEST V23 và hồi quy Client theo [biên bản](71-TV2-TV3-CONTENT06-CMS-VALIDATION.md) |
| CMS-DATA-01 | 3 | Thiết kế lưu nội dung | TV3 | Cao | `PASS_LOCAL_TEST` (bản nháp nghĩa tên) | Chốt phạm vi với TV2 | V21 tách bản nháp `NAME_GLOSS` khỏi dữ liệu E01 đã công bố |
| CMS-DATA-02 | 3 | Liên kết dữ liệu nguồn | TV3 | Cao | `PASS_LOCAL_TEST` (nguồn quẻ, E01 và danh mục đọc) | CMS-DATA-01 | Đối chiếu 64 nghĩa tên với E01 theo tài liệu 65. Danh mục nguồn đọc và đối chiếu các tham chiếu trực tiếp theo tài liệu 72 |
| CMS-DATA-03 | 3 | Phiên bản và lịch sử chỉnh sửa | TV3 | Cao | `PASS_LOCAL_TEST` (nghĩa tên và đề xuất sửa nguồn) | CMS-DATA-01 | Đọc lại từng phiên bản, giữ nguồn tại lúc lưu và kiểm xung đột theo tài liệu 66 và 73 |
| CMS-DATA-04 | 3 | Trạng thái duyệt nội dung | TV3 | Cao | `PASS_LOCAL_TEST` (nghĩa tên và đề xuất nguồn) | CMS-DATA-01 | V22 lưu lịch sử duyệt nghĩa tên. V25 lưu quyết định theo đúng phiên bản đề xuất nguồn, kiểm cạnh tranh theo tài liệu 74 |
| CMS-DATA-05 | 3 | Bảo toàn dữ liệu cũ | TV3 | Cao | `PASS_LOCAL_TEST` | CMS-DATA-01–04 | 28 bảng cũ khớp khi nâng V20 → V22. E02, Mai Hoa, Tam Thế, lịch và cách ly H01 đạt theo [biên bản kiểm toán](68-TV2-TV3-CMS-DATA05-V22-MIGRATION-AUDIT.md) |
| PH3-PH-01 | 3 | Tích hợp và nghiệm thu nội dung trên localhost | TV1, TV2, TV3 | Cao | `PASS_LOCAL_TEST` (nghĩa tên quẻ, metadata sách và nội dung website) | CONTENT-01–06, CMS-DATA-01–05 | Nghiệm thu Chromium theo tài liệu 67, 75 và [76](76-TV2-TV3-WEBSITE-CONTENT-CMS.md). V27 kiểm với hai phiên Admin và một phiên khách trên PostgreSQL TEST. |

### Theo dõi Phase 4

Hợp đồng và cách kiểm quản lý tài khoản Admin (ADM-02–04) có trong [tài liệu 58](58-TV2-TV3-ADMIN-ACCOUNTS.md).

Hợp đồng thống kê Dashboard và quy tắc đếm (ADM-01, ADM-DATA-02) có trong [tài liệu 59](59-TV2-TV3-ADMIN-METRICS-CONTRACT.md).

Hợp đồng đổi vai trò tài khoản (ADM-05, ADM-DATA-03) có trong [tài liệu 60](60-TV2-TV3-ADMIN-ACCOUNT-ROLES.md).

Hợp đồng quản lý hồ sơ tư vấn viên (ADM-06, ADM-DATA-04) có trong [tài liệu 61](61-TV2-TV3-ADMIN-CONSULTANT-REVIEW.md).

Hợp đồng nhật ký quản trị (ADM-07, ADM-DATA-05) có trong [tài liệu 62](62-TV2-TV3-ADMIN-AUDIT-CONTRACT.md).

Môi trường TEST chung và checklist nghiệm thu (ADM-08, ADM-DATA-06) có trong [tài liệu 63](https://github.com/trong-crypto/Huy-n-c-/blob/50cba56a19d6e90be5f3aef01a4e67b91c8da92d/docs/63-TV2-TV3-PHASE4-ADMIN-TEST-HANDOFF.md).

Kiểm toán bảo toàn H01 và cách ly lịch sử tài khoản (ADM-DATA-01) có trong [tài liệu 64](64-TV2-TV3-H01-MIGRATION-COMPATIBILITY.md).

| ID | Công việc | Người phụ trách | Ưu tiên | Trạng thái | Phụ thuộc | Tiêu chí nghiệm thu |
| --- | --- | --- | --- | --- | --- | --- |
| ADM-01 | Thống kê dashboard | TV2 | Cao | `PASS_LOCAL_TEST` (API) | ADM-DATA-02, ADM-08 | Tổng, phân nhóm và trạng thái được đối chiếu với dữ liệu thật trong phạm vi đã chốt. TV1 tích hợp Dashboard theo tài liệu 59 |
| ADM-02 | Danh sách và chi tiết tài khoản | TV2 | Cao | `PASS_LOCAL_TEST` | ADM-DATA-01, ADM-08 | Vai trò và trạng thái đúng. Chỉ trả trường được phép xem |
| ADM-03 | Tìm kiếm, lọc và phân trang | TV2 | Cao | `PASS_LOCAL_TEST` | ADM-02 | Kết quả đúng, không lặp hoặc bỏ sót bản ghi giữa các trang với tập dữ liệu cố định |
| ADM-04 | Quản lý trạng thái tài khoản | TV2 | Cao | `PASS_LOCAL_TEST` | ADM-DATA-03, ADM-08 | Khóa/mở khóa có hiệu lực, đọc lại đúng và bị từ chối khi thiếu quyền |
| ADM-05 | Quản lý vai trò | TV2 | Cao | `PASS_LOCAL_TEST` (API) | ADM-DATA-03, ADM-08 | USER ↔ CONSULTANT, kiểm hồ sơ đã duyệt, chặn đổi quyền Admin, thu hồi phiên. TV1 tích hợp theo tài liệu 60 |
| ADM-06 | Quản lý tư vấn viên | TV2 | Cao | `PASS_LOCAL_TEST` (API) | ADM-DATA-04, ADM-08 | Tạo, lọc, xem chi tiết, duyệt/từ chối và đọc lại lý do. TV1 tích hợp theo tài liệu 61 |
| ADM-07 | API nhật ký quản trị | TV2 | Trung bình | `PASS_LOCAL_TEST` (API) | ADM-DATA-05, ADM-08 | Lọc, phân trang và giới hạn trường dữ liệu. TV1 tích hợp theo tài liệu 62 |
| ADM-08 | Xác thực, phân quyền và CSRF | TV2 | Cao | `PASS_LOCAL_TEST` (API) | AUTH-01–06 | Kiểm 19 tuyến Admin và trạng thái dữ liệu sau 401/403/409 trên TEST V20 |
| ADM-DATA-01 | Dữ liệu và cấu trúc tài khoản | TV3 | Cao | `PASS_LOCAL_TEST` | DATA-01 | V13 → V20 giữ nguyên dữ liệu H01. Kiểm cách ly lịch sử tài khoản theo tài liệu 64 |
| ADM-DATA-02 | Dữ liệu thống kê người dùng và lượt tính | TV3 | Cao | `PASS_LOCAL_TEST` | Quy tắc đếm tại tài liệu 59 | Có bộ dữ liệu đối chiếu tổng, phân nhóm, số 0 và trường hợp thiếu dữ liệu |
| ADM-DATA-03 | Dữ liệu role và trạng thái | TV3 | Cao | `PASS_LOCAL_TEST` | DATA-02, ADM-DATA-01 | Kiểm ràng buộc và nhật ký trên PostgreSQL TEST V18 |
| ADM-DATA-04 | Hồ sơ tư vấn viên | TV3 | Cao | `PASS_LOCAL_TEST` | ADM-DATA-01, ADM-DATA-03 | PostgreSQL TEST V19 giữ hồ sơ cũ và kiểm được lý do từ chối, người duyệt, phiên bản và trạng thái độc lập |
| ADM-DATA-05 | Dữ liệu nhật ký quản trị | TV3 | Trung bình | `PASS_LOCAL_TEST` | View V20 | Đối chiếu dữ liệu có sẵn và sự kiện mới với bảng nguồn. Lưu giữ theo vòng đời dữ liệu nguồn ở giai đoạn TEST |
| ADM-DATA-06 | Dữ liệu TEST cho nghiệm thu | TV3 | Cao | `PASS_LOCAL_TEST` | TEST V20 | Bộ dữ liệu tổng hợp và kịch bản chạy lại tại tài liệu 63 |
| PH4-PH-01 | Chốt hợp đồng và nghiệm thu localhost | TV1, TV2, TV3 | Cao | `PASS_LOCAL_TEST` (các màn hình tích hợp mới) | ADM-01–08, ADM-DATA-06 | Chrome trên TEST V20 đã kiểm Dashboard, hồ sơ, vai trò, nhật ký và chặn khách. TV1 chạy lại checklist tài liệu 63 trên máy riêng |

### Theo dõi Phase 5

| ID | Công việc | Người phụ trách | Ưu tiên | Trạng thái | Phụ thuộc | Tiêu chí nghiệm thu |
| --- | --- | --- | --- | --- | --- | --- |
| PH5-PH-01 | Chốt phương pháp và phạm vi | TV1, TV2, TV3 | Cao | `DONE` | Xác nhận của chủ dự án ngày 08/11/2026 | [Phạm vi Trượng xích chiêm](78-PH5-PH-01-TRUONG-XICH-PROPOSAL.md) và quyết định `DEC-20261108-MH-TRUONG-XICH`. |
| METHOD-01 | Hợp đồng và xử lý Backend | TV2 | Cao | `PASS_LOCAL_TEST` | Catalog `TEAM_DECISION` và dữ liệu V28 | Backend và DTO Trượng xích đã kiểm với catalog phát hành. Xem [bàn giao V28](79-TV2-TV3-TRUONG-XICH-HANDOFF.md). |
| METHOD-DATA-01 | Nguồn, phiên bản dữ liệu và ca chuẩn | TV3 | Cao | `PASS_LOCAL_TEST` | Phạm vi PH5-PH-01 | V28 giữ nguồn `SOURCE_LOCATED` tại trang in 61, PDF 56. Sáu ca chuẩn tại [tài liệu 78](78-PH5-PH-01-TRUONG-XICH-PROPOSAL.md). |
| PH5-PH-02 | Nghiệm thu Client–Server trên localhost | TV1, TV2, TV3 | Cao | `PASS_LOCAL_TEST` | Client, Server và PostgreSQL TEST V28 | [Biên bản Chromium](80-PH5-PH-02-TRUONG-XICH-CLIENT-ACCEPTANCE.md) kiểm form mặc định, STOMP, kết nối lại và cách ly lịch sử với catalog đã duyệt. |

### Theo dõi Phase 6

| ID | Công việc | Người phụ trách | Ưu tiên | Trạng thái | Phụ thuộc | Hợp đồng | Tiêu chí nghiệm thu |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CHAT-01 | Danh bạ và chi tiết tư vấn viên | TV2 | Cao | `PASS_LOCAL_TEST` (REST C1/C2, giao diện C1) | CHAT-DATA-01, CHAT-04 | C1, C2 | `/tu-van` dùng C1 để hiển thị và chọn tư vấn viên, kèm giới thiệu đã duyệt. |
| CHAT-02 | Tạo yêu cầu và đọc hội thoại | TV2 | Cao | `PASS_LOCAL_TEST` (REST và Client C3–C5) | CHAT-04, CHAT-DATA-02–03 | C3–C5 | Chromium trên TEST V31 đã kiểm USER tạo và mở phòng, CONSULTANT mở phòng được phân. [Hợp đồng và nghiệm thu](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-02). |
| CHAT-03 | STOMP riêng và ACK nghiệp vụ | TV2 | Cao | `PASS_LOCAL_TEST` (Backend C7) | CHAT-04, CHAT-05, CHAT-DATA-04 | C7 | Hai kết nối STOMP thật trao đổi trên TEST V32. ACK sau commit và thử lại chỉ nhận ACK cũ. [Hợp đồng](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-03). |
| CHAT-04 | Xác thực phiên chat và vai trò | TV2 | Cao | `PASS_LOCAL_TEST` (REST C10) | Phiên CUSTOMER, CHAT-DATA-01 | C10 | USER/CONSULTANT do Server xác nhận. [Hợp đồng và ràng buộc STOMP](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md). |
| CHAT-05 | Phân quyền từng cuộc trò chuyện | TV2 | Cao | `PASS_LOCAL_TEST` | CHAT-04, CHAT-DATA-02 | C3–C10 | Từ chối ngoài phòng ở REST, SEND và SUBSCRIBE. Kiểm lại quyền trước khi giao frame cho subscription đã mở. [Hợp đồng và nghiệm thu](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-05). |
| CHAT-06 | Vòng đời và kết thúc hội thoại | TV2 | Cao | `PASS_LOCAL_TEST` (REST và Client C6/C9) | CHAT-05, CHAT-DATA-05 | C6, C9 | Hai phiên Chromium trên TEST V31 đã kiểm nhận, từ chối, hủy, kết thúc và xử lý `409`. [Hợp đồng và nghiệm thu](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-06). |
| CHAT-07 | Lịch sử tin nhắn | TV2 | Cao | `PASS_LOCAL_TEST` (Backend C8) | CHAT-05, CHAT-DATA-04, CHAT-DATA-07 | C8 | Đọc theo cursor, loại tin hết hạn và kiểm quyền trên PostgreSQL TEST V33. |
| CHAT-08 | Kết nối lại và chống trùng | TV2 | Cao | `PASS_LOCAL_TEST` | CHAT-03, CHAT-07 | C7, C8, C10 | Hai phiên Chromium trên TEST V33 kiểm ngắt socket, đọc bù, loại trùng và xóa nội dung sau thu hồi phiên. [Hợp đồng và nghiệm thu](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-08). |
| CHAT-09 | Chuẩn hóa DTO, định danh và lỗi | TV2 | Cao | `PASS_LOCAL_TEST` (kỹ thuật) | C1–C10 đã triển khai | C1–C10 | [Fixture và bảng mã](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-09) khớp DTO Client/Backend. Chờ nhóm xác nhận ở lượt bàn giao. |
| CHAT-DATA-01 | Tài khoản và hồ sơ tư vấn viên | TV3 | Cao | `PASS_LOCAL_TEST` | DATA-01–02, ADM-DATA-04 | C1, C2, C10 | Projection ba trường công bố và điều kiện `CONSULTANT + ACTIVE + APPROVED` dùng schema hiện có. |
| CHAT-DATA-02 | Quan hệ USER, CONSULTANT và phòng | TV3 | Cao | `PASS_LOCAL_TEST` | CHAT-DATA-01, CHAT-04 | C3–C5, C10 | V29 lưu đúng hai người tham gia, kiểm quyền theo vị trí và phiên hiện hành. [Thiết kế và nghiệm thu](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-data-02). |
| CHAT-DATA-03 | Lưu cuộc trò chuyện | TV3 | Cao | `PASS_LOCAL_TEST` (lớp dữ liệu) | CHAT-DATA-02, CHAT-DATA-05 | C3–C6, C9 | Tạo và đọc lại đúng phòng, người tham gia và vòng đời trên V30. [Nghiệp vụ và nghiệm thu](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-data-03). |
| CHAT-DATA-04 | Lưu tin và định danh chống trùng | TV3 | Cao | `PASS_LOCAL_TEST` (lớp dữ liệu) | CHAT-DATA-03 | C7, C8 | V32 lưu tin theo thứ tự trong phòng, chống trùng khi gửi đồng thời và đọc theo cursor. [Thiết kế và ACK](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-data-04). |
| CHAT-DATA-05 | Trạng thái cuộc trò chuyện | TV3 | Cao | `PASS_LOCAL_TEST` | CHAT-DATA-02, CHAT-04 | C3–C6, C9 | V30 và service nội bộ bảo vệ chuyển trạng thái, thao tác lặp và xung đột. [Vòng đời và nghiệm thu](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-data-05). |
| CHAT-DATA-06 | Hai tài khoản và phòng TEST | TV3 | Cao | `PASS_LOCAL_TEST` | CHAT-04, CHAT-DATA-01–03 | C3–C10 | Script tạo USER, CONSULTANT, tài khoản ngoài phòng, phòng chờ và phòng hoạt động. [Cách chạy và bằng chứng](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-data-06). |
| CHAT-DATA-07 | Lưu giữ, truy xuất và bảo vệ hội thoại | TV3 | Cao | `PASS_LOCAL_TEST` | CHAT-DATA-04, CHAT-05 | C7, C8 | Tin hết hạn sau 30 ngày, dọn theo lô và giữ khóa chống gửi lại. [Chính sách và nghiệm thu](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#chat-data-07). |
| PH6-PH-01 | Nghiệm thu chat 1:1 trên localhost | TV1, TV2, TV3 | Cao | `PASS_LOCAL_TEST` (kỹ thuật) | CHAT-01–09, CHAT-DATA-06 | C1–C10 | Ba phiên Chromium trên TEST V33 đạt vòng đời, gửi nhận, reconnect, mất ACK và kiểm ngoài quyền. Chờ nhóm xác nhận bàn giao. [Biên bản](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#ph6-ph-01). |

### Theo dõi Phase 7

**Nghiệm thu bản tích hợp ngày 10/11/2026.** Bản tích hợp trên nền `3ef055d` đạt kiểm thử localhost với JDK 17, Next.js và PostgreSQL TEST riêng. Flyway nâng V32 lên V33 và giữ nguyên phòng mẫu. Backend chạy 2.332 ca, đạt 2.302, bỏ qua 30, trong đó cả 20 ca Chat tích hợp PostgreSQL đều đạt. Client đạt 1.411 Vitest, 12 ca tính toán Node và 63 fixture hợp đồng.

Ba phiên Chromium kiểm danh bạ, vòng đời phòng, gửi nhận và đọc lại tin, ngắt kết nối, gửi lại sau mất ACK mà không nhân đôi, chặn người ngoài phòng và thu hồi phiên. Luồng qua Backend thật cũng kiểm đăng ký bằng mật khẩu tám chữ số có số 0 đầu, đăng nhập Admin, Mai Hoa LINES, Tam Thế CAREER, lưu lịch sử theo tài khoản và quyền truy cập Admin metrics. Đây là bằng chứng hồi quy cục bộ cho một phần INT-02 đến INT-04. Nghiệm thu phối hợp và kiểm từ mạng khác được theo dõi riêng.

| ID | Công việc | Người phụ trách | Ưu tiên | Trạng thái | Điều kiện nghiệm thu |
| --- | --- | --- | --- | --- | --- |
| INT-01 | Bàn giao Backend và dữ liệu TEST | TV2, TV3 | P0 | `PASS_LOCAL_TEST` | GitHub `8efe7db`, Flyway V20 → V27, health/readiness và hồi quy đạt. Xem [cấu hình và checklist TV1](https://github.com/trong-crypto/Huy-n-c-/blob/50cba56a19d6e90be5f3aef01a4e67b91c8da92d/docs/77-TV1-INT01-V27-TEST-HANDOFF.md). |
| INT-02 | Chạy lại luồng lõi và H01 trên TEST | TV1, TV2, TV3 | P0 | `BLOCKED` | INT-01 đạt, có bằng chứng REST/STOMP, 401/403, cách ly phiên và cleanup đúng |
| INT-03 | Tích hợp Auth trước Admin/chat | TV1, TV2, TV3 | P0 | `BLOCKED` | AUTH/CHAT Auth chốt và kiểm trên Backend thật. Có tài khoản TEST theo role |
| INT-04 | Nghiệm thu Admin và chat theo contract | TV1, TV2, TV3 | P1 | `BLOCKED` | INT-03 đạt và hợp đồng liên quan được bàn giao. Kiểm dữ liệu lưu và ca ngoài quyền |

### P21 · Kiểm thử HTTPS/WSS cục bộ

Ngày 10/11/2026, GitHub `main` và bản dùng để kiểm thử cùng ở `23d61e4`. Client chạy bản production build với Next.js 16, Backend dùng JDK 17 và PostgreSQL TEST khôi phục riêng lên Flyway V33. Cả ba dịch vụ chạy trên loopback. Điểm vào HTTPS dùng chứng chỉ thử nghiệm chỉ được tin cậy trong tiến trình kiểm thử.

- Health và readiness đạt. Điểm vào HTTPS từ chối khách chưa có mã, từ chối mã sai và cấp phiên khi nhập đúng. Cookie đăng nhập TEST có `Secure`, `HttpOnly` và `SameSite=Lax`.
- Qua cùng Origin HTTPS, STOMP chạy trên WSS cho Mai Hoa LINES, Tam Thế CAREER và Chat 1:1. Lịch sử được lưu theo đúng tài khoản. Admin đọc được số liệu, tài khoản khách hàng bị chặn.
- Ba phiên Chromium kiểm vòng đời phòng, gửi nhận, kết nối lại, đọc bù, gửi lại sau mất ACK, chặn người ngoài phòng và thu hồi phiên.

**Trạng thái:** đạt phần HTTPS/WSS cục bộ. Các dịch vụ thử đã dừng sau lượt chạy. Chủ dự án giới hạn đợt nghiệm thu này trên một máy. Nghiệm thu qua hai mạng chỉ áp dụng khi mở lại phạm vi staging.

### P22 · Hồi quy cục bộ

Ngày 10/11/2026, kiểm trên nền `23d61e4`, Client production, Backend JDK 17 và hai bản sao PostgreSQL TEST riêng. Lượt Backend xác nhận Flyway V33 giữ phòng mẫu từ V32. Lượt HTTPS/WSS dùng bản sao khác, trên loopback.

| Hạng mục | Kết quả |
| --- | --- |
| Client | 1.411 Vitest, 12 ca Node và 63 fixture hợp đồng đạt. Ca phiên hết hạn chờ hiệu ứng xóa trạng thái lịch sử trước khi khẳng định. |
| Backend | 2.302 đạt, 30 bỏ qua, 0 lỗi. Cả 20 ca tích hợp Chat trên PostgreSQL đạt. 30 ca bỏ qua thuộc các bộ dữ liệu tri thức cần cấu hình TEST riêng. |
| Nghiệp vụ qua HTTPS/WSS | Mai Hoa LINES, OBJECT_COUNT, TIME, Tam Thế CAREER, tra quẻ, chuyển lịch, đọc nội dung CMS và Admin metrics đạt. Kiểm mã quẻ sai định dạng 400, mã đúng định dạng nhưng không tồn tại 404 và ngày sai 400. |
| Auth và lịch sử | Cookie bảo mật, lưu/đọc/xóa đúng chủ tài khoản, tài khoản khác nhận 404, sai CSRF hoặc Origin nhận 403 và tài khoản khách hàng bị chặn khỏi Admin metrics. |
| Chat | Ba phiên Chromium kiểm vòng đời, gửi nhận, đọc bù sau ngắt socket, gửi lại sau mất ACK, chặn người ngoài phòng và thu hồi phiên. Một lượt hết thời gian chờ bắt tay WSS ở ngưỡng 5 giây. Lượt đầy đủ đạt khi tăng ngưỡng chờ của công cụ kiểm thử lên 15 giây. |

**Trạng thái:** `PASS_LOCAL_TEST` cho các ca trên. Lượt CMS trực tiếp kiểm đọc nội dung, còn quy trình nháp, duyệt và công bố dùng bằng chứng V27 tại PH3-PH-01.

### P23 · Tải đồng thời và lỗi kết nối cục bộ

Ngày 10/11/2026, đo Backend trên nền `23d61e4` với JDK 17.0.12, Node 24.21.0 và PostgreSQL TEST riêng tại Flyway V33. Windows, Intel Core i7-13620H, 16 luồng logic, khoảng 23,71 GiB RAM theo Node. Bộ phát tải, Backend và database chạy cùng máy, qua loopback. Flyway tắt trong lúc đo, pool JDBC ở chế độ chỉ đọc.

Ma trận gồm 1, 5 và 20 kết nối STOMP độc lập, mỗi mức ba lượt, chạy tuần tự và xoay thứ tự. Mỗi lượt làm nóng 5 giây, đo 15 giây và có tối đa 15 giây thu nốt. Backend dùng `bounded`, 4 worker, hàng đợi 100 và JVM heap từ 256 đến 512 MiB. Tải là Mai Hoa LINES với tối đa một yêu cầu chưa có kết quả trên mỗi kết nối và khoảng nghỉ 200 ms. Runner dùng bản sao tạm của X01, đổi số Client, điều kiện đích TEST V33 và đường dẫn tải bộ kiểm hợp đồng. Ma trận đo trực tiếp WebSocket, tập trung vào xử lý tính quẻ, không gồm chi phí trình duyệt, HTTPS hay tải từ mạng ngoài.

Đối chiếu mẫu từ CSV theo thời điểm SEND trong cửa sổ `[start, end)`. Số yêu cầu trong bảng cộng qua ba lượt. Median, P95, P99 và thông lượng lấy median của ba chỉ số từng lượt. P95/P99 tính theo nearest-rank trên kết quả hợp lệ, thông lượng đếm kết quả đến trong cửa sổ đo.

| Client | Hoàn thành / gửi | Median (ms) | P95 (ms) | P99 (ms) | Yêu cầu/giây |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 209 / 209 | 2,929 | 5,452 | 7,652 | 4,667 |
| 5 | 1.039 / 1.039 | 4,477 | 9,047 | 12,790 | 23,000 |
| 20 | 4.120 / 4.120 | 10,526 | 19,101 | 155,732 | 91,467 |

Cả chín lượt đạt. Có 5.368 kết quả đúng, không phát hiện SEND ngoài ranh, kết quả đến muộn hoặc lỗi giao thức. P99 của ba lượt 20 Client lần lượt là 276,026, 155,732 và 42,347 ms. Độ trễ đuôi dao động đáng kể giữa các lượt ngắn. Phép đo có nhịp gửi cố định theo từng Client, nên thông lượng chỉ mô tả tải đã thử trên máy này.

Ca lỗi kết nối chạy riêng qua HTTPS/WSS trên PostgreSQL TEST V33. Khi ngắt socket phía USER và gửi từ CONSULTANT, USER kết nối lại và đọc bù đúng một lần. Khi chặn ACK sau lúc Server đã lưu tin, Client giữ bản nháp, gửi lại cùng mã yêu cầu và PostgreSQL giữ một bản ghi. Tài khoản ngoài phòng tiếp tục bị từ chối và giao diện xóa nội dung khi phiên bị thu hồi.

**Trạng thái:** `PASS_LOCAL_TEST`. Dữ liệu thô và CSV đối chiếu nằm ở `server/target/p23-local/`. Log lỗi kết nối nằm ở `server/target/p23-fault/scenarios.log`. Các tiến trình thử đã dừng.

### P24 · Bàn giao trên một máy

Đã bổ sung [hướng dẫn chạy, sao lưu, khôi phục và kịch bản demo](82-HUYENCO-LAN-DEMO.md#7-sao-lưu-và-khôi-phục-thử) vào README. Diễn tập sao lưu và khôi phục trên PostgreSQL TEST V33 đạt `PASS_LOCAL_TEST`. Số dòng và dấu vân tay nội dung của sáu bảng, gồm quẻ, tài khoản, phòng chat và tin nhắn, đều khớp giữa nguồn và đích.

<a id="cap-nhat"></a>
## Quy tắc cập nhật

1. Đọc file này trước khi ghi yêu cầu mới. Chỉ thêm việc TV1 thực sự cần TV2 hoặc TV3 hỗ trợ và đưa vào đúng phase.
2. Dùng mã công việc ổn định. Tìm và cập nhật dòng hiện có trước khi thêm mới. Giữ các việc chưa hoàn thành và tránh tạo thêm tài liệu bàn giao song song.
3. Chỉ đổi trạng thái khi có bằng chứng và xác nhận của người phụ trách. Khi ghi `READY FOR TV1`, kèm mốc commit và hướng dẫn tích hợp. Khi ghi `DONE`, kèm kết quả nghiệm thu hoặc đường dẫn bằng chứng.
4. Giữ lịch sử quyết định theo mốc commit hoặc ngày xác nhận, người xác nhận, nội dung đã chốt và tác động đến Client/Backend/dữ liệu. Đánh dấu rõ đề xuất đang chờ duyệt.
5. Giữ tài liệu bàn giao Admin Auth gốc làm căn cứ. Ghi các yêu cầu mới và trạng thái hiện hành tại file tập trung này.
