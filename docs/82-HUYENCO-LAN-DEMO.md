# Huyền Cơ · Hướng dẫn chạy Client và Admin

Chuẩn bị JDK 17, Node 24, Python và PostgreSQL 18. Máy chủ chạy một tiến trình Next.js cho cả Client và Admin, cùng Backend và PostgreSQL TEST V33. Khi thử một máy, dùng loopback. Khi thử hai máy cùng Wi-Fi, thiết bị thứ hai chỉ cần trình duyệt. Next.js chuyển tiếp REST và WebSocket, còn Backend và PostgreSQL nghe trên loopback.

| Thành phần | Địa chỉ mẫu |
| --- | --- |
| Website, dùng trên cả hai thiết bị | `http://192.168.1.6:18100` |
| Backend, dùng trên máy chủ | `http://127.0.0.1:18117` |
| PostgreSQL, dùng trên máy chủ | `127.0.0.1:5432` |

**Thứ tự chạy:** chuẩn bị TEST V33 ở mục 1, chạy Backend ở mục 2, rồi mở một PowerShell khác để chạy Client ở mục 3. Chỉ chạy các lệnh trên máy chủ. Máy thứ hai cùng Wi-Fi chỉ mở URL website qua IPv4 Wi-Fi của máy chủ. Cổng `18117` dành cho Backend. Nếu đang mở `http://127.0.0.1:18117/`, hãy chuyển sang URL website ở cổng `18100` sau khi Client khởi động.

## 1. Chuẩn bị PostgreSQL

Trên máy chủ, chạy `ipconfig` và lấy **IPv4 Address** của card Wi-Fi đang kết nối. Thay `192.168.1.6` trong các lệnh bằng IP hiện tại. Mở `services.msc` và khởi động dịch vụ PostgreSQL nếu kiểm tra sau chưa báo `accepting connections`.

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
& "$pgBin\pg_isready.exe" -h 127.0.0.1 -p 5432
```

Dùng **database TEST riêng có dữ liệu nguồn và Flyway V33** cho hướng dẫn này. Nếu đã tạo TEST V33, chuyển tới mục 2. Nếu chưa, tạo TEST theo các bước bên dưới và ghi lại tên database được in ra. Kéo mã mới từ GitHub chỉ cập nhật tệp migration. Schema PostgreSQL chỉ thay đổi khi Flyway chạy trên database đã chọn.

### Tạo database TEST mới nếu cần

Trên máy dự án có bản sao TEST V28 đã seed tại đường dẫn dưới đây. Nếu chuyển sang máy khác, cập nhật `$dump` thành đường dẫn của bản sao TEST đã được cấp.

```powershell
cd 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$testDb = "huyenco_chat_fixture_test_$(Get-Date -Format yyyyMMddHHmmss)"
$dump = 'C:\Users\abc\Documents\Codex\huyenco-chat-foundation-test-20261109\huyenco_chat_foundation_test_20261109_003702.dump'
if (!(Test-Path -LiteralPath $dump)) { throw 'Thieu ban sao TEST da seed' }
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/$testDb"
$env:DB_USERNAME = 'postgres'
$env:DB_PASSWORD = [pscredential]::new('postgres', (Read-Host 'Mat khau PostgreSQL TEST' -AsSecureString)).GetNetworkCredential().Password
$env:PGPASSWORD = $env:DB_PASSWORD
try {
    & "$pgBin\createdb.exe" -h 127.0.0.1 -p 5432 -U postgres -w $testDb
    if ($LASTEXITCODE -ne 0) { throw 'Tao TEST that bai' }
    & "$pgBin\pg_restore.exe" -h 127.0.0.1 -p 5432 -U postgres -w --no-owner --no-privileges --exit-on-error -d $testDb $dump
    if ($LASTEXITCODE -ne 0) { throw 'Khoi phuc TEST that bai' }
    Push-Location server
    try {
        .\mvnw.cmd -Pdatabase '-Dflyway.target=33' flyway:migrate
        if ($LASTEXITCODE -ne 0) { throw 'Flyway migrate that bai' }
        .\mvnw.cmd -Pdatabase -DskipTests package
        if ($LASTEXITCODE -ne 0) { throw 'Build Backend that bai' }
    } finally { Pop-Location }
    python -X utf8 .\scripts\prepare_chat_test_fixtures.py --database $testDb --psql "$pgBin\psql.exe" --java "$env:JAVA_HOME\bin\java.exe"
    if ($LASTEXITCODE -ne 0) { throw 'Tao fixture that bai' }
    Write-Host "Database TEST: $testDb"
} finally {
    Remove-Item Env:PGPASSWORD, Env:DB_PASSWORD -ErrorAction SilentlyContinue
}
```

Lưu riêng tên database và thông tin ba tài khoản `user`, `consultant`, `outsider` do script in ra. Chia sẻ mật khẩu TEST qua kênh nội bộ.

## 2. Chạy Backend trong PowerShell A

Khi được hỏi tên database, nhập tên TEST mà bước chuẩn bị đã in ra. Khối này xác nhận phiên bản schema bằng truy vấn chỉ đọc rồi chạy Backend. Flyway tắt trong lần khởi động này.

```powershell
cd 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\server'
$lanIp = (Read-Host 'Nhap IPv4 Wi-Fi cua may chu, hoac 127.0.0.1 neu chi thu tren mot may').Trim()
$webPort = 18100
$dbName = (Read-Host 'Nhap ten database TEST da tao').Trim()
if ($dbName -cnotmatch '^huyenco_chat_fixture_test(?:_[a-z0-9]+)?$') {
    throw 'Can ten database TEST tu muc 1, vi du huyenco_chat_fixture_test_20261110090000'
}
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/$dbName"
$env:DB_USERNAME = 'postgres'
$env:DB_PASSWORD = [pscredential]::new('postgres', (Read-Host 'Mat khau PostgreSQL' -AsSecureString)).GetNetworkCredential().Password
$env:PGPASSWORD = $env:DB_PASSWORD
try {
    $version = & "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d $dbName -XAtw -v ON_ERROR_STOP=1 -c 'SELECT max(version::int) FROM flyway_schema_history WHERE success'
    if ($LASTEXITCODE -ne 0) {
        throw "Khong truy van duoc Flyway tren '$dbName'. Xem loi psql ngay phia tren."
    }
    if ($version -ne '33') {
        $current = if ($version) { "V$version" } else { 'chua co migration thanh cong' }
        throw "Database '$dbName' hien o $current. Can TEST V33. Xem muc 1 de chuan bi ban TEST."
    }
} catch {
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    throw
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

$key = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($key) } finally { $rng.Dispose() }
$env:AUTH_CSRF_KEY = [Convert]::ToBase64String($key)
$env:SPRING_PROFILES_ACTIVE = 'db'
$env:SPRING_FLYWAY_ENABLED = 'false'
$env:SERVER_ADDRESS = '127.0.0.1'
$env:SERVER_PORT = '18117'
$env:AUTH_ENABLED = 'true'
$env:AUTH_SECURE_COOKIE = 'false' # HTTP noi bo
$env:SESSION_SECURE_COOKIE = 'false'
$websiteUrl = "http://${lanIp}:$webPort"
$env:ALLOWED_ORIGINS = ($websiteUrl, "http://127.0.0.1:$webPort", "http://localhost:$webPort" | Select-Object -Unique) -join ','
Write-Host "URL website sau khi chay Client: $websiteUrl"
try { .\mvnw.cmd -Pdatabase spring-boot:run }
finally { Remove-Item Env:DB_PASSWORD, Env:AUTH_CSRF_KEY -ErrorAction SilentlyContinue }
```

Giữ cửa sổ A mở. Nếu dùng HTTPS cho demo, dùng URL HTTPS trong `ALLOWED_ORIGINS` và bật `AUTH_SECURE_COOKIE=true`.

| Kết quả kiểm tra | Cách xử lý |
| --- | --- |
| `database ... does not exist` | Kiểm tra tên TEST đã nhập, hoặc tạo TEST theo mục 1. |
| `password authentication failed` hoặc `connection refused` | Kiểm tra mật khẩu của role PostgreSQL, dịch vụ và cổng 5432. |
| `relation "flyway_schema_history" does not exist` | Database chưa có schema Flyway. Chuẩn bị lại database TEST theo mục 1. |
| In phiên bản khác V33 | Chọn đúng TEST V33 hoặc dựng bản TEST V33 mới theo mục 1. |

## 3. Chạy Next.js trong PowerShell B

Nếu đã chạy `npm run dev` hoặc Client cũ trên cổng 18100, dừng nó bằng `Ctrl+C` trong cửa sổ tương ứng. Mở PowerShell B trên máy chủ và chạy bản production dưới đây. Bản này bỏ kênh tự tải lại mã `/_next/hmr` dùng trong chế độ dev.

```powershell
Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/health' -ErrorAction Stop
$ready = Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/readiness' -ErrorAction Stop
if ($ready.status -ne 'READY') { throw 'Backend chua READY. Kiem tra PowerShell A.' }

cd 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\client'
if (!(Test-Path -LiteralPath 'node_modules/.bin/next.cmd')) {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Cai dependencies Client that bai' }
}
$env:HUYENCO_API_URL = 'http://127.0.0.1:18117'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:NEXT_PUBLIC_ACCOUNT_HISTORY = '1'
$env:NEXT_PUBLIC_ADMIN_ACCOUNTS = '1'
$env:NEXT_PUBLIC_METHOD_GUIDES = '1'
$env:NEXT_PUBLIC_ADMIN_HEXAGRAM_GLOSSES = '1'
$env:NEXT_PUBLIC_ADMIN_SOURCE_CATALOG = '1'
$env:NEXT_PUBLIC_WEBSITE_CONTENT = '1'
$clientBind = '0.0.0.0' # Neu chi thu tren mot may, doi thanh 127.0.0.1
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build Client that bai' }
npm.cmd run start -- --hostname $clientBind --port 18100
```

- **Hai máy cùng Wi-Fi:** mở URL mà PowerShell A đã in trên cả hai máy, ví dụ `http://192.168.1.6:18100/dang-ky`. Dùng IPv4 thật đã nhập ở mục 2.
- **Một máy:** chọn `127.0.0.1` ở mục 2 và cho `$clientBind` ở mục 3, rồi mở [trang đăng ký local](http://127.0.0.1:18100/dang-ky).

Giữ `HUYENCO_API_URL=http://127.0.0.1:18117` trong PowerShell B vì Next.js gọi Backend trên cùng máy chủ.

## 4. Sửa cấu hình khi đổi Wi-Fi, IP hoặc cổng

Trong cách chạy qua proxy này, đổi Wi-Fi thường chỉ cần đổi biến môi trường. Các tệp dưới đây là vị trí đọc cấu hình nếu cần rà lại mã.

| Thay đổi | Cần cập nhật |
| --- | --- |
| IP Wi-Fi của máy chủ đổi | Chạy `ipconfig`, thay `$lanIp` và URL mở trang. Khởi động lại Backend để áp dụng `ALLOWED_ORIGINS` mới. |
| Cổng website đổi | Đổi `$webPort`, tham số `--port`, URL trình duyệt và cổng của rule Windows Firewall. Khởi động lại Backend và Next.js. |
| Cổng Backend đổi | Đổi `SERVER_PORT`, `HUYENCO_API_URL` và URL health/readiness. Khởi động lại cả hai tiến trình. |
| Đổi sang Wi-Fi có profile Firewall khác | Kiểm profile bằng `Get-NetConnectionProfile` và cập nhật rule cho đúng profile, IP máy chủ và IP thiết bị kiểm thử nếu rule giới hạn địa chỉ. |
| Cần tìm nơi đọc Origin | Backend đọc `ALLOWED_ORIGINS` tại [application.yml](../server/src/main/resources/application.yml). Biến này chứa Origin có giao thức, host và cổng, ví dụ `http://192.168.1.6:18100`. |
| Cần tìm nơi định tuyến REST và WebSocket | [next.config.ts](../client/next.config.ts) chuyển tiếp REST và WebSocket tới `HUYENCO_API_URL`. [socketIdentity.ts](../client/src/services/session/socketIdentity.ts) và [useRoomChat.ts](../client/src/components/chat/useRoomChat.ts) dùng địa chỉ trang hiện tại cho WebSocket khi bật Auth. |

Khi chỉ đổi IP Wi-Fi, giữ `DB_URL` và `HUYENCO_API_URL` ở `127.0.0.1` nếu cả Backend và PostgreSQL vẫn chạy cùng máy Next.js. Đặt `NEXT_PUBLIC_API_BASE_URL=/api/v1` để trình duyệt tiếp tục dùng cùng Origin. Nếu bạn từng ghi IP cũ vào `client/.env.local` hoặc cấu hình Run của IDE, cập nhật hoặc bỏ giá trị ghi đè đó.

### Máy thứ hai không kết nối được

Từ thiết bị thứ hai chạy `Test-NetConnection 192.168.1.6 -Port 18100` nếu dùng Windows, thay IP ví dụ bằng IPv4 Wi-Fi của máy chủ. Nếu thất bại, kiểm tra IP, cổng Next.js, profile Firewall và chế độ cô lập thiết bị của Wi-Fi khách. Trên mạng nội bộ tin cậy, dùng rule dưới đây để cho phép các thiết bị trong mạng con truy cập cổng website. Mở PowerShell quản trị trên máy chủ và điền IPv4 Wi-Fi của máy chủ cùng profile đang hoạt động. Mọi thiết bị mở cùng URL website, nên dùng chung một Origin.

```powershell
$serverIp = '192.168.1.6'
$profile = 'Private'      # Doi thanh Public neu Get-NetConnectionProfile bao Public
$ruleName = 'HuyenCo-LAN-18100'
if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
    Remove-NetFirewallRule -Name $ruleName
}
New-NetFirewallRule -Name $ruleName -DisplayName 'Huyen Co LAN 18100' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 18100 -LocalAddress $serverIp -RemoteAddress LocalSubnet -Profile $profile
```

Rule trên chỉ mở cổng Next.js cho mạng con nội bộ. Backend và PostgreSQL vẫn dùng loopback. Sau demo, có thể gỡ rule bằng `Remove-NetFirewallRule -Name 'HuyenCo-LAN-18100'`. Nếu trang mở được nhưng lỗi `401`, kiểm phiên và cookie cho địa chỉ mới, sau đó đăng nhập lại. Nếu gặp `403` hoặc WebSocket bị từ chối, kiểm URL đang mở và `ALLOWED_ORIGINS`. Nếu gặp `502`, kiểm Backend và `HUYENCO_API_URL` trên máy chủ.

Khi đăng ký thất bại, mở **F12 → Network → register → Response**. Nếu trả `403 CSRF_REJECTED`, vào **Headers → Request Headers → Origin** và đối chiếu giao thức, host và cổng với danh sách `ALLOWED_ORIGINS` ở PowerShell A. Khối Backend trên cho phép đúng URL LAN đã nhập cùng hai địa chỉ cục bộ `127.0.0.1` và `localhost` trên cổng Client. Sau khi đổi danh sách, khởi động lại Backend. Nếu Console vẫn hiện `/_next/hmr`, kiểm tra cổng 18100 đang chạy `npm run start` rồi tải lại trang.

## 5. Checklist demo trên một hoặc hai thiết bị

1. Mở `/dang-ky` và `/dang-nhap` bằng URL LAN. Dùng các tài khoản TEST mà script đã tạo.
2. Trong phiên USER, lập quẻ Mai Hoa theo số vật, nhập **12**, chọn **Mùi**, lưu và tải lại trang Lịch sử để đối chiếu bản ghi. Mở Tra cứu quẻ, tìm **Tỉnh**, rồi kiểm một lần đổi lịch Âm–Dương.
3. Dùng USER tại `/tu-van` và CONSULTANT tại `/tu-van-vien`. Mở cùng phòng `active` hoặc tạo yêu cầu và chấp nhận trước khi trao đổi hai chiều.
4. Nếu dùng hai máy, ngắt Wi-Fi ở máy khách, gửi một tin từ máy còn kết nối rồi bật lại Wi-Fi trên máy khách. Kiểm tin đọc bù xuất hiện một lần. Giữ máy chủ trên mạng trong suốt ca này.
5. Dùng profile riêng đăng nhập `outsider`. Kiểm tài khoản ngoài phòng không thấy cuộc trò chuyện hay lịch sử riêng. Ghi URL, hai thiết bị, database và kết quả từng ca vào biên bản.

[Biên bản localhost V33](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#ph6-ph-01)

## 6. Truy cập Client và Admin cùng lúc

1. Chọn URL gốc đã in ở PowerShell A. Mở Client ở `/`, đăng ký ở `/dang-ky`, đăng nhập ở `/dang-nhap`. Giữ tài khoản USER riêng để demo lập quẻ, tra cứu, lịch và lịch sử.
2. Nếu đã có tài khoản ADMIN trong đúng database TEST, chuyển sang bước 4. Nếu chưa, đăng ký một tài khoản TEST riêng có tên `admin-demo` qua `/dang-ky`.
3. Trong pgAdmin, mở **Databases → database TEST đang dùng → Query Tool**. Thay `TEN_DATABASE_TEST` bằng tên đã nhập ở PowerShell A rồi chạy:

```sql
UPDATE accounts
SET role = 'ADMIN'
WHERE current_database() = 'TEN_DATABASE_TEST'
  AND current_database() ~ '^huyenco_chat_fixture_test(_[a-z0-9]+)?$'
  AND identifier_normalized = 'admin-demo'
  AND role = 'USER'
RETURNING identifier_normalized, role;
```

   Kết quả cần có một dòng `admin-demo | ADMIN`. Nếu trả 0 dòng, kiểm tra tên database và tài khoản. Nếu pgAdmin chưa mở được, kết nối qua `psql.exe -h 127.0.0.1 -p 5432 -U postgres -d TEN_DATABASE_TEST` từ thư mục bin của PostgreSQL, rồi chạy cùng truy vấn. Nhập mật khẩu ở lời nhắc.

4. Mở `/admin/login` trên **cùng URL gốc**, ví dụ [Admin trên một máy](http://127.0.0.1:18100/admin/login). Đăng nhập bằng `admin-demo` và mật khẩu đã đặt. Giữ Client ở cửa sổ thường và mở Admin trong cửa sổ ẩn danh hoặc hồ sơ trình duyệt khác để dễ kiểm hai vai trò cùng lúc. Cả hai dùng chung Next.js cổng 18100.
5. Kiểm Dashboard, tài khoản, hồ sơ tư vấn viên và CMS. Để thử quy trình công bố nội dung website, chuẩn bị hai Admin TEST riêng. Một tài khoản soạn và gửi duyệt, tài khoản còn lại duyệt và công bố.

Nếu trang Admin báo tính năng chưa bật, kiểm các biến `NEXT_PUBLIC_*` trong mục 3, dừng Client và build lại. Nếu USER bị từ chối trên Admin, dùng đúng tài khoản ADMIN tại cổng đăng nhập riêng. Với tư vấn viên, dùng tài khoản CONSULTANT có hồ sơ đủ điều kiện để vào `/tu-van-vien`.

## 7. Sao lưu và khôi phục thử

Dừng Backend TEST trước khi so sánh dữ liệu. Điền tên database TEST V33 hiện có. Đích luôn có tên mới và lần chạy thất bại có thể để lại đích thử riêng. Khi chạy lại, dùng đích mới theo timestamp. Lưu bản sao lưu ở thư mục riêng ngoài repo.

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$source = 'huyenco_chat_fixture_test'
if ($source -cnotmatch '^huyenco_chat_fixture_test(?:_[a-z0-9]+)?$') { throw 'Sai ten database TEST' }
$stamp = Get-Date -Format yyyyMMddHHmmssfff
$destination = "huyenco_chat_fixture_test_restore$stamp"
$backupDir = Join-Path $env:LOCALAPPDATA 'HuyenCo\test-backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$dump = Join-Path $backupDir "$source-$stamp.dump"
$connection = @('-h','127.0.0.1','-p','5432','-U','postgres','-w')
$env:PGPASSWORD = [pscredential]::new('postgres', (Read-Host 'Mat khau PostgreSQL TEST' -AsSecureString)).GetNetworkCredential().Password
try {
    $versionSql = 'SELECT max(version::int) FROM flyway_schema_history WHERE success'
    $before = & "$pgBin\psql.exe" @connection -d $source -XAt -v ON_ERROR_STOP=1 -c $versionSql
    if ($LASTEXITCODE -ne 0 -or $before -ne '33') { throw 'Nguon TEST chua o V33' }
    & "$pgBin\pg_dump.exe" @connection -Fc -d $source -f $dump
    if ($LASTEXITCODE -ne 0) { throw 'Sao luu that bai' }
    & "$pgBin\pg_restore.exe" --list $dump | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Khong doc duoc ban sao luu' }
    Get-FileHash -Algorithm SHA256 -LiteralPath $dump
    & "$pgBin\createdb.exe" @connection $destination
    if ($LASTEXITCODE -ne 0) { throw 'Khong tao duoc database dich moi' }
    & "$pgBin\pg_restore.exe" @connection --no-owner --no-privileges --exit-on-error --single-transaction -d $destination $dump
    if ($LASTEXITCODE -ne 0) { throw 'Khoi phuc that bai' }
    $after = & "$pgBin\psql.exe" @connection -d $destination -XAt -v ON_ERROR_STOP=1 -c $versionSql
    if ($LASTEXITCODE -ne 0 -or $after -ne $before) { throw 'Sai schema sau khoi phuc' }
    $countsSql = 'SELECT (SELECT count(*) FROM hexagrams), (SELECT count(*) FROM accounts), (SELECT count(*) FROM chat_conversations), (SELECT count(*) FROM chat_messages)'
    $sourceCounts = & "$pgBin\psql.exe" @connection -d $source -XAt -v ON_ERROR_STOP=1 -c $countsSql
    if ($LASTEXITCODE -ne 0) { throw 'Khong dem duoc du lieu nguon' }
    $restoredCounts = & "$pgBin\psql.exe" @connection -d $destination -XAt -v ON_ERROR_STOP=1 -c $countsSql
    if ($LASTEXITCODE -ne 0 -or $restoredCounts -ne $sourceCounts) { throw 'Du lieu khoi phuc lech nguon' }
    Write-Host "RESTORE PASS | TEST V$after | $destination | $restoredCounts"
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
```

Các số đếm lần lượt là quẻ, tài khoản, phòng chat và tin nhắn. Để chạy thử bản khôi phục, đặt `$dbName` bằng tên đích khi PowerShell A hỏi tên database, kiểm `READY`, đăng nhập lại và mở một phòng đã có tin. Tùy chọn `--no-owner --no-privileges` dùng cho bản TEST này và bỏ qua quyền sở hữu cùng GRANT gốc.

### Kết quả diễn tập P24

Ngày 10/11/2026, đã sao lưu một database TEST V33 bằng `pg_dump -Fc` và khôi phục bằng `pg_restore` vào database mới trên một cụm PostgreSQL 18 tạm. Kiểm tra Flyway V33, số dòng và dấu vân tay nội dung của sáu bảng đều khớp.

| Dữ liệu | Số dòng ở cả hai database |
| --- | ---: |
| Migration thành công | 33 |
| Quy tắc tính | 15 |
| Quẻ | 64 |
| Tài khoản TEST | 16 |
| Phòng chat | 2 |
| Tin nhắn | 2 |

SHA-256 của bản dump diễn tập là `8ede647d29c21db62798cd921663ca04d976b3197c8f92125c1017d694f7189d`. Kết quả máy đọc được nằm tại `server/target/p24-local/restore-evidence.json`. Cụm thử đã dừng.
