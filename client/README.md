# Huyền Cơ Client

Next.js Client do TV1 phụ trách: biểu mẫu Mai Hoa/Tam Thế, kết quả có nguồn, tra cứu quẻ, lịch/Can Chi và lịch sử H01. Client kiểm đầu vào và trình bày phản hồi; phép tính và quyền truy cập do Backend quyết định.

**Trạng thái:** Phase 0–7 đã có implementation; lịch sử mới được nghiệm thu UI bằng mock. Chưa coi F08 hoặc toàn sản phẩm đã nghiệm thu live. Xem [ma trận Phase 8A](../docs/44-TV1-PHASE8A-ACCEPTANCE.md) và [kịch bản demo](../docs/45-TV1-DEMO-SCRIPT.md).

## Môi trường và cài đặt

- Next.js đang cài yêu cầu Node.js **>=20.9.0**. Dùng phiên bản Node đáp ứng yêu cầu này và npm đi kèm; repo chưa pin riêng phiên bản npm.
- Máy dùng kiểm tra Phase 8A: Node **26.5.0**, npm **11.17.0**, Next.js **16.4.2**. Đây không phải bằng chứng đã chạy trên mọi phiên bản Node được hỗ trợ.
- Giữ `package-lock.json`; không nâng dependencies chỉ để chạy dự án.

Từ repository root, dùng PowerShell:

```powershell
cd client
npm ci
if (-not (Test-Path -LiteralPath .env.local)) { Copy-Item .env.example .env.local }
```

Chỉ copy nếu chưa có `.env.local`; nếu đã có, đối chiếu và giữ cấu hình của bạn. Không commit `.env.local`, token, cookie hoặc thông tin đăng nhập. Phase 8A sử dụng dependencies đã có, **chưa thực hiện cài/chạy lại trên máy sạch**.

## Cấu hình kết nối

Ví dụ chạy cùng máy, thống nhất mở trang bằng `127.0.0.1`:

```dotenv
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8080/ws
NEXT_PUBLIC_API_BASE_URL=/api/v1
HUYENCO_API_URL=http://127.0.0.1:8080
```

| Biến | Nơi sử dụng | Ý nghĩa |
| --- | --- | --- |
| `NEXT_PUBLIC_WS_URL` | Browser; có trong bundle | WebSocket STOMP trực tiếp, không SockJS. Mặc định `ws://localhost:8080/ws`. |
| `NEXT_PUBLIC_API_BASE_URL` | Browser; có trong bundle | Giữ `/api/v1` để dùng proxy cùng origin; H01 từ chối base URL khác origin. |
| `HUYENCO_API_URL` | Next.js server-only | Đích Backend cho REST; không thêm tiền tố `NEXT_PUBLIC`. |
| `API_SERVER_URL` | Next.js server-only | Alias dự phòng khi chưa đặt `HUYENCO_API_URL`. |

Thứ tự REST Backend: `HUYENCO_API_URL` → `API_SERVER_URL` → `http://127.0.0.1:8080`. Đặt URL gốc, không nối thêm `/api/v1`. Đổi URL WebSocket không tự đổi đích REST. Các biến `NEXT_PUBLIC_*` được đóng vào bundle, còn rewrites được tạo khi build: cấu hình **trước build**; đổi cấu hình phải restart dev hoặc build/start lại production.

Proxy giữ các tuyến: `/api/v1/hexagrams/:path*`, hai POST `/api/v1/calendar/convert` và `/api/v1/calendar/can-chi`, `/api/v1/session`, `/api/v1/history/:path*`. Wildcard nhận cả collection và đường dẫn chi tiết. Proxy không thay thế kiểm tra Origin, CSRF hoặc ownership của Backend.

## Chạy dev và production

Trong `client/`:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3173
```

Mở `http://127.0.0.1:3173`. Port 3173 là lựa chọn của môi trường TV1; Next.js mặc định dùng 3000 nếu không truyền port.

```powershell
npm run build
npm run start -- --hostname 127.0.0.1 --port 3173
```

Không chạy dev/start đồng thời cùng port hoặc build trong khi dev đang dùng cùng `.next`. `next dev` có thể tự sinh/cập nhật `AGENTS.md` và `next-env.d.ts`; review Git sau khi chạy. Không xóa artifact của người khác để làm sạch status.

Backend cần code/contract v1.2 hiện tại, dữ liệu V12 đã được TV2/TV3 bàn giao và Origin thật của trang được cho phép. Git không chuyển PostgreSQL. Đọc [hướng dẫn Backend](../docs/35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md); không tự bootstrap/import/Flyway hoặc đổi CORS để vượt lỗi. Phase 8A không khởi động lại Backend.

## Phiên, cookie và riêng tư

**Mở bất kỳ trang nào có thể gọi `POST /api/v1/session` tự động**, trước WebSocket. Trên Backend thật, bootstrap này có thể ghi DB; không coi chỉ mở giao diện là thao tác chỉ đọc. Chỉ mở UI nối Backend thật khi môi trường và quyền thao tác đã được xác nhận.

- Cookie `huyenco_session` là HttpOnly, SameSite=Lax, Path=/; JavaScript không đọc cookie. CSRF chỉ ở React memory, bootstrap lại khi reload.
- Cookie không phân biệt port nhưng phân biệt hostname: `localhost` và `127.0.0.1` không dùng chung cookie. Client chỉ chuẩn hóa hai alias loopback này cho WebSocket. Với hai máy/hostname khác nhau cần cấu hình cùng hostname/reverse proxy phù hợp; không tắt Origin/CSRF. Socket không tương thích cookie không được coi là kết quả có thể lưu.
- Socket được tạo sau bootstrap; bootstrap thất bại cho phép tính ẩn danh nhưng không cho lưu. Reconnect không tự resend yêu cầu cũ.
- Lưu là opt-in sau `COMPLETED` hợp lệ, chỉ gửi requestId và tiêu đề. Kết quả chưa lưu có TTL tối đa 15 phút và có thể bị loại sớm hơn. Chỉ báo lưu sau HTTP 201 hợp lệ; xóa cần xác nhận và HTTP thành công.
- Không gửi ownerId/snapshot/ngày sinh/câu hỏi trong body lưu. Không lưu token hoặc kết quả vào localStorage/sessionStorage, không log dữ liệu riêng tư. Hết quyền/CSRF bị từ chối sẽ ẩn state riêng tư. Mất cookie không có cơ chế đăng nhập khôi phục lịch sử.
- Hai tab cùng profile có thể cùng owner; nghiệm thu owner A/B cần **hai browser context độc lập**, kiểm Server từ chối đọc/xóa chéo. UI ẩn bản ghi không chứng minh authorization.

## Kiểm thử và mock

Các lệnh dưới dùng fixture/mock hoặc kiểm tĩnh, không yêu cầu Backend/DB:

```powershell
npm run test:run
npm run test:calculation
npm run check:contract
npm run typecheck
npm run build
```

`test:run` chạy Vitest/component/mock HTTP/STOMP; `test:calculation` chạy reducer/Panel bằng Node. `check:contract` kiểm 62 JSON fixture, không phải 62 ca live. Kết quả chính xác của lượt cuối ở ma trận Phase 8A.

Không có `npm run test:e2e` hoặc chế độ mock được bật sẵn trong sản phẩm. Test mock nằm trong các file `.test.*`, fixture chuẩn ở `../docs/examples/`; không ghi đè fixture để khớp UI. Browser mock Phase 8A dùng helper tạm ngoài repo, không phát hành cùng Client. Để trở lại cấu hình thật: dừng preview/helper mock, giữ đúng URL thực trong môi trường cục bộ và build lại; không dùng ảnh fixture làm bằng chứng live.

Các `smoke:*` là script kết nối mạng thật, chỉ chạy sau khi review script và xác nhận môi trường. **Không chạy `smoke:history` trong quy trình chỉ đọc**: script tạo phiên, lưu và xóa lịch sử. Các script E2E mở rộng cũng có thể ghi history. Phase 8A không chạy smoke, V12 739-case E2E hoặc load test.

## Trang và giới hạn

`/`, `/mai-hoa`, `/tam-the`, `/hexagrams`, `/hexagrams/[code]`, `/calendar`, `/history`, `/history/[id]` đều có implementation. Tên quẻ/NAME_GLOSS không phải lời dự đoán; giữ phân biệt SOURCE_VERIFIED với TEAM_DECISION. Lịch dùng UTC+07:00 cố định, Dương 1900–2099, quy ước Can Chi không phải Bát Tự theo tiết khí. Tam Thế LEGACY có thể thất bại cả request khi thiếu khóa Lộc; EXTENDED giữ no-match Lộc riêng và vẫn trình bày các mục bổ sung hợp lệ.

Client chưa được xác nhận DONE toàn trình: còn live H01 hai-owner, nghiệm thu UI/network cuối, kiểm máy sạch và tài liệu demo/bản nộp cần nhóm review. Nội dung thuộc tri thức văn hóa truyền thống, không phải dự đoán khoa học.
