# H01 — Phiên người dùng và lịch sử luận giải (25/10/2026)

**DONE phần Server và schema huyenco.** V11 đã áp dụng sau sao lưu đầy đủ; dữ liệu tri thức không đổi. H01 không triển khai giao diện, đăng ký tài khoản hoặc đăng nhập bằng mật khẩu. TV1 tích hợp các API và vòng đời phiên dưới đây. Task tiếp theo: **N01 — điều phối hữu hạn và idempotency yêu cầu tính**.

## 1. Kế hoạch đã thực hiện

| Bước | Triển khai | Kiểm chứng |
| --- | --- | --- |
| 1 | Chốt phiên vô danh/cookie, quyền owner, CSRF và thời hạn | Giữ hợp đồng v1.2; không nhận ownerId hoặc snapshot của Client |
| 2 | V11 anonymous_sessions/interpretation_history và JDBC | FK owner, unique owner/requestId, index phân trang; giới hạn lưu được khóa theo owner |
| 3 | POST session, xác thực cookie, chặn Origin/CSRF | Cookie giả/hết hạn/trùng, nguồn khác, thiếu/sai token bị từ chối |
| 4 | Gắn cookie đã xác thực vào WebSocket handshake | Không nhận danh tính từ native STOMP header; queue vẫn cách ly từng socket |
| 5 | Giữ kết quả thành công trong bộ nhớ có giới hạn | Đúng owner; không giữ lỗi/timeout/hủy; TTL và hạn byte/số mục |
| 6 | API lưu/list/search/filter/detail/delete | Snapshot DTO thật, owner predicates, JSON nghiêm ngặt, truy cập chéo404 |
| 7 | Kiểm DB tạm, HTTP/STOMP, restart và fixtures |480 Java có DB;54 HTTP H01 +8 terminal STOMP;31 fixtures/typecheck; kiểm restart |
| 8 | Backup rồi áp dụng V11 vào huyenco | Dữ liệu tri thức trước/sau giống nhau; audit nguồn54/0 FAIL/0 PENDING |

## 2. Phiên và quyền sở hữu

- `POST /api/v1/session`, body `{}`, header `Content-Type: application/json`, `X-HuyenCo-Request:1`.
- Nếu chưa có cookie: tạo secret32 byte bằng SecureRandom, cookie `huyenco_session` dạng43 ký tự base64url; DB chỉ lưu SHA-256, không lưu raw token.
- Cookie `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`. `Secure` khi request HTTPS hoặc `SESSION_SECURE_COOKIE=true`; triển khai sau reverse proxy TLS phải cấu hình proxy/cookie tương ứng.
- `data={expiresAt,csrfToken}`; không trả raw token/ownerId trong JSON. Không ghi token, câu hỏi hoặc dữ liệu sinh vào log.
- Gọi lại với cookie hợp lệ trả cùng phiên và CSRF, không kéo dài thời hạn. Owner tồn tại30 ngày kể từ tạo; cookie giả/hết hạn trả401 INVALID_SESSION.
- Đây là phiên vô danh theo cookie trình duyệt: mất cookie không có cơ chế phục hồi tài khoản. Xác thực hạn phiên ở REST và khi kết nối WebSocket; không có job xóa vật lý tự động các dòng phiên hết hạn trong H01.
- CSRF được suy ra từ secret cookie; Server so constant-time. Lưu/xóa yêu cầu cả `X-HuyenCo-Request:1` và `X-CSRF-Token`. Với header Origin, chỉ nhận origin cấu hình hoặc origin của chính backend. Không có Origin vẫn phải vượt custom header/CSRF (hỗ trợ CLI). Mọi response phiên/lịch sử có `Cache-Control: no-store`.

## 3. Luồng TV1 phải tích hợp

1. Bootstrap session trước khi mở WebSocket; giữ `csrfToken` trong bộ nhớ trang. Khi reload, gọi bootstrap lại để nhận CSRF cho cookie hiện có.
2. Mở WebSocket `/ws` bằng cùng hostname/cookie. Trình duyệt tự gửi cookie, Client không cần đọc HttpOnly. Nếu WebSocket đã mở trước bootstrap, kết nối lại để handshake nhận owner.
3. Tính quẻ/luận giải theo STOMP hiện hành. Nhận `COMPLETED` và giữ requestId của kết quả muốn lưu.
4. Khi người dùng bấm lưu, POST history chỉ gửi requestId và tiêu đề tùy chọn. Server lấy đúng kết quả đã tính cho owner, không tin snapshot gửi từ Client.
5. Dùng GET list/detail và DELETE để xem lại/xóa. Các fetch cùng origin tự gửi cookie; qua cấu hình cross origin cần tích hợp đúng proxy/cookie, không sửa tắt kiểm tra Origin.

Ví dụ lưu sau khi đã bootstrap và có kết quả:

```javascript
await fetch('/api/v1/history', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-HuyenCo-Request': '1',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({ calculationRequestId: completedRequestId, title: 'Lần tra cứu của tôi' }),
});
```

Tính quẻ công khai không cookie vẫn được phép nhưng không có kết quả thuộc owner để lưu. STOMP header giả `ownerId`/`cookie` không tạo quyền sở hữu. Cùng owner có thể dùng nhiều socket, kết quả/progress vẫn gửi theo socket, không phát chung cho các tab.

## 4. API và dữ liệu

Envelope `{requestId,status,data,error}` và mã lỗi dùng chung. UUID requestId của REST do Server tạo.

| API | Điều kiện | data |
| --- | --- | --- |
| POST /api/v1/session | JSON `{}`, custom header, origin hợp lệ | expiresAt,csrfToken; Set-Cookie khi tạo |
| POST /api/v1/history | Cookie,custom header,CSRF; `{calculationRequestId,title?}` | HistoryDetail,HTTP201 |
| GET /api/v1/history | Cookie; q?,type?,page=0,size=20 | Page<HistoryItem> |
| GET /api/v1/history/{id} | Cookie,UUID | HistoryDetail |
| DELETE /api/v1/history/{id} | Cookie,custom header,CSRF | `{deleted:true}` |

- HistoryItem: id,type,title,createdAt,ruleBasis. HistoryDetail thêm `result` theo MaiHoaResult/TamTheResult. Không trả ownerId/cookie/calculation_request_id nội bộ.
- q≤100 ký tự, tìm tiêu đề không phân biệt hoa/thường bằng chuỗi con literal; `%`/`_` không có nghĩa wildcard. Không cam kết tìm không dấu cho tiêu đề lịch sử.
- type nếu có chỉ MAI_HOA/TAM_THE; page nguyên không âm đến2147483647; size1–100. Sắp createdAt giảm,id giảm. Offset tính bằng long; ngoài trang cuối trảitems rỗng và tổng đúng. Count/list cùng snapshot REPEATABLE_READ.
- title nếu có phải là chuỗi không trắng,1–100 ký tự sau strip, không ký tự điều khiển. Không có title dùng `Kết quả Mai Hoa` hoặc `Luận giải Tam Thế`.
- POST body đọc tối đa16001 byte để từ chối >16000, UTF-8 nghiêm ngặt, không JSON trùng key/nối tài liệu, field lạ hoặc null sai kiểu. Không chấp nhận ownerId/result/ruleBasis do Client đưa vào.
- Snapshot lưu result DTO do Server tạo, bao gồm nguồn/phiên bản/quyết định nhóm; không lưu payload thô, birthDate,birthTime hoặc question. Các giá trị đã tính như lunarDate và bước số học Mai Hoa được giữ theo Result DTO. Tiêu đề là nội dung người dùng chủ động đặt.

### Quy tắc lưu và thời hạn

- Chỉ giữ các kết quả thành công có cookie owner đã xác thực. Cache tối đa15 phút, tối đa10000 mục/32MiB toàn Server và128KiB cho1 snapshot; bỏ mục cũ nhất khi đầy.15 phút là hạn tối đa, không bảo đảm giữ được khi hết dung lượng.
- Không lưu khi tính lỗi/timeout/disconnect đã hủy. Kết quả thành công đã phát có thể lưu sau khi ngắt WebSocket nếu còn cache và cookie hợp lệ.
- Trùng requestId giữa hai owner độc lập. Cùng owner/requestId có các kết quả khác nhau trong cache bị đánh dấu xung đột, lưu trả400 INVALID_INPUT; Client tính lại với ID mới. N01 sẽ bổ sung chặn/dedupe ngay ở yêu cầu tính.
- Một owner/requestId chỉ có1 bản ghi. POST lặp trả lại bản gốc HTTP201, không đổi tiêu đề/thời điểm/snapshot và không tăng số lượng. Nếu cache đã hết hạn/restart, bản đã lưu vẫn có thể trả lại theo cùng requestId; kết quả chưa lưu không phục hồi được từ cache đã mất.
- Mỗi owner tối đa1000 lịch sử mặc định; khóa hàng anonymous_sessions trong transaction trước đếm/chèn để các yêu cầu đồng thời không vượt giới hạn. Mọi đọc/xóa đều lọc owner từ cookie. Bản đã lưu tồn tại qua restart trong PostgreSQL, quyền truy cập vẫn cần phiên còn hạn.

### Lỗi

| HTTP/code | Ý nghĩa |
| --- | --- |
|400 INVALID_INPUT|JSON/query/UUID/title sai; quá giới hạn; requestId có kết quả mâu thuẫn |
|401 INVALID_SESSION|Thiếu/giả/trùng/hết hạn cookie |
|403 CSRF_REJECTED|Sai Origin/custom header/CSRF |
|404 NOT_FOUND|Không thuộc owner; thiếu kết quả thành công trong cache; lịch sử không tồn tại/đã xóa |
|503 DATABASE_UNAVAILABLE|Không DB hoặc lỗi truy cập kho phiên/lịch sử |
|500 INTERNAL_ERROR|Lỗi ngoài dự kiến, thông điệp chung không lộ SQL/secret |

## 5. Schema, cấu hình và mã nguồn

- `V11__anonymous_sessions_and_history.sql`: anonymous_sessions(owner_id,token_hash,created_at,expires_at); interpretation_history(id,owner_id,calculation_request_id,calculation_type,title,created_at,rule_basis,result_snapshot JSONB).
- FK history→owner ON DELETE CASCADE, unique(owner,requestId), index(owner,createdAt DESC,id DESC), index hết hạn phiên. Không thay V1–V10 hoặc dữ liệu sách.
- Module `server/src/main/java/com/huyenco/history/`: SessionService,RequestGuards,HistoryController,HistoryStore/JdbcHistoryStore,CompletedResults,HistoryHandshakeInterceptor,HistoryConfig.
- WebSocketConfig/SessionDestinationInterceptor/CalculationSessions nối owner cookie đã xác thực với bộ giữ kết quả. Không gắn owner làm Principal dùng chung queue của các socket.
- Biến môi trường: HISTORY_RESULT_TTL_SECONDS=900, HISTORY_RESULT_MAX_ENTRIES=10000, HISTORY_RESULT_MAX_BYTES=33554432, HISTORY_MAX_PER_OWNER=1000, SESSION_SECURE_COOKIE=false mặc định HTTP dev.
- `client/src/types/contract.ts` và31 fixtures được kiểm cùng Java;4 mẫu history list/detail/not-found/deleted chụp qua HTTP thật. Không lưu cookie/CSRF thực vào fixture, không sửa UI TV1.

## 6. Bằng chứng

- **480 Java có PostgreSQL,0 lỗi/0 bỏ qua**, gồm7 test bảo mật/cache/controller/handshake và3 test JDBC lịch sử (cách ly,giới hạn đồng thời,hết hạn/lưu bền).
- Bootstrap2 lần toàn bộ hàng/metadata giống nhau, DB tạm đã xóa. `scripts/generated/h01_bootstrap.log` và `a02_bootstrap_result.json`.
- **54 HTTP H01 +8 terminal STOMP** trên Server thật: hai owner/cùng requestId,hai socket cùng owner,anonymous spoof header,JSON sai,CSRF,owner chéo,lọc/phân trang,TTL cache,xung đột requestId,lưu kết quả Mai Hoa/Tam Thế và xóa. `h01_network.json`, `h01_network.log`.
- Đã dừng/khởi động lại Server giữa lượt kiểm: cookie/CSRF vẫn hợp lệ, snapshot đã lưu đọc lại giống kết quả gốc; POST trùng không tạo bản ghi mới. DB thử độc lập, sau kiểm đã dọn. `h01_integration.json`.
- Hồi quy E02 **121 HTTP** vẫn đạt sau restart; TypeScript/**31 fixtures**/**54 Python** đạt. JAR profile database build thành công.
- Server không profile db vẫn khởi động và trả đúng2 lỗi HTTP H01: POST session503 DATABASE_UNAVAILABLE,GET history không cookie401 INVALID_SESSION. Không có phiên giả hoặc lịch sử in-memory thay DB.
- `huyenco` đã có V11 sau backup `scripts/generated/db-backups/before-h01-20261025T084504196842Z.dump`; archive được kiểm bằng pg_restore -l. Hash của11 bảng tri thức trước/sau giống nhau, audit nguồn54 PASS/0 FAIL/0 PENDING. `h01_deployment.json`, `h01_migration.log`, `tv3_audit_report.md`.
- Khi triển khai xong, hai bảng mới có0 dòng vì chưa có thao tác sử dụng thật; không chèn dữ liệu demo riêng tư vào huyenco.

## 7. Chạy và kiểm lại

Khởi động lại backend profile db để nạp mã H01. Không cần chạy lại import sách. V11 đã có trong huyenco; Flyway chỉ validate khi khởi động lại.

```powershell
# Giao thức trên Server đang chạy; không sửa UI:
$env:H01_HTTP_URL='http://localhost:8080'
node client/scripts/smoke-history.mjs
```

Lệnh smoke tạo phiên/lịch sử thử trên Server được chỉ định; nên dùng database thử. Chạy trực tiếp mặc định không thử restart/TTL rút ngắn. Ca TTL được bật khi H01_RESTART_CHECK=1 hoặc H01_WAIT_TTL_MS được chỉ định,thiết kế cho Server đặt HISTORY_RESULT_TTL_SECONDS=5 và chờ5100ms. Cách khuyến nghị là `python scripts/verify_h01.py`, script tự dựng database tạm, bootstrap, chạy Server/các ca/restart/không DB và dọn tài nguyên; cần PGPASSWORD trong môi trường và JAR build profile database. `--write-fixtures` dùng khi muốn chụp lại mẫu. Bộ kiểm hoàn chỉnh Java+bootstrap lặp: `python scripts/test_a02_bootstrap.py`.

`scripts/apply_h01.py` dành cho triển khai schema sau backup vào DB chỉ định; nhận mật khẩu qua môi trường, không chứa mật khẩu trong mã. Không chạy script kiểm thử ghi lịch sử trên DB dùng thật chỉ để có dữ liệu mẫu.

**Giới hạn nghiệm thu:** H01 DONE Server/schema, chưa coi giao diện I01 hoặc toàn sản phẩm đã xong. N01 (worker/queue hữu hạn và registry idempotency yêu cầu tính), đo tải và nghiệm thu UI tiếp tục theo kế hoạch. Các giới hạn nguồn sách/tài lộc của biên bản33 giữ nguyên.
