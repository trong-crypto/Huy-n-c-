# Huyền Cơ · Chạy demo và kiểm thử qua Wi-Fi nội bộ

Máy chủ chạy Next.js, Backend và PostgreSQL. Máy thứ hai chỉ cần trình duyệt và cùng mạng nội bộ. Trình duyệt gọi REST và WebSocket qua cùng địa chỉ Next.js. Backend và PostgreSQL nghe trên loopback.

| Thành phần | Địa chỉ mẫu |
| --- | --- |
| Website, dùng trên cả hai thiết bị | `http://192.168.1.6:18100` |
| Backend, dùng trên máy chủ | `http://127.0.0.1:18117` |
| PostgreSQL, dùng trên máy chủ | `127.0.0.1:5432` |

## 1. Chuẩn bị PostgreSQL

Trên máy chủ, chạy `ipconfig` và lấy **IPv4 Address** của card Wi-Fi đang kết nối. Thay `192.168.1.6` trong các lệnh bằng IP hiện tại. Mở `services.msc` và khởi động dịch vụ PostgreSQL nếu kiểm tra sau chưa báo `accepting connections`.

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
& "$pgBin\pg_isready.exe" -h 127.0.0.1 -p 5432
```

Chọn database có dữ liệu nguồn và Flyway **V33**. Dùng `huyenco` để trình diễn bằng dữ liệu chính, hoặc dùng database TEST riêng khi cần tạo phòng mẫu và thử các ca thu hồi phiên, sai quyền. Khi bật Auth, V33 dọn nội dung tin nhắn đã quá 30 ngày. Với database chính đang ở phiên bản cũ, sao lưu và nâng cấp riêng trước khi dùng.

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

Đặt `$dbName` thành tên database đã chọn. Với bản sao vừa tạo, dùng tên script in ra. Khối này xác nhận phiên bản schema bằng truy vấn chỉ đọc rồi chạy Backend.

```powershell
cd 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\server'
$lanIp = '192.168.1.6'
$webPort = 18100
$dbName = 'huyenco' # Hoac ten database TEST V33
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/$dbName"
$env:DB_USERNAME = 'postgres'
$env:DB_PASSWORD = [pscredential]::new('postgres', (Read-Host 'Mat khau PostgreSQL' -AsSecureString)).GetNetworkCredential().Password
$env:PGPASSWORD = $env:DB_PASSWORD
try {
    $version = & "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d $dbName -XAtw -v ON_ERROR_STOP=1 -c 'SELECT max(version::int) FROM flyway_schema_history WHERE success'
    if ($LASTEXITCODE -ne 0 -or $version -ne '33') { throw 'Database chua o Flyway V33' }
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
$env:ALLOWED_ORIGINS = "http://${lanIp}:$webPort"
try { .\mvnw.cmd -Pdatabase spring-boot:run }
finally { Remove-Item Env:DB_PASSWORD, Env:AUTH_CSRF_KEY -ErrorAction SilentlyContinue }
```

Giữ cửa sổ A mở. Nếu dùng HTTPS cho demo, dùng URL HTTPS trong `ALLOWED_ORIGINS` và bật `AUTH_SECURE_COOKIE=true`.

## 3. Chạy Next.js trong PowerShell B

```powershell
Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/health'
Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/readiness'

cd 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\client'
# Chay npm.cmd ci neu chua cai dependencies
$env:HUYENCO_API_URL = 'http://127.0.0.1:18117'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:NEXT_PUBLIC_ACCOUNT_HISTORY = '1'
npm.cmd run dev -- --hostname 0.0.0.0 --port 18100
```

Trên cả hai thiết bị, mở `http://192.168.1.6:18100` bằng IP hiện tại. Dùng cùng URL LAN trên máy chủ để Origin khớp. Nếu dùng `npm.cmd run build` và `npm.cmd run start`, đặt các biến trước khi build rồi chạy `npm.cmd run start -- --hostname 0.0.0.0 --port 18100`.

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

Từ thiết bị thứ hai chạy `Test-NetConnection 192.168.1.6 -Port 18100` nếu dùng Windows. Nếu thất bại, kiểm tra IP mới, cổng Next.js, profile Firewall và chế độ cô lập thiết bị của Wi-Fi khách. Nếu cần thêm rule, mở PowerShell quản trị trên máy chủ, điền IP thật của hai máy và chọn profile đang hoạt động.

```powershell
$serverIp = '192.168.1.6'
$clientIp = '192.168.1.20' # Thay bang IP thiet bi thu hai
$profile = 'Private'      # Doi thanh Public neu Get-NetConnectionProfile bao Public
$ruleName = 'HuyenCo-LAN-18100'
if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
    Remove-NetFirewallRule -Name $ruleName
}
New-NetFirewallRule -Name $ruleName -DisplayName 'Huyen Co LAN 18100' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 18100 -LocalAddress $serverIp -RemoteAddress $clientIp -Profile $profile
```

Rule trên dành riêng cho Next.js và thiết bị thử. Nếu trang mở được nhưng lỗi `401`, kiểm phiên và cookie cho địa chỉ mới, sau đó đăng nhập lại. Nếu gặp `403` hoặc WebSocket bị từ chối, kiểm URL đang mở và `ALLOWED_ORIGINS`. Nếu gặp `502`, kiểm Backend và `HUYENCO_API_URL` trên máy chủ.

## 5. Checklist demo trên hai thiết bị

1. Mở `/dang-ky` và `/dang-nhap` bằng URL LAN. Với database chính, dùng USER demo và CONSULTANT đã được duyệt. Với TEST, dùng các tài khoản script đã tạo.
2. Trên máy thứ hai, lập quẻ Mai Hoa theo số vật, nhập **12**, chọn **Mùi**, lưu và tải lại trang Lịch sử để đối chiếu bản ghi.
3. Dùng USER tại `/tu-van` và CONSULTANT tại `/tu-van-vien`. Mở cùng phòng `active` hoặc tạo yêu cầu và chấp nhận trước khi trao đổi hai chiều.
4. Ngắt Wi-Fi ở máy khách, gửi một tin từ máy còn kết nối rồi bật lại Wi-Fi trên máy khách. Kiểm tin đọc bù xuất hiện một lần. Giữ máy chủ trên mạng trong suốt ca này.
5. Dùng profile riêng đăng nhập `outsider`. Kiểm tài khoản ngoài phòng không thấy cuộc trò chuyện hay lịch sử riêng. Ghi URL, hai thiết bị, database và kết quả từng ca vào biên bản.

[Biên bản localhost V33](81-TV2-TV3-CHAT-SESSION-AND-CONSULTANT-DATA.md#ph6-ph-01)
