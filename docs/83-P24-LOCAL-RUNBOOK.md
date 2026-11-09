# P24 · Chạy và bàn giao Huyền Cơ trên một máy

Bản nghiệm thu dùng commit `23d61e4`, JDK 17, Node 24, PostgreSQL 18 và Flyway V33. Dùng database TEST riêng và hai hồ sơ trình duyệt để mô phỏng người dùng và tư vấn viên.

## 1. Chuẩn bị và chạy

1. Tại gốc repo, kiểm tra `git rev-parse --short HEAD`, `java -version`, `node -v` và `python --version`. Kiểm PostgreSQL local bằng `& 'C:\Program Files\PostgreSQL\18\bin\pg_isready.exe' -h 127.0.0.1 -p 5432`. Nếu PostgreSQL chưa phản hồi, kiểm tra dịch vụ trong `services.msc`.
2. Nếu chưa có database TEST V33 và tài khoản mẫu, chạy phần **Tạo database TEST mới** của [hướng dẫn 82](82-HUYENCO-LAN-DEMO.md#tạo-database-test-mới-nếu-cần). Bước đó khôi phục bản TEST V28 có seed, nâng Flyway tới V33 và tạo tài khoản `user`, `consultant` và `outsider`. Bản dump TEST có seed và thông tin tài khoản được bàn giao riêng.
3. Trong **PowerShell A**, chạy khối **Chạy Backend** của [hướng dẫn 82](82-HUYENCO-LAN-DEMO.md#2-chạy-backend-trong-powershell-a). Đặt `$lanIp = '127.0.0.1'`, `$webPort = 18100` và `$dbName` bằng tên TEST thực tế. Giữ Backend ở `127.0.0.1:18117`, dùng profile `db` và để Flyway tắt sau khi xác nhận V33. Nhập mật khẩu qua ô ẩn. Khối lệnh tạo khóa CSRF riêng cho lần chạy.
4. Trong **PowerShell B** tại gốc repo, chạy khối dưới đây. Nếu mới kéo repo hoặc lockfile thay đổi, chạy `npm.cmd ci` trong thư mục Client trước.

```powershell
Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/health'
$ready = Invoke-RestMethod 'http://127.0.0.1:18117/api/v1/readiness'
if ($ready.status -ne 'READY') { throw 'Backend chua san sang' }
Set-Location client
$env:HUYENCO_API_URL = 'http://127.0.0.1:18117'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:NEXT_PUBLIC_ACCOUNT_HISTORY = '1'
$env:NEXT_PUBLIC_ADMIN_ACCOUNTS = '1'
$env:NEXT_PUBLIC_METHOD_GUIDES = '1'
$env:NEXT_PUBLIC_ADMIN_HEXAGRAM_GLOSSES = '1'
$env:NEXT_PUBLIC_ADMIN_SOURCE_CATALOG = '1'
$env:NEXT_PUBLIC_WEBSITE_CONTENT = '1'
npm.cmd run dev -- --hostname 127.0.0.1 --port 18100
```

Mở [Huyền Cơ local](http://127.0.0.1:18100) bằng cùng địa chỉ trong cả hai hồ sơ. Với bản production, đặt các biến trước khi chạy `npm.cmd run build`, sau đó dùng `npm.cmd run start -- --hostname 127.0.0.1 --port 18100`. Kịch bản này chạy HTTP/WS trên loopback. Kết quả HTTPS/WSS cục bộ nằm trong [biên bản P21/P22](TV1-TO-TV2-TV3-HANDOFF.md#p21--kiểm-thử-httpswss-cục-bộ).

## 2. Sao lưu và khôi phục thử

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

Các số đếm lần lượt là quẻ, tài khoản, phòng chat và tin nhắn. Để chạy thử bản khôi phục, đặt `$dbName` bằng tên đích ở PowerShell A, kiểm `READY`, đăng nhập lại và mở một phòng đã có tin. Tùy chọn `--no-owner --no-privileges` dùng cho bản TEST này và bỏ qua quyền sở hữu cùng GRANT gốc.

## 3. Kịch bản demo 5–8 phút

| Bước | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| 1 | Mở hai hồ sơ trình duyệt riêng. Đăng nhập USER và CONSULTANT bằng tài khoản TEST. | Hai cửa sổ nhận đúng phiên và đúng vai trò. |
| 2 | Ở USER, mở Mai Hoa, nhập 12 vật, chọn giờ Mùi, gửi rồi lưu với tên `DEMO P24`. Tải lại Lịch sử. | Thấy tiến trình, ba quẻ, hào động và bản ghi đã lưu. |
| 3 | Tìm quẻ **Tỉnh** trong Tra cứu quẻ. Sau đó đổi một ngày dương lịch sang âm lịch. | Có nghĩa tên, nguồn tham chiếu và kết quả đổi lịch. |
| 4 | Mở USER ở `/tu-van` và CONSULTANT ở `/tu-van-vien`. Chọn phòng mẫu đang hoạt động, gửi tin hai chiều rồi tải lại. | Tin đến đúng phòng và vẫn đọc được sau khi tải trang. |
| 5 | Đăng nhập `outsider` ở hồ sơ thứ ba, xem danh sách phòng và lịch sử. | Tài khoản ngoài phòng không thấy cuộc trò chuyện hoặc lịch sử riêng của USER. |
| 6 | Mở [biên bản P23](TV1-TO-TV2-TV3-HANDOFF.md#p23--tải-đồng-thời-và-lỗi-kết-nối-cục-bộ) và trình bày bảng 1/5/20 Client cùng ca mất ACK. | Người xem đối chiếu được cấu hình, tải thử và kết quả. |

Nếu giao diện báo mất kết nối, kiểm `READY`, hai tiến trình và `ALLOWED_ORIGINS`. Origin phải trùng `http://127.0.0.1:18100`. Nếu đổi cổng Client, đổi Origin Backend và URL trình duyệt. Nếu đổi cổng Backend, đổi `HUYENCO_API_URL` và URL health/readiness. Chạy lại các tiến trình sau khi đổi. Cấu hình một máy dùng loopback nên IP Wi-Fi thay đổi không ảnh hưởng các lệnh này. Dừng Client và Backend bằng `Ctrl+C` khi demo xong.

## 4. Bằng chứng diễn tập

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
