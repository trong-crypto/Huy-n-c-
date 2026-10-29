# TV2 trả lời TV1 — Hợp đồng tích hợp Huyền Cơ

Ngày chốt: **24/10/2026**, Asia/Ho_Chi_Minh. Contract **v1.2**; phiên bản quy tắc nghiệp vụ **1.0**. Hai số phiên bản này có ý nghĩa khác nhau.

Nguồn câu hỏi: [Google Docs TV2](https://docs.google.com/document/d/1jPQPdilk4stXNJLfTu-bt7QRWFXBwb7GZIFRr1ASeUY), phần T2-D01…T2-D13, gồm cả hai nhóm cấu hình mang mã D12. Phần T3 là bàn giao dữ liệu riêng; dưới đây trả lời ở vai trò **TV2**.

TV1 ơi, mình xác nhận như sau để bạn triển khai Client. **CONFIRMED** là hợp đồng/quyết định đã chốt, không đồng nghĩa API đã có implementation. Những phần chưa đủ đầu ra hoặc còn phải triển khai được ghi rõ **OPEN**. Mốc tương lai là mục tiêu của kế hoạch 15, không phải bằng chứng đã hoàn thành.

## 0. Có thể tích hợp ngay

| Phần | Hợp đồng | Implementation | Bàn giao |
| --- | --- | --- | --- |
| LINES và ba quẻ | CONFIRMED | Đã chạy PostgreSQL + STOMP, tên đã duyệt | Có ngay, D02 |
| Error/progress/session routing | CONFIRMED | Đã có | Có ngay, D04/D05/D07/D12 |
| OBJECT_COUNT | CONFIRMED | Đã chạy; căn cứ TEAM_DECISION | Có ngay, D01 |
| TIME | Request/schema chung CONFIRMED; fixture thành công OPEN | Chưa có lịch/bộ tính B04 | Mục tiêu C01/B04 ngày 25/10 |
| Tam Thế | DTO CONFIRMED; nội dung/fixture thành công OPEN | Chưa có D03; S02 mới duyệt ánh xạ 60 Can Chi→hành | Mục tiêu ngày 26/10, phụ thuộc nguồn |
| Tra quẻ REST | CONFIRMED về hợp đồng | Chưa có E02 | Mục tiêu ngày 26/10 |
| Lịch/Can Chi REST | CONFIRMED về hình dạng; thuật toán/ca chuẩn OPEN | Chưa có C01 | Mục tiêu ngày 25/10 |
| History/owner | CONFIRMED về thiết kế | Chưa có H01 | Mục tiêu ngày 27/10 |
| Dedup TTL/worker queue | CONFIRMED về thiết kế | Chưa có N01 | Mục tiêu ngày 27/10 |

Giao diện, component, biểu mẫu và cách trình bày thuộc TV1. TV2 bàn giao hợp đồng, Server, fixture và kiểm giao thức; tài liệu này không thay mã giao diện.

## T2-D02 — LINES request/response và renderer

**Status: CONFIRMED. Implementation: đã code và kiểm qua STOMP. Bàn giao: ngay.**

### Request chính thức

Gửi `/app/mai-hoa/calculate`; JSON UTF-8. Cả ba trường envelope và cả ba trường payload dưới đây bắt buộc, không nhận null. LINES không nhận `question` hoặc field bổ sung.

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "MAI_HOA",
  "payload": {
    "method": "LINES",
    "linesBottomUp": [
      true,
      false,
      true,
      false,
      true,
      false
    ],
    "movingLine": 2
  }
}
```

`linesBottomUp` là đúng sáu boolean, `true=dương`, `false=âm`; index 0 là hào 1 dưới cùng. `movingLine` là số nguyên 1–6. Hiển thị từ trên xuống thì TV1 đảo thứ tự **khi render**, giữ nguyên mảng khi gửi/nhận. Không tính lại quẻ hỗ/biến ở Client.

### Response COMPLETED đầy đủ

Fixture sau được lấy từ runtime, cố định requestId cho tài liệu. Đây là dữ liệu thật của LINES; tên và các rule có phạm vi review riêng.

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "MAI_HOA",
  "status": "COMPLETED",
  "data": {
    "method": "LINES",
    "ruleVersion": "1.0",
    "ruleBasis": "SOURCE_VERIFIED",
    "sourceStatus": "VERIFIED",
    "rules": [
      {
        "ruleCode": "MH-MUTUAL",
        "ruleVersion": "1.0",
        "executionPolicy": "SOURCE_VERIFIED",
        "ruleBasis": "SOURCE_VERIFIED",
        "sourceStatus": "VERIFIED",
        "sourceReferences": [
          {
            "sourceId": "MH",
            "title": "Mai Hoa Dịch Số",
            "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
            "section": "MH-QUE-HO-BIEN",
            "printedPage": "47",
            "pdfPage": 42,
            "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
            "url": null
          }
        ],
        "decisionReferences": []
      },
      {
        "ruleCode": "MH-CHANGE",
        "ruleVersion": "1.0",
        "executionPolicy": "SOURCE_VERIFIED",
        "ruleBasis": "SOURCE_VERIFIED",
        "sourceStatus": "VERIFIED",
        "sourceReferences": [
          {
            "sourceId": "MH",
            "title": "Mai Hoa Dịch Số",
            "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
            "section": "MH-HAO-6",
            "printedPage": "46",
            "pdfPage": 41,
            "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
            "url": null
          }
        ],
        "decisionReferences": []
      }
    ],
    "sourceReferences": [
      {
        "sourceId": "MH",
        "title": "Mai Hoa Dịch Số",
        "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
        "section": "MH-QUE-HO-BIEN",
        "printedPage": "47",
        "pdfPage": 42,
        "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
        "url": null
      },
      {
        "sourceId": "MH",
        "title": "Mai Hoa Dịch Số",
        "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
        "section": "MH-HAO-6",
        "printedPage": "46",
        "pdfPage": 41,
        "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
        "url": null
      }
    ],
    "decisionReferences": [],
    "calculationSteps": [
      {
        "code": "MUTUAL",
        "message": "Hỗ hạ lấy hào 2–4; hỗ thượng lấy hào 3–5.",
        "values": {
          "upperLineStart": 3,
          "lowerLineStart": 2
        }
      },
      {
        "code": "CHANGE",
        "message": "Đảo duy nhất hào động tính từ dưới lên.",
        "values": {
          "movingLine": 2
        }
      }
    ],
    "primaryHexagram": {
      "code": "H_KHAM_LY",
      "name": "Ký tế",
      "nameStatus": "VERIFIED",
      "linesBottomUp": [
        true,
        false,
        true,
        false,
        true,
        false
      ]
    },
    "mutualHexagram": {
      "code": "H_LY_KHAM",
      "name": "Vị tế",
      "nameStatus": "VERIFIED",
      "linesBottomUp": [
        false,
        true,
        false,
        true,
        false,
        true
      ]
    },
    "changedHexagram": {
      "code": "H_KHAM_CAN",
      "name": "Nhu",
      "nameStatus": "VERIFIED",
      "linesBottomUp": [
        true,
        true,
        true,
        false,
        true,
        false
      ]
    },
    "movingLine": 2,
    "lunarDate": null
  },
  "error": null
}
```

Ca này: **Ký tế → hỗ Vị tế → biến Nhu**, hào động 2. Quẻ hỗ không nhận một hào động riêng từ Server; Client không tự gán hào động cho quẻ hỗ.

### Required / optional / null

| Vị trí | Quy ước |
| --- | --- |
| Envelope thành công | requestId, type, status, data, error đều có; error=null, data khác null |
| data | method, ruleVersion, ruleBasis, sourceStatus, rules, sourceReferences, decisionReferences, calculationSteps, primaryHexagram, mutualHexagram, changedHexagram, movingLine, lunarDate đều có |
| Mỗi quẻ | **Chỉ** code, name, nameStatus, linesBottomUp. Chưa có upperTrigramCode/lowerTrigramCode trong DTO kết quả tính |
| code/nameStatus | Wire type cho phép null để tương thích trường hợp chưa có định danh; dữ liệu LINES hiện tại đã trả đủ mã/trạng thái |
| name | Có thể null; chỉ hiển thị tên như đã duyệt khi nameStatus=VERIFIED và name khác null. Không suy tên từ code |
| linesBottomUp | Sáu boolean bắt buộc, không null, không thiếu phần tử |
| lunarDate | Có field, null với LINES và OBJECT_COUNT; TIME dự kiến trả ngày âm sau C01/B04 |
| Các mảng metadata | Có field; decisionReferences=[] khi không có quyết định nhóm. calculationSteps đã có trong phiên bản hiện tại |

`sourceReferences` có tại **data.sourceReferences** (hợp nguồn quy tắc không trùng) và từng **data.rules[i].sourceReferences**; không nằm trong từng HexagramView. Nguồn tên quẻ trong kho tra cứu là phạm vi khác; không ghi hai trang của rule thành trang chứa tên quẻ.

`CalculationStep={code,message,values}`; values là map của string/number/boolean/boolean[]. Không gửi phần trăm tiến trình giả. Nguồn sách dùng `printedPage:string|null`, `pdfPage:number|null` đếm từ trang 1, `sha256:string|null`, `url:string|null`; các field nhận diện sourceId/title/version/section là chuỗi bắt buộc. Chưa xác minh đầy đủ danh tính ấn bản in vẫn phải hiển thị ghi chú version nguyên trạng.

### FAILED mẫu cho movingLine=7

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440003",
  "type": "MAI_HOA",
  "status": "FAILED",
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "movingLine phải là số nguyên từ 1 đến 6.",
    "ruleCode": null,
    "reason": null
  }
}
```

Input sai là INVALID_INPUT; rule chưa được duyệt/không đủ điều kiện là RULE_NOT_AVAILABLE. Không dùng hai mã thay thế nhau.

## T2-D04 — Error envelope

**Status: CONFIRMED. Implementation: STOMP đã có; các lỗi REST owner dành cho H01. Bàn giao: ngay.**

Giữ envelope `requestId,type,status,data,error`; lỗi có status=FAILED, data=null. Trong error, **code/message/ruleCode/reason đều là field của wire DTO**. code và message là chuỗi; ruleCode/reason được null. Với RULE_NOT_AVAILABLE, ruleCode và reason xác định quy tắc/lý do; lỗi thông thường để hai field này null.

Không khóa Client theo danh sách sáu mã cũ. **Chín mã Server hiện tại**:

| code | Ý nghĩa |
| --- | --- |
| INVALID_INPUT | Field/kiểu/giới hạn/JSON không hợp lệ |
| INVALID_DATE | Ngày giờ không hợp lệ hoặc sai ISO/offset |
| INVALID_METHOD | method ngoài TIME/OBJECT_COUNT/LINES |
| RULE_NOT_AVAILABLE | Rule/nguồn/implementation chưa đủ điều kiện |
| SERVER_BUSY | Vượt giới hạn tiếp nhận Run |
| PROCESSING_TIMEOUT | Hạn xử lý Server đã hết |
| DATABASE_UNAVAILABLE | Không truy cập được DB tri thức |
| KNOWLEDGE_DATA_INCOMPLETE | Thiếu/sai cấu trúc dữ liệu cần để tính |
| INTERNAL_ERROR | Lỗi nội bộ với message an toàn |

REST dự kiến thêm NOT_FOUND, INVALID_SESSION, CSRF_REJECTED. `REQUEST_TIMEOUT`, `DISCONNECTED`, `INVALID_RESPONSE` là trạng thái/lỗi cục bộ Client; không coi chúng là code Server. Nếu gặp code/reason mới, Client vẫn có nhánh hiển thị lỗi chung, không crash.

Reason chính thức: UNKNOWN_RULE, EXECUTION_DISABLED, RULE_STATE_UNAVAILABLE, RULE_VERSION_MISMATCH, SOURCE_UNVERIFIED, MISSING_SOURCE_REFERENCE, MISSING_SOURCE_REVIEW, MISSING_DECISION_REFERENCE, TEAM_DECISION_NOT_ALLOWED, IMPLEMENTATION_UNAVAILABLE.

JSON hỏng hoặc ID thiếu/sai: requestId=null nếu không lấy được UUID chuẩn. **type được Server xác định từ destination**, ví dụ gửi tới Mai Hoa thì lỗi trả type=MAI_HOA kể cả payload thiếu/sai type. Wire type cho phép null để xử lý lỗi không thể xác định module; không phải hành vi thường lệ của hai handler hiện có. Lỗi không có ID chỉ hiển thị lỗi chung, không tự hoàn tất một request khác đang chờ. Request thiếu type nhưng có UUID chuẩn bị INVALID_INPUT, phản hồi vẫn giữ ID đó và type của tuyến.

STOMP ERROR/đóng transport do frame/destination không hợp lệ là lỗi giao thức, không phải JSON ApiResponse. Không đợi JSON cuối sau khi socket đã đóng. Không có retryAfter, timestamp, stack trace hoặc SQL trong ApiError hiện tại.

## T2-D05 — Timeout

**Status: CONFIRMED về các hạn dưới đây. Implementation: hạn request đã có; connectionTimeout 10 giây là cấu hình bàn giao TV1, chưa đặt trong hook hiện tại của repo.**

| Hạn | Giá trị | Điểm bắt đầu |
| --- | ---: | --- |
| Client chờ phản hồi | **15.000 ms** | Ngay trước publish của lần gửi; tổng thời gian chờ |
| Server Run | **10.000 ms** mặc định | Khi handler đã parse JSON và bắt đầu Run, trước validation nghiệp vụ |
| Kết nối STOMP | **10.000 ms/lần kết nối** | Từ một lần connect đến CONNECTED; TV1 cấu hình connectionTimeout=10000 |
| Reconnect delay | **3.000 ms** | Khoảng chờ giữa các lần kết nối lại |

Progress **không gia hạn** timeout. Client không chuyển timer 15 giây thành timer mới sau ACCEPTED hoặc mỗi progress. Hạn Server hiện chưa tính thời gian chờ trong inbound queue, không bảo đảm ngắt tức thì JDBC đang chạy; Server chặn phát kết quả sau terminal/deadline. N01 bổ sung worker/queue hữu hạn.

Client phân biệt timeout kết nối với timeout một request đã publish. Hook hiện tại không đặt connectionTimeout; mặc định thư viện cài trong repo là 0 (không bật hạn connect riêng), nên không mô tả cấu hình 10 giây là đã chạy. TV1 có thể đặt cấu hình trên từ Phase 2.

## T2-D06 — Retry và idempotency

**Status: CONFIRMED về chính sách; implementation dedup OPEN, thuộc N01. Bàn giao thiết kế ngay; mục tiêu mã ngày 27/10.**

- Không tự resend khi reconnect. Reconnect chỉ kết nối/subscribe lại; request bị gián đoạn kết thúc trạng thái chờ tại Client.
- Mỗi hành động gửi mới và mỗi lần retry thủ công trong bản hiện tại dùng **UUID mới**. Không dùng lại ID cho payload đã thay đổi.
- Hiện Server chưa dedup: gửi lặp cùng ID trong một phiên có thể tính nhiều lần. TV1 không dựa vào replay/cache trong bản này.
- Thiết kế N01 giữ khóa `(sessionId,requestId)`, TTL **60 giây**, tối đa **10.000 mục** gồm đang chạy + đã xong. Cùng type/payload chuẩn hóa → dùng chung công việc hoặc replay terminal; khác nội dung → INVALID_INPUT.
- Khi triển khai N01, TTL kết quả được tính từ lúc kết thúc; khóa đang chạy giữ đến kết thúc/timeout, không loại chỉ vì đủ 60 giây. Replay phải phát lại đúng terminal đã cache; không tự tạo chuỗi progress mới cho kết quả cache. Trước khi bật replay sẽ bổ sung fixture cho TV1.
- Session mới có phạm vi mới, không replay chéo session. Retry thủ công sau reconnect dùng ID mới. Cookie owner lịch sử không thay đổi quy tắc dedup theo WebSocket session.

TV1 không phải đợi N01 để làm Phase 2: một request chờ trên biểu mẫu, chặn double-submit và dùng ID mới khi người dùng chủ động thử lại.

## T2-D12 — WebSocket và REST config

**Status: CONFIRMED. Implementation: WS đã có; proxy REST/CORS HTTP theo H01 còn OPEN.**

### WebSocket hiện tại

| Việc | Địa chỉ |
| --- | --- |
| Native WebSocket, không SockJS | `/ws` |
| SEND Mai Hoa | `/app/mai-hoa/calculate` |
| SEND Tam Thế | `/app/tam-the/calculate` |
| SUBSCRIBE progress | `/user/queue/progress` |
| SUBSCRIBE thành công | `/user/queue/results` |
| SUBSCRIBE lỗi nghiệp vụ | `/user/queue/errors` |

Không subscribe raw `/queue/...`, không gắn sessionId/người khác vào user destination, không SEND thẳng broker. Server từ chối các frame đó bằng STOMP ERROR và đóng socket.

Dev mặc định chỉ cấu hình origin **http://localhost:3000** qua ALLOWED_ORIGINS. `http://127.0.0.1:3000`, cổng khác hoặc hostname LAN là origin khác; muốn dùng phải thêm đúng origin vào biến Server, phân tách dấu phẩy. Không dùng wildcard cho bản history có credential.

Client giữ `NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws`. Demo qua LAN đổi host thành địa chỉ Server thực; khi HTTPS phải WSS. Chưa có URL demo công khai đã xác nhận, nên host demo là **OPEN** tới khi chốt máy triển khai. Không coi cổng kiểm tra 18081 là cổng sản phẩm; Server không được cam kết đang chạy chỉ vì endpoint đã implement.

### REST đã chốt kiến trúc, chưa implement proxy

Frontend gọi đường dẫn cùng origin **/api/v1** qua Next.js proxy; backend đích mặc định **http://localhost:8080/api/v1**. Dùng cùng hostname localhost trong demo, tránh trộn localhost với 127.0.0.1. next.config hiện chưa có rewrite/proxy REST.

| Biến | Nơi cấu hình | Giá trị dev / trạng thái |
| --- | --- | --- |
| NEXT_PUBLIC_WS_URL | Client, đã có | ws://localhost:8080/ws |
| NEXT_PUBLIC_API_BASE_URL | Client, đề xuất khóa cấu hình cho REST | /api/v1; TV1 bổ sung khi làm REST |
| HUYENCO_API_URL | Next.js server/proxy, dự kiến | http://localhost:8080; không dùng NEXT_PUBLIC cho đích nội bộ |
| ALLOWED_ORIGINS | Server, đã có cho WS | http://localhost:3000; cho phép đúng các origin thực dùng |

Proxy phải chuyển tiếp Cookie/Set-Cookie, Origin và các header CSRF cần thiết. Client dùng credentials=same-origin cho đường proxy; không cần credentials=include tới URL cross-origin trong phương án đã chọn. Allowlist WS hiện có không đồng nghĩa CORS cho mọi REST đã implement. Nếu đổi sang REST cross-origin phải chốt lại CORS origin cụ thể + allowCredentials=true ở Server và credentials=include ở Client; đó không phải cấu hình mặc định của đợt này.

## T2-D13 — SERVER_BUSY

**Status: CONFIRMED. Implementation: đã có giới hạn Run; worker/queue/dedup N01 chưa có.**

Hiện start Run trả SERVER_BUSY nếu vượt tổng **1.000 Run** đang theo dõi hoặc **16 Run/session**; cấu hình được. Có giới hạn **1.024 session**, vượt CONNECT bị từ chối ở mức giao thức. Đây chưa phải queue hữu hạn 4 worker/100 việc như thiết kế N01. Server trả lỗi khi handler kiểm thấy đầy; chưa bảo đảm trả ngay từ lúc packet đến máy nếu đang chờ executor inbound.

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440003",
  "type": "MAI_HOA",
  "status": "FAILED",
  "data": null,
  "error": {
    "code": "SERVER_BUSY",
    "message": "Server đang bận, vui lòng thử lại.",
    "ruleCode": null,
    "reason": null
  }
}
```

Không có `retryAfter` hoặc thời gian chờ trong wire DTO. Client báo bận và cho retry thủ công bằng UUID mới sau khi kết nối còn tốt; không lặp gửi tự động. Lỗi bận trước khi cấp Run hiện không có progress và không có dedup cache. Khi làm N01, **không cache SERVER_BUSY do từ chối tiếp nhận**; phải giải phóng reservation nếu đã có, để lần thử lại không bị replay lỗi bận hết TTL.

## T2-D01 — TIME và OBJECT_COUNT

**Status: CONFIRMED về input/schema dùng chung; TIME success fixture OPEN.**

### OBJECT_COUNT — đã chạy

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

`method/objectCount/hourIndex` bắt buộc, không null; objectCount nguyên 1–999999; hourIndex nguyên 1–12, Tý=1…Hợi=12. question tùy chọn chuỗi 0–500 ký tự; muốn bỏ thì không gửi field, không gửi null. Không nhận numbers:[a,b] hoặc method=NUMBER.

Thượng=N%8, hạ=H%8 (dư 0→8); hào=(N+H)%6 (dư 0→6), dùng **hai số gốc**. Dùng chung MaiHoaResult/HexagramView với LINES, thêm bước OBJECT_COUNT_NUMBERS; lunarDate=null.

Response thực tế đầy đủ:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "MAI_HOA",
  "status": "COMPLETED",
  "data": {
    "method": "OBJECT_COUNT",
    "ruleVersion": "1.0",
    "ruleBasis": "TEAM_DECISION",
    "sourceStatus": "SOURCE_AMBIGUOUS",
    "rules": [
      {
        "ruleCode": "MH-OBJECT-COUNT",
        "ruleVersion": "1.0",
        "executionPolicy": "TEAM_DECISION",
        "ruleBasis": "TEAM_DECISION",
        "sourceStatus": "SOURCE_AMBIGUOUS",
        "sourceReferences": [
          {
            "sourceId": "MH",
            "title": "Mai Hoa Dịch Số",
            "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
            "section": "MH-OBJECT-COUNT",
            "printedPage": "51",
            "pdfPage": 46,
            "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
            "url": null
          }
        ],
        "decisionReferences": [
          {
            "decisionId": "DEC-20261022-MH-OBJECT-COUNT",
            "decidedAt": "2026-10-22",
            "document": "docs/07-DECISION-LOG.md",
            "description": "Nhóm dùng objectCount gốc và hourIndex để lấy hào theo tổng chia 6; cụm số quẻ PDF 46 còn đa nghĩa."
          }
        ]
      },
      {
        "ruleCode": "MH-TRIGRAM",
        "ruleVersion": "1.0",
        "executionPolicy": "SOURCE_VERIFIED",
        "ruleBasis": "SOURCE_VERIFIED",
        "sourceStatus": "VERIFIED",
        "sourceReferences": [
          {
            "sourceId": "MH",
            "title": "Mai Hoa Dịch Số",
            "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
            "section": "MH-QUAI-SO",
            "printedPage": "44",
            "pdfPage": 39,
            "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
            "url": null
          }
        ],
        "decisionReferences": []
      },
      {
        "ruleCode": "MH-MUTUAL",
        "ruleVersion": "1.0",
        "executionPolicy": "SOURCE_VERIFIED",
        "ruleBasis": "SOURCE_VERIFIED",
        "sourceStatus": "VERIFIED",
        "sourceReferences": [
          {
            "sourceId": "MH",
            "title": "Mai Hoa Dịch Số",
            "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
            "section": "MH-QUE-HO-BIEN",
            "printedPage": "47",
            "pdfPage": 42,
            "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
            "url": null
          }
        ],
        "decisionReferences": []
      },
      {
        "ruleCode": "MH-CHANGE",
        "ruleVersion": "1.0",
        "executionPolicy": "SOURCE_VERIFIED",
        "ruleBasis": "SOURCE_VERIFIED",
        "sourceStatus": "VERIFIED",
        "sourceReferences": [
          {
            "sourceId": "MH",
            "title": "Mai Hoa Dịch Số",
            "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
            "section": "MH-HAO-6",
            "printedPage": "46",
            "pdfPage": 41,
            "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
            "url": null
          }
        ],
        "decisionReferences": []
      }
    ],
    "sourceReferences": [
      {
        "sourceId": "MH",
        "title": "Mai Hoa Dịch Số",
        "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
        "section": "MH-OBJECT-COUNT",
        "printedPage": "51",
        "pdfPage": 46,
        "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
        "url": null
      },
      {
        "sourceId": "MH",
        "title": "Mai Hoa Dịch Số",
        "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
        "section": "MH-QUAI-SO",
        "printedPage": "44",
        "pdfPage": 39,
        "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
        "url": null
      },
      {
        "sourceId": "MH",
        "title": "Mai Hoa Dịch Số",
        "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
        "section": "MH-QUE-HO-BIEN",
        "printedPage": "47",
        "pdfPage": 42,
        "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
        "url": null
      },
      {
        "sourceId": "MH",
        "title": "Mai Hoa Dịch Số",
        "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
        "section": "MH-HAO-6",
        "printedPage": "46",
        "pdfPage": 41,
        "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
        "url": null
      }
    ],
    "decisionReferences": [
      {
        "decisionId": "DEC-20261022-MH-OBJECT-COUNT",
        "decidedAt": "2026-10-22",
        "document": "docs/07-DECISION-LOG.md",
        "description": "Nhóm dùng objectCount gốc và hourIndex để lấy hào theo tổng chia 6; cụm số quẻ PDF 46 còn đa nghĩa."
      }
    ],
    "calculationSteps": [
      {
        "code": "OBJECT_COUNT_NUMBERS",
        "message": "Số vật lấy thượng quái, chỉ số giờ lấy hạ quái; tổng số gốc chia 6 lấy hào theo quy ước nhóm.",
        "values": {
          "movingLine": 2,
          "lowerTrigram": 8,
          "movingLineSum": 20,
          "upperTrigram": 4,
          "hourIndex": 8,
          "objectCount": 12
        }
      },
      {
        "code": "MUTUAL",
        "message": "Hỗ hạ lấy hào 2–4; hỗ thượng lấy hào 3–5.",
        "values": {
          "lowerLineStart": 2,
          "upperLineStart": 3
        }
      },
      {
        "code": "CHANGE",
        "message": "Đảo duy nhất hào động tính từ dưới lên.",
        "values": {
          "movingLine": 2
        }
      }
    ],
    "primaryHexagram": {
      "code": "H_CHAN_KHON",
      "name": "Dự",
      "nameStatus": "VERIFIED",
      "linesBottomUp": [
        false,
        false,
        false,
        true,
        false,
        false
      ]
    },
    "mutualHexagram": {
      "code": "H_KHAM_CAN2",
      "name": "Kiển",
      "nameStatus": "VERIFIED",
      "linesBottomUp": [
        false,
        false,
        true,
        false,
        true,
        false
      ]
    },
    "changedHexagram": {
      "code": "H_CHAN_KHAM",
      "name": "Giải",
      "nameStatus": "VERIFIED",
      "linesBottomUp": [
        false,
        true,
        false,
        true,
        false,
        false
      ]
    },
    "movingLine": 2,
    "lunarDate": null
  },
  "error": null
}
```

12/8 trả Dự/hỗ Kiển/biến Giải, hào 2. Root ruleBasis=TEAM_DECISION, sourceStatus=SOURCE_AMBIGUOUS; Client hiển thị căn cứ quy ước nhóm và không gắn nhãn toàn phép tính VERIFIED. Trạng thái tên quẻ VERIFIED là phạm vi riêng.

FAILED khi hourIndex=13:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440003",
  "type": "MAI_HOA",
  "status": "FAILED",
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "hourIndex phải là số nguyên từ 1 đến 12.",
    "ruleCode": null,
    "reason": null
  }
}
```

### TIME — mới có validator/request

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "MAI_HOA",
  "payload": {
    "method": "TIME",
    "datetime": "2026-10-22T10:30:00+07:00",
    "question": "Công việc sắp tới"
  }
}
```

method/datetime bắt buộc; datetime ISO 8601 **có offset**, ví dụ +07:00 hoặc Z. question như OBJECT_COUNT. Không thêm field timezone hoặc tự gửi năm/tháng/ngày âm trong payload TIME. Server C01/B04 chuẩn hóa instant về Asia/Ho_Chi_Minh (UTC+7) rồi chuyển lịch.

Kết quả thành công dự kiến dùng **cùng MaiHoaResult**, method=TIME, lunarDate khác null; quy ước ngày đổi 00:00 giờ Việt Nam, giờ Tý 23:00–00:59, năm theo năm âm. Các ranh này là quyết định triển khai cần ca chuẩn C01; chưa công bố thuật toán lịch đã VERIFIED. TIME vẫn giữ TEAM_DECISION do điểm xung đột bản in.

Hiện request hợp lệ trả lỗi sau, chưa có COMPLETED thật để bàn giao:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "MAI_HOA",
  "status": "FAILED",
  "data": null,
  "error": {
    "code": "RULE_NOT_AVAILABLE",
    "message": "Quy tắc hoặc dữ liệu chưa sẵn sàng để xử lý yêu cầu.",
    "ruleCode": "MH-TIME",
    "reason": "IMPLEMENTATION_UNAVAILABLE"
  }
}
```

**Không cung cấp TIME success fixture giả.** TV1 có thể xây renderer chung từ LINES/OBJECT_COUNT và màn chờ/lỗi; fixture ngày âm có expected/source chỉ bàn giao khi C01/B04 chạy và được đối chiếu. Mục tiêu 25/10; nếu chưa đạt sẽ báo phần thiếu, không đổi dữ liệu giả thành VERIFIED.

## T2-D03 — Tam Thế DTO

**Status: CONFIRMED về schema; fixture thành công ba category OPEN. Implementation: chỉ validator và lỗi chưa triển khai. Mục tiêu D03: 26/10, phụ thuộc nguồn và lịch.**

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "type": "TAM_THE",
  "payload": {
    "birthDate": "2003-08-15",
    "birthTime": "08:30",
    "calendarType": "SOLAR",
    "isLeapMonth": false,
    "categories": [
      "CAREER",
      "WEALTH",
      "LOVE"
    ]
  }
}
```

birthDate chuỗi YYYY-MM-DD, birthTime HH:mm theo giờ Việt Nam, calendarType SOLAR/LUNAR, isLeapMonth boolean đều bắt buộc và không null. SOLAR buộc isLeapMonth=false. Với LUNAR, các số trong birthDate là **ngày âm**, không chuyển sang ngày Dương ở Client. Validator hiện mới kiểm ranh cơ bản ngày âm, C01/D03 phải kiểm tháng nhuận/ngày thật sự tồn tại.

categories tùy chọn; bỏ field nghĩa là cả CAREER, WEALTH, LOVE. Nếu gửi thì 1–3 giá trị khác nhau, không gửi null hoặc []. Chỉ yêu cầu CAREER thì chỉ có CAREER trong kết quả; không tự thêm WEALTH/LOVE. Giữ thứ tự được yêu cầu.

Schema thành công đã chốt (ký hiệu kiểu, **không phải JSON phản hồi đã có**):

```ts
type Entry = {
  resultCode: string;
  title: string;
  content: string;
  sourceReferences: SourceReference[];
};
// data còn có toàn bộ ResultEvidence: ruleVersion/ruleBasis/sourceStatus,
// rules/sourceReferences/decisionReferences như contract.ts.
type Categories = [
  { category: "CAREER"; entries: Entry[] },
  { category: "WEALTH"; entries: Entry[] },
  { category: "LOVE"; entries: Entry[] }
];
```

Mỗi category thành công có **một hoặc nhiều entry**, không giới hạn một entry. Nguồn gắn từng entry và tổng hợp ở root/rules. Theo DTO hiện tại, entry không có status/ruleVersion riêng; các trường này nằm ở data và rules[]. Không tự thêm chúng vào entry để hiển thị.

Lời luận chỉ được phát khi root ruleBasis=SOURCE_VERIFIED, sourceStatus=VERIFIED và các rule dùng có đủ chứng cứ. Một category **được yêu cầu** thiếu nguồn/chưa duyệt → **fail toàn request**, data=null, RULE_NOT_AVAILABLE với ruleCode/reason phù hợp. Không có PARTIAL hoặc thành công rỗng.

Lỗi thật hiện tại:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "type": "TAM_THE",
  "status": "FAILED",
  "data": null,
  "error": {
    "code": "RULE_NOT_AVAILABLE",
    "message": "Quy tắc hoặc dữ liệu chưa sẵn sàng để xử lý yêu cầu.",
    "ruleCode": "TT-NGU-HANH",
    "reason": "IMPLEMENTATION_UNAVAILABLE"
  }
}
```

TT-NGU-HANH đã VERIFIED cho 60 ánh xạ Can Chi→hành theo S02, nhưng reason=IMPLEMENTATION_UNAVAILABLE ở đây vì TamTheService chưa implement. Không hiểu lỗi này là phủ nhận dữ liệu S02. Chưa có JSON COMPLETED cả ba category từ nguồn đã duyệt; TV1 không dùng đoạn luận tự sinh như fixture xác minh. Mẫu cấu trúc nếu tự dựng cho UI phải có nhãn mock ở môi trường phát triển, không phục vụ từ API thành công.

## T2-D07 — Progress STOMP

**Status: CONFIRMED. Implementation: đã code và kiểm thật. Bàn giao: ngay.**

Queue `/user/queue/progress`, JSON gồm **requestId,type,sequence,step,message**, không có stage, percent hoặc status. sequence bắt đầu 1 và tăng theo **từng lần xử lý request trong session**, không tăng toàn session. Hai session cùng UUID vẫn độc lập. Trước N01 không gửi trùng ID trong cùng session vì có thể tạo hai lần xử lý/chuỗi sequence.

Chuỗi cho request LINES D02:

```json
[
  {
    "requestId": "550e8400-e29b-41d4-a716-446655440002",
    "type": "MAI_HOA",
    "sequence": 1,
    "step": "ACCEPTED",
    "message": "Server đã nhận yêu cầu."
  },
  {
    "requestId": "550e8400-e29b-41d4-a716-446655440002",
    "type": "MAI_HOA",
    "sequence": 2,
    "step": "VALIDATING",
    "message": "Đang kiểm tra đầu vào và điều kiện nguồn."
  },
  {
    "requestId": "550e8400-e29b-41d4-a716-446655440002",
    "type": "MAI_HOA",
    "sequence": 3,
    "step": "CALCULATING",
    "message": "Đang tính quẻ chủ, quẻ hỗ và quẻ biến."
  },
  {
    "requestId": "550e8400-e29b-41d4-a716-446655440002",
    "type": "MAI_HOA",
    "sequence": 4,
    "step": "LOOKUP",
    "message": "Đang tra mã quẻ và tên đã duyệt trong dữ liệu nguồn."
  }
]
```

Sau sequence 4, terminal là **response LINES đầy đủ tại D02**, cùng requestId/type, qua `/user/queue/results`. Validation/rule/implementation lỗi có thể chỉ phát 1–2 rồi FAILED; SERVER_BUSY trước cấp Run không có bước; JSON hỏng/ID không hợp lệ không có progress. Timeout có thể kết thúc tại bất kỳ tiền tố nào.

Server chặn phát thêm sau terminal. Client vẫn bỏ progress đến muộn/lặp và chỉ dùng terminal COMPLETED/FAILED tương ứng requestId+type để kết thúc chờ; disconnect/timeout cục bộ cũng kết thúc chờ. Trật tự sequence hợp lệ không chứng minh phép tính thành công; không kết thúc ở LOOKUP. Progress không gia hạn timeout. Thiếu sequence/step sai không được tự bù tiến trình.

## T2-D08 — REST tra cứu 64 quẻ

**Status: CONFIRMED về hợp đồng. Implementation: OPEN, E02 chưa có controller. Mục tiêu 26/10.**

| Endpoint | Quy ước |
| --- | --- |
| GET /api/v1/hexagrams | q?≤100 ký tự, upperTrigramCode?, lowerTrigramCode?, page=0, size=20 (1–100) |
| GET /api/v1/hexagrams/{code} | ID là **mã H_UPPER_LOWER**, ví dụ H_KHAM_LY; không dùng tên hoặc số thứ tự làm ID |

q tìm tên có/không dấu hoặc mã; lọc thượng/hạ trong CAN, DOAI, LY, CHAN, TON, KHAM, CAN2, KHON. Kết hợp điều kiện theo AND. Thứ tự **code tăng cố định**, chưa nhận query sort tự do. Trang từ 0; ngoài trang cuối items=[]; size/page không hợp lệ trả 400.

List item: `{code,name,nameKind,verificationStatus,upperTrigramCode,lowerTrigramCode,linesBottomUp,sourceReferences}`. Detail thêm `interpretations:[{resultCode,title,content,sourceReferences,verificationStatus}]`; chỉ phát đoạn interpretations VERIFIED. Mảng rỗng khi chưa có nội dung, không tạo câu luận để lấp chỗ trống. Hiện 64 tên/cấu trúc đã có nhưng interpretations=0, API chi tiết vẫn chưa implement.

Ví dụ schema list rỗng **DESIGN EXAMPLE — chưa phải phản hồi endpoint đã chạy**:

```json
{"requestId":"550e8400-e29b-41d4-a716-446655440008","status":"COMPLETED","data":{"items":[],"page":0,"size":20,"totalElements":0,"totalPages":0},"error":null}
```

Ví dụ detail dựng từ dữ liệu tên/cấu trúc đã duyệt, **chưa phải HTTP runtime**:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440008",
  "status": "COMPLETED",
  "data": {
    "code": "H_KHAM_LY",
    "name": "Ký tế",
    "nameKind": "CANONICAL_TITLE",
    "verificationStatus": "VERIFIED",
    "upperTrigramCode": "KHAM",
    "lowerTrigramCode": "LY",
    "linesBottomUp": [
      true,
      false,
      true,
      false,
      true,
      false
    ],
    "sourceReferences": [
      {
        "sourceId": "MH",
        "title": "Mai Hoa Dịch Số",
        "version": "Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in",
        "section": "MH-64-QUE-NAMES-278",
        "printedPage": "278",
        "pdfPage": 271,
        "sha256": "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de",
        "url": null
      }
    ],
    "interpretations": []
  },
  "error": null
}
```

Không có mã → HTTP404/FAILED/NOT_FOUND, data=null. Không có kết quả tìm → HTTP200/COMPLETED với Page rỗng; không dùng NOT_FOUND. JSON REST không có field type.

## T2-D09 — REST lịch Âm–Dương và Can Chi

**Status: CONFIRMED về hình dạng API; thuật toán/nguồn, ca chuẩn và fixture COMPLETED OPEN. Implementation: chưa có C01. Mục tiêu 25/10.**

Hai chiều dùng chung **POST /api/v1/calendar/convert**, calendarType chỉ hệ lịch của input; không thêm endpoint /solar-to-lunar hoặc /lunar-to-solar song song.

```json
{"calendarType":"SOLAR","year":2026,"month":10,"day":24,"isLeapMonth":false}
```

```json
{"calendarType":"LUNAR","year":2026,"month":1,"day":1,"isLeapMonth":false}
```

Đây là **hai input mẫu độc lập**, chưa khẳng định là một cặp ngày tương đương. Toàn bộ field CalendarInput bắt buộc; không null; tháng 1–12 và isLeapMonth giữ riêng. Không dùng tháng 13 hoặc số tháng âm để chỉ nhuận. SOLAR buộc false; LUNAR phải kiểm năm thực có tháng nhuận đó và số ngày của tháng.

Can Chi dùng riêng **POST /api/v1/calendar/can-chi**:

```json
{"date":{"calendarType":"SOLAR","year":2026,"month":10,"day":24,"isLeapMonth":false},"time":"08:30"}
```

date bắt buộc, time tùy chọn HH:mm; bỏ time thì hour=null. Không có query parameters thay body trong bản hợp đồng này.

CalendarResult = ResultEvidence + `{solarDate:string YYYY-MM-DD,lunarDate:{year,month,day,isLeapMonth},timezone:"Asia/Ho_Chi_Minh"}`. CanChiResult thêm `year/month/day:{stem,branch}`, `hour:{stem,branch}|null`; mã Can/Chi nhất quán với S02 (GIAP…QUY; TY,SUU,DAN,MAO,THIN,TI,NGO,MUI,THAN,DAU,TUAT,HOI).

Ngày nhập là ngày dân sự Việt Nam, time cũng theo UTC+7; không tự thêm offset tùy ý vào CalendarInput. Phạm vi **mục tiêu** là ngày Dương 1900-01-01…2099-12-31; ngày âm phải quy đổi ra Dương trong khoảng đó. Khoảng này chưa được kiểm để công bố là đã hỗ trợ. Năm/tháng Can Chi của hợp đồng dùng lịch âm, không tự mặc định Bát Tự theo tiết khí. Mai Hoa/Tam Thế có ranh giờ riêng; không suy giờ sinh Tam Thế bằng bảng giờ Mai Hoa.

Dự kiến HTTP400/INVALID_DATE cho ngày không tồn tại, sai nhuận hoặc ngoài phạm vi; INVALID_INPUT cho sai kiểu/thiếu field, RULE_NOT_AVAILABLE cho bộ thuật toán chưa đủ điều kiện. Chưa có canonical output hai chiều/Can Chi để bàn giao. UI chưa được coi các ví dụ request này là ca VERIFIED; TV2 bàn giao expected+nguồn sau C01.

## T2-D10 — REST History

**Status: CONFIRMED về hợp đồng. Implementation: OPEN/H01. Mục tiêu 27/10.**

| HTTP | URL | Body/kết quả |
| --- | --- | --- |
| POST | /api/v1/history | body `{calculationRequestId,title?}` → HTTP201 HistoryDetail |
| GET | /api/v1/history | q?≤100, type?=MAI_HOA/TAM_THE, page=0, size=20 (1–100) → Page<HistoryItem> |
| GET | /api/v1/history/{id} | id UUID → HTTP200 HistoryDetail |
| DELETE | /api/v1/history/{id} | HTTP200, data={deleted:true} |

Lưu **thủ công/opt-in**; không tự lưu mỗi lần tính. Ví dụ request (hợp đồng, chưa có endpoint):

```json
{"calculationRequestId":"550e8400-e29b-41d4-a716-446655440002","title":"Lần lập quẻ cần xem lại"}
```

calculationRequestId bắt buộc UUID; title tùy chọn, nếu có là chuỗi 1–100 ký tự, không null. Nếu bỏ, Server tạo nhãn trung tính theo module; không lấy câu hỏi riêng tư làm tiêu đề mặc định. Server tạo id/createdAt; không nhận snapshot hay ownerId từ Client.

HistoryItem = `{id,type,title,createdAt,ruleBasis}`; createdAt ISO8601 UTC có Z. HistoryDetail thêm **result:MaiHoaResult|TamTheResult** là snapshot allowlist của kết quả đã hoàn tất. Giữ ruleVersion/rules/sourceStatus/sourceReferences/decisionReferences/calculationSteps và các dữ liệu kết quả cần xem lại; không lưu bản thô ngày sinh/câu hỏi đầu vào. Giới hạn mục tiêu 1.000 bản ghi/owner, vượt trả 400 INVALID_INPUT.

Danh sách sắp createdAt giảm, id là khóa phụ; q tìm tiêu đề, type lọc module. Không có dòng thì HTTP200 Page rỗng. Owner khác hoặc không có id đó → **404 NOT_FOUND** giống nhau; credential thiếu/hết hạn → **401 INVALID_SESSION**; CSRF/origin không hợp lệ → **403 CSRF_REJECTED**. Page DTO `{items,page,size,totalElements,totalPages}`. H01 sẽ trả fixture record thật sau khi lưu được, hiện không bịa id/thời điểm lịch sử đã tồn tại.

## T2-D11 — History ownership/security

**Status: CONFIRMED về phương án; implementation/kiểm quyền OPEN, H01. Mục tiêu 27/10.**

- Bản đầu không có đăng ký/login hoặc đồng bộ đa thiết bị. Một owner ẩn danh bền vững gắn với credential trình duyệt do Server phát; không dùng WebSocket sessionId làm owner lâu dài.
- **POST /api/v1/session**, body `{}`, header `X-HuyenCo-Request: 1` → data `{expiresAt,csrfToken}`; không trả ownerId/token cookie qua JSON. Token ngẫu nhiên ít nhất 256 bit, Server lưu hash token + owner + hạn trong DB.
- Cookie dự kiến `huyenco_session`, HttpOnly, SameSite=Lax, Path=/, Max-Age=30 ngày, Secure khi HTTPS. expiresAt là thời điểm hết hạn từ Server, không tự tính lại ở Client. Không lưu token này trong localStorage hoặc biến NEXT_PUBLIC.
- Client dùng cookie qua proxy cùng origin; CSRF token chỉ phục vụ header `X-CSRF-Token` cho POST history/DELETE history và giữ trong bộ nhớ. Các thao tác ghi còn cần `X-HuyenCo-Request: 1`; Server kiểm Origin. Mất CSRF sau reload thì gọi session để lấy lại theo credential còn hợp lệ; không tạo owner mới nếu cookie hợp lệ.
- Server suy owner từ credential và lọc owner ở **mọi** truy vấn list/detail/delete/save. ownerId tùy ý từ Client không cấp quyền. Cookie giả/hết hạn bị từ chối.
- H01 phải ràng buộc owner vào handshake WebSocket bằng cookie đã được xác thực phía Server; registry kết quả gắn owner/session. Trước khi dùng lưu lịch sử, TV1 bootstrap session **trước khi mở WebSocket**; nếu cấp cookie sau khi socket đã mở thì reconnect có chủ đích trước các phép tính sẽ được lưu. Không tự resend request cũ trong lần reconnect đó.
- Server giữ kết quả hoàn tất tạm, TTL mục tiêu **15 phút**, để POST history chỉ nhận calculationRequestId thuộc owner/phiên đủ điều kiện. Hết TTL/không có quyền → NOT_FOUND; không yêu cầu Client gửi toàn bộ kết quả để khôi phục quyền.
- Mất cookie, hết hạn, chuyển trình duyệt/thiết bị thì không truy cập lại lịch sử cũ trong MVP; không có cơ chế phục hồi/ghép owner. Không tuyên bố dữ liệu cũ đã bị xóa chỉ vì cookie mất; chính sách dọn DB còn thuộc H01.

Toàn bộ các điểm trên là **thiết kế đã chốt**, chưa có cookie/session/history controller, schema owner/history hoặc binding handshake tương ứng trong mã hiện tại. Không xem việc bảng nguồn sách đã có là bằng chứng quyền lịch sử đã an toàn.

## Bổ sung nguồn và trạng thái để TV1 không tự tạo enum

| Rule | sourceStatus hiện có | executionPolicy | Đã có tuyến tính? |
| --- | --- | --- | --- |
| MH-MUTUAL | VERIFIED | SOURCE_VERIFIED | Có, LINES/OBJECT_COUNT |
| MH-CHANGE | VERIFIED | SOURCE_VERIFIED | Có, LINES/OBJECT_COUNT |
| MH-TRIGRAM | VERIFIED | SOURCE_VERIFIED | Có, OBJECT_COUNT |
| MH-OBJECT-COUNT | SOURCE_AMBIGUOUS | TEAM_DECISION | Có |
| MH-TIME | BLOCKED_SOURCE_CONFLICT | TEAM_DECISION | Chưa B04 |
| LUNAR-CONVERSION | DRAFT | SOURCE_VERIFIED | Chưa C01 |
| TT-NGU-HANH | VERIFIED cho 60 ánh xạ hành | SOURCE_VERIFIED | Dữ liệu có, chưa có TamTheService D03 |

SourceStatus wire chỉ có DRAFT, SOURCE_LOCATED, SOURCE_AMBIGUOUS, BLOCKED_SOURCE_CONFLICT, VERIFIED. **SOURCE_NOT_LOCATED là nhãn khảo sát trong tài liệu, chưa phải enum API**; chưa tìm được nguồn thì giữ DRAFT/nguồn chưa có và registry từ chối thích hợp. Không thêm trạng thái này hoặc MOCK vào API khi chưa cập nhật hợp đồng. Mock là nhãn môi trường fixture, không phải xác nhận nguồn.

## TV1 bắt đầu Phase 2 ngay theo gói nào?

1. Dùng request/response LINES D02 và DTO v1.2; giữ chiều dưới→trên trong dữ liệu.
2. Hiển thị ba quẻ từ kết quả Server, tên theo nameStatus; nguồn quy tắc/các bước tính đúng metadata.
3. Dùng progress D07 và timeout/retry D05/D06, một request đang chờ trên mỗi biểu mẫu.
4. Kiểm FAILED, kết nối lại, ID/type không khớp, name=null và unknown error code.
5. Tích hợp OBJECT_COUNT tiếp được ngay; TIME/Tam Thế/REST chờ đúng fixture/implementation nêu trên.

Bàn giao cấu trúc **ngay ngày 24/10**. Các mốc 25–27/10 lấy từ kế hoạch hiện tại và còn phụ thuộc nguồn; TV2 báo theo task C01/B04/D03/E02/H01/N01 khi có mã/fixture thật. Không ghi toàn bộ database hoặc F01–F08 đã hoàn thành.

Tài liệu đối chiếu: `docs/02-API-CONTRACT.md`, `client/src/types/contract.ts`, DTO/controller/config Server, các fixture trong `docs/examples/`, biên bản B01/B02/B03/S01/S02. Tài liệu này là trả lời hợp đồng; không gửi tin cho TV1, không chỉnh Google Docs nguồn, không chỉnh giao diện hay triển khai những endpoint đang OPEN.

Kiểm tra bản bàn giao: đủ 13 mã T2; **18 khối JSON** parse được và khớp kiểu TypeScript dùng chung qua kiểm tra compiler ở bộ nhớ, không viết file Client. Các mẫu DESIGN vẫn chỉ xác nhận cấu trúc, không xác nhận endpoint/thuật toán/nội dung đã triển khai hoặc được kiểm chứng nguồn.
