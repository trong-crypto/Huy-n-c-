# INT-01 · Bàn giao Backend và PostgreSQL TEST V27 cho TV1

Bản mã nghiệm thu là commit `8efe7db594dfd466b13abb5197c6cb5570d18653` trên GitHub. Môi trường bên dưới chạy trên máy của người nghiệm thu và dùng database riêng `huyenco_tv1_v27_test`. PostgreSQL và Backend chỉ cần lắng nghe loopback khi chạy cả Client trên cùng máy.

## 1. Chuẩn bị database TEST

Cần JDK 17, Node.js 20.9 trở lên theo README, PostgreSQL với công cụ `psql.exe`, Maven Wrapper và dữ liệu tri thức đã duyệt. Dùng một trong hai cách:

- **Tạo database TEST mới.** Tạo `huyenco_tv1_v27_test` trong PostgreSQL, rồi chạy lệnh dưới đây ở thư mục gốc repo. Thay thư mục PDF bằng thư mục chứa hai ấn bản đã ghim. Script hỏi mật khẩu PostgreSQL và nạp dữ liệu nguồn, chạy migration và xuất báo cáo kiểm toán.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_all.ps1 -DbName huyenco_tv1_v27_test -DbUser postgres -PdfDir 'C:\duong-dan\pdf-nguon'
```

- **Dùng bản sao TEST đã seed ở V20.** Khôi phục bản sao được phép sử dụng vào một database TEST riêng. Kiểm tra tên database và schema trước khi sao lưu và chạy migration theo bước 2. Dùng kênh riêng nếu cần trao đổi dữ liệu TEST hoặc thông tin truy cập.

Nếu TV1 chỉ có mã nguồn, cần có hai PDF đúng ấn bản hoặc được cấp môi trường TEST đã seed. Các file trên GitHub không mang theo dữ liệu PostgreSQL đã nạp.

## 2. Kiểm datasource, chạy Flyway và khởi động Backend

Dùng PowerShell tại thư mục `server`. Nếu dùng role PostgreSQL khác, thay `postgres` bằng role có quyền trên database TEST. Các lệnh `psql.exe` và `pg_dump.exe` giả định thư mục `bin` PostgreSQL đã nằm trên PATH.

```powershell
$dbName = 'huyenco_tv1_v27_test'
$upgradeFromV20 = $false # Đặt $true nếu vừa khôi phục bản TEST đã seed ở V20.
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/$dbName"
$env:DB_USERNAME = 'postgres'
$env:DB_PASSWORD = [pscredential]::new('test', (Read-Host 'PostgreSQL TEST' -AsSecureString)).GetNetworkCredential().Password

$env:PGPASSWORD = $env:DB_PASSWORD
try {
    $dbCheck = psql.exe -XAtw -h 127.0.0.1 -p 5432 -U $env:DB_USERNAME -d $dbName -c 'SELECT current_database()'
    if ($LASTEXITCODE -ne 0 -or $dbCheck -ne $dbName -or $dbName -notlike 'huyenco_*_test') { throw 'Sai datasource TEST' }

    $schemaQuery = 'SELECT max(version::int) FROM flyway_schema_history WHERE success'
    if ($upgradeFromV20) {
        $currentVersion = psql.exe -XAtw -h 127.0.0.1 -p 5432 -U $env:DB_USERNAME -d $dbName -c $schemaQuery
        if ($LASTEXITCODE -ne 0 -or $currentVersion -ne '20') { throw 'Bản sao TEST chưa ở V20' }
        $backup = Join-Path $env:TEMP "$dbName-before-v27-$(Get-Date -Format yyyyMMddHHmmss).dump"
        pg_dump.exe -Fc -w -h 127.0.0.1 -p 5432 -U $env:DB_USERNAME -d $dbName -f $backup
        if ($LASTEXITCODE -ne 0) { throw 'Sao lưu TEST thất bại' }
        .\mvnw.cmd -B -ntp -Pdatabase "-Dflyway.target=27" flyway:migrate
        if ($LASTEXITCODE -ne 0) { throw 'Flyway migrate thất bại' }
    }

    .\mvnw.cmd -B -ntp -Pdatabase "-Dflyway.target=27" flyway:validate
    if ($LASTEXITCODE -ne 0) { throw 'Flyway validate thất bại' }
    $version = psql.exe -XAtw -h 127.0.0.1 -p 5432 -U $env:DB_USERNAME -d $dbName -c $schemaQuery
    if ($LASTEXITCODE -ne 0 -or $version -ne '27') { throw 'Schema TEST chưa ở V27' }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$key = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($key) } finally { $rng.Dispose() }
$env:AUTH_CSRF_KEY = [Convert]::ToBase64String($key)
$env:SPRING_PROFILES_ACTIVE = 'db'
$env:SPRING_FLYWAY_ENABLED = 'false'
$env:SERVER_ADDRESS = '127.0.0.1'
$env:SERVER_PORT = '18117'
$env:AUTH_ENABLED = 'true'
$env:AUTH_SECURE_COOKIE = 'false'
$env:ALLOWED_ORIGINS = 'http://127.0.0.1:18117,http://127.0.0.1:18118'
try { .\mvnw.cmd -Pdatabase spring-boot:run }
finally { Remove-Item Env:DB_PASSWORD, Env:AUTH_CSRF_KEY -ErrorAction SilentlyContinue }
```

Nếu vừa bootstrap, giữ `$upgradeFromV20 = $false` để chạy validate trực tiếp. Giữ cùng khóa CSRF trong suốt phiên nghiệm thu.

Trong terminal khác:

```powershell
Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/health'
Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/readiness' |
  Select-Object status,database,schema,seed,businessFeaturesReady
```

Kỳ vọng health HTTP 200, readiness HTTP 200 với `READY / UP / READY / READY`. Readiness xác nhận điều kiện kho tri thức. Số migration được kiểm riêng bằng Flyway và SQL. Tại commit này `businessFeaturesReady=false` vẫn xuất hiện với `BUSINESS_IMPLEMENTATION_PENDING` và `RULES_NOT_AUTHORIZED`. Dùng checklist bên dưới để xác nhận từng luồng nghiệp vụ.

## 3. Chạy Client

Tại thư mục `client`, dùng địa chỉ `127.0.0.1` nhất quán để cookie, Origin và proxy hoạt động cùng nhau.

```powershell
npm.cmd ci
$env:HUYENCO_API_URL = 'http://127.0.0.1:18117'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:NEXT_PUBLIC_WS_URL = 'ws://127.0.0.1:18118/api/v1/ws'
$env:NEXT_PUBLIC_ACCOUNT_HISTORY = '1'
$env:NEXT_PUBLIC_METHOD_GUIDES = '1'
$env:NEXT_PUBLIC_ADMIN_ACCOUNTS = '1'
$env:NEXT_PUBLIC_ADMIN_HEXAGRAM_GLOSSES = '1'
$env:NEXT_PUBLIC_ADMIN_SOURCE_CATALOG = '1'
$env:NEXT_PUBLIC_WEBSITE_CONTENT = '1'
npm.cmd run dev -- --hostname 127.0.0.1 --port 18118
```

Mở [Client TEST](http://127.0.0.1:18118). Đăng ký hai tài khoản tổng hợp `int01-admin-a` và `int01-admin-b` bằng form người dùng. Trong Query Tool của database TEST, cấp quyền cho đúng hai tài khoản vừa tạo:

```sql
UPDATE accounts
SET role = 'ADMIN'
WHERE current_database() = 'huyenco_tv1_v27_test'
  AND identifier_normalized IN ('int01-admin-a', 'int01-admin-b')
  AND role = 'USER'
RETURNING identifier_normalized, role;
```

Dùng hai hồ sơ trình duyệt riêng để đăng nhập Admin, và một tài khoản USER khác để kiểm lịch sử.

## 4. Checklist TV1 chạy lại

| Luồng | Kết quả cần thấy |
| --- | --- |
| Mai Hoa LINES / OBJECT_COUNT / TIME và Tam Thế | Có tiến độ STOMP và kết quả đúng yêu cầu. Với OBJECT_COUNT có thể dùng 12 vật và giờ Mùi. |
| Tra cứu 64 quẻ, đổi lịch và Can Chi | Danh sách, chi tiết quẻ và các phép lịch trả dữ liệu. |
| Lịch sử theo tài khoản | USER A chủ động lưu được kết quả. USER B và khách không đọc được bản ghi của A. |
| Admin | Kiểm Dashboard và quyền theo [checklist Phase 4](63-TV2-TV3-PHASE4-ADMIN-TEST-HANDOFF.md#checklist-tích-hợp-cho-tv1). |
| CMS website | Admin A lưu và gửi duyệt. Khách thấy bản đã công bố cũ. Admin B công bố, tải lại trang chủ thấy bản mới. Xem [luồng V27](76-TV2-TV3-WEBSITE-CONTENT-CMS.md). |
| CMS nghĩa tên và nguồn | Kiểm [duyệt nghĩa tên](67-TV2-TV3-HEXAGRAM-GLOSS-PUBLICATION.md) và [áp dụng metadata sách](75-TV2-TV3-SOURCE-PROPOSAL-APPLICATION.md) trên dữ liệu tổng hợp. |

Ghi lại commit, tên database TEST, URL, ngày chạy và ca đạt hoặc lỗi. Bằng chứng nghiệm thu nên che cookie, token và mật khẩu.

## 5. Kết quả INT-01 ngày 08/11/2026

- Xác nhận GitHub `main` trỏ tới `8efe7db594dfd466b13abb5197c6cb5570d18653`. Backend được đóng gói từ cùng commit.
- Sao lưu và khôi phục PostgreSQL 18.6 TEST thành `huyenco_int01_v27_test_20261108_220252`. Chạy một lượt V21–V27 liên tiếp, Flyway validate đạt. Số dòng và dấu vân tay dữ liệu khớp ở cả 28 bảng cũ, cùng lịch sử Flyway V1–V20.
- Health và readiness đạt. Kiểm 121 yêu cầu HTTP tra cứu quẻ E02. Lượt hồi quy sau migration chạy 22 HTTP và 6 STOMP, giữ hai bản ghi lịch sử tổng hợp từ V20, kiểm cách ly theo tài khoản và giữa hai chế độ phiên, rồi lưu/xóa một bản ghi TEST mới.
- API nội dung công khai trả danh sách rỗng trước lần công bố đầu tiên trên database mới. Bằng chứng Chromium có hai Admin và khách cho luồng công bố nằm trong [biên bản V27](76-TV2-TV3-WEBSITE-CONTENT-CMS.md#nghiệm-thu-ngày-08112026).
- Môi trường kiểm thử này chạy trên loopback của TV2/TV3. Bước 4 dành cho lần nghiệm thu độc lập của TV1.
