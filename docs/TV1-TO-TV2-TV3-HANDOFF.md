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
4. [Các phase tiếp theo](#phase-tiep-theo)
5. [Bảng theo dõi công việc](#theo-doi)
6. [Quy tắc cập nhật](#cap-nhat)

<a id="phase-2"></a>
## Phase 2 – Xác thực quản trị (Admin Authentication)

**Trạng thái `PARTIAL – WAITING FOR BACKEND`.**

<a id="hien-trang"></a>
### Hiện trạng và căn cứ

- **TV1 đã hoàn thiện** trang `/admin/login`, kiểm tra biểu mẫu, bố cục Admin, thanh bên, đầu trang, bảng điều khiển cơ bản tại `/admin` và các bài kiểm thử giao diện. Mốc bàn giao frontend là `13cc086`.
- **Đang chờ tích hợp** đăng nhập với Backend thật, kiểm tra quyền `ADMIN`, đăng xuất, xử lý hết phiên và nghiệm thu xác thực/phân quyền. Các bài kiểm thử giao diện hiện có chỉ xác nhận hành vi phía Client.
- **Backend trên nhánh `bmanh812` tại `13cc086`** có `POST /api/v1/session` trong `HistoryController` và các API lịch sử H01. `SessionService` xác minh cookie `huyenco_session` và quyền sở hữu lịch sử. Cookie do Server cấp với `HttpOnly` và `SameSite=Lax`. Phản hồi bootstrap phiên có `expiresAt` và `csrfToken`. H01 dùng `401` cho phiên không hợp lệ và `403` cho kiểm tra CSRF/Origin thất bại. Phiên này đại diện cho chủ sở hữu ẩn danh, chưa gắn với tài khoản hoặc vai trò `ADMIN`.
- **Đối chiếu tài liệu với mã** cho thấy tình trạng chờ Admin Auth trong tài liệu cũ phù hợp với bản mã đã đọc. Chưa thấy API đăng nhập, đọc phiên quản trị, đăng xuất hay kiểm tra vai trò `ADMIN` trong Backend tại mốc này. Migration V11 tạo `anonymous_sessions` và `interpretation_history`. Các migration đến V12 chưa có bảng tài khoản hoặc vai trò Admin. Nếu TV2/TV3 đã làm trên nhánh khác, cần xác nhận bằng nhánh, commit và hợp đồng tương ứng.

[Bàn giao Admin Auth gốc](TV1-PHASE2-ADMIN-AUTH-HANDOFF.md) · [Hợp đồng API hiện tại](02-API-CONTRACT.md) · [Hợp đồng H01](34-H01-SESSION-HISTORY-HANDOFF.md) · [HistoryController](../server/src/main/java/com/huyenco/history/HistoryController.java) · [Migration V11](../server/src/main/resources/db/migration/V11__anonymous_sessions_and_history.sql)

<a id="cong-viec-tv2"></a>
### A. Công việc TV2 – Backend

1. **AUTH-01 – Đăng nhập quản trị.** Kiểm tra tài khoản, mật khẩu và quyền tại Server. Khi hợp lệ, cấp phiên quản trị an toàn và trả dữ liệu tối thiểu theo hợp đồng. Với thông tin sai, trả lỗi chung để tránh tiết lộ tài khoản nào tồn tại. Loại thông tin bí mật khỏi phản hồi và log.
2. **AUTH-02 – Đọc phiên quản trị hiện tại.** Xác minh cookie và trạng thái phiên. Trả tên hiển thị, vai trò, thời hạn và dữ liệu CSRF nếu hợp đồng yêu cầu. Xử lý phiên thiếu, hết hạn hoặc đã thu hồi.
3. **AUTH-03 – Đăng xuất.** Thu hồi phiên phía Server, làm hết hạn cookie quản trị và kiểm tra CSRF theo hợp đồng. Phiên cũ phải bị từ chối khi dùng lại.
4. **AUTH-04 – Phân quyền quản trị.** Phân biệt `ADMIN`, `USER` và các vai trò được nhóm thống nhất. Kiểm tra quyền trên từng API quản trị và từ chối yêu cầu thiếu quyền. Client dùng thông tin vai trò để hiển thị giao diện. Quyết định cấp quyền thuộc Backend.
5. **AUTH-05 – Cookie, phiên và CSRF.** Thống nhất cookie riêng cho Admin, thời hạn, thuộc tính và phạm vi cookie, cách kiểm tra Origin khi đăng nhập, cách cấp/gửi CSRF và cách bảo vệ thao tác ghi. Kiểm tra tương thích với Next.js trên localhost và phiên lịch sử H01.
6. **AUTH-06 – Phản hồi lỗi.** Chốt cấu trúc JSON, mã lỗi ổn định và thông báo an toàn. Phân biệt dữ liệu sai (`400`), thông tin đăng nhập/phiên không hợp lệ (`401`), thiếu quyền hoặc lỗi Origin/CSRF (`403`) và lỗi nội bộ (`500`) khi phù hợp.

<a id="cong-viec-tv3"></a>
### B. Công việc TV3 – Cơ sở dữ liệu và dữ liệu

1. **DATA-01 – Dữ liệu tài khoản.** Rà soát cấu trúc hiện có, đề xuất bảng/trường và ràng buộc cần thiết. Chốt với TV2 quan hệ tài khoản–phiên và dữ liệu cần lưu cho hết hạn hoặc thu hồi nếu thiết kế dùng phiên lưu trong cơ sở dữ liệu.
2. **DATA-02 – Vai trò người dùng.** Đề xuất cách lưu vai trò/quyền, tối thiểu phân biệt `ADMIN` và `USER`. Tính đến khả năng thêm `CONSULTANT` khi phase tương ứng xác nhận nhu cầu.
3. **DATA-03 – Bảo mật dữ liệu tài khoản.** Thống nhất với TV2 cách băm mật khẩu phù hợp và cấu trúc lưu giá trị băm. Chỉ lưu giá trị băm theo thiết kế đã duyệt. Cấp thông tin bí mật qua kênh riêng, tách khỏi mã nguồn và tài liệu.
4. **DATA-04 – Tài khoản kiểm thử.** Chuẩn bị tài khoản `ADMIN` và `USER` cho môi trường TEST trên localhost, cùng hướng dẫn thiết lập an toàn. Cung cấp thông tin đăng nhập qua kênh riêng của nhóm.
5. **DATA-05 – Tương thích dữ liệu cũ.** Xác định migration cần thiết nếu có, kiểm tra bảo toàn lịch sử và quyền sở hữu H01. Xác nhận Mai Hoa, Tam Thế và Lịch sử tiếp tục hoạt động trên cơ sở dữ liệu TEST sau thay đổi.

<a id="phoi-hop"></a>
### Công việc phối hợp

- **PH2-PH-01 – Thiết kế tài khoản, vai trò và phiên.** TV2 và TV3 thống nhất nơi lưu tài khoản, vai trò, cách lưu/thu hồi phiên và cách tách dữ liệu Admin khỏi phiên H01 trước khi chốt migration.
- **PH2-PH-02 – Chốt hợp đồng tích hợp.** TV2 và TV1 thống nhất các API trong bảng dưới. TV3 xác nhận dữ liệu tài khoản, vai trò và tài khoản TEST có thể đáp ứng hợp đồng.
- **PH2-PH-03 – Nghiệm thu trên localhost.** TV2 cung cấp Backend TEST và hợp đồng. TV3 chuẩn bị dữ liệu/tài khoản và bằng chứng bảo toàn lịch sử. TV1 tích hợp và chạy các ca trên trình duyệt. Cả nhóm ghi kết quả tại mục nghiệm thu.

<a id="hop-dong-api"></a>
### C. Hợp đồng API cần thống nhất

Các phương thức, trường và mã phản hồi bên dưới là đề xuất để TV2 và TV1 chốt. Các endpoint quản trị chưa được xác nhận.

| ID | Chức năng | HTTP Method | Endpoint | Request | Response | Auth/CSRF | Người phụ trách | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Đăng nhập Admin | `POST` đề xuất | TBD – Chờ TV2 thống nhất | JSON `username`, `password` | `200` đề xuất, cấp cookie Admin và trả dữ liệu phiên. `400`/`401`/`403` khi phù hợp. | Chốt kiểm tra Origin và cơ chế chống CSRF khi đăng nhập. | TV2, TV1 đối chiếu | `TODO` |
| AUTH-02 | Đọc phiên Admin hiện tại | `GET` đề xuất | TBD – Chờ TV2 thống nhất | Cookie Admin, không có body | `200` đề xuất, trả dữ liệu phiên. `401` khi thiếu/hết phiên và `403` khi thiếu quyền. | Cookie Admin. Chốt cách cấp hoặc làm mới thông tin CSRF nếu có. | TV2, TV1 đối chiếu | `TODO` |
| AUTH-03 | Đăng xuất Admin | `POST` đề xuất | TBD – Chờ TV2 thống nhất | Cookie Admin và thông tin CSRF theo hợp đồng | `204` đề xuất, thu hồi phiên và làm hết hạn cookie. Chốt hành vi nếu phiên đã hết hạn. | Cookie Admin, Origin/CSRF theo hợp đồng. | TV2, TV1 đối chiếu | `TODO` |
| AUTH-04 | Kiểm tra quyền Admin | Theo từng API | TBD – Chờ TV2 thống nhất | Cookie Admin và dữ liệu theo thao tác | Phản hồi theo từng API. `401` khi phiên không hợp lệ, `403` khi phiên hợp lệ nhưng thiếu quyền hoặc lỗi CSRF. | Backend bắt buộc xác minh phiên và vai trò `ADMIN`. Áp dụng CSRF cho thao tác ghi. | TV2 | `TODO` |

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

**Trạng thái `PARTIAL – WAITING FOR BACKEND`.** TV1 đã bổ sung giao diện phương pháp, quẻ và lời giải nghĩa, dữ liệu nguồn, nội dung website và xem trước quy trình duyệt. Danh sách/chi tiết quẻ dùng API công khai `GET /api/v1/hexagrams` và `GET /api/v1/hexagrams/{code}` để đối chiếu. Danh mục phương pháp dựa trên các phương pháp đã có trong Client. Form chỉ xem trước trên trang, chưa ghi dữ liệu. Trạng thái nội dung quản trị và phiên bản nguồn phải đến từ Backend.

### A. Công việc TV2 – Backend

| ID | Phạm vi | Endpoint |
| --- | --- | --- |
| CONTENT-01 | Danh sách/chi tiết phương pháp, quẻ và giải nghĩa, nguồn, nội dung website. Thống nhất tìm kiếm, lọc, phân trang, trạng thái và phiên bản có thể hiển thị. | TBD – Chờ TV2 thống nhất |
| CONTENT-02 | Tạo/chỉnh sửa bản nháp và tiếp nhận đề xuất chỉnh sửa nguồn. Tách nội dung biên tập khỏi công thức, dữ liệu nghiệp vụ và quy tắc tính quẻ. | TBD – Chờ TV2 thống nhất |
| CONTENT-03 | Ẩn/hiện hoặc đổi trạng thái nội dung. Chốt cách xử lý thao tác cạnh tranh và quyền cần thiết. | TBD – Chờ TV2 thống nhất |
| CONTENT-04 | Gửi duyệt, duyệt và công bố theo các chuyển trạng thái hợp lệ. Chốt cách từ chối/lưu trữ nếu có và nội dung nào được website người dùng đọc. | TBD – Chờ TV2 thống nhất |
| CONTENT-05 | Bảo vệ mọi API quản trị bằng phiên Admin, quyền phù hợp và CSRF cho thao tác ghi. Thống nhất phản hồi `401`/`403` theo Phase 2. | Áp dụng cho toàn bộ API quản trị |
| CONTENT-06 | Xác thực dữ liệu ở Server, chốt cấu trúc phản hồi, lỗi theo trường và lỗi xung đột phiên bản/trạng thái. Chốt giới hạn văn bản và quy tắc hiển thị an toàn. | Áp dụng cho toàn bộ API quản trị |

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

<a id="phase-tiep-theo"></a>
## Các phase tiếp theo

| Phase | Phạm vi dự kiến | Trạng thái |
| --- | --- | --- |
| 5 | Phương pháp bói mới | Chưa bắt đầu – Sẽ bổ sung yêu cầu sau khi TV1 triển khai và xác định dependency |
| 6 | Chat trực tiếp với người tư vấn | Chưa bắt đầu – Sẽ bổ sung yêu cầu sau khi TV1 triển khai và xác định dependency |
| 7 | Tích hợp hệ thống trên localhost | Chưa bắt đầu – Sẽ bổ sung yêu cầu sau khi TV1 triển khai và xác định dependency |
| 8 | Kiểm thử và bàn giao | Chưa bắt đầu – Sẽ bổ sung yêu cầu sau khi TV1 triển khai và xác định dependency |

Phase 9 là tùy chọn và chưa nằm trong phạm vi cam kết triển khai.

<a id="theo-doi"></a>
## Bảng theo dõi công việc

`TODO` — chưa thực hiện · `IN PROGRESS` — đang thực hiện · `BLOCKED` — đang bị chặn · `READY FOR TV1` — Backend/dữ liệu đã sẵn sàng để TV1 tích hợp · `TESTING` — đang nghiệm thu · `DONE` — đã hoàn thành và kiểm chứng.

| ID | Phase | Công việc | Người phụ trách | Mức ưu tiên | Trạng thái | Phụ thuộc | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | 2 | Đăng nhập quản trị | TV2 | Cao | `TODO` | DATA-01, DATA-02, DATA-03, AUTH-05 | Chốt định danh đăng nhập và dữ liệu phiên |
| AUTH-02 | 2 | Đọc phiên quản trị | TV2 | Cao | `TODO` | AUTH-05, DATA-02 | Chốt thời hạn và hành vi khi hết phiên |
| AUTH-03 | 2 | Đăng xuất quản trị | TV2 | Cao | `TODO` | AUTH-05 | Thu hồi phiên và hết hạn cookie |
| AUTH-04 | 2 | Phân quyền quản trị | TV2 | Cao | `TODO` | AUTH-02, DATA-02 | Kiểm tra quyền tại Backend |
| AUTH-05 | 2 | Cookie, phiên, Origin và CSRF | TV2 | Cao | `TODO` | PH2-PH-01 | Tách Admin và H01 |
| AUTH-06 | 2 | Cấu trúc và mã lỗi | TV2 | Cao | `TODO` | PH2-PH-02 | Phân biệt lỗi phiên, quyền và CSRF |
| DATA-01 | 2 | Thiết kế dữ liệu tài khoản | TV3 | Cao | `TODO` | PH2-PH-01 | Xác định ràng buộc và quan hệ tài khoản–phiên |
| DATA-02 | 2 | Lưu vai trò người dùng | TV3 | Cao | `TODO` | PH2-PH-01 | Tối thiểu `ADMIN` và `USER` |
| DATA-03 | 2 | Bảo mật dữ liệu tài khoản | TV3 | Cao | `TODO` | PH2-PH-01 | Thống nhất băm mật khẩu với TV2 |
| DATA-04 | 2 | Tài khoản TEST | TV3 | Cao | `TODO` | DATA-01, DATA-02, DATA-03 | Cấp thông tin thử nghiệm qua kênh riêng |
| DATA-05 | 2 | Tương thích dữ liệu cũ | TV3 | Cao | `TODO` | PH2-PH-01 | Xác định migration và đối chiếu lịch sử |
| PH2-PH-01 | 2 | Chốt thiết kế tài khoản, vai trò và phiên | TV2, TV3 | Cao | `TODO` | Rà soát Backend và dữ liệu hiện có | Ghi quyết định kỹ thuật trước migration |
| PH2-PH-02 | 2 | Chốt hợp đồng API | TV2, TV1, TV3 | Cao | `TODO` | PH2-PH-01 | Xác nhận endpoint, schema, lỗi và cơ chế bảo mật |
| PH2-PH-03 | 2 | Tích hợp và nghiệm thu localhost | TV1, TV2, TV3 | Cao | `BLOCKED` | AUTH-01–06, DATA-04–05, PH2-PH-02 | Chờ Backend và dữ liệu TEST |
| CONTENT-01 | 3 | Đọc danh sách và chi tiết quản trị | TV2 | Cao | `TODO` | CMS-DATA-01, CMS-DATA-02 | API công khai chỉ phục vụ đối chiếu quẻ |
| CONTENT-02 | 3 | Tạo và sửa bản nháp | TV2 | Cao | `TODO` | CMS-DATA-01–03, CONTENT-05 | Có kiểm tra phiên bản nguồn |
| CONTENT-03 | 3 | Ẩn/hiện và đổi trạng thái | TV2 | Cao | `TODO` | CMS-DATA-04, CONTENT-05 | Chốt quyền và chuyển trạng thái |
| CONTENT-04 | 3 | Duyệt và công bố | TV2 | Cao | `TODO` | CMS-DATA-03–04, CONTENT-05 | Chỉ bản đã công bố ra website |
| CONTENT-05 | 3 | Xác thực, phân quyền và CSRF | TV2 | Cao | `BLOCKED` | AUTH-01–06 | Chờ Auth Phase 2 |
| CONTENT-06 | 3 | Kiểm tra dữ liệu và chuẩn hóa phản hồi | TV2 | Cao | `TODO` | CMS-DATA-01–04 | Chốt schema và mã lỗi với TV1 |
| CMS-DATA-01 | 3 | Thiết kế lưu nội dung | TV3 | Cao | `TODO` | Chốt phạm vi với TV2 | Tách bản công bố và bản nháp |
| CMS-DATA-02 | 3 | Liên kết dữ liệu nguồn | TV3 | Cao | `TODO` | CMS-DATA-01 | Bảo toàn xuất xứ và đối chiếu |
| CMS-DATA-03 | 3 | Phiên bản và lịch sử chỉnh sửa | TV3 | Cao | `TODO` | CMS-DATA-01 | Phục vụ kiểm tra xung đột |
| CMS-DATA-04 | 3 | Trạng thái duyệt nội dung | TV3 | Cao | `TODO` | CMS-DATA-01 | Thống nhất chuyển trạng thái với TV2 |
| CMS-DATA-05 | 3 | Bảo toàn dữ liệu cũ | TV3 | Cao | `TODO` | CMS-DATA-01–04 | Kiểm chứng trên cơ sở dữ liệu TEST |
| PH3-PH-01 | 3 | Tích hợp và nghiệm thu nội dung trên localhost | TV1, TV2, TV3 | Cao | `BLOCKED` | CONTENT-01–06, CMS-DATA-01–05 | Ghi bằng chứng API, quyền, lưu và công bố |

### Theo dõi Phase 4

| ID | Công việc | Người phụ trách | Ưu tiên | Trạng thái | Phụ thuộc | Tiêu chí nghiệm thu |
| --- | --- | --- | --- | --- | --- | --- |
| ADM-01 | Thống kê dashboard | TV2 | Cao | `TODO` | ADM-DATA-02, ADM-08 | Tổng, phân nhóm và trạng thái được đối chiếu với dữ liệu thật trong phạm vi đã chốt |
| ADM-02 | Danh sách và chi tiết tài khoản | TV2 | Cao | `TODO` | ADM-DATA-01, ADM-08 | Vai trò và trạng thái đúng. Chỉ trả trường được phép xem |
| ADM-03 | Tìm kiếm, lọc và phân trang | TV2 | Cao | `TODO` | ADM-02 | Kết quả đúng, không lặp hoặc bỏ sót bản ghi giữa các trang với tập dữ liệu cố định |
| ADM-04 | Quản lý trạng thái tài khoản | TV2 | Cao | `TODO` | ADM-DATA-03, ADM-08 | Khóa/mở khóa có hiệu lực, đọc lại đúng và bị từ chối khi thiếu quyền |
| ADM-05 | Quản lý vai trò | TV2 | Cao | `TODO` | ADM-DATA-03, ADM-08 | Role đúng khi đọc lại. Từ chối nâng quyền trái phép |
| ADM-06 | Quản lý tư vấn viên | TV2 | Cao | `TODO` | ADM-DATA-04, ADM-08 | Danh sách/chi tiết và duyệt/từ chối hoạt động, lý do hiển thị nếu hợp đồng hỗ trợ |
| ADM-07 | API nhật ký quản trị | TV2 | Trung bình | `TODO` | ADM-DATA-05, ADM-08 | Nếu được duyệt phạm vi, truy xuất đúng thao tác và chỉ hiển thị trường được phép |
| ADM-08 | Xác thực, phân quyền và CSRF | TV2 | Cao | `BLOCKED` | AUTH-01–06 | Phân biệt 401/403, chặn ghi khi thiếu quyền hoặc CSRF không hợp lệ |
| ADM-DATA-01 | Dữ liệu và cấu trúc tài khoản | TV3 | Cao | `TODO` | DATA-01 | Đọc đúng tài khoản TEST mà vẫn bảo toàn phiên H01 |
| ADM-DATA-02 | Dữ liệu thống kê người dùng và lượt tính | TV3 | Cao | `TODO` | Chốt định nghĩa lượt tính với TV2 | Có bộ dữ liệu đối chiếu tổng, phân nhóm, số 0 và trường hợp thiếu dữ liệu |
| ADM-DATA-03 | Dữ liệu role và trạng thái | TV3 | Cao | `TODO` | DATA-02, ADM-DATA-01 | Ràng buộc vai trò và trạng thái đã chốt, từ chối dữ liệu không hợp lệ |
| ADM-DATA-04 | Hồ sơ tư vấn viên | TV3 | Cao | `TODO` | ADM-DATA-01, ADM-DATA-03 | Hồ sơ liên kết tài khoản, trạng thái duyệt độc lập và lý do đọc lại được nếu có |
| ADM-DATA-05 | Dữ liệu nhật ký quản trị | TV3 | Trung bình | `TODO` | Thống nhất với TV2 | Đối chiếu sự kiện với thay đổi thật, kiểm tra trường nhạy cảm và thời hạn lưu |
| ADM-DATA-06 | Dữ liệu TEST cho nghiệm thu | TV3 | Cao | `TODO` | DATA-04, ADM-DATA-01–04 | Đủ vai trò, trạng thái và nhiều trang, dùng tài khoản tổng hợp |
| PH4-PH-01 | Chốt hợp đồng và nghiệm thu localhost | TV1, TV2, TV3 | Cao | `BLOCKED` | ADM-01–06, ADM-08, ADM-DATA-06 | Kiểm quyền, thống kê, cập nhật có lưu, tài khoản, tư vấn viên và hồi quy Phase 1–3 |

<a id="cap-nhat"></a>
## Quy tắc cập nhật

1. Đọc file này trước khi ghi yêu cầu mới. Chỉ thêm việc TV1 thực sự cần TV2 hoặc TV3 hỗ trợ và đưa vào đúng phase.
2. Dùng mã công việc ổn định. Tìm và cập nhật dòng hiện có trước khi thêm mới. Giữ các việc chưa hoàn thành và tránh tạo thêm tài liệu bàn giao song song.
3. Chỉ đổi trạng thái khi có bằng chứng và xác nhận của người phụ trách. Khi ghi `READY FOR TV1`, kèm mốc commit và hướng dẫn tích hợp. Khi ghi `DONE`, kèm kết quả nghiệm thu hoặc đường dẫn bằng chứng.
4. Giữ lịch sử quyết định theo mốc commit hoặc ngày xác nhận, người xác nhận, nội dung đã chốt và tác động đến Client/Backend/dữ liệu. Đánh dấu rõ đề xuất đang chờ duyệt.
5. Giữ tài liệu bàn giao Admin Auth gốc làm căn cứ. Ghi các yêu cầu mới và trạng thái hiện hành tại file tập trung này.
