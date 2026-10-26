# Hợp đồng Huyền Cơ v1.2 — cập nhật đến D04

**D04 ngày26/10:** Tam Thế `wealthMode=EXTENDED` đã hoạt động theo [39](39-DETAILED-READINGS-CONTRACT.md)/[42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md). LOC giữ MATCHED/NO_SOURCE_MATCH; Sang hèn/Điền sản có nguồn và quyết định riêng.720 tổ hợp và STOMP/HTTP/history thật đạt,62 fixtures. LEGACY và envelope1.2 giữ nguyên. Các gate chưa mở D04 ở mốc M02/M03 dưới đây là lịch sử; UI/I02 và T02 còn làm.

**M03 ngày26/10:** Mai Hoa có `payload.reading` đã sinh `detailedReading` thật cho LINES/OBJECT_COUNT/TIME từ bundle M01 đã duyệt trên DB V12. Giữ JSON cũ khi không có reading; Tam Thế EXTENDED vẫn chờ D04. Xem [39](39-DETAILED-READINGS-CONTRACT.md) và [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md), bốn capture thật m03-* trong docs/examples. Gate Mai Hoa trong đoạn M02 dưới đây là lịch sử, không còn hành vi của Server M03 đã cấu hình đúng DB.

**M02 ngày26/10:** bổ sung tùy chọn `payload.reading` (Mai Hoa), `payload.wealthMode` (Tam Thế) và DTO đầu ra mở rộng; giữ JSON/envelope cũ. Validator đã nhận field mới; opt-in hợp lệ trả RULE_NOT_AVAILABLE/IMPLEMENTATION_UNAVAILABLE chờ service M03/D04. Chi tiết field/entries/mùa/decision ở [39](39-DETAILED-READINGS-CONTRACT.md), bằng chứng và trạng thái runtime ở [40](40-M02-CONTRACT-HANDOFF.md). Bốn fixture `.schema.response.json` chỉ kiểm kiểu, không phải capture lời luận thành công.

**Cập nhật theo xác nhận của chủ dự án:** MH-TIME đã được duyệt **VERIFIED cho quy tắc dự án dùng chia6**; không còn chờ xác nhận lại. TIME trả TEAM_DECISION/VERIFIED; câu chữ bản in được giữ trong ghi chú nguồn. Biên bản `docs/28-TIME-OWNER-APPROVAL.md` thay các ghi nhận BLOCKED/chưa duyệt của MH-TIME ở mốc trước.

## 1. Phạm vi và trạng thái triển khai

Đây là hợp đồng dùng chung cho TV1 và phần TV2 + TV3. Giữ envelope v1.1, bổ sung metadata nguồn/quyết định và `error.reason`; Client cũ vẫn đọc được envelope. Các kiểu TypeScript ở `client/src/types/contract.ts`; DTO Java ở `common/dto`; catalog chính sách ở `server/src/main/resources/rules/execution-catalog.json`.

| Thành phần | Trạng thái sau N01 |
| --- | --- |
| STOMP endpoint, results/errors, validator và lỗi có reason | Có trong mã |
| Catalog, registry, kiểm chính sách, DTO kết quả/progress | Có trong mã và kiểm thử; profile db đã nối provider PostgreSQL |
| Health/readiness | Đã có controller; readiness kiểm kho dữ liệu, chưa xác nhận nghiệp vụ hoàn tất |
| LINES trả quẻ chủ/hỗ/biến | B01 đã triển khai, có registry/DB và kiểm qua hai Client STOMP |
| OBJECT_COUNT trả quẻ chủ/hỗ/biến | B03 đã triển khai/kiểm STOMP, bốn rule phụ thuộc; giữ TEAM_DECISION/SOURCE_AMBIGUOUS |
| TIME trả quẻ chủ/hỗ/biến | B04 đã nối lịch C01 và kiểm STOMP; TEAM_DECISION/VERIFIED |
| Tam Thế trả kết quả thật | D03 LEGACY giữ CAREER/WEALTH/LOVE và lỗi thiếu Lộc; D04 EXTENDED có ba tiểu mục, no-match Lộc vẫn giữ đủ category. Nghiệm thu720 tổ hợp theo42 |
| Progress, concurrency và vòng đời request | B02 đã phát bước thật; N01 đã thêm worker/hàng đợi hữu hạn, idempotency theo phiên và deadline tính cả thời gian chờ; hook/Panel TV1 nhận tiến trình |
| REST lịch/Can Chi | C01 đã triển khai hai POST /calendar/convert và /calendar/can-chi; cần DB V8/biên bản nguồn C01 |
| REST tra quẻ | E02: danh sách/tìm/lọc/phân trang và chi tiết với nghĩa tên VERIFIED |
| REST session/lịch sử | H01: cookie owner,CSRF,save/list/search/detail/delete đã chạy với DB và qua restart |

Các file `.response.json` là **fixtures hợp đồng**, không thay cho biên bản duyệt dữ liệu. LINES/OBJECT_COUNT/TIME và lịch C01 đã cập nhật từ phản hồi runtime, chỉ cố định requestId. Nguồn/tên được duyệt theo biên bản riêng; không dùng fixtures làm chứng nhận VERIFIED hay luận giải sách.

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

**B04 đã mở TIME**: chuẩn hóa instant sang **UTC+07:00 cố định**, kiểm ngày Dương 1900-01-01…2099-12-31 sau chuẩn hóa, rồi đổi lịch bằng C01. Y là số Chi năm âm (đổi tại Tết); M/D lấy ngày âm thật; giờ Chi Tý 23:00–00:59, ngày đổi 00:00. Tháng nhuận lấy cùng số tháng, giữ cờ nhuận. `dateSum=Y+M+D`, `timeSum=dateSum+H`; thượng/hạ chia8, hào chia6, dư0→8/8/6. Quy ước dân sự/nhuận ghi `DEC-20261024-B04-CIVIL-TIME`, không tự sửa chứng cứ nguồn MH-TIME.

TIME trả `lunarDate` khác null, `calculationSteps=[TIME_NUMBERS,MUTUAL,CHANGE]`. Bước TIME_NUMBERS có lunarYear/lunarMonth/lunarDay/isLeapMonth, yearBranchIndex/hourIndex (Tý=1…Hợi=12), dateSum/timeSum, upperTrigram/lowerTrigram/movingLine, utcOffset/dayBoundary/leapMonthPolicy. Không thêm top-level ngoài DTO, không echo datetime thô/question. Sai ngày/offset/tràn/phạm vi → INVALID_DATE; missing/type/trường lạ → INVALID_INPUT; thiếu gate/snapshot C01 sai → RULE_NOT_AVAILABLE. Thiếu bảng quái/quẻ → KNOWLEDGE_DATA_INCOMPLETE.

Kết quả TIME tổng `ruleBasis=TEAM_DECISION`, `sourceStatus=BLOCKED_SOURCE_CONFLICT`; năm rule theo thứ tự LUNAR-CONVERSION/MH-TIME/MH-TRIGRAM/MH-MUTUAL/MH-CHANGE. `MH-TIME` giữ xung đột bản in; UI phải hiển thị cảnh báo quy ước nhóm. Ca 10/2/2024 00:00+07:00 → âm1/1 Giáp Thìn, Bác/hỗ Khôn/biến Mông, hào2. Fixture chụp từ runtime ở `examples/mai-hoa-time.response.json`; giới hạn/kiểm ở `27-B04-TIME-HANDOFF.md`.

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

Catalog hiện có 14 mã quy tắc. MH-TIME/MH-OBJECT-COUNT dùng TEAM_DECISION theo quyết định 22/10; TT-GIO-SINH dùng TEAM_DECISION theo DEC-20261025-D02-HOUR-PARTS (mốc có hiệu chỉnh và ba phần 40 phút). MH-THE-DUNG DISABLED; **D03 đã mở TT-TAI-LOC/TT-TINH-DUYEN bằng SOURCE_VERIFIED**; các mã còn lại yêu cầu SOURCE_VERIFIED. TT-36-PHAN duyệt nội dung, không duyệt 40 phút là nguyên văn sách; khi dùng phải kèm bằng chứng TT-GIO-SINH. Được cấu hình policy không có nghĩa mọi module đã có code hoặc mọi endpoint đã sẵn sàng. Tên 64 quẻ và từng ô Tam Thế phải kiểm trạng thái riêng, không suy trạng thái từ một rule chung. Dữ liệu D02 ở `29-D02-TAM-THE-DATA.md`; service ở `30-D03-TAM-THE-HANDOFF.md`.

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

TamTheResult thêm `categories:[{category,entries:[{resultCode,title,content,sourceReferences}]}]`. **D03 đã triển khai cả ba nhóm phía Server**, giữ thứ tự category được yêu cầu. CAREER trả mọi nghề Số11 theo thứ tự Mua bán/Câu chài/Làm thợ rồi một đoạn Số13; WEALTH trả mọi giao điểm theo thứ tự cột; LOVE trả một bài tám câu. Mỗi mục phải có dữ liệu VERIFIED riêng và đủ trang nguồn. Bảng Lộc chỉ phủ 60/120 khóa: nếu không có khóa WEALTH thì FAILED/RULE_NOT_AVAILABLE, ruleCode TT-TAI-LOC, reason **LOOKUP_NOT_AVAILABLE**, data=null cho cả request. Không trả CAREER/LOVE như thể đủ ba mục. Bản ghi chưa duyệt → SOURCE_UNVERIFIED; bảng thiếu/sai cấu trúc hoặc mất trang nối → KNOWLEDGE_DATA_INCOMPLETE.

D03 dùng C01 → Can Chi năm âm → hành S02 → Can/hành + tháng âm. `birthTime` được kiểm nhưng không chi phối ba bảng chung này; không gọi TT-GIO-SINH/TT-36-PHAN cho ba category. Tháng nhuận tra theo cùng số tháng C01 trả. Mỗi response có C01/TT-NGU-HANH và các rule của đúng category yêu cầu, ruleBasis SOURCE_VERIFIED/sourceStatus VERIFIED. Mỗi entry có cả trang bảng và trang đoạn; metadata rule/toàn kết quả cũng hợp đầy đủ các nguồn đã dùng. Số11 có content tóm tắt được ghi rõ “Bảng Số 11 ghi nghề: ….”; các đoạn còn lại dùng bản chép đã duyệt. Nhãn bảng khác tiêu đề đoạn được giữ trong title `(đoạn: …)`, chữ mờ giữ `[CHU_MO]`. Không echo ngày/giờ sinh trong kết quả. Fixture thật và giới hạn ở biên bản 30.

## 7. Progress (B02)

JSON riêng: `{requestId,type,sequence,step,message}`. sequence nguyên >=1, tăng trong cùng request/session. Step gồm ACCEPTED, VALIDATING, CALCULATING, LOOKUP; chỉ phát bước thực sự thực hiện. Kết quả cuối qua results/errors. Không giả thời gian xử lý bằng sleep. Client chỉ hiển thị progress của request đang chờ, không dùng progress để chuyển sang thành công; sau kết quả cuối bỏ progress đến muộn.

B02 đã triển khai: LINES thành công có sequence 1–4 theo thứ tự trên. ACCEPTED nghĩa đã nhận request có ID chuẩn, chưa khẳng định input hợp lệ; VALIDATING bao gồm gate nguồn. CALCULATING phát sau authorize, LOOKUP ngay trước repository. Sai payload hoặc method chưa triển khai chỉ có tiền tố 1–2 rồi FAILED. ID không chuẩn không phát progress; timeout có thể kết thúc ở bất kỳ tiền tố nào.

B04: TIME thành công cũng có sequence1–4; chuẩn hóa/kiểm lịch và gate nguồn thuộc VALIDATING, phần số học/quẻ thuộc CALCULATING. Lỗi ngày/phạm vi hoặc nguồn chưa được cấp quyền không phát CALCULATING/LOOKUP. D03 Tam Thế kiểm lịch/quyền/snapshot bảng trong VALIDATING, tính hành/khóa trong CALCULATING, tra/ghép nội dung trong LOOKUP; snapshot JDBC được đọc trước để bảo đảm nguồn nhất quán. Thiếu khóa Lộc hợp lệ phát đủ 1–4 rồi FAILED/LOOKUP_NOT_AVAILABLE. Script hồi quy đã cập nhật cả TIME và Tam Thế thật.

Server mặc định đóng Run sau 10 giây **từ khi được tiếp nhận**, gồm cả thời gian chờ trong hàng đợi N01; trả PROCESSING_TIMEOUT và bỏ mọi progress/kết quả muộn. Disconnect hủy Run/timer, gỡ yêu cầu chưa chạy khỏi queue nếu có thể và xóa registry của phiên; không gửi sang phiên mới. Ngắt công việc đã chạy là best effort (phụ thuộc JDBC/thư viện có đáp ứng interruption hay không), không bảo đảm dừng tức thì truy vấn. Client chờ tổng 15 giây, không gia hạn theo progress, không tự gửi lại khi reconnect. Với requestId hợp lệ, N01 bảo đảm một lần tính cho mỗi khóa `(sessionId, requestId)` khi yêu cầu còn đang chạy hoặc còn cache kết quả.

Client nhận cùng requestId + type; bỏ progress lặp/cũ, báo INVALID_RESPONSE nếu sequence bị hổng/step sai thứ tự; lỗi parse, ngắt kết nối hoặc timeout đều dọn trạng thái chờ. Chi tiết cấu hình/giới hạn và bằng chứng tại `20-B02-PROGRESS-HANDOFF.md`.

Chốt bàn giao TV1 ngày 24/10 tại `23-TV2-CONTRACT-REPLIES-TO-TV1.md`: hạn connect STOMP riêng 10 giây/lần là cấu hình TV1 cần thêm (hook hiện tại chưa đặt); reconnect delay 3 giây. Không tự resend khi reconnect. **N01 đã triển khai:** cache terminal theo `(sessionId, requestId)` trong 60 giây sau khi kết thúc, mặc định tối đa 10.000 khóa kể cả đang chạy. SEND cùng ID, cùng type/payload (bỏ qua thứ tự key JSON) khi đang chạy cùng chia sẻ một job/terminal; gửi lại sau khi đã xong và còn TTL thì replay terminal về cùng session, không tính lại. Cùng ID nhưng khác type/payload trả `INVALID_INPUT` mà không thay đổi job cũ. Khi queue/registry đầy trả `SERVER_BUSY`, không lưu lỗi quá tải vào idempotency cache. Kết nối mới có sessionId mới, không replay cache phiên cũ; retry thủ công muốn tính mới phải dùng UUID mới. Chi tiết tại `36-N01-CONCURRENCY-IDEMPOTENCY-HANDOFF.md`.

Chế độ Server mặc định `CALCULATION_MODE=bounded`, `CALCULATION_WORKERS=4`, `CALCULATION_QUEUE_CAPACITY=100`, `IDEMPOTENCY_TTL_SECONDS=60`, `IDEMPOTENCY_MAX_ENTRIES=10000`. Có thể đặt `CALCULATION_MODE=direct` để chạy baseline benchmark X01, vẫn dùng vòng đời/idempotency N01. `MAX_ACTIVE_CALCULATIONS` và `MAX_ACTIVE_PER_SESSION` tiếp tục giới hạn lượng Run được nhận; giới hạn queue/registry được xét riêng. Các giá trị có thể chỉnh bằng biến môi trường trước khi khởi động Server; không thay đổi STOMP endpoint/envelope.

## 8. REST: lịch C01,tra quẻ E02 và session/lịch sử H01 đã triển khai

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

**E02 chốt hành vi:** Hai GET `/api/v1/hexagrams` và `/api/v1/hexagrams/{code}` trả envelope nêu trên. `q` mặc định rỗng, bỏ khoảng trắng đầu/cuối, so không phân biệt hoa/thường và chuẩn hóa Unicode NFC. Có dấu thì tìm chuỗi con giữ dấu (phân biệt Bĩ/Bí, Càn/Cấn); không dấu thì bỏ dấu tên và đ→d (ví dụ `bi` trả Bĩ/Bí, `ly` trả Ly/Lý). Truy vấn bắt đầu bằng `H_` (không phân biệt hoa/thường) tìm chuỗi con mã; `q=H_` khớp mọi mã. `%`, `_` là ký tự thường, không phải wildcard SQL. Bộ lọc quái nhận đúng mã viết hoa `CAN,DOAI,LY,CHAN,TON,KHAM,CAN2,KHON`; `CAN2` là Cấn. Kết hợp q/thượng/hạ bằng AND. Sắp code tăng, size mặc định20/tối đa100, page mặc định0; số nguyên quá lớn/âm/thập phân, tham số rỗng không hợp lệ, tham số lạ hoặc lặp trả 400 INVALID_INPUT. `q=` hợp lệ. Page đến 2147483647 hợp lệ và trả rỗng nếu vượt cuối, không tràn phép nhân offset.

E02 chỉ phát đoạn `category=resultCode="NAME_GLOSS"`, có thêm `sourceOrder` (1–64), `printedSourceLabel`, `verificationNote`, `verificationStatus="VERIFIED"`. Ngoài trạng thái phải có reviewer, thời điểm duyệt, ghi chú và nguồn truy xuất được; thiếu duyệt thì `interpretations=[]`. Nghĩa tên ngắn không phải lời dự đoán. Tỉnh (`H_KHAM_TON`, mục48) có content="Giếng nước", printedSourceLabel="Ích" và ghi chú giải quyết nhãn in sai; tên chuẩn vẫn Tỉnh. Không phát các category chưa triển khai hoặc lời luận chưa duyệt. SourceReferences của tên và của từng nghĩa được trả riêng.

Mã chi tiết có cú pháp `H_[A-Z0-9]+_[A-Z0-9]+`, tối đa64 ký tự; sai cú pháp trả400, đúng cú pháp nhưng không tồn tại trả404 NOT_FOUND. Không DB/mất kết nối trả503 DATABASE_UNAVAILABLE; dataset thiếu/thừa/trùng mã hoặc sai cấu trúc bắt buộc trả503 KNOWLEDGE_DATA_INCOMPLETE. Exception không lộ SQL/credentials/stack trace. Repository chỉ đọc trong transaction REPEATABLE_READ, timeout SQL3 giây; tải tối đa65 quẻ/65 nghĩa để kiểm bộ cố định64 và phát hiện thừa; tìm/lọc/phân trang thực hiện trên snapshot này, không đọc lịch sử hay dữ liệu người dùng. Không cần PostgreSQL unaccent/extension hoặc migration mới cho E02.

CalendarInput: `{calendarType,year,month,day,isLeapMonth}`; SOLAR buộc false. CalendarResult gồm ResultEvidence và `{solarDate,lunarDate:{year,month,day,isLeapMonth},timezone:"Asia/Ho_Chi_Minh"}`. Phạm vi mục tiêu ngày Dương 1900-01-01…2099-12-31; ngày Âm cần quy đổi ra ngày Dương trong khoảng này. CanChiResult thêm year/month/day cặp stem/branch; hour tương tự hoặc null. Năm/tháng tính theo lịch âm, không khẳng định Bát Tự theo tiết khí. Các ranh năm/giờ phải được C01 chốt trong rule/reference trước khi mở API.

**C01 đã mở hai API lịch:** phạm vi Dương **1900-01-01…2099-12-31**, cả hai đầu; một phần năm âm 1899 hợp lệ khi đổi ra ngày Dương trong phạm vi. Không nhận tháng nhuận không tồn tại/ngày 30 của tháng thiếu. Không ép chuỗi/số thực thành int; không nhận trường lạ, thiếu/null cờ nhuận, JSON trùng key/nối nhiều tài liệu hoặc UTF-8 sai; body kiểm tại controller tối đa 16.000 byte. `time` nếu có phải là HH:mm 00:00…23:59, bỏ thì hour=null; gửi null bị từ chối. Can/Chi trả mã `GIAP`…`QUY`, `TY`…`HOI`, `TI` là Tỵ.

`timezone` giữ nhãn hợp đồng, **phép tính dùng UTC+07:00 cố định**, kể cả trước 1968; không theo historical offset của ZoneId. Năm đổi tại Tết, ngày đổi 00:00, tháng nhuận giữ Can Chi tháng cùng số; Tý 23:00–00:59, Can giờ tại 23:xx vẫn theo ngày dân sự hiện tại. Đây là lịch tính theo mô hình được pin, không phục dựng lịch sử hoặc Bát Tự tiết khí, không thay bảng giờ sinh Tam Thế. Nguồn thuật toán ngoài sách có version/hash/URL, không tạo trang PDF giả; rule LUNAR-CONVERSION và snapshot phải khớp DB V8. Không DB/chưa duyệt trả 422 RULE_NOT_AVAILABLE, mất DB trả 503 DATABASE_UNAVAILABLE. Chi tiết/giới hạn ở `26-C01-CALENDAR-HANDOFF.md`.

HistoryItem: `{id,type,title,createdAt,ruleBasis}`. HistoryDetail thêm result snapshot theo hợp đồng MaiHoaResult/TamTheResult, không lưu payload thô/birthDate/birthTime/question. Chỉ lưu calculationRequestId thành công thuộc owner đã xác thực tại WebSocket handshake. Cache giữ tối đa15 phút,10000 mục/32MiB toàn Server,128KiB/mục; khi đầy loại mục cũ nhất. Phiên owner30 ngày, không trượt thời hạn khi bootstrap lại. Mặc định tối đa1000 lịch sử/owner, vượt trả INVALID_INPUT; khóa owner trong transaction trước đếm/chèn. Client không gửi ownerId,result hoặc policy để nâng quyền. Mọi đọc/xóa history lọc owner từ cookie; owner khác trả404. POST lưu lặp cùng owner/requestId trả bản gốc201, không tạo bản sao; nếu trong cache phát hiện cùng ID có kết quả khác nhau thì400 yêu cầu ID mới. Đã lưu vẫn xem/lưu lặp được sau restart; kết quả chưa lưu mất khi cache hết hạn/restart. GET list tìm title chuỗi con literal không phân biệt hoa/thường,q≤100,không cam kết bỏ dấu; type MAI_HOA/TAM_THE,page/size cùng ranh tra quẻ; sort createdAt DESC,id DESC. title tùy chọn1–100 sau strip,không trắng/không ký tự điều khiển.

**H01 phiên và bảo mật:** POST session nhận đúng `{}`, custom header X-HuyenCo-Request:1; tạo cookie `huyenco_session` HttpOnly,SameSite=Lax,Path=/,Max-Age30 ngày,Secure trên HTTPS hoặc SESSION_SECURE_COOKIE=true. Token32 byte ngẫu nhiên,DB chỉ lưu SHA-256. JSON chỉ trả expiresAt/csrfToken; không trả raw token/ownerId. Gọi lại cookie hợp lệ trả CSRF ổn định; cookie giả/trùng/hết hạn401 INVALID_SESSION. Lưu/xóa cần cả X-CSRF-Token và X-HuyenCo-Request:1; Origin nếu có phải thuộc cấu hình hoặc chính backend,thiếu/sai kiểm tra403 CSRF_REJECTED. Tất cả response session/history có Cache-Control:no-store. Body POST≤16000 byte,UTF-8/JSON nghiêm ngặt; không chấp nhận field lạ/key trùng/null sai kiểu; query lạ/lặp/số xấu trả400. Mã lịch sử UUID canonical; không DB/lỗi JDBC503 DATABASE_UNAVAILABLE,không lộ SQL/secret. Xem `34-H01-SESSION-HISTORY-HANDOFF.md`.

**Lịch C01,tra quẻ E02 và5 endpoint session/history H01 đã có**. Fixtures lịch,tra quẻ,Tam Thế và lịch sử chụp từ Server thật,chỉ cố định requestId; không ghi cookie/CSRF thực vào fixture. Không dùng fixture thay chứng cứ nguồn. Tam Thế tiếp tục dùng STOMP,không tự thêm REST tính toán mới.

Chốt bàn giao TV1: REST qua proxy cùng origin `/api/v1`,backend dev `http://localhost:8080`; NEXT_PUBLIC_API_BASE_URL dự kiến `/api/v1`,HUYENCO_API_URL là biến Next.js server-only cho đích nội bộ. Proxy/UI thuộc TV1. H01 đã xác thực cookie ở handshake và gắn owner vào bộ giữ kết quả; không dùng owner làm Principal để tránh phát kết quả lẫn tab. **Client bootstrap session trước WebSocket**,hoặc kết nối lại nếu socket đã mở vô danh. WebSocket không cookie vẫn tính được nhưng không có kết quả thuộc owner để lưu; không nhận owner từ STOMP header. Sau refresh/bootstrap lại lấy CSRF vào bộ nhớ trang,không cần đọc HttpOnly cookie.

## 9. Mã lỗi và reason

- Lỗi dữ liệu: INVALID_INPUT, INVALID_DATE, INVALID_METHOD.
- Không đủ điều kiện: RULE_NOT_AVAILABLE cùng ruleCode và reason.
- Hạ tầng: SERVER_BUSY, PROCESSING_TIMEOUT, DATABASE_UNAVAILABLE, INTERNAL_ERROR.
- Tri thức thiếu/sai cấu trúc: KNOWLEDGE_DATA_INCOMPLETE, data=null, ruleCode/reason=null; B01 dùng khi bộ 64 cấu trúc không đầy đủ hoặc không nhất quán. Không trả kết quả tính một phần. REST nếu dùng lỗi này sẽ trả 503.
- REST owner: INVALID_SESSION, CSRF_REJECTED, NOT_FOUND.
- REQUEST_TIMEOUT/DISCONNECTED là trạng thái Client, không trộn với PROCESSING_TIMEOUT của Server.

Reason cho RULE_NOT_AVAILABLE: UNKNOWN_RULE, EXECUTION_DISABLED, RULE_STATE_UNAVAILABLE, RULE_VERSION_MISMATCH, SOURCE_UNVERIFIED, MISSING_SOURCE_REFERENCE, MISSING_SOURCE_REVIEW, MISSING_DECISION_REFERENCE, TEAM_DECISION_NOT_ALLOWED, IMPLEMENTATION_UNAVAILABLE, **LOOKUP_NOT_AVAILABLE** (D03: khóa không có trong một bảng nguồn đã kiểm đủ cấu trúc). Các lỗi khác reason=null; message cho người dùng, không đưa SQL/stack trace/secret. Nếu client cũ không biết reason mới, vẫn xử lý theo code; guard dùng chung hiện đã nhận reason này.

## 10. Bảo mật và kiểm tra tương thích

Giữ origin allowlist, giới hạn frame/payload và session routing. B02 đã chặn SUBSCRIBE raw broker queue/user queue chỉ định người khác và SEND thẳng broker, có kiểm qua STOMP thật. N01 giới hạn worker/queue/registry, cô lập idempotency theo session và trả SERVER_BUSY khi quá tải; chưa thay thế rate limit tầng reverse proxy. REST qua proxy cùng hostname, cookie chỉ Server đọc; H01 bổ sung chống CSRF và test quyền sở hữu. Triển khai Internet cần HTTPS/WSS và kiểm proxy/rate limit trước khi công bố an toàn.

Các fixture success không được phục vụ bằng controller giả. `npm run smoke:lines` kiểm COMPLETED cho 384 tổ hợp qua hai Client trên Server profile db; `npm run smoke:stomp` kiểm OBJECT_COUNT và Tam Thế đủ ba nhóm, lỗi đầu vào và tách phiên. `npm run smoke:tam-the` kiểm riêng D03; biên bản 30 có bằng chứng và fixture thật. Bằng chứng B01/B03 ở biên bản 18/21; trả lời thiết kế TV1 ở biên bản 23.
