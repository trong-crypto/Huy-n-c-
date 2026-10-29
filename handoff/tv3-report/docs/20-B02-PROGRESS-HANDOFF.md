# B02 — Tiến trình STOMP, lỗi và vòng đời yêu cầu

Hoàn thành ngày 24/10/2026. Server đã phát tiến trình tại các bước thực sự chạy; hook Client và ResultPanel nhận/hiển thị được tiến trình. Không có thay đổi migration, nội dung sách hoặc trạng thái VERIFIED trong B02.

## 1. Luồng và thông điệp

Client đăng ký ba đích: `/user/queue/progress`, `/user/queue/results`, `/user/queue/errors`. SEND vẫn chỉ dùng hai đường `/app/mai-hoa/calculate`, `/app/tam-the/calculate`.

| Bước LINES thành công | sequence | Thời điểm phát |
| --- | ---: | --- |
| ACCEPTED | 1 | Server đã đọc JSON và nhận yêu cầu có requestId chuẩn; chưa khẳng định input/nghiệp vụ hợp lệ |
| VALIDATING | 2 | Trước kiểm envelope/input và điều kiện nguồn |
| CALCULATING | 3 | Sau khi hai rule được registry cho phép, ngay trước biến đổi sáu hào |
| LOOKUP | 4 | Sau biến đổi, ngay trước đọc bộ cấu trúc/tên quẻ từ repository |
| COMPLETED | — | Kết quả cuối riêng qua results, không phải một progress event |

Event: `{requestId,type,sequence,step,message}`. Sequence thuộc **mỗi lần xử lý trong mỗi session**, bắt đầu 1. Bật preserve receive/publish order của Spring để các frame cùng session không bị đảo giữa progress/results/errors. Chưa có phần trăm ước lượng, sleep hoặc sự kiện tính toán giả.

Input sai nhưng có ID chuẩn chỉ có ACCEPTED → VALIDATING → FAILED. TIME/OBJECT_COUNT/Tam Thế chưa triển khai cũng dừng ở hai bước đó và RULE_NOT_AVAILABLE. Nguồn của LINES chưa đủ điều kiện thì không phát CALCULATING/LOOKUP. Timeout có thể kết thúc tại bất kỳ tiền tố bước nào.

Fixture `docs/examples/calculation.progress.json` đã lấy từ phản hồi thực B02, cố định requestId. Fixture LINES vẫn là kết quả thật sau S01, có tên đã duyệt.

## 2. JSON và lỗi giao thức

Controller nhận payload byte trực tiếp để bắt lỗi parse, thay vì để converter chặn trước controller. Giới hạn byte đầu vào 16.000, UTF-8 giải mã nghiêm ngặt; không nhận UTF-16/32, JSON trùng key, nhiều tài liệu nối tiếp hoặc cú pháp hỏng. Sau parse vẫn dùng ContractValidator hiện có, gồm giới hạn JSON chuẩn hóa và allowlist field.

- JSON không đọc được hoặc ID không chuẩn: INVALID_INPUT với requestId=null, type theo endpoint, data=null; không phát progress mang ID không đáng tin. Lỗi parse không đóng kết nối; request hợp lệ tiếp theo vẫn dùng được.
- Input sai có ID chuẩn: giữ ID đó trong phản hồi và tiến trình.
- Lỗi rule/nguồn/DB giữ mã B01/A02; không đưa SQL, dữ liệu sinh, câu hỏi hoặc stack trace vào thông điệp ứng dụng.
- Chỉ cho SUBSCRIBE ba user queue trên; chặn raw `/queue/...`, `/user/<người khác>/...`, `/topic/...`. Chỉ cho SEND hai application endpoint; chặn gửi thẳng vào broker queue.
- Vi phạm đường dẫn hoặc lỗi STOMP ở transport trả STOMP ERROR có message `STOMP_FRAME_REJECTED`, nội dung cố định và đóng socket. Đây không phải JSON error có requestId vì lỗi giao thức không luôn có một request ứng dụng hợp lệ.

Với inbound có thứ tự, interceptor có thể chạy trong callback bất đồng bộ. Vì vậy việc chặn đường dẫn gửi ERROR trực tiếp qua clientOutboundChannel rồi bỏ frame; không chỉ ném exception và hy vọng transport bắt được. Ca này đã được phát hiện và sửa khi chạy mạng thật.

## 3. Timeout, disconnect và tài nguyên

`CalculationSessions` quản lý các session/lần xử lý đang sống, không lưu payload, ngày sinh hay kết quả lâu dài. Mỗi Run khóa đồng bộ việc phát progress và kết thúc; chỉ lần kết thúc đầu tiên có hiệu lực.

| Biến môi trường | Mặc định | Ý nghĩa |
| --- | ---: | --- |
| PROCESSING_TIMEOUT_MS | 10000 | Hạn Run từ khi bắt đầu xử lý sau parse JSON |
| MAX_CALCULATION_SESSIONS | 1024 | Số session đang theo dõi; vượt giới hạn CONNECT bị từ chối |
| MAX_ACTIVE_CALCULATIONS | 1000 | Số vòng đời yêu cầu chưa kết thúc được theo dõi; đầy trả SERVER_BUSY |
| MAX_ACTIVE_PER_SESSION | 16 | Giới hạn vòng đời của một session |
| Client timeout | 15000 | Hạn tổng chờ phản hồi ở hook, không gia hạn khi nhận progress |

Một scheduler daemon phát PROCESSING_TIMEOUT khi quá hạn. Khi đã timeout, mọi progress/kết quả đến muộn bị bỏ. Khi disconnect, hủy timer, bỏ các Run của phiên, không gửi kết quả vào phiên đã đóng; handler đang chờ tới checkpoint sẽ dừng bằng Stopped. Khi kết thúc bình thường/lỗi hoặc shutdown, hủy và loại deadline khỏi queue. Không tạo lại session từ một SEND đến muộn.

**Giới hạn hiện tại:** xử lý vẫn trực tiếp trên executor inbound của Spring. Deadline đóng quyền phát kết quả và dừng ở checkpoint, không bảo đảm ngắt ngay JDBC/Java đang chạy; JDBC vẫn có timeout A02 riêng. Giới hạn Run không phải giới hạn worker/queue vận chuyển hoặc số công việc còn chạy sau timeout. Hạn Run chưa bao gồm thời gian chờ trong hàng đợi inbound. N01 tiếp tục worker/queue hữu hạn, rate limit, hủy best effort và idempotency; không coi phần đó đã hoàn thành.

Hai SEND trùng requestId trong cùng phiên hiện vẫn là hai lần xử lý; B02 bảo đảm một terminal cho **mỗi lần xử lý**, chưa thực hiện dedup/replay theo requestId. Cùng ID ở hai session là hai yêu cầu độc lập. Phải giữ cách hiểu này trong benchmark và trước khi mở cơ chế gửi lại tự động.

## 4. Client

`useCalculation` đăng ký progress và dùng reducer có kiểm runtime cho các trường giao tiếp đang sử dụng. Chỉ nhận event/result của requestId + module đang chờ. Progress tăng liên tục; sự kiện cũ/lặp bị bỏ, thiếu bước hoặc step sai thứ tự hiển thị INVALID_RESPONSE. Không đổi thành công dựa vào progress.

Timeout, lỗi đọc phản hồi, lỗi publish và disconnect đều đóng trạng thái chờ, dọn timer. Phản hồi đến muộn không thay kết quả/lỗi đã kết thúc hoặc ảnh hưởng request mới. Chỉ cho một yêu cầu chờ trên mỗi hook. Reconnect chỉ đăng ký lại queue, không publish lại yêu cầu cũ; người dùng chủ động gửi lại sau khi kết nối phục hồi.

ResultPanel hiển thị danh sách các bước thực nhận, lỗi và kết quả cuối riêng; không tạo progress giả trong lúc đợi. React escape nội dung message. Trạng thái failed dùng cho lỗi cục bộ; FAILED từ Server vẫn là response cuối có mã lỗi. Form TIME/OBJECT_COUNT/Tam Thế hiện có đã nhận cùng hook/Panel; chưa thêm form LINES hoặc sơ đồ ba quẻ vào phần việc TV1/I01, nên chưa tuyên bố nghiệm thu toàn bộ F03/F07 trên giao diện sản phẩm.

## 5. Bằng chứng đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Java với PostgreSQL tạm | **429 test, 0 failure/error, 0 skip**; bootstrap hai lần giữ nguyên bản ghi, DB tạm đã xóa |
| Java cuối cho controller/lifecycle/interceptor | Kiểm lại UTF-8 nghiêm ngặt, JSON lỗi, timeout, disconnect, một terminal và đường queue sau sửa; đạt |
| Client | **10/10** kiểm reducer/guard và render Panel; typecheck và 12 fixtures đạt |
| LINES qua hai Client thật | **387 terminal + 1.546 progress đúng thứ tự**, gồm 384 tổ hợp và hai session cùng ID/khác input, input sai; không lẫn phiên |
| Lỗi và phục hồi qua STOMP | JSON hỏng/trùng key/trailing bị từ chối, request sau vẫn chạy; input sai và method chưa có chỉ phát hai bước; reconnect bắt đầu sequence mới |
| Quyền queue qua STOMP | Chặn raw queue, user queue của người khác và SEND thẳng broker; Client nhận ERROR cố định và socket đóng |
| Deadline với tác vụ DB thật | Server kiểm tra riêng đặt **1 ms**, nhận đúng PROCESSING_TIMEOUT, không có COMPLETED muộn trong cửa sổ quan sát; test unit dùng latch ép handler trả sau timeout để kiểm quy tắc một terminal |
| Build Client | Production build Webpack và TypeScript đạt sau khi cấp quyền worker tạo thư mục `.next` trong OneDrive |

Các ca unit timeout/disconnect dùng latch giữ handler thử nghiệm; không có flag sleep/delay hoặc method giả trong API sản phẩm. Server 1 ms chỉ dùng cổng kiểm tra 18083, không phải cấu hình triển khai. Kiểm mạng thường ở 18081. Cả hai Server đã dừng sau kiểm; mặc định sản phẩm vẫn 10 giây. Không thay cấu hình PostgreSQL hoặc nguồn đã duyệt trong đợt này.

Bằng chứng cục bộ được ignore:

- `scripts/generated/b02_lines_stomp.json`: terminal và progress theo từng Client.
- `scripts/generated/b02_progress_errors.json`: lỗi JSON, phục hồi, reconnect và queue bị chặn.
- `scripts/generated/b02_real_timeout.json`: timeout trên DB thật.
- Java: `server/target/surefire-reports/`; bootstrap: `scripts/generated/a02_bootstrap_result.json`.

Đây là kiểm chức năng, không phải kết quả benchmark. Kiểm queue đã đóng lỗ truy cập trực tiếp trong các ca nêu trên; không coi ứng dụng đã được đánh giá bảo mật toàn diện hay sẵn sàng công bố Internet. HTTPS/WSS và các phần N01/T01/H01 vẫn theo kế hoạch.

## 6. Chạy lại

Từ `server/`, cấu hình DB rồi chạy profile database/db như README. Từ `client/`:

```powershell
npm run typecheck
npm run check:contract
npm run test:calculation
npm run smoke:lines
npm run smoke:progress
npm run build
```

Hai smoke command cần Server có DB và bộ tên đã duyệt; đổi cổng bằng WS_URL. PROGRESS_REPORT_PATH và LINES_REPORT_PATH là đường dẫn lưu chứng cứ tùy chọn. Muốn tái lập phép deadline, khởi động **Server kiểm tra riêng** với PROCESSING_TIMEOUT_MS=1, đặt WS_URL tới cổng đó, EXPECT_SERVER_TIMEOUT=1 rồi chạy smoke:progress; kết thúc thì dừng Server kiểm tra và bỏ biến override trước lần chạy bình thường.

Java thường `.\mvnw.cmd test` bỏ qua 5 test cần DB nếu thiếu biến kiểm thử. Toàn bộ test DB dùng `python scripts/test_a02_bootstrap.py` từ repo root với PGPASSWORD trong môi trường; script tạo/xóa đúng DB tạm. Không đưa mật khẩu vào file hoặc command line của helper.

## 7. Tiếp theo

Tiếp tục B03 trong chuỗi Mai Hoa: đọc/đối chiếu bảng quái và duyệt đúng MH-TRIGRAM nếu đủ nguồn, nối OBJECT_COUNT vào bộ dựng quẻ đã có, giữ TEAM_DECISION và SOURCE_AMBIGUOUS của công thức số vật. S02/S03 về Can Chi và bản đồ nguồn luận giải vẫn là công việc riêng chưa hoàn thành. N01 chưa triển khai cơ chế worker/queue/idempotency; đo baseline trực tiếp phải thực hiện trước khi đối chiếu với chế độ bounded.
