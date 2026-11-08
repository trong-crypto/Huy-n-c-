# Bàn giao nghiệm thu Admin Phase 4

ADM-08 và ADM-DATA-06 dùng chung một Backend và một PostgreSQL TEST để đối chiếu thống kê, tài khoản, vai trò, hồ sơ tư vấn viên, CMS và nhật ký quản trị.

## Môi trường cục bộ

| Thành phần | Giá trị |
| --- | --- |
| PostgreSQL | `huyenco_phase4_test_20261108` tại `127.0.0.1:5432`, Flyway V20 |
| Backend | `http://127.0.0.1:18117`, kiểm nhanh `GET /api/v1/health` |
| Origin Client đề xuất | `http://127.0.0.1:18118` |
| Spring | Maven profile `database`, Spring profile `db`, `AUTH_ENABLED=true` |

Database được tạo từ bản sao TEST có dữ liệu tri thức và 64 quẻ. Tài khoản, phiên, hồ sơ, dữ liệu CMS và lịch sử tạo trong lượt kiểm là dữ liệu tổng hợp. Khi tạo môi trường tương đương, dùng database riêng có tên bắt đầu bằng `huyenco_phase4_test`. Đặt `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` và chạy Flyway tới V20 trước khi khởi động Backend. Dùng `AUTH_CSRF_KEY` là Base64 của 32 byte ngẫu nhiên, `AUTH_SECURE_COOKIE=false` cho HTTP loopback, và `ALLOWED_ORIGINS` chứa địa chỉ Backend lẫn Origin Client thử nghiệm. Có thể dùng `SPRING_FLYWAY_ENABLED=false` khi khởi động trên schema đã migrate và validate.

Trên máy TV1, ưu tiên khôi phục bản sao TEST đã có tri thức rồi migrate tới V20. Nếu dùng database mới, chạy bước bootstrap theo README với đúng tên database TEST và hai PDF nguồn. PostgreSQL và các tiến trình loopback cần chạy trên máy đang nghiệm thu.

Trong PowerShell tại thư mục `server`, sau khi đặt các biến kết nối PostgreSQL TEST và `AUTH_CSRF_KEY`:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'db'
$env:SERVER_ADDRESS = '127.0.0.1'
$env:SERVER_PORT = '18117'
$env:AUTH_ENABLED = 'true'
$env:AUTH_SECURE_COOKIE = 'false'
$env:ALLOWED_ORIGINS = 'http://127.0.0.1:18117,http://127.0.0.1:18118'
.\mvnw.cmd -Pdatabase spring-boot:run
```

Trong PowerShell khác, tại thư mục `client`:

```powershell
npm.cmd ci
$env:HUYENCO_API_URL = 'http://127.0.0.1:18117'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:NEXT_PUBLIC_ACCOUNT_HISTORY = '1'
$env:NEXT_PUBLIC_METHOD_GUIDES = '1'
$env:NEXT_PUBLIC_ADMIN_ACCOUNTS = '1'
npm.cmd run dev -- --hostname 127.0.0.1 --port 18118
```

## Tạo Admin TEST và chạy lại bộ kiểm

Đăng ký tài khoản tổng hợp, ví dụ `phase4-tv1-admin`, bằng `POST /api/v1/auth/register` với `identifier`, `displayName` và mật khẩu tự đặt. Request đăng ký cần `Content-Type: application/json`, Origin cho phép và `X-HuyenCo-Request: 1`. Trong Query Tool của database Phase 4 TEST, cấp quyền cho đúng tài khoản vừa đăng ký.

```sql
UPDATE accounts
SET role = 'ADMIN'
WHERE current_database() = 'huyenco_phase4_test_20261108'
  AND identifier_normalized = 'phase4-tv1-admin'
  AND role = 'USER'
RETURNING identifier_normalized, role;
```

Chạy từ thư mục gốc dự án. Cài dependencies Client để script dùng thư viện WebSocket/STOMP. `psql` cần nằm trên PATH hoặc đặt đường dẫn trong `PHASE4_PSQL`. Truyền mật khẩu qua prompt hoặc kho bí mật.

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGDATABASE = 'huyenco_phase4_test_20261108'
$env:PGUSER = '<role PostgreSQL TEST>'
$env:PHASE4_BACKEND_URL = 'http://127.0.0.1:18117'
$env:PHASE4_ADMIN_IDENTIFIER = 'phase4-tv1-admin'
$env:PGPASSWORD = [pscredential]::new('test', (Read-Host 'PostgreSQL TEST' -AsSecureString)).GetNetworkCredential().Password
$env:PHASE4_ADMIN_PASSWORD = [pscredential]::new('test', (Read-Host 'Admin TEST' -AsSecureString)).GetNetworkCredential().Password
# Chọn mã chưa có bài CMS, hoặc tạo database TEST mới.
$env:PHASE4_METHOD_CODE = 'TIME'
try { node .\scripts\verify_phase4_admin.mjs }
finally { Remove-Item Env:PGPASSWORD, Env:PHASE4_ADMIN_PASSWORD -ErrorAction SilentlyContinue }
```

Script đối chiếu ID Admin trả về từ Backend với ID trong PostgreSQL trước khi tạo dữ liệu. Mỗi lượt dùng một tiền tố riêng cho 28 tài khoản, 3 hồ sơ và các thao tác demo. Bài CMS và dữ liệu tổng hợp được giữ trong TEST để đọc lại. Trong lúc chạy, dùng database riêng cho lượt kiểm để bộ kiểm có thể đối chiếu trạng thái trước và sau một cách nhất quán.

## Kết quả ngày 08/11/2026

- Flyway migrate và validate V20. Backend trả health 200.
- Lượt kiểm lại với CMS `OBJECT_COUNT` đạt 155 yêu cầu HTTP và 1 lượt STOMP. Kiểm 19 tuyến theo cặp phương thức và đường dẫn, gồm 106 ca từ chối và 4 ca xung đột phiên bản. Dấu vân tay dữ liệu trước và sau mỗi nhóm kiểm khớp.
- 28 tài khoản của lượt này nằm trên hai trang, gồm 4 tài khoản bị khóa. Ba hồ sơ bao phủ `PENDING_REVIEW`, `APPROVED` và `REJECTED`. Dùng tiền tố `phase4-28dadd01-f78` để tìm đúng dữ liệu của lượt này trên môi trường hiện tại.
- Kiểm công bố và ẩn/hiện bài CMS, thu hồi phiên sau khi khóa tài khoản, đối chiếu số liệu Dashboard và nhật ký bằng SQL. Một lượt Mai Hoa tăng đúng một đơn vị thống kê. Lịch sử của lượt đó chỉ đọc được bằng phiên của tài khoản sở hữu.
- Bản build production Next.js và 1.374 kiểm thử Client đạt. Bộ Maven có 2.250 ca đạt và 30 ca tích hợp opt-in bỏ qua trong lượt Maven mặc định. Lượt HTTP/STOMP ở trên sử dụng PostgreSQL thật.
- Chrome trên cùng TEST V20 xác nhận khách bị chặn, Dashboard khớp số tài khoản và báo thiếu số liệu lịch sử, tạo/duyệt/từ chối hồ sơ có lý do, cấp và thu hồi vai trò, lọc đúng hai sự kiện đổi vai trò. TV1 có thể chạy độc lập lại theo checklist bên dưới.

## Checklist tích hợp cho TV1

1. Mở `http://127.0.0.1:18118/admin/login`. Cờ `NEXT_PUBLIC_ADMIN_ACCOUNTS=1` bật phần tài khoản, vai trò, thống kê, hồ sơ và nhật ký. Next.js chuyển tiếp các yêu cầu cùng Origin tới Backend TEST.
2. Đăng nhập Admin và kiểm Dashboard hiển thị số thật. Chọn ngày trước mốc ghi nhận để xác nhận giao diện phân biệt số 0 và chưa có dữ liệu.
3. Kiểm phân trang tài khoản, khóa/mở khóa, đổi vai trò và thu hồi phiên cũ. Kiểm tài khoản USER và CONSULTANT bị từ chối truy cập Admin.
4. Kiểm hồ sơ ở ba trạng thái, đọc lại lý do từ chối và thực hiện duyệt hoặc từ chối một hồ sơ TEST. Đối chiếu việc duyệt hồ sơ và việc cấp vai trò là hai thao tác riêng.
5. Kiểm luồng CMS nháp, gửi duyệt, công bố, ẩn/hiện và đọc nhật ký. Tái hiện xung đột phiên bản bằng hai tab rồi tải lại chi tiết.
6. Kiểm hồi quy Mai Hoa và lịch sử đúng tài khoản. Ghi commit, Origin, URL, kết quả và bằng chứng của lần nghiệm thu trình duyệt PH4-PH-01.
