# Hợp đồng xác thực tài khoản Huyền Cơ

Hợp đồng 1.0 cho AUTH-01–07 và DATA-01–05. Backend đã triển khai và kiểm thử qua HTTP trên PostgreSQL TEST V13. Phần nối biểu mẫu Next.js và nghiệm thu trình duyệt chờ TV1.

## API và quyền truy cập

| Phương thức và đường dẫn | Request | Thành công |
| --- | --- | --- |
| `POST /api/v1/auth/register` | JSON gồm `displayName`, `identifier`, `password` | `201` và thông tin tài khoản mới có role `USER`. Client chuyển tới `/dang-nhap`. |
| `POST /api/v1/auth/login` | JSON gồm `identifier`, `password` | `200`, cấp cookie khách hàng và trả dữ liệu phiên. Nhận tài khoản `USER` hoặc `CONSULTANT`. |
| `GET /api/v1/auth/session` | Cookie khách hàng | `200`, trả dữ liệu phiên hiện hành. |
| `POST /api/v1/auth/logout` | Cookie khách hàng và header CSRF, body `{}` | `204`, thu hồi phiên và xóa cookie khách hàng. |
| `POST /api/v1/auth/admin/login` | JSON gồm `identifier`, `password` | `200`, cấp cookie Admin và trả dữ liệu phiên. Chỉ nhận tài khoản `ADMIN`. |
| `GET /api/v1/auth/admin/session` | Cookie Admin | `200`, trả dữ liệu phiên Admin. |
| `POST /api/v1/auth/admin/logout` | Cookie Admin và header CSRF, body `{}` | `204`, thu hồi phiên và xóa cookie Admin. |

- Form khách hàng gửi `identifier` theo tên trường hiện có. Form Admin ánh xạ ô “Tài khoản” sang cùng trường. Trường xác nhận mật khẩu ở form đăng ký chỉ dùng để kiểm tra trên Client. API từ chối trường ngoài hợp đồng, kể cả `role` và `confirmation`.
- TV1 điều hướng từ role do Server trả về. `USER` về trang công khai, `ADMIN` vào `/admin`. Chỉ bật điều hướng `CONSULTANT` tới workspace sau khi workspace và quyền tương ứng sẵn sàng.
- Mọi API Admin kiểm phiên Admin và quyền trên Server. Thiếu phiên hợp lệ trả `401`, gồm cả trường hợp chỉ có cookie khách hàng. Đăng nhập đúng mật khẩu nhưng sai cổng theo role, hoặc thao tác với phiên hợp lệ nhưng thiếu quyền yêu cầu, trả `403 FORBIDDEN`. Role lấy từ DB. Các API sửa dữ liệu Admin kiểm thêm Origin và CSRF.

## Dữ liệu gửi và nhận

- `displayName` bỏ khoảng trắng đầu/cuối, dài 1–80 ký tự Unicode và loại ký tự điều khiển.
- `identifier` là một username hoặc một email cho mỗi tài khoản. Sau khi bỏ khoảng trắng đầu/cuối, username dùng `[a-zA-Z0-9._-]{3,32}`. Email dài tối đa 254 ký tự ASCII và có một dấu `@`. Phần trước `@` dài 1–64 ký tự, gồm các nhóm `[a-zA-Z0-9_+%-]+` phân cách bằng dấu chấm. Tên miền có ít nhất hai nhãn phân cách bằng dấu chấm. Mỗi nhãn dài 1–63 ký tự, gồm chữ cái ASCII, chữ số hoặc dấu gạch ngang, với đầu và cuối là chữ cái hoặc chữ số. Chuẩn hóa ASCII sang chữ thường trước khi so trùng và tìm kiếm. Đăng ký bằng email trong mốc này chỉ dùng địa chỉ làm định danh nhập liệu.
- `password` khi đăng ký dài 8–128 điểm mã Unicode. Giữ nguyên ký tự và khoảng trắng, không yêu cầu pha trộn các loại ký tự. Mỗi định danh là duy nhất; hai tài khoản có thể chọn cùng mật khẩu và mỗi bản băm Argon2id có salt riêng. Login giữ giới hạn 1–128 điểm mã Unicode và tiếp tục hỗ trợ mật khẩu đã đăng ký. Ngưỡng 8 là chính sách bản thử nghiệm localhost; nhóm phải đánh giá lại nguy cơ mật khẩu dễ đoán và biện pháp xác thực trước khi triển khai Internet. Mọi POST dùng đối tượng JSON UTF-8 với giới hạn 16 KiB. Từ chối khóa trùng, giá trị sai kiểu và tham số query ngoài hợp đồng.
- Mọi phản hồi có body dùng envelope `requestId` (UUID do Server cấp), `status` (`COMPLETED` hoặc `FAILED`), `data`, `error`. Phản hồi Auth có `Cache-Control: no-store`, kể cả khi thất bại.

Ví dụ `data` khi đăng nhập hoặc đọc phiên. Đăng ký chỉ trả trường `account` trong `data`. `expiresAt` là thời điểm UTC theo ISO 8601.

```json
{
  "account": {
    "id": "11111111-1111-4111-8111-111111111111",
    "displayName": "Tài khoản kiểm thử",
    "role": "USER"
  },
  "expiresAt": "2026-11-08T08:00:00Z",
  "csrfToken": "<token gắn với phiên>"
}
```

Khi thất bại, `data=null` và `error` gồm `code` cùng `message`. Sai mật khẩu, định danh không tồn tại hoặc tài khoản bị khóa dùng cùng phản hồi đăng nhập. Client xử lý theo mã lỗi.

| HTTP | Mã | Trường hợp |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Sai định dạng, thiếu trường, dư trường hoặc giá trị ngoài giới hạn. |
| 401 | `INVALID_CREDENTIALS` | Đăng nhập thất bại. |
| 401 | `INVALID_SESSION` | Thiếu phiên phù hợp, phiên hết hạn, đã thu hồi hoặc tài khoản bị khóa. |
| 403 | `FORBIDDEN` | Đúng thông tin đăng nhập nhưng sai cổng, hoặc phiên hợp lệ thiếu quyền thao tác. |
| 403 | `CSRF_REJECTED` | Origin hoặc header bảo vệ yêu cầu ghi không hợp lệ. |
| 409 | `IDENTIFIER_TAKEN` | Trùng định danh sau chuẩn hóa, kể cả khi đăng ký đồng thời. |
| 429 | `TOO_MANY_REQUESTS` | Vượt giới hạn đăng ký hoặc đăng nhập. Kèm `Retry-After` theo giây. |
| 503 | `DATABASE_UNAVAILABLE` | Kho tài khoản hoặc phiên tạm thời không truy cập được. |
| 500 | `INTERNAL_ERROR` | Lỗi chưa phân loại. |

## Cookie, thời hạn và CSRF

- Tên cookie là `huyenco_account_session` cho khách hàng và `huyenco_admin_session` cho Admin. Cả hai dùng `HttpOnly`, `SameSite=Lax`, `Path=/api/v1` và phạm vi host hiện tại. Bật `Secure` khi triển khai HTTPS. Môi trường HTTP kiểm thử nội bộ dùng cấu hình riêng.
- Phiên có hạn tuyệt đối từ lúc cấp, mặc định 24 giờ cho khách hàng và 8 giờ cho Admin. Cookie hết hạn cùng phiên. Mỗi lần đăng nhập thành công cấp token ngẫu nhiên mới ít nhất 256 bit và thu hồi phiên cũ của cùng cổng nếu request có cookie hợp lệ. Đăng xuất dùng `Max-Age=0` với cùng tên, host và path. Đăng xuất bằng phiên đã hết hiệu lực trả `401 INVALID_SESSION`; Client bỏ trạng thái đã đăng nhập và có thể đăng nhập lại.
- Browser gọi API cùng Origin qua Next.js với `credentials: "same-origin"`. TV1 bổ sung rewrite cho `/api/v1/auth/:path*` và, khi có API quản trị, cho đường dẫn Admin tương ứng. TV2 đối chiếu Origin thật qua proxy. POST và các yêu cầu ghi Admin gửi `Content-Type: application/json` cùng `X-HuyenCo-Request: 1`. Backend kiểm một Origin nằm trong danh sách cho phép. CLI kiểm thử gửi Origin tường minh.
- Đăng ký và đăng nhập kiểm Origin và header yêu cầu trước khi cấp phiên. Đăng xuất và thao tác ghi Admin kiểm thêm `X-CSRF-Token` gắn với cookie phiên tương ứng. Server trả token CSRF khi login và GET session để Client phục hồi sau tải lại. Client giữ token CSRF trong bộ nhớ. TV2 có thể dẫn xuất token bằng HMAC-SHA-256 từ khóa cấu hình bí mật, tên cổng và token phiên, rồi so sánh an toàn theo thời gian.
- TV2 giới hạn các lượt đăng nhập theo IP và theo cặp IP/định danh đã chuẩn hóa, áp dụng tương tự cho định danh chưa tồn tại. Đăng ký có giới hạn riêng theo IP. Các ngưỡng vận hành cấu hình ở Backend. Phản hồi và log dùng mã lỗi cùng request ID để đối chiếu, loại mật khẩu, cookie, token và body xác thực khỏi log.

## Migration và dữ liệu kiểm thử

TV3 đã thêm [migration V13](../server/src/main/resources/db/migration/V13__account_auth.sql) và áp dụng lên `huyenco_test_tv1_20261107`. Kết quả kiểm toán được ghi trong [bàn giao môi trường TEST](55-TV2-TV3-TEST-ENVIRONMENT-20261107.md#migration-auth-v13). TV2 dùng schema này để triển khai API và chuẩn bị tài khoản kiểm thử.

| Bảng | Dữ liệu và ràng buộc tối thiểu |
| --- | --- |
| `accounts` | UUID khóa chính, `identifier_normalized` duy nhất, `display_name`, `password_hash`, `role` thuộc `USER/ADMIN/CONSULTANT`, `status` thuộc `ACTIVE/LOCKED`, thời điểm tạo. Đăng ký công khai luôn ghi `USER` do Server gán. |
| `account_sessions` | UUID khóa chính, FK tới `accounts`, `realm` thuộc `CUSTOMER/ADMIN`, `token_hash` duy nhất, `created_at`, `expires_at`, `revoked_at` nullable. Dùng `TIMESTAMPTZ`, ràng buộc hết hạn sau lúc tạo và index phục vụ dọn phiên hết hạn. |

- Băm mật khẩu bằng Argon2id với salt riêng, tối thiểu 19 MiB, hai vòng và độ song song một. Lưu kết quả băm có tham số. Token cookie là chuỗi ngẫu nhiên có entropy cao, lưu SHA-256 của token trong DB. Phiên chỉ hợp lệ khi bản ghi còn hạn, chưa thu hồi, tài khoản đang hoạt động và role vẫn phù hợp cổng. Luồng khóa tài khoản hoặc đổi role khi được triển khai phải thu hồi phiên trong cùng giao dịch để phiên cũ không có hiệu lực lại.
- Tạo USER và ADMIN TEST bằng dữ liệu riêng. Tạo CONSULTANT TEST để kiểm đường đăng nhập khách hàng nếu cần. Cấp tài khoản đặc quyền bằng quy trình quản trị có kiểm soát, với mật khẩu cấp ngoài Git. Dùng TEST riêng đã xác nhận datasource, sao lưu và đối chiếu H01 trước/sau migration.
- Từ V14, khi bật Auth trên profile `db`, lịch sử dùng phiên tài khoản theo quy tắc bên dưới. Cookie `huyenco_session` và dữ liệu H01 cũ thuộc chế độ tương thích.

## Ca bàn giao TV1

1. Đăng ký hợp lệ nhận `201/USER`. Thử lại với định danh đổi hoa/thường nhận `409`. Gửi thêm `role` nhận `400`.
2. Đăng nhập đúng và tải lại trang qua GET session. Kiểm sai mật khẩu hoặc định danh lạ nhận cùng `401`. USER đăng nhập cổng Admin nhận `403`. Gọi API Admin chỉ với cookie khách hàng nhận `401`.
3. Thử Origin sai, thiếu header yêu cầu và CSRF sai. Kiểm cookie đúng thuộc tính qua proxy, phiên hết hạn, logout `204`, và cookie cũ bị từ chối sau logout hoặc sau khi bị thay bởi phiên mới.
4. Trên PostgreSQL TEST, đối chiếu tài khoản, phiên và ràng buộc định danh, rồi hồi quy lưu/đọc lịch sử bằng hai phiên H01 khác nhau.
5. TV2–TV3 bàn giao endpoint thực tế, migration và kết quả kiểm API trên TEST. TV1 xác nhận điều hướng, xử lý lỗi và phiên qua trình duyệt khi có thể phối hợp.

## Chạy Backend Auth trên TEST

Build với Maven profile `database`, chạy Spring profile `db` với datasource `huyenco_test_tv1_20261107` đã ở V13. Đặt `AUTH_ENABLED=true`, cấp `AUTH_CSRF_KEY` từ nguồn bí mật dưới dạng Base64 của 32 byte ngẫu nhiên. Giữ cùng khóa giữa các lần khởi động của một môi trường nếu cần Client tiếp tục dùng token CSRF đã cấp. Dùng `AUTH_SECURE_COOKIE=false` chỉ khi thử HTTP nội bộ. Mặc định cookie Auth yêu cầu HTTPS. Đặt `ALLOWED_ORIGINS` theo Origin thực của Next.js và giữ Flyway tắt khi chạy TEST đã migrate.

Giới hạn mặc định trong 15 phút là 60 lượt login theo IP, 10 lượt login theo cặp IP/định danh và 10 lượt đăng ký theo IP. Ba ngưỡng đọc từ `AUTH_LOGIN_PER_IP`, `AUTH_LOGIN_PER_IDENTIFIER` và `AUTH_REGISTER_PER_IP`. Bộ đếm nằm trong một tiến trình Backend và dùng địa chỉ do servlet nhận. Khi dùng reverse proxy, cấu hình hạ tầng tin cậy để servlet nhận đúng địa chỉ nếu cần giới hạn riêng theo IP khách.

Lượt kiểm ngày 07/11/2026 chạy trên `http://127.0.0.1:18095`. Có 42 ca HTTP Auth đạt, gồm phiên Admin và khách hàng, mật khẩu sai, xung đột định danh, xoay token, hết hạn, thu hồi, Origin, CSRF và giới hạn tần suất. Hồi quy H01 đạt 49 yêu cầu HTTP và 8 phản hồi cuối STOMP. Hai lượt đã dọn bản ghi thử. Kiểm trình duyệt qua Next.js và môi trường hai máy vẫn là bước bàn giao tiếp theo.

## Lịch sử theo tài khoản V14

- Với profile `db` và `AUTH_ENABLED=true`, `POST /api/v1/session` trả thời hạn và CSRF từ phiên khách hàng hiện có. API lưu, liệt kê, đọc và xóa `/api/v1/history` yêu cầu phiên này. Khách và phiên hết hạn nhận `401 LOGIN_REQUIRED`. Phiên Admin và cookie H01 không cấp quyền truy cập lịch sử tài khoản. Với mã bản ghi ngoài quyền, API trả `404`.
- Khách vẫn lập quẻ được. Để lưu kết quả mới, người dùng đăng nhập rồi lập quẻ trong phiên đã xác thực. WebSocket dùng `/api/v1/ws` để cookie khách hàng có `Path=/api/v1` đi cùng yêu cầu. Kết quả tạm chỉ lưu được từ phiên tài khoản đã tính ra kết quả. Sau khi lưu, mọi phiên hợp lệ của cùng tài khoản đọc được qua REST.
- Migration tạo bảng `account_history` với khóa sở hữu theo tài khoản. Bản ghi H01 cũ được giữ trong `interpretation_history` và thuộc phiên ẩn danh ban đầu. Bản này chưa có thao tác chuyển dữ liệu H01 vào tài khoản. Môi trường chạy với Auth tắt tiếp tục dùng H01 cho kiểm thử tương thích.
- Giao diện bật `NEXT_PUBLIC_ACCOUNT_HISTORY=1` khi build và khi chạy, trỏ `HUYENCO_API_URL` tới Backend Auth. Next.js chuyển tiếp các tuyến Auth và WebSocket cùng origin. Đăng nhập dẫn tới lịch sử, tại đó có nút đăng xuất. Khách được dẫn tới đăng nhập khi mở lịch sử hoặc muốn lưu kết quả.
- Trên TEST V14, kiểm qua Next.js đạt 27 yêu cầu HTTP và hai kết quả STOMP, gồm khách bị chặn lưu, tài khoản khác bị chặn đọc/xóa, cùng tài khoản đọc bằng phiên thứ hai và phiên cũ bị từ chối sau đăng xuất. Chrome cũng đạt luồng đăng ký, đăng nhập, lập quẻ, lưu, tải lại và đăng xuất. Các tài khoản thử đã được dọn. Nghiệm thu qua thiết bị thứ hai dành cho mốc triển khai sau.

Tham chiếu triển khai. [Bàn giao Auth của TV1](https://github.com/trong-crypto/Huy-n-c-/blob/50cba56a19d6e90be5f3aef01a4e67b91c8da92d/docs/TV1-PHASE2-ADMIN-AUTH-HANDOFF.md), [môi trường TEST](55-TV2-TV3-TEST-ENVIRONMENT-20261107.md), [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
