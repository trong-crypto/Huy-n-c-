# Hợp đồng Huyền Cơ v1.2 — cập nhật A02/B01/S01/B02/B03

## 1. Phạm vi và trạng thái triển khai

Đây là hợp đồng dùng chung cho TV1 và phần TV2 + TV3. Giữ envelope v1.1, bổ sung metadata nguồn/quyết định và `error.reason`; Client cũ vẫn đọc được envelope. Các kiểu TypeScript ở `client/src/types/contract.ts`; DTO Java ở `common/dto`; catalog chính sách ở `server/src/main/resources/rules/execution-catalog.json`.

| Thành phần | Trạng thái sau B03 |
| --- | --- |
| STOMP endpoint, results/errors, validator và lỗi có reason | Có trong mã |
| Catalog, registry, kiểm chính sách, DTO kết quả/progress | Có trong mã và kiểm thử; profile db đã nối provider PostgreSQL |
| Health/readiness | Đã có controller; readiness kiểm kho dữ liệu, chưa xác nhận nghiệp vụ hoàn tất |
| LINES trả quẻ chủ/hỗ/biến | B01 đã triển khai, có registry/DB và kiểm qua hai Client STOMP |
| OBJECT_COUNT trả quẻ chủ/hỗ/biến | B03 đã triển khai/kiểm STOMP, bốn rule phụ thuộc; giữ TEAM_DECISION/SOURCE_AMBIGUOUS |
| TIME/Tam Thế trả kết quả thật | Chưa triển khai; B04/D03 |
| Progress và vòng đời request | B02 đã phát bước thật, dọn theo disconnect/deadline; hook/Panel nhận tiến trình, chưa có worker/idempotency N01 |
| REST tra quẻ/lịch/session/lịch sử | Chốt hợp đồng dưới đây; chưa có controller, không coi URL đã chạy |

Các file `.response.json` là **fixtures hợp đồng**, không thay cho biên bản duyệt dữ liệu. LINES và OBJECT_COUNT đã cập nhật từ phản hồi runtime, chỉ cố định requestId. Nguồn/tên được duyệt theo biên bản riêng; không dùng fixtures làm chứng nhận VERIFIED hay luận giải sách.

### Probe sức khỏe và kho dữ liệu (A02 đã triển khai)

- `GET /api/v1/health`: HTTP 200 với `{"status":"UP"}`, không truy vấn DB.
- `GET /api/v1/readiness`: HTTP 200 khi `status=READY`, HTTP 503 khi `status=NOT_READY`. Response trực tiếp, không dùng envelope nghiệp vụ REST.
- Fields: `status`, `scope` (cố định `KNOWLEDGE_STORAGE`), `database` (UP/UNAVAILABLE/DISABLED), `schema` (READY/NOT_READY/NOT_CHECKED/INVALID_DATA), `seed` (READY/NOT_READY/NOT_CHECKED), `businessFeaturesReady`, `counts`, `rules`, `pending`.
- `rules[]`: `ruleCode`, `executionPolicy`, `sourceStatus` (trạng thái nguồn hoặc MISSING), `calculationAuthorized`, `reason` (lý do từ registry hoặc null).
- A02 luôn có `businessFeaturesReady=false`; quyền một quy tắc không chứng minh tuyến tính đã triển khai. Tắt profile DB trả 503 với `database=DISABLED`; không trả exception SQL/URL/mật khẩu. Chi tiết điều kiện seed và kết quả chạy tại `17-A02-DATABASE-HANDOFF.md`.

## 2. Giao tiếp STOMP

- WebSocket `/ws`; application prefix `/app`, broker `/queue`, user prefix `/user`.
- SEND `/app/mai-hoa/calculate` hoặc `/app/tam-the/calculate`.
- SUBSCRIBE `/user/queue/progress`, `/user/queue/results`, `/user/queue/errors`; chỉ cho ba đích logic này. SEND chỉ cho hai application endpoint trên; raw queue/user queue của người khác bị từ chối bằng STOMP ERROR và đóng kết nối.
- Chỉ gửi đến session đã yêu cầu; không broadcast ngày sinh/câu hỏi/kết quả.
- UTF-8 JSON; `requestId` UUID dạng chuẩn 36 ký tự. `type` khớp endpoint. Client không gửi chính sách thực thi/trạng thái kiểm chứng để yêu cầu nâng quyền chạy.
- Payload tối đa theo transport hiện tại 16 KiB, thêm giới hạn validator JSON chuẩn hóa 16.000 byte; buffer gửi 64 KiB. Trường không thuộc hợp đồng bị từ chối INVALID_INPUT.
- B02 đọc UTF-8 nghiêm ngặt; JSON hỏng, trùng key hoặc nhiều tài liệu nối nhau trả INVALID_INPUT với requestId=null, không phát progress. Lỗi STOMP ở transport dùng ERROR cố định STOMP_FRAME_REJECTED, không giả JSON response có ID.

Request giữ dạng:

```json
{"requestId":"550e8400-e29b-41d4-a716-446655440002","type":"MAI_HOA","payload":{"method":"LINES","linesBottomUp":[true,false,true,false,true,false],"movingLine":2}}
```

Kết quả cuối:

```text
{requestId, type, status: COMPLETED, data: <MaiHoaResult | TamTheResult>, error: null}
{requestId, type, status: FAILED, data: null, error: {code, message, ruleCode, reason}}
```

`requestId` có thể null ở lỗi thiếu ID; Client không dùng lỗi không có ID để hoàn tất yêu cầu khác. Mỗi yêu cầu hợp lệ có đúng một kết quả cuối sau khi module được triển khai. Không thêm PARTIAL hoặc RUNNING vào status cuối. COMPLETED nghĩa là toàn bộ nội dung được yêu cầu đã thực hiện; thiếu một category Tam Thế yêu cầu thì FAILED, không trả thành công rỗng.

## 3. Đầu vào Mai Hoa

| method | Trường | Kiểm tra |
| --- | --- | --- |
| LINES | `linesBottomUp`, `movingLine` | Đúng sáu boolean từ dưới lên; true=dương, false=âm; hào động nguyên 1–6. Không nhận question |
| OBJECT_COUNT | `objectCount`, `hourIndex`, `question?` | Số vật nguyên 1–999999; giờ nguyên 1–12, Tý=1…Hợi=12; question chuỗi tối đa 500 ký tự |
| TIME | `datetime`, `question?` | ISO 8601 có offset; chuẩn hóa UTC+7 trước khi chuyển lịch; question như trên |

NUMBER và numbers:[a,b] đã bị loại bỏ. NUMBER trả INVALID_METHOD; thêm numbers vào OBJECT_COUNT cũng bị từ chối. Số nguyên vượt kiểu Java phải bị từ chối trước khi ép kiểu, không cho tràn thành một giá trị hợp lệ.

Quy ước nhóm đã chốt cho OBJECT_COUNT: thượng=`objectCount % 8`, hạ=`hourIndex % 8`, hào=`(objectCount+hourIndex)%6`; dư 0 thành 8/8/6. TIME lấy năm/tháng/ngày âm và chỉ số giờ; hào động theo tổng chia 6. Giữ chữ in PDF 45/46 và lý do chọn cách cài trong decisionReferences.

B03 đã mở OBJECT_COUNT với MH-TRIGRAM VERIFIED theo biên bản 21. `calculationSteps` gồm OBJECT_COUNT_NUMBERS/MUTUAL/CHANGE; bước đầu có objectCount, hourIndex, **movingLineSum là tổng hai số gốc**, upperTrigram/lowerTrigram/movingLine. Ca 12/8 trả Dự → Kiển → Giải, hào 2; sourceStatus tổng vẫn SOURCE_AMBIGUOUS. Không trả lại câu hỏi hoặc tự tạo lời luận.

Quy tắc cần cấp quyền trước phép tính:

| Tuyến | Bộ quy tắc tối thiểu |
| --- | --- |
| LINES | MH-MUTUAL, MH-CHANGE |
| OBJECT_COUNT | MH-OBJECT-COUNT, MH-TRIGRAM, MH-MUTUAL, MH-CHANGE |
| TIME | LUNAR-CONVERSION, MH-TIME, MH-TRIGRAM, MH-MUTUAL, MH-CHANGE |

Tên quẻ là dữ liệu bổ sung chỉ gắn khi có tên VERIFIED; thiếu tên không chặn LINES trả cấu trúc hào. Không gán tên chưa kiểm cho kết quả tính. Khi chỉ có cấu trúc, `code/name/nameStatus` có thể null. Các mục tra cứu nguồn có trạng thái riêng ở REST.

## 4. Trạng thái nguồn và quyền chạy

Hai trục khác nhau:

| Trường | Giá trị | Ý nghĩa |
| --- | --- | --- |
| sourceStatus | DRAFT / SOURCE_LOCATED / SOURCE_AMBIGUOUS / BLOCKED_SOURCE_CONFLICT / VERIFIED | Trạng thái chứng cứ nguồn, đọc từ repository; không sửa bởi catalog |
| executionPolicy | DISABLED / SOURCE_VERIFIED / TEAM_DECISION | Cấu hình được phép chạy theo cách nào |
| ruleBasis | SOURCE_VERIFIED / TEAM_DECISION | Căn cứ thực tế được dùng cho kết quả đã cấp quyền |

Registry chỉ cấp quyền khi ruleCode/module/version khớp trạng thái từ repository và có nguồn truy vết. DISABLED luôn từ chối. SOURCE_VERIFIED cần status VERIFIED, reviewer không rỗng và reviewedAt. TEAM_DECISION cần quyết định đầy đủ/ngày/tài liệu, nguồn có vị trí, status khác DRAFT; chỉ áp dụng phép tính quy ước, **không cấp quyền phát lời luận giải chưa xác minh**. Không có state từ DB → RULE_STATE_UNAVAILABLE; không lấy trạng thái từ file catalog hoặc từ Client làm thay thế.

Catalog hiện có 14 mã quy tắc. MH-TIME/MH-OBJECT-COUNT dùng TEAM_DECISION theo quyết định 22/10; MH-THE-DUNG/TT-TAI-LOC/TT-TINH-DUYEN DISABLED; các mã khác yêu cầu SOURCE_VERIFIED. Được cấu hình policy không có nghĩa module đã có code, bảng tra đã đủ hoặc endpoint đã sẵn sàng. Tên 64 quẻ và từng ô Tam Thế phải kiểm trạng thái riêng, không suy trạng thái từ một rule chung.

A01 có provider mặc định không trả state để đóng quyền khi chưa nối DB. A02 đã nối provider PostgreSQL ở profile `db`, đọc đúng module/mã/phiên bản; profile mặc định vẫn không cấp state. B01 trở đi phải gọi registry cho **tất cả** rule bắt buộc trước khi phát kết quả; còn phải kiểm tính đầy đủ của dữ liệu bảng và bản thân implementation. Việc duyệt dữ liệu chỉ thực hiện bằng đợt cập nhật có bằng chứng như nhật ký nguồn, không bằng request API.

## 5. Metadata kết quả

Cả MaiHoaResult và TamTheResult gồm:

- `ruleVersion`: phiên bản bộ quy tắc hiện tại "1.0"; khác contractVersion "1.2". Mọi rule của một bộ kết quả hiện cùng phiên bản; `rules[]` giữ phiên bản từng rule.
- `ruleBasis`: TEAM_DECISION nếu có ít nhất một rule theo quy ước nhóm, còn lại SOURCE_VERIFIED.
- `sourceStatus`: mức chưa chắc chắn cao nhất của rules, theo thứ tự VERIFIED → SOURCE_LOCATED → SOURCE_AMBIGUOUS → BLOCKED_SOURCE_CONFLICT → DRAFT. Không dùng chỉ số này thay kiểm từng rule/ô dữ liệu.
- `rules[]`: ruleCode, ruleVersion, executionPolicy, ruleBasis, sourceStatus, sourceReferences, decisionReferences.
- `sourceReferences[]`: hợp nguồn không trùng; `decisionReferences[]`: hợp quyết định không trùng, rỗng khi không có quyết định nhóm.

SourceReference: `{sourceId,title,version,section,printedPage,pdfPage,sha256,url}`. Nguồn sách dùng mã MH/TT, số trang PDF từ 1, nhãn trang in và SHA-256 đúng bản scan; url null. Nguồn thuật toán ngoài sách có URL HTTPS trực tiếp, phiên bản và mục; trường trang/hash không áp dụng có thể null. Không dùng một độ lệch trang in/PDF cố định cho toàn cuốn.

DecisionReference: `{decisionId,decidedAt,document,description}`, ngày YYYY-MM-DD; document là đường dẫn tài liệu dự án có quyết định. Các mã quyết định dùng trong catalog phải xuất hiện trong nhật ký. UI hiển thị cảnh báo khi ruleBasis=TEAM_DECISION: “Kết quả tính theo quy ước nhóm. Bản in có điểm chưa được xác minh”. Metadata không được bỏ khi lưu lịch sử.

MaiHoaResult thêm `method`, `movingLine`, `primaryHexagram`, `mutualHexagram`, `changedHexagram`, `lunarDate` (null với LINES/OBJECT_COUNT), `calculationSteps[]`. HexagramView có `{code,name,nameStatus,linesBottomUp}`; tên chỉ hiện khi nameStatus=VERIFIED. CalculationStep có `{code,message,values}`; values là map giá trị chuỗi/số/boolean/mảng boolean, không chứa input riêng tư không cần thiết.

Với request LINES mẫu, quẻ hỗ `[false,true,false,true,false,true]`, quẻ biến `[true,true,true,false,true,false]`; chỉ đảo hào thứ 2. Xem `examples/mai-hoa-lines.response.json`. Fixture OBJECT_COUNT đã cập nhật từ runtime B03: 12/8 có thượng Chấn/hạ Khôn/hào 2, Dự/hỗ Kiển/biến Giải; MH-TRIGRAM đã VERIFIED theo biên bản, còn công thức số vật giữ SOURCE_AMBIGUOUS/TEAM_DECISION.

## 6. Tam Thế

Payload: `birthDate` YYYY-MM-DD, `birthTime` HH:mm, `calendarType` SOLAR hoặc LUNAR, `isLeapMonth` boolean bắt buộc, `categories?` là mảng 1–3 giá trị CAREER/WEALTH/LOVE không trùng. Bỏ categories nghĩa là yêu cầu cả ba. SOLAR buộc isLeapMonth=false. Validator kiểm định dạng và ranh cơ bản; C01/D03 phải kiểm ngày âm thực sự tồn tại/tháng nhuận/phạm vi lịch.

TamTheResult thêm `categories:[{category,entries:[{resultCode,title,content,sourceReferences}]}]`. Giữ thứ tự category được yêu cầu; mỗi mục phải có dữ liệu đã kiểm. Không có đủ nguồn cho bất kỳ mục yêu cầu nào → FAILED/RULE_NOT_AVAILABLE với ruleCode tương ứng. Không trả một CAREER như kết quả đầy đủ cả ba. Chưa có fixture thành công lời luận Tam Thế vì chưa có đủ nội dung xác minh; dùng fixture lỗi có thật về trạng thái implementation.

## 7. Progress (B02)

JSON riêng: `{requestId,type,sequence,step,message}`. sequence nguyên >=1, tăng trong cùng request/session. Step gồm ACCEPTED, VALIDATING, CALCULATING, LOOKUP; chỉ phát bước thực sự thực hiện. Kết quả cuối qua results/errors. Không giả thời gian xử lý bằng sleep. Client chỉ hiển thị progress của request đang chờ, không dùng progress để chuyển sang thành công; sau kết quả cuối bỏ progress đến muộn.

B02 đã triển khai: LINES thành công có sequence 1–4 theo thứ tự trên. ACCEPTED nghĩa đã nhận request có ID chuẩn, chưa khẳng định input hợp lệ; VALIDATING bao gồm gate nguồn. CALCULATING phát sau authorize, LOOKUP ngay trước repository. Sai payload hoặc method chưa triển khai chỉ có tiền tố 1–2 rồi FAILED. ID không chuẩn không phát progress; timeout có thể kết thúc ở bất kỳ tiền tố nào.

Server mặc định đóng Run sau 10 giây từ khi bắt đầu xử lý sau parse; trả PROCESSING_TIMEOUT và bỏ mọi progress/kết quả muộn. Disconnect hủy Run/timer; không gửi sang phiên mới. Chưa bảo đảm ngắt tức thì truy vấn đang chạy và chưa tính hàng đợi inbound vào hạn Run. Client chờ tổng 15 giây, không gia hạn theo progress, không tự gửi lại khi reconnect. B02 bảo đảm một terminal cho mỗi lần xử lý, chưa dedup các SEND trùng requestId; N01 làm idempotency/worker/queue.

Client nhận cùng requestId + type; bỏ progress lặp/cũ, báo INVALID_RESPONSE nếu sequence bị hổng/step sai thứ tự; lỗi parse, ngắt kết nối hoặc timeout đều dọn trạng thái chờ. Chi tiết cấu hình/giới hạn và bằng chứng tại `20-B02-PROGRESS-HANDOFF.md`.

Chốt bàn giao TV1 ngày 24/10 tại `23-TV2-CONTRACT-REPLIES-TO-TV1.md`: hạn connect STOMP riêng 10 giây/lần là cấu hình TV1 cần thêm (hook hiện tại chưa đặt); reconnect delay 3 giây. Không tự resend; retry thủ công dùng UUID mới trong bản chưa có dedup. N01 giữ thiết kế TTL 60 giây theo session/ID, tính TTL kết quả từ terminal và giữ khóa đang chạy đến kết thúc; không cache SERVER_BUSY do chưa được tiếp nhận. Các chính sách N01 chưa được coi là implementation hiện có.

## 8. REST đã dành cho các task tiếp theo

Envelope REST: `{requestId,status,data,error}`, cùng cấu trúc error với STOMP; requestId do Server tạo. HTTP và status phải nhất quán. 400 INVALID_INPUT/INVALID_DATE/INVALID_METHOD; 401 INVALID_SESSION; 403 CSRF_REJECTED; 404 NOT_FOUND (kể cả history của owner khác); 422 RULE_NOT_AVAILABLE; 503 DATABASE_UNAVAILABLE/SERVER_BUSY; 504 PROCESSING_TIMEOUT; 500 INTERNAL_ERROR.

| API | Input | data khi thành công |
| --- | --- | --- |
| GET /api/v1/hexagrams | q? <=100 ký tự; upperTrigramCode?/lowerTrigramCode? trong tám mã; page=0, size=20 (1–100) | Page<HexagramRecord> |
| GET /api/v1/hexagrams/{code} | Mã H_UPPER_LOWER, không dùng tên làm ID | HexagramDetail |
| POST /api/v1/calendar/convert | CalendarInput | CalendarResult |
| POST /api/v1/calendar/can-chi | `{date:CalendarInput,time?:"HH:mm"}`; bỏ time thì hour=null | CanChiResult |
| POST /api/v1/session | JSON `{}` và header X-HuyenCo-Request:1 | `{expiresAt,csrfToken}`; cookie HttpOnly; không trả token/ownerId |
| POST /api/v1/history | `{calculationRequestId,title?}`; title 1–100 ký tự nếu có | HistoryDetail; HTTP 201 |
| GET /api/v1/history | q? <=100 ký tự; type? MAI_HOA/TAM_THE; page=0,size=20 (1–100) | Page<HistoryItem> |
| GET /api/v1/history/{id} | UUID | HistoryDetail |
| DELETE /api/v1/history/{id} | UUID; cookie + CSRF | `{deleted:true}`; HTTP 200 |

Page<T>: `{items,page,size,totalElements,totalPages}`; số trang từ 0; ngoài trang cuối trả items=[]; page âm/size ngoài ranh trả 400. Tra quẻ sắp thứ tự code tăng để phân trang ổn định; tìm tên có/không dấu. History sắp createdAt giảm, id làm khóa phụ. Không trả toàn bộ dataset theo size không giới hạn.

HexagramRecord: code, name, nameKind STRUCTURAL_LABEL/CANONICAL_TITLE, verificationStatus, upperTrigramCode, lowerTrigramCode, linesBottomUp, sourceReferences. Dữ liệu tra cứu chưa duyệt có thể trả như bản chép nguồn với trạng thái rõ; UI không trình bày như kết quả luận giải. HexagramDetail thêm interpretations: mỗi đoạn có resultCode/title/content/sourceReferences/verificationStatus; bản đầu chỉ phát nội dung interpretations VERIFIED, phần chưa có trả mảng rỗng, không chèn câu dự đoán.

CalendarInput: `{calendarType,year,month,day,isLeapMonth}`; SOLAR buộc false. CalendarResult gồm ResultEvidence và `{solarDate,lunarDate:{year,month,day,isLeapMonth},timezone:"Asia/Ho_Chi_Minh"}`. Phạm vi mục tiêu ngày Dương 1900-01-01…2099-12-31; ngày Âm cần quy đổi ra ngày Dương trong khoảng này. CanChiResult thêm year/month/day cặp stem/branch; hour tương tự hoặc null. Năm/tháng tính theo lịch âm, không khẳng định Bát Tự theo tiết khí. Các ranh năm/giờ phải được C01 chốt trong rule/reference trước khi mở API.

HistoryItem: `{id,type,title,createdAt,ruleBasis}`. HistoryDetail thêm result snapshot đã lọc theo hợp đồng MaiHoaResult/TamTheResult và dữ liệu tối thiểu cho xem lại; không lưu bản thô birthDate/question. Chỉ lưu calculationRequestId thuộc owner/phiên đang giữ; TTL registry kết quả mục tiêu 15 phút, session owner 30 ngày; mặc định tối đa 1000 lịch sử/owner, vượt trả INVALID_INPUT. Client không gửi ownerId, snapshot tùy ý hay policy để nâng quyền. Đọc/xóa history luôn lọc owner từ cookie. Thao tác ghi sau tạo phiên yêu cầu X-CSRF-Token và X-HuyenCo-Request:1; Server kiểm origin. H01 triển khai chính xác lưu trữ/TTL và test chéo trước khi mở.

Các REST trên là hợp đồng được chốt, không phải các endpoint đã có. Không tạo fixture kết quả lịch/luận giải giả khi C01/D03 chưa có đầu ra đã đối chiếu.

Chốt cấu hình bàn giao TV1: REST qua proxy cùng origin `/api/v1`, đích backend dev `http://localhost:8080`; NEXT_PUBLIC_API_BASE_URL dự kiến `/api/v1`, HUYENCO_API_URL là biến Next.js server-only cho đích nội bộ. next.config hiện chưa có proxy. Cookie owner dự kiến huyenco_session, Path=/; H01 phải xác thực cookie trong handshake và gắn owner vào registry kết quả. Client bootstrap session trước WebSocket khi dùng lưu lịch sử. Đây là thiết kế cho H01/TV1, chưa có session/history/proxy/binding tương ứng.

## 9. Mã lỗi và reason

- Lỗi dữ liệu: INVALID_INPUT, INVALID_DATE, INVALID_METHOD.
- Không đủ điều kiện: RULE_NOT_AVAILABLE cùng ruleCode và reason.
- Hạ tầng: SERVER_BUSY, PROCESSING_TIMEOUT, DATABASE_UNAVAILABLE, INTERNAL_ERROR.
- Tri thức thiếu/sai cấu trúc: KNOWLEDGE_DATA_INCOMPLETE, data=null, ruleCode/reason=null; B01 dùng khi bộ 64 cấu trúc không đầy đủ hoặc không nhất quán. Không trả kết quả tính một phần. REST nếu dùng lỗi này sẽ trả 503.
- REST owner: INVALID_SESSION, CSRF_REJECTED, NOT_FOUND.
- REQUEST_TIMEOUT/DISCONNECTED là trạng thái Client, không trộn với PROCESSING_TIMEOUT của Server.

Reason cho RULE_NOT_AVAILABLE: UNKNOWN_RULE, EXECUTION_DISABLED, RULE_STATE_UNAVAILABLE, RULE_VERSION_MISMATCH, SOURCE_UNVERIFIED, MISSING_SOURCE_REFERENCE, MISSING_SOURCE_REVIEW, MISSING_DECISION_REFERENCE, TEAM_DECISION_NOT_ALLOWED, IMPLEMENTATION_UNAVAILABLE. Các lỗi khác reason=null; message cho người dùng, không đưa SQL/stack trace/secret. Nếu client cũ không biết reason mới, vẫn xử lý theo code.

## 10. Bảo mật và kiểm tra tương thích

Giữ origin allowlist, giới hạn frame/payload và session routing. B02 đã chặn SUBSCRIBE raw broker queue/user queue chỉ định người khác và SEND thẳng broker, có kiểm qua STOMP thật. N01 tiếp tục giới hạn tải/worker/idempotency. REST qua proxy cùng hostname, cookie chỉ Server đọc; H01 bổ sung chống CSRF và test quyền sở hữu. Triển khai Internet cần HTTPS/WSS và kiểm proxy/rate limit trước khi công bố an toàn.

Các fixture success không được phục vụ bằng controller giả. `npm run smoke:lines` kiểm COMPLETED cho 384 tổ hợp qua hai Client trên Server profile db; sau B03, `npm run smoke:stomp` kiểm OBJECT_COUNT thành công, Tam Thế chưa triển khai và lỗi đầu vào. Bằng chứng B01/B03 tại các biên bản 18/21; trả lời chi tiết TV1 tại biên bản 23.
