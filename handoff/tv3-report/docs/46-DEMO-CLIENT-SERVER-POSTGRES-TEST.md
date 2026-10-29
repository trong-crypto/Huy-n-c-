# Huyền Cơ — Lệnh chạy demo Client–Server–PostgreSQL TEST

Ngày soạn: 28/10/2026. Dùng PowerShell trên Windows tại máy có PostgreSQL 18 và database nguồn `huyenco` đã có V12. Đây là hướng dẫn thao tác; các lệnh trong file chưa được chạy chỉ vì tài liệu được tạo.

## 1. Chọn quy trình

| Tình huống | Thực hiện |
| --- | --- |
| Chưa chuẩn bị database demo | Chạy mục 2 một lần, sau đó mục 3–6. |
| Đã có database TEST do mục 2 tạo | Mở file này, chạy lại mục 3–6. Không cần sao chép database mỗi lần demo. |
| Chỉ trình diễn chức năng trước lớp | Chạy mục 3–5. Bộ kiểm tự động ở mục 6 dành cho nghiệm thu trước buổi demo. |
| Muốn giữ bằng chứng | Ghi kết quả theo mục 7. Chỉ ghi PASS sau khi chạy thực tế. |
| TV1 chạy Client trên máy khác, bạn chạy Server/DB | Làm mục 2 trên máy bạn nếu chưa có TEST, sau đó dùng mục 9 thay cho mục 3–4. |

Môi trường cố định của hướng dẫn:

| Thành phần | Địa chỉ / tên |
| --- | --- |
| Repository | `C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM` |
| PostgreSQL | `127.0.0.1:5432` |
| Database TEST | `huyenco_acceptance_test_<yyyyMMdd_HHmmss>` |
| Backend TEST | `http://127.0.0.1:18090` |
| STOMP WebSocket | `ws://127.0.0.1:18090/ws` |
| Client | `http://127.0.0.1:3173` |

Cần JDK 17+, Node.js 20.9+, Python 3.10+ cho các script kiểm toán/tra cứu và PostgreSQL đang hoạt động. Giữ các terminal Server/Client mở trong lúc trình diễn. Dừng Client cũ đang chạy từ cùng thư mục trước khi dùng lại `client/`; dev/build cùng dùng thư mục `.next`.

Database nguồn chỉ được đọc để xuất dữ liệu. Mọi thao tác khôi phục, tạo phiên, lưu/xóa lịch sử của quy trình này nhắm vào TEST. Mật khẩu nhập ẩn trong terminal; không ghi mật khẩu vào Markdown, YAML hoặc Git.

## 2. Chuẩn bị database TEST lần đầu

Mở **terminal chuẩn bị**. Chạy các khối dưới đây lần lượt trong cùng terminal. Nếu có lỗi, dừng và xử lý trước khi chuyển bước.

### 2.1. Đường dẫn và mật khẩu

```powershell
$repo = 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM'
Set-Location -LiteralPath $repo
$ErrorActionPreference = 'Stop'

$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
if (-not (Test-Path -LiteralPath "$pgBin\pg_dump.exe")) {
    throw 'Kiem tra lai duong dan PostgreSQL bin.'
}
$env:PATH = "$pgBin;$env:PATH"

$dbSecret = Read-Host 'Mat khau PostgreSQL' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $dbSecret).Password
Remove-Variable dbSecret

$runTag = Get-Date -Format 'yyyyMMdd_HHmmss'
$testDb = "huyenco_acceptance_test_$runTag"
New-Item -ItemType Directory -Force '.\scripts\generated\db-backups' | Out-Null
$dumpFile = Join-Path $repo "scripts\generated\db-backups\$testDb.dump"
```

### 2.2. Xuất schema và dữ liệu sách

Hai bảng phiên/lịch sử vẫn được giữ cấu trúc, nhưng bỏ dữ liệu người dùng khi xuất.

```powershell
& "$pgBin\pg_dump.exe" `
  -h 127.0.0.1 -p 5432 -U postgres -d huyenco `
  --format=custom --no-owner --no-privileges --schema=public `
  --exclude-table-data=public.anonymous_sessions `
  --exclude-table-data=public.interpretation_history `
  --file="$dumpFile"

if ($LASTEXITCODE -ne 0) { throw 'Xuat du lieu that bai. Dung tai day.' }
```

### 2.3. Tạo mới và khôi phục TEST

Lệnh tạo database phải thành công trước khi khôi phục. Không thay `$testDb` bằng tên database dự án. `--clean --if-exists` xử lý các đối tượng mặc định trên database TEST mới tạo; không dùng tùy chọn `--create` của pg_restore vì archive mang tên database nguồn.

```powershell
if ($testDb -notmatch '^huyenco_acceptance_test_\d{8}_\d{6}$') {
    throw 'Ten database khong thuoc pham vi TEST.'
}

& "$pgBin\createdb.exe" `
  -h 127.0.0.1 -p 5432 -U postgres `
  --template=template0 "$testDb"

if ($LASTEXITCODE -ne 0) { throw 'Tao database TEST that bai. Dung tai day.' }

& "$pgBin\pg_restore.exe" `
  -h 127.0.0.1 -p 5432 -U postgres --dbname="$testDb" `
  --clean --if-exists --no-owner --no-privileges --exit-on-error `
  "$dumpFile"

if ($LASTEXITCODE -ne 0) { throw 'Khoi phuc TEST that bai. Dung tai day.' }
Write-Host "DATABASE TEST: $testDb"
```

### 2.4. Xác minh V12 và lưu tên TEST để dùng lại

```powershell
& "$pgBin\psql.exe" -X -h 127.0.0.1 -p 5432 -U postgres -d "$testDb" `
  -v ON_ERROR_STOP=1 `
  -c 'SELECT current_database(); SELECT version, success FROM flyway_schema_history ORDER BY installed_rank; SELECT count(*) AS sessions FROM anonymous_sessions; SELECT count(*) AS history FROM interpretation_history;'

if ($LASTEXITCODE -ne 0) { throw 'Kiem tra schema TEST that bai.' }

$initialCounts = & "$pgBin\psql.exe" -X -A -t -h 127.0.0.1 -p 5432 -U postgres -d "$testDb" `
  -v ON_ERROR_STOP=1 `
  -c 'SELECT (SELECT count(*) FROM anonymous_sessions)::text || '','' || (SELECT count(*) FROM interpretation_history)::text;'

if ($LASTEXITCODE -ne 0) { throw 'Kiem tra du lieu phien TEST that bai.' }
if (($initialCounts -join '').Trim() -ne '0,0') {
    throw 'TEST vua tao phai rong phien va lich su.'
}

python .\scripts\audit_v12_readings.py --database "$testDb"
if ($LASTEXITCODE -ne 0) { throw 'Kiem toan V12 chua dat. Chua chay Server.' }

@{
    database = $testDb
    copiedFrom = 'huyenco'
    createdAt = (Get-Date -Format 'o')
} | ConvertTo-Json | Set-Content -LiteralPath '.\scripts\generated\v12_demo_target.json' -Encoding UTF8

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
```

Kết quả cần: đúng tên TEST, migration đến V12 thành công, ban đầu không có phiên/lịch sử và audit V12 `PASS` với bộ dữ liệu `1/20/19/204`. Audit này đối chiếu bundle V12; không thay thế toàn bộ kiểm toán nguồn nền hay nghiệm thu chức năng.

File `scripts/generated/v12_demo_target.json` chỉ ghi tên database/thời gian, không chứa mật khẩu. File này và dump nằm trong các đường dẫn đang được Git bỏ qua. Tên TEST được lưu sau khi kiểm toán đạt, giúp dùng lại ở các buổi sau. Không cần nhập PDF hoặc bootstrap lại cho quy trình sao chép này.

## 3. Mỗi buổi demo — terminal 1 chạy Backend

Chạy lại khối này mỗi khi mở terminal mới. Nó đọc tên TEST đã lưu ở mục 2 và yêu cầu nhập mật khẩu.

```powershell
$repo = 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM'
Set-Location -LiteralPath $repo
$ErrorActionPreference = 'Stop'

$targetFile = Join-Path $repo 'scripts\generated\v12_demo_target.json'
if (-not (Test-Path -LiteralPath $targetFile)) {
    throw 'Chua co ten TEST da luu. Thuc hien muc 2 truoc.'
}
$demoTarget = Get-Content -LiteralPath $targetFile -Raw | ConvertFrom-Json
$testDb = [string]$demoTarget.database
if ($testDb -notmatch '^huyenco_acceptance_test_\d{8}_\d{6}$') {
    throw 'Database da luu khong thuoc pham vi TEST.'
}

$dbSecret = Read-Host 'Mat khau PostgreSQL' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $dbSecret).Password
Remove-Variable dbSecret

$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/$testDb"
$env:DB_USERNAME = 'postgres'
$env:SERVER_ADDRESS = '127.0.0.1'
$env:SERVER_PORT = '18090'
$env:ALLOWED_ORIGINS = 'http://127.0.0.1:3173,http://localhost:3000'
$env:SPRING_FLYWAY_ENABLED = 'false'
$env:SESSION_SECURE_COOKIE = 'false'

git log -1 --oneline
Write-Host "BACKEND TEST: $env:DB_URL"
Set-Location -LiteralPath (Join-Path $repo 'server')
.\mvnw.cmd -Pdatabase spring-boot:run '-Dspring-boot.run.profiles=db'
```

Giữ terminal mở. Flyway tắt vì bản sao đã có V12. `-Pdatabase` là Maven profile; `db` là Spring profile. Origin `http://localhost:3000` được thêm vì script `smoke-history.mjs` hiện dùng cố định origin này; UI demo vẫn mở bằng `127.0.0.1:3173`.

## 4. Mỗi buổi demo — terminal 2 kiểm Backend và chạy Client

### 4.1. Health/readiness

```powershell
$base = 'http://127.0.0.1:18090'
$health = Invoke-RestMethod "$base/api/v1/health"
$ready = Invoke-RestMethod "$base/api/v1/readiness"
$health | ConvertTo-Json -Depth 5
$ready | ConvertTo-Json -Depth 10

if ($health.status -ne 'UP' -or $ready.status -ne 'READY') {
    throw 'Backend TEST chua san sang. Kiem tra terminal Server.'
}
```

Cần HTTP 200, health `UP`, readiness `READY`, database `UP`, schema/seed `READY`. HTTP 503 cần được xử lý trước khi demo; health một mình không đủ chứng minh dữ liệu sẵn sàng.

### 4.2. Chạy Client

```powershell
Set-Location -LiteralPath 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\client'

$env:NEXT_PUBLIC_WS_URL = 'ws://127.0.0.1:18090/ws'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:HUYENCO_API_URL = 'http://127.0.0.1:18090'

if (-not (Test-Path -LiteralPath '.\node_modules')) {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Cai dependency Client that bai.' }
}

npm.cmd run dev -- --hostname 127.0.0.1 --port 3173
```

Mở **[http://127.0.0.1:3173](http://127.0.0.1:3173)**. Các biến trên đặt trong terminal, không sửa `.env.local`. Dùng nhất quán hostname `127.0.0.1`; cookie phân biệt `localhost` với `127.0.0.1`. Đổi cấu hình thì restart Client.

Nếu dùng production thay dev, đặt cùng các biến trên, chạy `npm.cmd run build`, kiểm exit code bằng 0 rồi chạy `npm.cmd run start -- --hostname 127.0.0.1 --port 3173`. Dừng dev trước khi build; không chạy hai chế độ cùng thư mục `.next`.

## 5. Kịch bản trình diễn trên giao diện

| Thứ tự | Trang / input mẫu | Kết quả cần quan sát |
| --- | --- | --- |
| 1. Mai Hoa LINES | `/mai-hoa`; hào 1→6: Dương, Âm, Dương, Âm, Dương, Âm; động 2; tắt luận chi tiết | Quẻ chủ **Ký tế**, hỗ **Vị tế**, biến **Nhu**; hào 1 ở dưới. |
| 2. Mai Hoa OBJECT_COUNT | Số vật 12; giờ Mùi, chỉ số 8; tắt luận chi tiết | Chủ **Dự**, hỗ **Kiển**, biến **Giải**, động 2; giữ `TEAM_DECISION`/`SOURCE_AMBIGUOUS`. |
| 3. Mai Hoa TIME | 10/02/2024 00:00, giờ Việt Nam; tắt luận chi tiết | Chủ **Bác**, hỗ **Khôn**, biến **Mông**, động 2; có lịch, bước tính và nguồn/quyết định. |
| 4. Lời luận Mai Hoa | TIME như ca 3; bật chi tiết, chủ đề Tổng quan | Có Thể/Dụng, các giai đoạn luận, tóm tắt và nguồn. |
| 5. Tam Thế | `/tam-the`; Âm lịch 01/02/1984, 08:30, không nhuận; cả ba lĩnh vực; Tài lộc Mở rộng | Có Công danh/Tài lộc/Tình duyên. Lộc báo không có giao điểm nguồn; Sang hèn/Điền sản vẫn có nội dung hợp lệ. |
| 6. Tra quẻ | `/hexagrams`; đi các trang, tìm Tỉnh rồi mở chi tiết | Tổng 64 mã, bốn trang 20/20/20/4; chi tiết có sáu hào, nghĩa tên và nguồn. |
| 7. Đổi lịch | `/calendar`; Dương 01/01/2000; sau đó đổi ngược Âm 25/11/1999, không nhuận | Hai chiều trả đúng cặp ngày Dương/Âm. |
| 8. Can Chi | Dương 10/02/2024, 23:59; sau đó thử bỏ giờ | Năm Giáp Thìn, tháng Bính Dần, ngày Giáp Thìn, giờ Giáp Tý. Bỏ giờ: chưa xét giờ. |
| 9. Lịch sử | Sau COMPLETED, lưu tiêu đề `NGHIEM-THU-MAI-HOA`; vào `/history`, tìm, mở, tải lại trang | Snapshot giữ nguyên kết quả, loại phép tính và nguồn. Lưu sau khi tính, trong thời gian cache còn hiệu lực. |
| 10. Xóa bản demo | Hủy ở hộp xác nhận trước, sau đó xác nhận xóa đúng bản vừa tạo | Hủy giữ bản ghi; xác nhận xóa thành công thì danh sách/detail cập nhật. |

Mỗi yêu cầu tính thành công cần bốn progress theo thứ tự và một terminal `COMPLETED`, ghép đúng `requestId`. Quyết định nhóm và trạng thái kiểm chứng nguồn được giữ riêng; không đổi nhãn nguồn để làm kết quả trông đầy đủ hơn.

Đối chiếu JSON chuẩn trong [docs/examples](examples/): `mai-hoa-lines`, `mai-hoa-object-count`, `mai-hoa-time`, `m03-time-reading`, `d04-wealth-no-loc`, `hexagram-tinh`, `calendar-convert`, `calendar-can-chi`. UUID tạo ở mỗi lần submit được phép khác fixture. Kịch bản UI chi tiết và bằng chứng các lượt trước nằm ở [tài liệu 45](45-TV1-DEMO-SCRIPT.md) và [ma trận 44](44-TV1-PHASE8A-ACCEPTANCE.md).

Kiểm hai chủ sở hữu: dùng hai profile/trình duyệt hoặc context riêng tư độc lập. Hai tab cùng profile thường dùng chung phiên. Phiên B không liệt kê lịch sử A chỉ là kiểm UI; script H01 ở mục 6.4 còn kiểm API từ chối đọc/xóa chéo.

## 6. Nghiệm thu tự động — terminal 3

Server ở terminal 1 phải còn hoạt động trên TEST đúng cổng 18090. Các lệnh bên dưới có kiểm `$LASTEXITCODE`; dừng khi một lệnh thất bại. Không bật cờ ghi lại fixture để khớp kết quả thực tế.

### 6.1. Mai Hoa và Tam Thế V12

```powershell
Set-Location -LiteralPath 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\client'

$env:V12_HTTP_URL = 'http://127.0.0.1:18090'
$env:V12_ORIGIN = 'http://127.0.0.1:3173'
$env:V12_CAPTURE_SOURCE_ORDER_FIX = '0'

node .\scripts\smoke-v12-readings.mjs
if ($LASTEXITCODE -ne 0) { throw 'Nghiem thu V12 that bai.' }
```

Script gửi STOMP/GET thật, kiểm fixture M03/D04, các ca nền, progress/định tuyến và 720 tổ hợp năm-tháng Tam Thế. Cần `status: PASS`. Script này không tạo owner/lịch sử; báo cáo là `scripts/generated/v12_main_acceptance.json`. Tên file báo cáo là tên có sẵn của script, database thực tế vẫn do Backend TEST quyết định.

### 6.2. API tra cứu 64 quẻ

```powershell
Set-Location -LiteralPath 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM'

python .\scripts\smoke_e02_hexagrams.py --url 'http://127.0.0.1:18090'
if ($LASTEXITCODE -ne 0) { throw 'Nghiem thu tra cuu que that bai.' }
```

Cần dòng `E02 HTTP PASS`. Báo cáo: `scripts/generated/e02_http.json`.

### 6.3. API lịch và Can Chi

```powershell
Set-Location -LiteralPath 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM'
$base = 'http://127.0.0.1:18090'

$convertBody = Get-Content -LiteralPath '.\docs\examples\calendar-convert.request.json' -Raw
$converted = Invoke-RestMethod "$base/api/v1/calendar/convert" `
    -Method Post -ContentType 'application/json' -Body $convertBody
$converted | ConvertTo-Json -Depth 15
if ($converted.status -ne 'COMPLETED' -or $converted.data.lunarDate.year -ne 1999 -or
    $converted.data.lunarDate.month -ne 11 -or $converted.data.lunarDate.day -ne 25 -or
    $converted.data.lunarDate.isLeapMonth -ne $false) {
    throw 'Doi lich khong khop fixture.'
}

$reverseBody = @{
    calendarType = 'LUNAR'; year = 1999; month = 11; day = 25; isLeapMonth = $false
} | ConvertTo-Json
$reversed = Invoke-RestMethod "$base/api/v1/calendar/convert" `
    -Method Post -ContentType 'application/json' -Body $reverseBody
if ($reversed.status -ne 'COMPLETED' -or $reversed.data.solarDate -ne '2000-01-01') {
    throw 'Doi lich chieu nguoc khong khop.'
}

$canChiBody = Get-Content -LiteralPath '.\docs\examples\calendar-can-chi.request.json' -Raw
$canChi = Invoke-RestMethod "$base/api/v1/calendar/can-chi" `
    -Method Post -ContentType 'application/json' -Body $canChiBody
$expectedCanChi = Get-Content -LiteralPath '.\docs\examples\calendar-can-chi.response.json' -Raw | ConvertFrom-Json
if ($canChi.status -ne 'COMPLETED') { throw 'API Can Chi that bai.' }
foreach ($part in @('year', 'month', 'day', 'hour')) {
    if ($canChi.data.$part.stem -ne $expectedCanChi.data.$part.stem -or
        $canChi.data.$part.branch -ne $expectedCanChi.data.$part.branch) {
        throw "Can Chi khong khop fixture: $part"
    }
}
$canChi | ConvertTo-Json -Depth 15
Write-Host 'Calendar sample and round-trip PASS'
```

### 6.4. Phiên và lịch sử H01

```powershell
Set-Location -LiteralPath 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM\client'

$env:H01_HTTP_URL = 'http://127.0.0.1:18090'
$env:H01_WRITE_FIXTURES = '0'
$env:H01_RESTART_CHECK = '0'
Remove-Item Env:H01_WAIT_TTL_MS -ErrorAction SilentlyContinue

npm.cmd run smoke:history
if ($LASTEXITCODE -ne 0) { throw 'Nghiem thu lich su that bai.' }
```

Cần `passed: true`. Script tạo hai phiên, lưu/đọc/xóa một số bản ghi và kiểm truy cập chéo/CSRF. Một số phiên/bản ghi thử được giữ lại; dùng database TEST riêng. Báo cáo: `scripts/generated/h01_network.json`. Lượt mặc định này không kiểm bền vững qua restart hoặc history nhiều trang.

## 7. Bằng chứng và kết thúc

Ghi bảng sau vào biên bản của buổi chạy, không điền trước PASS:

| Ca | Commit | Database TEST | Đầu vào/fixture | Kết quả thực tế | PASS/FAIL/PENDING | Ảnh/log |
| --- | --- | --- | --- | --- | --- | --- |
| Mai Hoa / Tam Thế / quẻ / lịch / lịch sử | | | | | | |

Các báo cáo tự động cùng tên sẽ bị ghi đè khi chạy lại; sao chép báo cáo cần giữ sang thư mục riêng theo buổi chạy. Không đưa dump, mật khẩu, cookie hoặc CSRF token vào Git/ảnh bàn giao.

Dừng Client và Backend bằng **Ctrl+C** tại terminal tương ứng. Sau khi Server dừng, tại terminal 1:

```powershell
Remove-Item Env:DB_PASSWORD,Env:PGPASSWORD -ErrorAction SilentlyContinue
```

Giữ database TEST và file tên TEST để dùng lại. Lịch sử đã lưu thuộc cookie của phiên hiện tại; xóa cookie sẽ mất khả năng truy cập bằng phiên đó. Có thể dùng profile riêng tư mới cho mỗi buổi để bắt đầu một owner trống; dữ liệu của owner cũ vẫn còn trong TEST.

## 8. Xử lý nhanh khi demo gặp lỗi

| Hiện tượng | Kiểm tra |
| --- | --- |
| Chưa có `v12_demo_target.json` | Chạy mục 2 để tạo và kiểm toán TEST, rồi quay lại mục 3. |
| Cổng 18090 hoặc 3173 đang được dùng | Xác định tiến trình bằng `netstat -ano`; dừng đúng Server/Client cũ của mình trước khi chạy lại. |
| `psql` không được nhận diện | Mục 2 thêm PostgreSQL 18 vào PATH của terminal đó; terminal khác cần đường dẫn đầy đủ hoặc thêm lại PATH. |
| Readiness 503 | Xem DB_URL được in tại terminal 1, mật khẩu, dịch vụ PostgreSQL, schema/seed; kiểm toán TEST phải đạt trước. |
| WebSocket không kết nối | Kiểm URL `/ws`, Backend 18090, Origin 127.0.0.1:3173 và restart Client sau khi đổi cấu hình. |
| Tính được nhưng không lưu được | Kiểm session bootstrap, hostname/cookie cùng 127.0.0.1, tính lại rồi lưu trong thời gian cache; không tắt CSRF. |
| RULE_NOT_AVAILABLE | Kiểm đang chạy code mới với profile `db` và bản sao V12 đã audit; xem trường lỗi/nguồn. Không tự chuyển trạng thái VERIFIED để vượt lỗi. |
| Lỗi hydration với `bis_skin_checked`/`bis_register` | Thử profile trình duyệt sạch không extension; đối chiếu lại Console. |

Phạm vi còn riêng: history nhiều trang, timeout/reconnect/quá tải được tạo có kiểm soát, benchmark 2/5/20 Client direct/bounded theo [kế hoạch cập nhật 29/10, tài liệu 47](47-X01-BENCHMARK-2-5-20-PLAN.md), máy độc lập và gói nộp. PASS ở các bước demo này không tự đóng các mục đó.

## 9. Hai máy qua Wi-Fi/LAN: TV1 chạy Client, TV2/TV3 chạy Server và database

Các lệnh dưới dành cho hai máy Windows cùng mạng tin cậy, cho phép kết nối giữa hai máy. Ví dụ **máy Server có IPv4 `192.168.1.10`, máy TV1 có IPv4 `192.168.1.20`**. Thay hai địa chỉ mẫu bằng địa chỉ thật; mỗi máy dùng `ipconfig` để xem IPv4 của adapter Wi-Fi/Ethernet đang hoạt động. Wi-Fi Guest có thể chặn kết nối giữa thiết bị; cùng tên Wi-Fi chưa đủ chứng minh có đường truyền.

| Máy TV1 | Máy bạn |
| --- | --- |
| Node/Next.js và browser | Spring Boot và PostgreSQL TEST V12 |
| UI `127.0.0.1:3173` | Backend `192.168.1.10:18090` |
| Cổng chuyển tiếp `127.0.0.1:18090` → Server | JDBC vẫn dùng `127.0.0.1:5432` trên chính máy Server |

Luồng thực tế: browser/Next trên TV1 → cổng chuyển tiếp trên TV1 → Backend trên máy bạn → PostgreSQL trên máy bạn. TV1 chỉ cần URL Backend, không cần mật khẩu PostgreSQL hoặc bản sao database.

### 9.1. Vì sao dùng chuyển tiếp cổng cho lần kiểm đầy đủ

Code `client/src/services/session/socketIdentity.ts` chỉ gắn kết quả với phiên có thể lưu khi hostname của trang và WebSocket giống nhau. Cookie H01 là HttpOnly/SameSite=Lax. Nếu mở UI bằng localhost trên TV1 nhưng WebSocket trỏ thẳng sang IP Server, phần tính công khai có thể chạy nhưng chưa đủ để kiểm lưu lịch sử.

Giữ trang và WebSocket cùng `127.0.0.1` trên máy TV1 bằng một cổng TCP chuyển tiếp. Dữ liệu vẫn được xử lý trên Server từ xa. Windows hỗ trợ cách cấu hình này qua [netsh interface portproxy — Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netsh-interface). Giữ nguyên kiểm tra Origin, cookie và CSRF của ứng dụng.

### 9.2. Máy bạn: khởi động Backend TEST lắng nghe qua LAN

Chuẩn bị TEST theo mục 2 trước. Dừng Backend TEST cũ bằng Ctrl+C. Trong PowerShell thường trên **máy bạn**:

```powershell
$repo = 'C:\Users\abc\OneDrive\Documents\ChatGPT\BTL_LTM'
Set-Location -LiteralPath $repo
$ErrorActionPreference = 'Stop'

$demoTarget = Get-Content -LiteralPath '.\scripts\generated\v12_demo_target.json' -Raw | ConvertFrom-Json
$testDb = [string]$demoTarget.database
if ($testDb -notmatch '^huyenco_acceptance_test_\d{8}_\d{6}$') {
    throw 'Database khong thuoc pham vi TEST.'
}

$dbSecret = Read-Host 'Mat khau PostgreSQL' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $dbSecret).Password
Remove-Variable dbSecret
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/$testDb"
$env:DB_USERNAME = 'postgres'
$env:SERVER_ADDRESS = '0.0.0.0'
$env:SERVER_PORT = '18090'
$env:ALLOWED_ORIGINS = 'http://127.0.0.1:3173,http://localhost:3000'
$env:SPRING_FLYWAY_ENABLED = 'false'
$env:SESSION_SECURE_COOKIE = 'false'

Write-Host "DATABASE TEST: $env:DB_URL"
Set-Location -LiteralPath (Join-Path $repo 'server')
.\mvnw.cmd -Pdatabase spring-boot:run '-Dspring-boot.run.profiles=db'
```

`0.0.0.0` là địa chỉ lắng nghe của Server; dùng IPv4 thật để kết nối từ máy khác. `ALLOWED_ORIGINS` chứa Origin của trang browser TV1; với phương án này trang vẫn là `http://127.0.0.1:3173`, không đổi sang IP Server. Database tiếp tục nằm trên máy bạn và được truy cập cục bộ.

### 9.3. Máy bạn: mở cổng Backend cho máy TV1

Mở PowerShell **Run as administrator** trên máy bạn, sửa hai IP theo mạng hiện tại. Khối dưới lấy đúng profile của adapter có IP Server và tạo hoặc cập nhật rule cùng tên. Mạng/hotspot có thể đang là Public; không cần đổi mức tin cậy của toàn bộ mạng chỉ để chạy thử.

```powershell
$serverIp = '192.168.1.10'
$tv1Ip = '192.168.1.20'

$serverAddress = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $serverIp -ErrorAction Stop
$connection = Get-NetConnectionProfile -InterfaceIndex $serverAddress.InterfaceIndex -ErrorAction Stop
$firewallProfile = [string]$connection.NetworkCategory
if ($firewallProfile -eq 'DomainAuthenticated') { $firewallProfile = 'Domain' }
$connection | Select-Object Name, InterfaceIndex, NetworkCategory

$ruleSettings = @{
    Name = 'HuyenCo-TEST-18090-TV1'
    Direction = 'Inbound'
    Action = 'Allow'
    Enabled = 'True'
    Protocol = 'TCP'
    LocalAddress = $serverIp
    LocalPort = 18090
    RemoteAddress = $tv1Ip
    Profile = $firewallProfile
}
if (Get-NetFirewallRule -Name $ruleSettings.Name -ErrorAction SilentlyContinue) {
    Set-NetFirewallRule @ruleSettings -ErrorAction Stop
} else {
    New-NetFirewallRule @ruleSettings -DisplayName 'Huyen Co TEST Backend for TV1' -ErrorAction Stop
}

$rule = Get-NetFirewallRule -Name $ruleSettings.Name
$rule | Select-Object Name, Enabled, Profile, Direction, Action
$rule | Get-NetFirewallAddressFilter | Select-Object LocalAddress, RemoteAddress
$rule | Get-NetFirewallPortFilter | Select-Object Protocol, LocalPort
```

Rule này cho phép địa chỉ TV1 vào cổng Backend trên profile hiện tại, giữ phạm vi TCP/18090 và đúng hai IP. Lỗi `Cannot create a file when that file already exists` khi dùng New-NetFirewallRule nghĩa là tên rule đã tồn tại; khối trên dùng Set-NetFirewallRule để cập nhật cả profile và IP. Khi đổi Wi-Fi/hotspot, kiểm tra lại IP của cả hai máy và chạy lại khối này. Cấu hình này không cần mở cổng PostgreSQL 5432 hoặc thay `pg_hba.conf` cho TV1. Giữ firewall hoạt động.

### 9.4. Máy TV1: kiểm đường truyền và tạo cổng chuyển tiếp

Trong PowerShell **trên máy TV1**, thay IP Server:

```powershell
Test-NetConnection -ComputerName '192.168.1.10' -Port 18090
Invoke-RestMethod 'http://192.168.1.10:18090/api/v1/readiness'
```

Cần `TcpTestSucceeded: True`, readiness HTTP 200/`READY`. Nếu chưa đạt, xử lý IP, Backend bind, firewall/profile hoặc Wi-Fi isolation trước.

Tiếp theo, mở PowerShell **Run as administrator trên TV1**. Cổng 18090 cục bộ cần trống; nếu TV1 đang chạy Backend riêng ở đó, dừng đúng tiến trình trước. Xem các rule hiện có rồi thêm rule sau:

```powershell
netsh interface portproxy show all
Get-Service iphlpsvc
Start-Service iphlpsvc

netsh interface portproxy add v4tov4 listenaddress=127.0.0.1 listenport=18090 connectaddress=192.168.1.10 connectport=18090 protocol=tcp
if ($LASTEXITCODE -ne 0) { throw 'Tao portproxy that bai.' }

Invoke-RestMethod 'http://127.0.0.1:18090/api/v1/readiness'
```

Cần nhận cùng readiness `READY` của Backend trên máy bạn. Rule portproxy tồn tại qua lần khởi động máy; khi IP Server đổi cần cập nhật đúng rule. Nếu chưa có listener dù thêm thành công, kiểm IP Helper (`iphlpsvc`) và cấu hình mạng Windows. Không ghi đè rule của ứng dụng khác.

### 9.5. Máy TV1: chạy Client

TV1 dùng cùng phiên bản Client/contract với Backend. Dừng Client cũ, mở PowerShell thường tại thư mục `client` của checkout trên máy TV1; đường dẫn trên máy đó có thể khác máy bạn:

```powershell
# Dang o thu muc client cua du an tren may TV1.
$env:NEXT_PUBLIC_WS_URL = 'ws://127.0.0.1:18090/ws'
$env:NEXT_PUBLIC_API_BASE_URL = '/api/v1'
$env:HUYENCO_API_URL = 'http://127.0.0.1:18090'

if (-not (Test-Path -LiteralPath '.\node_modules')) {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Cai dependency Client that bai.' }
}
npm.cmd run dev -- --hostname 127.0.0.1 --port 3173
```

TV1 mở **http://127.0.0.1:3173** trên chính máy TV1. Ba URL loopback ở khối trên đi qua cổng chuyển tiếp; không thay chúng bằng IP Server trong phương án này. Client/Next vẫn chạy ở TV1, Java và PostgreSQL vẫn chạy trên máy bạn.

Chạy các ca ở mục 5. Trong DevTools Network kiểm session bootstrap, WebSocket upgrade, bốn progress và terminal đúng requestId; sau đó lưu, mở lại và xóa bản demo. Phần kiểm tự động mục 6 có thể chạy tại checkout trên TV1, với URL loopback giữ nguyên; các báo cáo sẽ được ghi trên máy TV1. Các lệnh `Set-Location` ở mục 6 phải đổi thành đường dẫn checkout thực tế của TV1.

Đây là cấu hình hướng dẫn; chưa có bằng chứng hai máy thật đã kết nối thành công từ lần biên soạn tài liệu này. Ghi commit/IP/môi trường và kết quả thực tế vào biên bản khi hai bạn chạy.

### 9.6. Kết thúc buổi kiểm

Dừng Client trên TV1 và Backend TEST trên máy bạn bằng Ctrl+C. Xóa biến DB_PASSWORD trên máy Server như mục 7. Nếu không cần giữ cấu hình mạng cho lần sau, chạy các lệnh sau trong PowerShell admin **đúng máy**:

Máy TV1 — chỉ xóa rule chuyển tiếp vừa tạo:

```powershell
netsh interface portproxy delete v4tov4 listenaddress=127.0.0.1 listenport=18090 protocol=tcp
```

Máy bạn — chỉ xóa firewall rule của buổi kiểm:

```powershell
Remove-NetFirewallRule -Name 'HuyenCo-TEST-18090-TV1'
```

Nếu hai máy ở hai mạng khác nhau, cần một đường VPN hoặc tunnel phù hợp thay cho kết nối LAN trực tiếp. Địa chỉ private 192.168.x.x không tự truy cập được qua Internet; không mở cổng database ra Internet để giải quyết việc này.
