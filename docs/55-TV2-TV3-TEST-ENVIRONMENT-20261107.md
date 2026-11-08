# TV2 TV3 — Môi trường Backend và PostgreSQL TEST ngày 07/11/2026

Database TEST hiện ở **V15** sau [migration quản trị nội dung](#migration-quản-trị-nội-dung-v15). [Lịch sử theo tài khoản](56-TV2-TV3-ACCOUNT-AUTH-CONTRACT.md#lịch-sử-theo-tài-khoản-v14) đã được kiểm trên localhost tại mốc V14.

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

### Lượt chuẩn bị LAN ngày 07/11/2026

Website TEST chạy tại `http://192.168.1.8:18100` trên giao diện Wi-Fi của máy chủ. Next.js nhận REST và WebSocket qua cùng địa chỉ. Bản build dùng `HUYENCO_WS_PROXY=1`, `HUYENCO_API_URL=http://127.0.0.1:18102` và `NEXT_PUBLIC_WS_URL=ws://192.168.1.8:18100/ws`. Backend nghe cổng 18102 trên loopback, cho phép Origin `http://192.168.1.8:18100` và dùng PostgreSQL TEST V13 đã sao lưu. Lượt này dùng lịch sử phiên ẩn danh H01.

Build Next.js và 98 ca kiểm Client liên quan đạt. Từ máy chủ, kiểm trực tiếp qua địa chỉ LAN đạt HTTP 200 cho trang chủ, Mai Hoa và API tra quẻ. Qua cùng địa chỉ Next.js, hồi quy H01 đạt 49 yêu cầu HTTP và 8 phản hồi cuối STOMP, gồm lưu, đọc và từ chối phiên ngoài quyền. Các phiên do bộ kiểm tạo đã được dọn.

**Đạt nghiệm thu H01 trên thiết bị thứ hai qua Wi-Fi.** Người dùng xác nhận đã mở website, lập quẻ Mai Hoa theo số vật, lưu kết quả, tải lại trang và đọc được lịch sử. Cửa sổ ẩn danh không thấy bản ghi đã lưu. Truy vấn chỉ đọc trên PostgreSQL TEST xác nhận bản ghi `MAI_HOA / OBJECT_COUNT` được lưu lúc 17:26:09 ngày 07/11/2026 (giờ Việt Nam), với số vật 12 và giờ Chi Mùi (8). Đối chiếu dựa vào dữ kiện và thời điểm lưu vì tiêu đề bản ghi khác `TEST LAN`.

Mốc này đóng cho phiên ẩn danh H01 trong mạng nội bộ. Lịch sử theo tài khoản và truy cập từ Internet vẫn có tiêu chí nghiệm thu riêng. Nếu địa chỉ Wi-Fi đổi, cập nhật Origin, địa chỉ Next.js và URL WebSocket trước khi build lại.

## Migration Auth V13

Ngày 07/11/2026, TV3 đã sao lưu và chạy `flyway:migrate` đến V13 trên `huyenco_test_tv1_20261107`. `flyway:validate` đạt với 13 migration. Flyway 11.7.2 cảnh báo PostgreSQL 18.6 nằm ngoài phạm vi phiên bản đã được Flyway này kiểm chứng.

- So số dòng và dấu vân tay nội dung của cả 17 bảng dữ liệu V12 trước và sau migration. Tất cả khớp, gồm hai bảng H01 vốn đang rỗng trên TEST.
- Kiểm thêm tài khoản và phiên hợp lệ trong giao dịch rollback. PostgreSQL từ chối định danh trùng, token trùng, role, trạng thái, cổng hoặc thời hạn sai và phiên thiếu tài khoản. Xóa tài khoản trong giao dịch thử đã xóa phiên tương ứng.
- Sau rollback, `accounts` và `account_sessions` đều có 0 dòng. Tạo tài khoản TEST cùng bước triển khai Auth bằng cơ chế băm mật khẩu của Backend.
- Bản sao lưu trước V13 nằm ngoài Git tại `C:\Users\abc\Documents\Codex\huyenco-v13-test-20261107-163007-244\before-v13.dump`. Danh mục archive đọc được bằng `pg_restore --list`.

## Migration lịch sử tài khoản V14

Flyway đã áp dụng và xác thực V14 trên `huyenco_test_tv1_20261107`. Bản ghi H01 có sẵn giữ nguyên dấu vân tay nội dung sau migration. Bản sao lưu trước V14 nằm tại `C:\Users\abc\Documents\Codex\huyenco-account-history-test-20261107\before-v14-180958782.dump`.

Bản TEST lịch sử tài khoản chạy tại `http://127.0.0.1:18103`, qua Backend `127.0.0.1:18104`. Nó dùng `AUTH_ENABLED=true` và `NEXT_PUBLIC_ACCOUNT_HISTORY=1`. Địa chỉ LAN của lượt H01 trước là môi trường tương thích phiên ẩn danh.

## Migration quản trị nội dung V15

Ngày 07/11/2026, Flyway áp dụng V15 trên `huyenco_test_tv1_20261107` và xác thực đủ 15 migration. Kết quả đối chiếu số dòng và dấu vân tay nội dung của 20 bảng dữ liệu V14 đều khớp. Flyway 11.7.2 tiếp tục cảnh báo về phạm vi hỗ trợ PostgreSQL 18.6.

Kiểm schema trong giao dịch rollback. PostgreSQL từ chối tạo bài trùng, bật hiển thị khi chưa công bố, trỏ bản nháp, bản công bố hoặc nhật ký sang bài khác, lý do trả duyệt rỗng, sửa phiên bản đã lưu và xóa sự kiện nhật ký. Kiểm tra có thể lưu bản nháp mới trong khi vẫn đọc được bản đã công bố. Sau rollback, cả ba bảng CMS đều rỗng. Đây là kết quả kiểm schema. Quyền Admin và xung đột phiên bản khi ghi cần kiểm ở bước triển khai API.

Bản sao lưu trước V15 nằm tại `C:\Users\abc\Documents\Codex\huyenco-method-guide-test-20261107\before-v15-183838224.dump`. Đã kiểm danh mục archive bằng `pg_restore --list`.
