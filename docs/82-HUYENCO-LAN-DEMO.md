# Huyền Cơ — Hướng dẫn chạy hệ thống qua Cloudflare

Cập nhật ngày 24/11/2026. Thực hiện các bước theo đúng thứ tự. Máy chủ chạy PostgreSQL, Backend trong IntelliJ, Client trong PowerShell và Cloudflare trong một PowerShell riêng. Người dùng, tư vấn viên và Admin cùng truy cập URL HTTPS do Cloudflare cấp.

| Thành phần | Cấu hình cố định |
| --- | --- |
| Database | `huyenco`, Flyway V40 |
| PostgreSQL | `127.0.0.1:5432` |
| Backend | `127.0.0.1:18117` |
| Client | `127.0.0.1:18100` |
| Địa chỉ truy cập | `https://…trycloudflare.com`, lấy mới ở bước 2 |

Luồng truy cập: trình duyệt → Cloudflare HTTPS/WSS → Client → Backend → PostgreSQL.

## 1. Bật PostgreSQL

Mở `services.msc`, tìm `postgresql-x64-18`, chọn **Start** nếu dịch vụ đang dừng. Mở PowerShell và kiểm tra:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_isready.exe' -h 127.0.0.1 -p 5432
```

Chỉ tiếp tục khi có `accepting connections`. Database `huyenco` đã được nâng lên V40 trong phiên triển khai. Các thao tác trên website ghi trực tiếp vào database này. pgAdmin là ứng dụng quản lý, có thể đóng sau khi kiểm tra database.

## 2. PowerShell A — mở Cloudflare và lấy URL

```powershell
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://127.0.0.1:18100 --no-autoupdate
```

Giữ cửa sổ này mở. Tìm khung chứa `Your quick Tunnel has been created` và sao chép URL dạng:

```text
https://TEN-DUOC-CAP.trycloudflare.com
```

Ở các bước sau, thay `TEN-DUOC-CAP` bằng tên thực tế vừa được cấp. URL có thể đổi mỗi lần khởi động tunnel. Chờ hoàn thành bước 4 rồi mới mở website. Nếu có lỗi `Unable to reach the origin service` trước lúc Client chạy, hoàn thành các bước tiếp theo và tải lại URL.

## 3. IntelliJ — cấu hình và chạy Backend

Mở dự án `C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM`. Vào **Run → Edit Configurations → HuyenCoApplication → Environment variables**.

Điền các biến dưới đây trong bảng biến môi trường:

| Biến | Giá trị |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `db` |
| `DB_URL` | `jdbc:postgresql://127.0.0.1:5432/huyenco` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | Mật khẩu PostgreSQL của bạn |
| `SPRING_FLYWAY_ENABLED` | `false` |
| `SERVER_ADDRESS` | `127.0.0.1` |
| `SERVER_PORT` | `18117` |
| `AUTH_ENABLED` | `true` |
| `AUTH_SECURE_COOKIE` | `true` |
| `SESSION_SECURE_COOKIE` | `true` |
| `ALLOWED_ORIGINS` | URL HTTPS lấy tại bước 2 |
| `AUTH_CSRF_KEY` | Khóa Base64 đã tạo và giữ trong cấu hình Run |
| `HUYENCO_HEXAGRAM_INTERPRETATION_ENABLED` | `true` |

Ví dụ cách điền Origin:

```text
ALLOWED_ORIGINS=https://TEN-DUOC-CAP.trycloudflare.com
```

Giá trị phải có `https://`, đúng tên miền, không kèm đường dẫn hoặc dấu `/` cuối.

Nếu chưa có `AUTH_CSRF_KEY`, tạo một lần bằng PowerShell rồi sao chép kết quả vào IntelliJ:

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
[Convert]::ToBase64String($bytes)
```

Giữ khóa đã tạo cho các lần chạy tiếp theo. Giữ mật khẩu và khóa trong cấu hình máy, tránh đưa vào Git hoặc gửi cùng URL website.

Nhấn **Apply → OK**, chạy `HuyenCoApplication`. Log cần hiện profile `db` và `Tomcat started on port 18117`. Nếu Backend đang chạy với URL cũ, dừng bằng nút Stop rồi chạy lại sau khi sửa Origin.

Maven profile `database` được bật mặc định trong `server/pom.xml`. Nếu IntelliJ báo thiếu `org.springframework.dao` hoặc `org.springframework.transaction`, nhấn chuột phải `server/pom.xml` → **Maven → Reload Project** rồi chạy lại.

## 4. PowerShell B — chạy Client

Mở PowerShell mới và chạy khối cấu hình này mỗi lần mở cửa sổ mới:

```powershell
cd 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\client'

Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/health' -ErrorAction Stop
$ready = Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/readiness' -ErrorAction Stop
if ($ready.status -ne 'READY') { throw 'Backend chua READY. Kiem tra IntelliJ.' }

$env:HUYENCO_API_URL = 'http://127.0.0.1:18117'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:NEXT_PUBLIC_ACCOUNT_HISTORY = '1'
$env:NEXT_PUBLIC_ADMIN_ACCOUNTS = '1'
$env:NEXT_PUBLIC_METHOD_GUIDES = '1'
$env:NEXT_PUBLIC_ADMIN_HEXAGRAM_GLOSSES = '1'
$env:NEXT_PUBLIC_HEXAGRAM_INTERPRETATIONS = '1'
$env:NEXT_PUBLIC_ADMIN_SOURCE_CATALOG = '1'
$env:NEXT_PUBLIC_WEBSITE_CONTENT = '1'
```

### Chuẩn bị bản chạy khi mới tải code hoặc vừa sửa code

Sau khối cấu hình, chạy:

```powershell
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Cai thu vien Client that bai' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build chua thanh cong. Doc thong bao ngay phia tren.' }
```

Nếu chỉ khởi động lại cùng bản code đã build thành công, tiếp tục ngay đến lệnh khởi chạy bên dưới.

### Khởi chạy

```powershell
npm.cmd run start -- --hostname 127.0.0.1 --port 18100
```

Đợi `Ready`, giữ cửa sổ này mở. Các biến `NEXT_PUBLIC_*` được sử dụng khi build, nên sau khi đổi các biến này phải build lại.

**Cảnh báo Next.js đang gặp:** dự án hiện dùng Next.js 16.4.2 theo lựa chọn giữ phiên bản cũ của chủ dự án. Công cụ có thể hiện lời nhắc nâng cấp bảo mật. Nếu chỉ tiếp tục build bằng phiên bản cũ, chọn **Skip** tại màn hình lựa chọn nâng cấp khi công cụ cung cấp lựa chọn đó. Nếu đã vào màn hình **Continue with Codex**, Esc sẽ hủy quy trình nâng cấp, và lệnh build có thể kết thúc với mã lỗi; chạy lại `npm.cmd run build` và kiểm tra kết quả. Chỉ coi build đạt khi lệnh kết thúc thành công. Phiên bản 16.4.2 vẫn có cảnh báo lỗ hổng đã biết; cần lên kế hoạch áp dụng bản vá.

## 5. Mở website và Admin

Mở URL HTTPS lấy tại bước 2 trên mọi thiết bị, kể cả máy chủ. Các đường dẫn:

| Trang | Đường dẫn thêm sau tên miền |
| --- | --- |
| Trang chủ | `/` |
| Đăng ký | `/dang-ky` |
| Đăng nhập USER/CONSULTANT | `/dang-nhap` |
| Không gian tư vấn viên | `/tu-van-vien` |
| Admin | `/admin/login` |

Ví dụ `https://TEN-DUOC-CAP.trycloudflare.com/admin/login`. Tư vấn viên đăng nhập thành công được chuyển vào không gian tư vấn viên. Admin đăng nhập bằng tài khoản có quyền ADMIN.

Trên điện thoại, tắt Wi-Fi, bật 4G/5G và mở cùng URL để nghiệm thu truy cập khác mạng. Kiểm tra đăng nhập, lập quẻ, lưu/xem lịch sử và gửi yêu cầu/chat bằng hai tài khoản USER/CONSULTANT. WSS sử dụng cùng tên miền HTTPS và được Client chọn tự động.

## 6. Lần sau chạy lại và khi đổi Wi-Fi

Lặp lại thứ tự **PostgreSQL → Cloudflare → Backend → Client → mở URL HTTPS**.

- Tunnel mới cấp URL khác: thay `ALLOWED_ORIGINS` trong IntelliJ rồi khởi động lại Backend, gửi URL mới cho người truy cập.
- Tunnel còn chạy và URL giữ nguyên: tiếp tục dùng Origin hiện có.
- Đổi Wi-Fi/IP máy chủ: các địa chỉ `127.0.0.1` trong lệnh giữ nguyên. Chờ tunnel kết nối lại; nếu tạo tunnel mới thì cập nhật Origin theo URL mới.
- Sửa code Client: dừng Client bằng Ctrl+C, chạy cấu hình ở bước 4, build lại rồi start, tải lại trình duyệt bằng Ctrl+Shift+R.
- Sửa code Backend: dừng và chạy lại trong IntelliJ. Nếu có migration mới, sao lưu database và nâng schema theo yêu cầu của bản code trước khi khởi động.

Máy chủ phải bật và có Internet. Dừng công khai website bằng Ctrl+C tại cửa sổ Cloudflare. Khi dừng toàn hệ thống, dừng Cloudflare, Client rồi Backend.

## 7. Kiểm tra nhanh và xử lý lỗi

```powershell
Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/health'
Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/readiness'
(Invoke-WebRequest 'http://127.0.0.1:18100').StatusCode
$publicUrl = Read-Host 'Dan URL HTTPS Cloudflare hien tai'
(Invoke-WebRequest $publicUrl -TimeoutSec 20).StatusCode
```

Kết quả mong đợi là health `UP`, readiness `READY`, hai trang trả `200`.

| Lỗi | Cách xử lý |
| --- | --- |
| Cloudflare báo `127.0.0.1:18100 ... actively refused`, trang lỗi 502 | Client chưa chạy cổng 18100. Thực hiện bước 4, đợi Ready rồi tải lại URL. |
| Trang hiện “Chưa xác minh được phiên”, API trả 500/502 | Kiểm Backend ở cổng 18117. Nếu log hiện 8080, sửa SERVER_PORT trong đúng cấu hình IntelliJ rồi chạy lại. |
| Đăng nhập/đăng ký trả `403 CSRF_REJECTED` hoặc WSS bị từ chối | Đối chiếu URL hiện tại với ALLOWED_ORIGINS, cập nhật đúng HTTPS rồi khởi động lại Backend. |
| API phiên trả `401 INVALID_SESSION` khi chưa đăng nhập | Đăng nhập trên URL mới. |
| Backend báo thiếu datasource URL hoặc profile mặc định | Kiểm SPRING_PROFILES_ACTIVE=db và ba biến DB_URL, DB_USERNAME, DB_PASSWORD. |
| Thiếu bảng `chat_read_positions` | Database chưa áp dụng V40. Dừng Backend, sao lưu và nâng migration. |
| Backend/Client báo cổng đã được dùng | Dừng tiến trình cũ đang dùng đúng cổng trước khi khởi chạy lại. |
| Build vẫn nhắc cập nhật Next.js | Xem ghi chú cuối bước 4. Kiểm phiên bản trong thư mục đang chạy, tránh nhầm với bản nâng cấp ở worktree khác. |
| Giao diện chưa cập nhật | Kiểm build thành công, dừng/start lại Client và Ctrl+Shift+R. |
| Cloudflare còn dòng lỗi đỏ cũ | Xem thời gian dòng lỗi. Tải lại URL và kiểm tra có phát sinh lỗi mới sau khi Client Ready hay không. |
| URL hết hiệu lực | Dùng URL mới được cấp khi chạy lại tunnel, cập nhật Origin và khởi động lại Backend. |

## 8. Nâng database khi bản code yêu cầu V40

Chỉ thực hiện mục này nếu database đang thấp hơn V40. Dừng Backend. Trong PowerShell tại thư mục dự án, chạy sao lưu rồi migration:

```powershell
cd 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/huyenco'
$env:DB_USERNAME = 'postgres'
$env:DB_PASSWORD = [pscredential]::new('postgres', (Read-Host 'Mat khau PostgreSQL' -AsSecureString)).GetNetworkCredential().Password
$env:PGPASSWORD = $env:DB_PASSWORD
try {
    New-Item -ItemType Directory -Force 'scripts/generated/db-backups' | Out-Null
    $backup = "scripts/generated/db-backups/huyenco-before-upgrade-$(Get-Date -Format yyyyMMddHHmmss).dump"
    & "$pgBin\pg_dump.exe" -h 127.0.0.1 -U postgres -d huyenco -Fc -f $backup
    if ($LASTEXITCODE -ne 0) { throw 'Sao luu that bai' }
    Push-Location server
    try {
        .\mvnw.cmd -Pdatabase '-Dflyway.target=40' flyway:migrate
        if ($LASTEXITCODE -ne 0) { throw 'Migration that bai' }
    } finally { Pop-Location }
    & "$pgBin\psql.exe" -h 127.0.0.1 -U postgres -d huyenco -XAtw -v ON_ERROR_STOP=1 -c 'SELECT max(version::int) FROM flyway_schema_history WHERE success'
    if ($LASTEXITCODE -ne 0) { throw 'Kiem tra Flyway that bai' }
    Write-Host "Backup: $backup"
} finally {
    Remove-Item Env:PGPASSWORD, Env:DB_PASSWORD -ErrorAction SilentlyContinue
}
```

Dùng JDK đã cấu hình hợp lệ cho Maven. Phiên bản migration cao nhất cần đạt 40. Sau đó tiếp tục bước 2 và 3.
