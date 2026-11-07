# TV2 TV3 — Môi trường Backend và PostgreSQL TEST ngày 07/11/2026

Database TEST hiện ở **V13** sau [migration Auth](#migration-auth-v13). Các số liệu V12 trong phần bàn giao bên dưới là mốc trước migration.

## Kết quả bàn giao

Đã tạo database riêng `huyenco_test_tv1_20261107` trên PostgreSQL 18.6 ở `127.0.0.1:5432`. Nguồn là bản `pg_dump -Fc` của `huyenco`; dữ liệu hai bảng `anonymous_sessions` và `interpretation_history` không được sao chép. Database chính không bị migrate hoặc ghi dữ liệu trong lượt chuẩn bị này. Bản dump nằm ngoài repository tại `C:\Users\abc\Documents\Codex\huyenco-postgres-recovery-20261104\huyenco-test-tv1-20261107-knowledge.dump` và không được đưa lên Git.

Tên `huyenco_test_tv1` trong bàn giao Phase 7B của TV1 không tồn tại trên máy này lúc kiểm tra. Dùng đúng tên có hậu tố ngày ở trên; không tự đổi thành `huyenco`.

| Kiểm toán chỉ đọc sau restore | Kết quả |
| --- | ---: |
| Bảng public / Flyway cao nhất | 18 / V12 |
| Quẻ / hào | 64 / 384 |
| Nghĩa tên quẻ `NAME_GLOSS` đã duyệt | 64 |
| Bundle nguồn / mẫu Mai Hoa | 1 / 20 |
| Kết quả / ánh xạ Tam Thế mở rộng | 19 / 204 |
| Phiên ẩn danh / lịch sử | 0 / 0 |

Backend chạy bằng JDK 17.0.12 và JAR hiện có, Spring profile `db`, Flyway **tắt** vì database TEST đã ở V12. Cổng `8080`; Origin được cho phép trong lượt này: `http://localhost:3000` và `http://127.0.0.1:3173`. Kết quả kiểm tại máy Server:

- `GET http://127.0.0.1:8080/api/v1/health`: HTTP 200, `UP`.
- `GET http://127.0.0.1:8080/api/v1/readiness`: HTTP 200, `READY`, `database=UP`, `schema=READY`, `seed=READY`.
- `GET http://127.0.0.1:8080/api/v1/hexagrams?size=1`: HTTP 200, có quẻ đã duyệt.
- `npm run smoke:stomp` với `WS_URL=ws://127.0.0.1:8080/ws`: PASS; hai session tách biệt, Mai Hoa OBJECT_COUNT và Tam Thế hoàn tất, đầu vào sai trả `INVALID_INPUT`.

`businessFeaturesReady=false` trong readiness là cờ phạm vi toàn sản phẩm; nó không phủ định trạng thái lưu trữ `READY`. Admin Auth, CRUD và chat thuộc các mốc sau, chưa được chứng minh bằng lượt này. Bằng chứng trên là localhost; truy cập từ máy khác chưa được kiểm.

## Cách chạy lại Backend trên máy này

Từ thư mục gốc dự án, mở PowerShell riêng. Nhập mật khẩu qua prompt, không ghi vào file cấu hình hoặc Git:

```powershell
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/huyenco_test_tv1_20261107'
$env:DB_USERNAME = 'postgres'
$secret = Read-Host 'Mật khẩu PostgreSQL' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
Remove-Variable secret
$env:SPRING_FLYWAY_ENABLED = 'false'
$env:ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3173'
& 'C:\Program Files\Java\jdk-17\bin\java.exe' -jar '.\server\target\huyen-co-server-0.1.0-SNAPSHOT.jar' --spring.profiles.active=db --spring.flyway.enabled=false
```

Nếu JAR bị thay hoặc Server source thay đổi, build lại với Maven profile `database` trước khi chạy. Chỉ đặt `SPRING_FLYWAY_ENABLED=true` trong lượt migration đã có backup và được kiểm soát; không bật khi chỉ nghiệm thu trên database TEST đã chuẩn bị. Sau khi dừng Server, xóa `DB_PASSWORD` khỏi phiên PowerShell.

TV1 trên cùng máy dùng `HUYENCO_API_URL=http://127.0.0.1:8080` cho REST proxy và `NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8080/ws` cho STOMP. Khi thử từ máy khác, thay `127.0.0.1` bằng IP Server, cấu hình Origin thật và firewall theo [hướng dẫn 35](35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md); kiểm readiness từ máy TV1 trước. PostgreSQL không cần mở cổng ra máy TV1.

## Giới hạn và bước kế tiếp

Lượt này chưa chạy các thao tác ghi H01, chưa nghiệm thu Browser Client hoặc mạng hai máy. TV1 có thể chạy Phase 7B luồng lõi trên TEST này; trước khi thử H01, xác nhận `DB_URL` trên tiến trình Server và chỉ tạo/xóa dữ liệu TEST của chính lượt nghiệm thu. TV2–TV3 tiếp tục chốt hợp đồng Auth tài khoản và migration tài khoản/vai trò; phiên H01 ẩn danh hiện tại không phải phiên ADMIN.

## Mốc nghiệm thu bắt buộc: người dùng truy cập từ máy khác

Kết quả mong đợi trong kế hoạch sau demo yêu cầu người dùng ở máy khác mở website, chọn phương pháp, gửi dữ liệu, nhận kết quả và xem lịch sử đúng phiên/tài khoản. Lượt kiểm localhost ở trên **chưa đáp ứng** yêu cầu này. Chia nghiệm thu thành hai mức để không nhầm phiên ẩn danh H01 với tài khoản đăng nhập chưa được triển khai:

1. **Mạng hai máy với phiên ẩn danh H01 — làm ngay trên TEST.** TV2 chạy Backend bằng địa chỉ mạng mà máy TV1 truy cập được, xác nhận chỉ mở cổng Backend cần thiết, đặt `ALLOWED_ORIGINS` theo Origin thật của Client và kiểm REST/STOMP. TV3 giữ datasource ở `huyenco_test_tv1_20261107`, xác nhận dữ liệu và sao lưu trước các lượt ghi lịch sử. TV1 chạy Client trên máy khác, cấu hình cả REST proxy lẫn WebSocket tới IP Server. Hai trình duyệt/phiên độc lập lần lượt lập quẻ, chủ động lưu kết quả, tải lại trang và xem lịch sử; bản ghi của phiên A không xuất hiện ở phiên B. Kiểm 401/403/404 theo hợp đồng H01. Ghi IP/port, Origin, commit, kết quả và lỗi; che token/cookie. Nếu cookie/CSRF hoặc WebSocket không hoạt động qua hai hostname, thiết lập một địa chỉ truy cập nhất quán và reverse proxy phù hợp trước khi đánh dấu PASS; không tắt kiểm tra bảo mật để vượt lỗi.
2. **Lịch sử theo tài khoản — sau mốc Auth.** TV2/TV3 phải chốt và triển khai liên kết lịch sử với tài khoản cùng quy tắc chuyển/giữ lịch sử ẩn danh, rồi mới để TV1 nghiệm thu đăng nhập trên máy khác, lưu và đọc lại trên thiết bị thứ hai. Cần kiểm người dùng khác không xem được, logout/phiên hết hạn không còn quyền và bản ghi H01 cũ không bị mất. Chưa có Auth và hợp đồng sở hữu thì ghi trạng thái `CHƯA TRIỂN KHAI`, không gọi mức này đã đạt.

**Điều kiện đóng mốc:** có bằng chứng Browser Client trên máy khác cho toàn chuỗi mở trang → chọn phương pháp → gửi → nhận → lưu → tải lại/xem lịch sử, kèm ca cách ly phiên. Khả năng truy cập website công khai ngoài mạng nội bộ/HTTPS là mốc triển khai riêng; thử hai máy trong LAN không chứng minh đã triển khai Internet.

## Migration Auth V13

Ngày 07/11/2026, TV3 đã sao lưu và chạy `flyway:migrate` đến V13 trên `huyenco_test_tv1_20261107`. `flyway:validate` đạt với 13 migration. Flyway 11.7.2 cảnh báo PostgreSQL 18.6 nằm ngoài phạm vi phiên bản đã được Flyway này kiểm chứng.

- So số dòng và dấu vân tay nội dung của cả 17 bảng dữ liệu V12 trước và sau migration. Tất cả khớp, gồm hai bảng H01 vốn đang rỗng trên TEST.
- Kiểm thêm tài khoản và phiên hợp lệ trong giao dịch rollback. PostgreSQL từ chối định danh trùng, token trùng, role, trạng thái, cổng hoặc thời hạn sai và phiên thiếu tài khoản. Xóa tài khoản trong giao dịch thử đã xóa phiên tương ứng.
- Sau rollback, `accounts` và `account_sessions` đều có 0 dòng. Tạo tài khoản TEST cùng bước triển khai Auth bằng cơ chế băm mật khẩu của Backend.
- Bản sao lưu trước V13 nằm ngoài Git tại `C:\Users\abc\Documents\Codex\huyenco-v13-test-20261107-163007-244\before-v13.dump`. Danh mục archive đọc được bằng `pg_restore --list`.
