# Huyền Cơ — Hướng dẫn Backend/PostgreSQL và nghiệm thu tích hợp TV1

**Tài liệu 35 · 25/10/2026 · Bàn giao TV2 + TV3 → TV1**

**Triển khai huyenco26/10:** DB trên máy chủ dự án đã V12 và nhập bộ M01 theo [43](43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md), M03/D04 nghiệm thu thật đạt. Máy này không cần bootstrap/import lại; dùng code mới/profile db và DB_URL đúng huyenco. TV1 ở máy khác vẫn cần TEST riêng đã seed hoặc một Server đang chạy được cấp truy cập; Git pull không chuyển database. Server tạm18089 đã dừng. Các dòng huyenco V11/chưa có dữ liệu mở rộng ở mốc cũ bên dưới là lịch sử; các script smoke M03/D04 có ghi history tiếp tục dùng TEST, script smoke-v12-readings chỉ đọc được mô tả ở43.

**Bổ sung D04 ngày26/10:** Backend đã trả Tam Thế EXTENDED thật theo [42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md), gồm năm capture và script kiểm720 tổ hợp. Dùng TEST V12/bundle M01 đã seed theo38, contract39; chỉ thêm wealthMode=EXTENDED khi muốn ba tiểu mục mới. Các đoạn chờ D04 ở mốc M03 dưới đây là lịch sử. DB huyenco vẫn V11, không dùng làm TEST; kiểm DB_URL trước khi profile db tự chạy Flyway. UI tích hợp thuộc TV1/I02.

**Bổ sung M03 ngày26/10:** hướng dẫn này vẫn dùng cho luồng bản nền. Muốn nghiệm thu lời luận Mai Hoa mới, dùng TEST V12/bundle đã seed theo [38](38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md), contract [39](39-DETAILED-READINGS-CONTRACT.md) và cách chạy/capture thật ở [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md). Request không có reading giữ tuyến cũ. Database dự án huyenco vẫn V11; không dùng nó làm TEST hoặc coi Server tạm đã dừng là môi trường nhóm đang chạy. Profile db tự chạy Flyway khi khởi động; kiểm đúng DB_URL trước khi chạy. Tam Thế EXTENDED chờ D04.

**Mục tiêu:** TV1 tự chạy Server Spring Boot với PostgreSQL đã nạp dữ liệu, nối Client Next.js bằng STOMP WebSocket, kiểm tra thật `LINES` và `OBJECT_COUNT`, ghi nhận kết quả nghiệm thu. **Không bắt buộc Docker.**

> TV1 sở hữu UI; TV2 + TV3 sở hữu Server, nghiệp vụ và dữ liệu sách. Không sửa `server/src/main/resources/application-db.yml`: file này đã lấy cấu hình từ biến môi trường. Không commit mật khẩu PostgreSQL, cookie, dữ liệu lịch sử cá nhân hoặc file dump lên GitHub.

## 1. Sơ đồ thao tác bàn giao

1. Nhận **cùng commit** của `server/`, `client/`, `scripts/`, `data/`, `docs/examples/` và các migration mới nhất; ghi SHA commit nhận từ TV2/TV3.
2. Chọn một trong hai môi trường: (a) chạy Server và PostgreSQL test đã có của TV2/TV3, hoặc (b) tự tạo database `huyenco` và bootstrap trên máy TV1.
3. Nếu DB đã có dữ liệu, **sao lưu trước** khi nâng schema/import. Không chạy nhiều phiên import đồng thời.
4. Khởi chạy Server có **Maven profile `database` và Spring profile `db`**. Kiểm `/health` và `/readiness`, yêu cầu readiness HTTP 200/READY.
5. Khởi chạy Client trên cổng 3000; kết nối đúng URL WebSocket `/ws`.
6. Chạy smoke và đối chiếu hai fixture ở mục 6; đánh dấu checklist mục 9.

**Clone GitHub chỉ lấy mã nguồn, không chuyển dữ liệu PostgreSQL sang máy khác.** Khi TV1 không có hai PDF để bootstrap, TV2/TV3 cần cung cấp Server/DB test đang hoạt động hoặc phương án chuyển dữ liệu test đã được cho phép. Không gửi bản sao DB chứa lịch sử/phiên người dùng lên Git.

## 2. Điều kiện và cấu hình

| Thành phần | Yêu cầu |
| --- | --- |
| Windows | PowerShell, hai terminal riêng cho Server/Client; đường dẫn lệnh dưới đây tính từ **repo root** `BTL_LTM` trừ khi ghi khác. |
| Backend | JDK 17+, `server/mvnw.cmd`; không cần cài Maven độc lập. Kiểm `java -version`. |
| Frontend | Node.js 20.9+, npm; `client/package-lock.json` đã có. Kiểm `node -v`, `npm -v`. |
| PostgreSQL | PostgreSQL hoạt động, thường `127.0.0.1:5432`, database `huyenco` và tài khoản DB (ví dụ `postgres`). Cần `psql.exe` và `pg_dump.exe` khi bootstrap/sao lưu. |
| Nhập dữ liệu mới | Python và thư viện PDF của importer, hai PDF scan **đúng bản**; Maven tải dependencies cần Internet ở lần đầu. |
| Cổng mặc định | Server `8080`, Client `3000`, WebSocket `/ws`, PostgreSQL `5432`. |
| Backend env | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `ALLOWED_ORIGINS`. |
| Client env | `NEXT_PUBLIC_WS_URL`, thường `ws://localhost:8080/ws`. Không có password DB trong Client. |

Hai PDF mà script khớp tên, số trang và SHA-256: `Mai hoa dich so-Thieu-khang Tiet.pdf` và `Diễn Cầm Tam Thế Diễn Nghĩa.pdf`. Mặc định chúng ở `$env:USERPROFILE\Downloads`; khi ở nơi khác dùng `-PdfDir`.

## 3. Bootstrap PostgreSQL an toàn — chỉ khi cần

**Bước 3.1.** PostgreSQL phải đang chạy và database đích đã tồn tại. Với DB **chưa có**, tạo bằng pgAdmin hoặc lệnh bên dưới (cần tài khoản có quyền; không chạy lại khi DB tồn tại):

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE DATABASE huyenco;"
```

Nếu `psql` không có trong PATH, dùng file thực tế tại `C:\Program Files\PostgreSQL\<version>\bin\psql.exe`; `import_all.ps1` có cơ chế tự tìm psql.

**Bước 3.2.** Nếu DB đã có bảng/dữ liệu, tạo một bản backup đầy đủ trước khi import/migrate:

```powershell
New-Item -ItemType Directory -Force .\scripts\generated\db-backups | Out-Null
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d huyenco -Fc -f ".\scripts\generated\db-backups\huyenco-before-import.dump"
```

Lệnh có thể hỏi mật khẩu qua PostgreSQL. Kiểm file dump tồn tại và lưu ở vị trí an toàn. Với **DB test mới, rỗng hoàn toàn** có thể bỏ qua backup; với DB đã dùng thì không bỏ qua. Không đẩy dump lên Git.

**Bước 3.3.** Đặt hai PDF đúng phiên bản vào Downloads, rồi tại repo root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_all.ps1
```

Script hỏi mật khẩu ẩn, kiểm DB, chạy Flyway V1–V3 khi cần → seed từ PDF → các migration mới nhất → 8 quái/64 quẻ/384 hào → dữ liệu và quyết định đã duyệt → audit. Script có khả năng chạy lại có kiểm soát, nhưng **mỗi pha có transaction riêng**: nếu lỗi giữa chừng, kiểm nguyên nhân/backup và chạy lại; không coi toàn bộ 8 pha là một transaction.

Ví dụ khi dữ liệu ở thư mục khác:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\import_all.ps1 -DbHost 127.0.0.1 -DbPort 5432 -DbName huyenco -DbUser postgres -PdfDir "D:\SachNguon"
```

Đọc `scripts/generated/tv3_audit_report.md` sau khi script kết thúc: phải đạt `FAIL=0`; **PENDING phải được ghi rõ**, vì audit nguồn sách khác với khả năng Server đã bật. Xác minh repository có các migration đến `V10__hexagram_name_gloss_reviews.sql` và `V11__anonymous_sessions_and_history.sql`. Nếu DB đã được bootstrap mới nhất, chỉ để chạy Server/Client thì **không cần nạp lại DB**. Tuyệt đối không chỉnh checksum/history Flyway thủ công, không gán nhãn VERIFIED cho nguồn chưa duyệt.

## 4. Bật Backend thực với PostgreSQL

Mở PowerShell riêng **tại repo root**, chạy:

```powershell
cd .\server
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/huyenco'
$env:DB_USERNAME = 'postgres'
$dbSecret = Read-Host 'Mật khẩu PostgreSQL' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $dbSecret).Password
Remove-Variable dbSecret
$env:ALLOWED_ORIGINS = 'http://localhost:3000'
.\mvnw.cmd -Pdatabase spring-boot:run '-Dspring-boot.run.profiles=db'
```

Giữ terminal Server hoạt động. `-Pdatabase` là **Maven profile** tải JDBC/PostgreSQL/Flyway; `-Dspring-boot.run.profiles=db` là **Spring profile** kích hoạt repository dữ liệu. Thiếu profile `db` Server vẫn có thể chạy khung nhưng từ chối tính LINES/OBJECT_COUNT.

Mở terminal thứ hai:

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/health
Invoke-RestMethod http://localhost:8080/api/v1/readiness |
  Select-Object status,scope,database,schema,seed,businessFeaturesReady
```

| Probe | Kết quả cần |
| --- | --- |
| `GET /api/v1/health` | HTTP 200 với `{"status":"UP"}`; chỉ cho biết HTTP Server chạy. |
| `GET /api/v1/readiness` | HTTP 200, `status=READY`, `scope=KNOWLEDGE_STORAGE`, `database=UP`, `schema=READY` và `seed=READY`. |
| `businessFeaturesReady` | Có thể vẫn là `false` do phạm vi nghiệp vụ toàn dự án chưa hoàn toàn xong; kiểm **quyền riêng cho từng method và smoke test**. |
| `/readiness` HTTP 503 | `database=DISABLED` khi không bật DB; `UNAVAILABLE` khi mất DB; hoặc schema/seed chưa đủ. Sửa môi trường trước khi nghiệm thu. |

PowerShell cũ có thể ném exception khi HTTP 503; dùng `curl.exe -i http://localhost:8080/api/v1/readiness` hoặc trình duyệt để xem body. Không lấy `health=UP` thay cho readiness. Khi dừng Server, có thể bỏ secret khỏi phiên: `Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue`.

## 5. Chạy Client TV1 và trường hợp chạy khác máy

Trong terminal mới tại repo root:

```powershell
cd .\client
npm ci
Copy-Item .env.example .env.local -ErrorAction SilentlyContinue
npm run dev
```

Nội dung `client/.env.local` trên **cùng máy**:

```dotenv
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
NEXT_PUBLIC_API_BASE_URL=/api/v1
HUYENCO_API_URL=http://127.0.0.1:8080
```

`HUYENCO_API_URL` là biến **server-only của Next.js**, dùng cho proxy tra cứu `/api/v1/hexagrams/:path*`, lịch `/api/v1/calendar/convert` và `/api/v1/calendar/can-chi`, phiên `/api/v1/session`, lịch sử `/api/v1/history/:path*` (gồm collection và chi tiết); không thêm tiền tố NEXT_PUBLIC cho biến này. `API_SERVER_URL` của nhánh TV1 vẫn được nhận làm alias dự phòng nếu chưa đặt HUYENCO_API_URL. Thứ tự ưu tiên: HUYENCO_API_URL → API_SERVER_URL → http://127.0.0.1:8080. Chỉ đổi NEXT_PUBLIC_WS_URL không thay đích REST proxy. Proxy giữ nguyên kiểm tra Origin/CSRF/ownership của Backend; việc có route H01 không đồng nghĩa nghiệm thu live lịch sử đã đạt.

Mở `http://localhost:3000`; sau khi sửa `.env.local`, **restart** Next.js khi dùng dev. Với production, đặt các biến đúng **trước `npm run build`**, rồi chạy lại build/start khi đổi đích Backend. Server không sử dụng SockJS: đây là endpoint WebSocket STOMP trực tiếp.

**Nếu TV1 và Server ở hai máy:** đặt `NEXT_PUBLIC_WS_URL=ws://<IP-server>:8080/ws` và `HUYENCO_API_URL=http://<IP-server>:8080` trên máy chạy Next.js, giữ NEXT_PUBLIC_API_BASE_URL=/api/v1; đổi cả hai URL nếu Backend dùng cổng khác. Bảo đảm mở được `http://<IP-server>:8080/api/v1/readiness`. Trên Server, đặt `ALLOWED_ORIGINS` theo **Origin thật** của trang Next.js (ví dụ `http://localhost:3000` khi TV1 mở localhost; hoặc `http://<IP-TV1>:3000` khi mở trang theo IP). Danh sách nhiều origin cách nhau bằng dấu phẩy; chỉ thêm origin tin cậy, rồi restart Server. Kiểm firewall/cổng 8080; **localhost luôn chỉ vào chính máy đang chạy lệnh**. Không cần công khai PostgreSQL port 5432 cho TV1 nếu PostgreSQL nằm cùng máy Backend.

> Với H01 (cookie + lịch sử), hai hostname/site khác nhau có thể làm cookie `SameSite=Lax` không được gửi trong WebSocket/API. Nên thống nhất cùng hostname và reverse proxy/same-origin trước khi nghiệm thu lịch sử. Không tắt kiểm tra Origin/CSRF để vượt lỗi này. Ngay lúc đầu có thể nghiệm thu **LINES/OBJECT_COUNT công khai** bằng kết nối STOMP giữa hai máy.

## 6. Hợp đồng STOMP và fixture đầu vào/đầu ra

| Giai đoạn | Đích / kiểm tra |
| --- | --- |
| WebSocket | `ws://localhost:8080/ws` hoặc địa chỉ Server thực tế, có STOMP CONNECT. |
| SUBSCRIBE **trước SEND** | `/user/queue/progress`, `/user/queue/results`, `/user/queue/errors`. |
| SEND | `/app/mai-hoa/calculate` với JSON UTF-8 `requestId` UUID, `type:"MAI_HOA"` và `payload` của method. |
| Thành công | `/user/queue/results`, `status:"COMPLETED"`, `data` chứa quẻ chủ/hỗ/biến và nguồn, `error:null`. |
| Lỗi | `/user/queue/errors`, `status:"FAILED"`, `data:null`, `error.code/message` (có thể có `ruleCode/reason`). |
| Tiến trình | `/user/queue/progress`, theo `sequence=1,2,3,4` và `step=ACCEPTED → VALIDATING → CALCULATING → LOOKUP` ở yêu cầu thành công. |
| Phiên | Một request chỉ có một **terminal**; progress không phải terminal. Kết quả/progress chỉ tới socket sở hữu request. |

Không SUBSCRIBE `/queue/...` thẳng hoặc queue của socket khác. Không gửi `method:"NUMBER"` hay `numbers:[12,25]` (đã loại khỏi hợp đồng); method số vật dùng `OBJECT_COUNT`. Mỗi lần người dùng submit tạo UUID mới để dễ ghép progress/terminal và tránh xung đột.

**Cập nhật N01:** Server mặc định có 4 worker, queue 100, idempotency theo `(sessionId,requestId)` với TTL 60 giây/tối đa 10.000 mục. Gửi trùng cùng nội dung khi đang chạy dùng chung một job; gửi lại khi đã xong và còn cache chỉ replay terminal, không phát lại progress. Cùng ID khác nội dung trả `INVALID_INPUT`; đầy queue/registry/giới hạn Run trả `SERVER_BUSY`. Reconnect tạo session mới và không replay cache phiên cũ. Không cần migration hoặc nạp lại DB cho N01. Cấu hình, giới hạn và bằng chứng test ở [biên bản 36](36-N01-CONCURRENCY-IDEMPOTENCY-HANDOFF.md); nghiệm thu STOMP sau N01 và benchmark vẫn cần thực hiện trong T01/X01.

### 6.1. Fixture LINES

Body SEND:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "MAI_HOA",
  "payload": {
    "method": "LINES",
    "linesBottomUp": [true, false, true, false, true, false],
    "movingLine": 2
  }
}
```

| Trường trong terminal `COMPLETED` | Kết quả chuẩn |
| --- | --- |
| `data.method` / `data.movingLine` | `LINES` / `2` |
| `data.primaryHexagram` | `H_KHAM_LY` — **Ký tế** (`nameStatus=VERIFIED`) |
| `data.mutualHexagram` | `H_LY_KHAM` — **Vị tế** (`nameStatus=VERIFIED`) |
| `data.changedHexagram` | `H_KHAM_CAN` — **Nhu** (`nameStatus=VERIFIED`) |
| `data.ruleBasis` / `data.sourceStatus` | `SOURCE_VERIFIED` / `VERIFIED` |
| `data.calculationSteps` | `MUTUAL`, `CHANGE` |

Đối chiếu **trọn JSON**, `rules` và `sourceReferences` từ hai file cố định [request LINES](examples/mai-hoa-lines.request.json) / [response LINES](examples/mai-hoa-lines.response.json). `linesBottomUp` được nhập **từ dưới lên**, true là hào dương, false là hào âm. Đây là trạng thái VERIFIED trong phạm vi các quy tắc và tên quẻ đã duyệt, không khẳng định mọi lời luận trong sách đã đối chiếu.

### 6.2. Fixture OBJECT_COUNT

Body SEND:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "MAI_HOA",
  "payload": {
    "method": "OBJECT_COUNT",
    "objectCount": 12,
    "hourIndex": 8,
    "question": "Xem hung kiết của sự việc"
  }
}
```

Quy ước nhóm: thượng quái = `objectCount % 8`; hạ quái = `hourIndex % 8`; hào động = `(objectCount + hourIndex) % 6`. **Số dư 0 quy về 8/8/6**. `hourIndex` là thứ tự giờ địa chi (Tý = 1, Mùi = 8, Hợi = 12). Mẫu số vật 12/giờ 8 có thượng quái 4, hạ quái 8, tổng lấy hào 20, hào động 2.

| Trường trong terminal `COMPLETED` | Kết quả chuẩn |
| --- | --- |
| `data.method` / `data.movingLine` | `OBJECT_COUNT` / `2` |
| `data.primaryHexagram` | `H_CHAN_KHON` — **Dự** |
| `data.mutualHexagram` | `H_KHAM_CAN2` — **Kiển** |
| `data.changedHexagram` | `H_CHAN_KHAM` — **Giải** |
| `data.calculationSteps` | `OBJECT_COUNT_NUMBERS`, `MUTUAL`, `CHANGE` |
| `data.calculationSteps[0].values` | `objectCount=12`, `hourIndex=8`, `movingLineSum=20`, `upperTrigram=4`, `lowerTrigram=8`, `movingLine=2` |
| **Nhận diện nguồn BẮT BUỘC** | `ruleBasis=TEAM_DECISION`, `sourceStatus=SOURCE_AMBIGUOUS`, `decisionReferences` chứa `DEC-20261022-MH-OBJECT-COUNT` |

Đối chiếu [request OBJECT_COUNT](examples/mai-hoa-object-count.request.json) / [response OBJECT_COUNT](examples/mai-hoa-object-count.response.json). Riêng thuật toán “Vật số chiêm” (trang in 51, PDF trang 46) **đã được nhóm chốt để thực thi nhưng bản sách còn đa nghĩa**. **KHÔNG biến nhãn tổng của OBJECT_COUNT thành `SOURCE_VERIFIED` trên UI**. Các rule phụ `MH-TRIGRAM`, `MH-MUTUAL`, `MH-CHANGE` VERIFIED có trạng thái riêng; UI cần giữ nguồn sách/quyết định nhóm, không tự sinh thêm lời luận.

## 7. Smoke test tích hợp trực tiếp (không phải mock UI)

Giữ Server chạy với profile DB, xác minh `/readiness` HTTP 200/READY, sau đó tại `client/`:

```powershell
npm run typecheck
npm run check:contract
npm run test:calculation
npm run smoke:stomp
npm run smoke:lines
npm run smoke:object-count
npm run smoke:progress
```

`smoke:stomp` có kiểm cả endpoint Tam Thế, vì thế cần mã/dữ liệu Server mới nhất. `smoke:lines` duyệt toàn bộ 384 dạng, lỗi hào động và cách ly hai socket; `smoke:object-count` duyệt các số vật/giờ, giá trị biên, lỗi đầu vào và hai socket; `smoke:progress` kiểm tuần tự, JSON lỗi, reconnect, giới hạn queue. Đây là **yêu cầu chạy trên Server thật/DB test**; kết quả 316 unit tests Client trước đó không thay việc nghiệm thu mạng.

Nếu Server ở máy khác, đặt trong terminal chạy smoke:

```powershell
$env:WS_URL = 'ws://<IP-server>:8080/ws'
npm run smoke:stomp
npm run smoke:lines
npm run smoke:object-count
npm run smoke:progress
```

**Điều kiện PASS:** không có lệnh lỗi/exit code khác 0; Client CONNECT STOMP; progress đúng thứ tự và `requestId`; đúng một terminal mỗi request; hai bộ quẻ/hào/nguồn khớp mục 6; input sai vào `errors`; kết quả không rò giữa các socket. Không chụp/log bí mật DB, cookie, CSRF hay dữ liệu riêng tư.

## 8. H01 (mở rộng): session và lịch sử luận giải

V11 đã thêm backend cookie phiên vô danh và REST history. **LINES/OBJECT_COUNT công khai không bắt buộc cookie**; để TV1 tích hợp lưu lịch sử thì cần:

1. **Trước khi mở socket**, `POST /api/v1/session`, body `{}`, headers `Content-Type: application/json` và `X-HuyenCo-Request: 1`. Giữ cookie HttpOnly `huyenco_session` mà trình duyệt nhận và giữ `data.csrfToken` trong bộ nhớ.
2. Mở (hoặc reconnect) `/ws` với **cùng hostname/cookie**, tính quẻ, giữ `calculationRequestId` của kết quả `COMPLETED`.
3. `POST /api/v1/history` với body `{"calculationRequestId":"<UUID>","title":"Lần tra cứu"}`, cùng cookie, `X-HuyenCo-Request: 1`, `X-CSRF-Token: <token>`. Server lưu snapshot do chính Server tính, không nhận `ownerId` hoặc result giả từ Client.
4. Xem/xóa bằng `GET /api/v1/history`, `GET /api/v1/history/{id}` và `DELETE /api/v1/history/{id}`. Thời hạn cache kết quả mới tính để lưu tối đa **15 phút** và có thể bị loại sớm vì giới hạn dung lượng.

**Smoke H01 tùy chọn trên database TEST:** từ thư mục `client/`, chạy lệnh dưới đây khi Server đang nghe ở cổng 8080:

```powershell
$env:H01_HTTP_URL = 'http://127.0.0.1:8080'
npm run smoke:history
Remove-Item Env:H01_HTTP_URL -ErrorAction SilentlyContinue
```

Script `smoke:history` **mặc định trỏ cổng 18084** nếu không có `H01_HTTP_URL`, vì vậy phải đặt biến như trên để dùng Server 8080. Script tạo các phiên và bản ghi lịch sử thử nghiệm, sau đó xóa một số bản ghi; **chỉ chạy trên DB test**, không chạy trên DB chứa dữ liệu thật. Nó cố định Origin `http://localhost:3000`, nên Backend phải cho phép origin này. Nếu PASS, xem thêm `scripts/generated/h01_network.json` ở repo root và ghi kết quả vào checklist mục 9.

Cookie mặc định `SameSite=Lax`; nếu Client/Server khác site, cần same-origin proxy/host nhất quán và cấu hình TLS/cookie đúng. Không tự tắt Origin/CSRF. Chi tiết trường, phân trang, bảo vệ owner và lỗi: [34-H01-SESSION-HISTORY-HANDOFF.md](34-H01-SESSION-HISTORY-HANDOFF.md), fixture `history-*.json` trong `docs/examples`.

## 9. Checklist nghiệm thu & biên bản bàn giao

- [ ] Đã nhận commit SHA đúng (`Server: ________`; `Client: ________`); đủ script/fixture/migrations đến V11. Máy nào chạy PostgreSQL: `________`.
- [ ] Nếu dựng DB, đã backup trước import (nếu có dữ liệu), đọc báo cáo audit (`FAIL=0`; `PENDING=________`).
- [ ] Chạy cả hai profile `database` + `db`; `/health` 200/UP; `/readiness` 200/READY và `database/schema/seed` đều sẵn sàng.
- [ ] Frontend ở origin `________` kết nối STOMP qua `________`, subscribe đủ ba `/user/queue/*`.
- [ ] LINES → **Ký tế / Vị tế / Nhu**, hào 2, `SOURCE_VERIFIED/VERIFIED`.
- [ ] OBJECT_COUNT → **Dự / Kiển / Giải**, hào 2, `TEAM_DECISION/SOURCE_AMBIGUOUS`.
- [ ] Progress 1–4, các lỗi vào `errors`, không lộ response giữa hai phiên WebSocket.
- [ ] `typecheck`, `check:contract`, `test:calculation`, `smoke:stomp`, `smoke:lines`, `smoke:object-count`, `smoke:progress` đã PASS hoặc ghi rõ lỗi/tên lệnh.
- [ ] Nếu nghiệm thu H01, đã có cookie/CSRF/same-origin phù hợp và kiểm lưu, đọc, xóa theo đúng owner; `smoke:history` PASS trên DB test (nếu có chạy).
- [ ] Chụp log/ảnh **đã xóa secret**, ghi thời gian nghiệm thu và tên người xác nhận TV1/TV2/TV3: `________`.

### Xử lý nhanh các lỗi thường gặp

| Triệu chứng | Hướng kiểm tra |
| --- | --- |
| `health` UP nhưng readiness 503 | Sai Spring profile `db`, DB URL/user/password, DB server tắt, schema/seed/Flyway thiếu; xem body `/readiness`. |
| `localhost:8080` refused | Server không chạy hoặc 8080 bị chiếm; nếu hai máy thì không dùng `localhost` từ TV1. |
| WebSocket từ chối Origin | `ALLOWED_ORIGINS` của Server chưa đúng origin Client đang mở; sửa và restart Backend. |
| Progress có nhưng không thấy terminal | Subscribe `/user/queue/results` và `errors` **trước** SEND, ghép đúng `requestId`, kiểm lỗi phía Server. |
| `RULE_NOT_AVAILABLE`, `KNOWLEDGE_DATA_INCOMPLETE` | Kiểm readiness, phiên bản code/DB, rule gate và dữ liệu; không tự đổi trạng thái nguồn sang VERIFIED. |
| Import sai hash/thiếu PDF | Đúng hai file scan, tên và thư mục `-PdfDir`; xem `scripts/generated/migration_stdout.log` và `migration_stderr.log` nếu Flyway lỗi. |
| Không lưu được history | Bootstrap session trước WS, cookie đúng host, header `X-HuyenCo-Request` và CSRF đúng, chưa quá TTL. |
| Đã git pull nhưng DB rỗng | Git không chứa dữ liệu PostgreSQL live; cần bootstrap từ hai PDF hoặc Server/DB test do nhóm bàn giao. |

## 10. Tài liệu tham chiếu và quy tắc bàn giao mã

- [02-API-CONTRACT.md](02-API-CONTRACT.md): hợp đồng v1.2 và mã lỗi.
- [17-A02-DATABASE-HANDOFF.md](17-A02-DATABASE-HANDOFF.md): JDBC/Flyway, bootstrap, readiness.
- [18-B01-LINES-HANDOFF.md](18-B01-LINES-HANDOFF.md), [20-B02-PROGRESS-HANDOFF.md](20-B02-PROGRESS-HANDOFF.md), [21-B03-OBJECT-COUNT-HANDOFF.md](21-B03-OBJECT-COUNT-HANDOFF.md): cách tính và quy tắc tiến trình.
- [23-TV2-CONTRACT-REPLIES-TO-TV1.md](23-TV2-CONTRACT-REPLIES-TO-TV1.md), [34-H01-SESSION-HISTORY-HANDOFF.md](34-H01-SESSION-HISTORY-HANDOFF.md).
- [36-N01-CONCURRENCY-IDEMPOTENCY-HANDOFF.md](36-N01-CONCURRENCY-IDEMPOTENCY-HANDOFF.md): worker/queue, retry/replay, TTL, timeout/disconnect và giới hạn nghiệm thu.
- [examples/README.md](examples/README.md): danh mục fixtures. Khi thông tin trạng thái giữa biên bản cũ và runtime hiện tại khác nhau, ưu tiên hợp đồng và response fixture mới đã được kiểm chứng, giữ nguyên provenance trong từng rule.

**Trước khi bảo TV1 pull GitHub:** TV2/TV3 kiểm `git status`, xác định đúng các thay đổi cần bàn giao rồi commit/push **đủ** code Backend, migrations, scripts, contract, fixtures và tài liệu 35. File tồn tại trên máy chưa đồng nghĩa đã push. **Không dùng `git add -A` vô điều kiện** khi workspace có file đang làm dở; không push `.env.local`, mật khẩu hoặc `scripts/generated/db-backups/`. TV1 phải được cung cấp SHA commit chính xác để hai phía chạy cùng bản.
