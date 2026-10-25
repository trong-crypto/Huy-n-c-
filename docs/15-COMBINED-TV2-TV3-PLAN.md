# Huyền Cơ — Kế hoạch hoàn thành phần TV2 + TV3

**Cập nhật theo xác nhận của chủ dự án:** MH-TIME đã được duyệt **VERIFIED cho quy tắc dự án dùng chia6**; không còn chờ xác nhận lại. TIME trả TEAM_DECISION/VERIFIED; câu chữ bản in được giữ trong ghi chú nguồn. Biên bản `docs/28-TIME-OWNER-APPROVAL.md` thay các ghi nhận BLOCKED/chưa duyệt của MH-TIME ở mốc trước.

Phiên bản 1.0, lập ngày 23/10/2026, múi giờ Asia/Ho_Chi_Minh. Hạn nộp theo `Submission.md`: **23:59 ngày 31/10/2026**. Các ngày dưới đây là mục tiêu thực hiện, chưa phải cam kết rằng chức năng đã hoàn thành.

## 1. Quyền quyết định và phân công mới

Chủ dự án hiện phụ trách cả TV2 và TV3, đã giao Codex quyền quyết định kỹ thuật để tiếp tục hoàn thành dự án. Codex triển khai Server, nghiệp vụ, dữ liệu, migration, kiểm thử, đo lường và tài liệu theo kế hoạch này; xử lý các lựa chọn kỹ thuật thông thường trong phạm vi đã giao mà không cần xin lại từng bước. **TV1 chịu trách nhiệm giao diện. Theo nhắc nhở sau B03, Codex không tự sửa trang, component, bố cục, biểu mẫu hoặc nội dung giao diện khi chưa có chỉ định riêng.** TV2–TV3 duy trì hợp đồng JSON/STOMP, kiểu dùng chung, fixtures và chương trình Client kiểm giao thức; bàn giao điểm tích hợp cho TV1.

Các yêu cầu F01–F08 vẫn giữ nguyên. Quyền quyết định triển khai không tự tạo ra bằng chứng nguồn sách, phản hồi giảng viên hoặc kết quả thực nghiệm. Tên người nhập/người kiểm trong dữ liệu phải phản ánh đúng người/công cụ đã thực hiện.

Kế hoạch này thay cách chia việc TV2/TV3 và các mốc còn lại trong tài liệu 08/09. Các quyết định nghiệp vụ đã chốt trước đó tiếp tục có hiệu lực.

## 2. Hiện trạng đã đọc trực tiếp — cập nhật sau H01 ngày25/10

**H01 DONE phần Server/schema:** cookie owner30 ngày,CSRF,5 API session/history,snapshot kết quả thành công theo owner qua handshake WebSocket và bộ nhớ có TTL/giới hạn đã triển khai. Huyenco V11 đã sao lưu/áp dụng, dữ liệu tri thức giữ nguyên.480 Java có DB,54 HTTP H01+8 terminal STOMP,2 ca không DB,121 HTTP hồi quy E02,31 fixtures/typecheck/54 Python đạt; lịch sử đọc lại được sau restart,DB tạm đã dọn. Xem `34-H01-SESSION-HISTORY-HANDOFF.md`. **Tiếp theo N01**; TV1 tích hợp bootstrap trước WebSocket và UI lịch sử.

**E01 và E02 DONE:** PostgreSQL V10 đã có64 nghĩa tên VERIFIED; hai GET tra quẻ đã chạy HTTP thật, tìm dấu/không dấu/mã, lọc và phân trang. 470 Java có DB/123 HTTP có DB+2 không DB, TypeScript/27 fixtures/54 Python đạt; bootstrap lặp giống dữ liệu, huyenco giữ nguyên sau kiểm chỉ đọc. Giao diện TV1 và nghiệm thu F05 còn riêng. **Tiếp theo H01**; các ghi nhận E01/E02 chưa triển khai trong mốc lịch sử dưới đây được thay bằng biên bản31/32.

**D03 đã hoàn thành Server ba nhóm Tam Thế**, nối C01/S02/D01/D02, giữ mọi kết quả và trang nguồn. Dữ liệu V9/447 ô/33 mục nguồn sách/12 rule VERIFIED giữ nguyên, không duyệt nguồn mới. 464 Java có DB, D03 STOMP263 terminal/1.034 progress; 24 fixtures/typecheck/12 kiểm thử guard Client và hồi quy Mai Hoa/B02 đạt. Lộc chỉ phủ 60/120 khóa; khóa thiếu trả LOOKUP_NOT_AVAILABLE toàn request. **E01 tiếp theo**, rồi E02; giao diện TV1/I01 còn nghiệm thu. Biên bản `30-D03-TAM-THE-HANDOFF.md` thay các mốc D03 chưa có service ở phía dưới.

| Thành phần | Đã có | Còn thiếu |
| --- | --- | --- |
| PostgreSQL | Flyway V1–V11; dữ liệu sách/nghiệp vụ V10 giữ nguyên; thêm anonymous_sessions và interpretation_history cho H01 | Không mở rộng sang mọi mục của cả hai sách; giới hạn nguồn theo biên bản33 |
| Kiểm chứng | 12 quy tắc VERIFIED theo phạm vi: tám mã trước + TT-TAI-LOC/TT-TINH-DUYEN/TT-36-PHAN/TT-GIO-SINH; 447 ô tra, 64 tên và 12 mốc; giữ TV2 tháng 5 | Mô tả nạp âm chưa duyệt; OBJECT_COUNT giữ đa nghĩa/TEAM_DECISION; giờ 40 phút là TEAM_DECISION, không phải nguyên văn sách |
| Mai Hoa | LINES/OBJECT_COUNT/TIME → registry/DB → STOMP, ba quẻ/hào động/progress thật; TIME nối C01 và giữ nguồn xung đột | Giao diện/sơ đồ/tích hợp F01–F03 thuộc TV1/I01; Thể/Dụng và lời luận chưa mở |
| Tam Thế | TamTheService CAREER/WEALTH/LOVE dùng C01/S02/D01/D02, giữ đa kết quả/nguồn; khóa Lộc thiếu báo lỗi | UI Tam Thế còn tích hợp/nghiệm thu; giữ giới hạn dữ liệu Lộc |
| Mạng | STOMP `/ws`, progress/kết quả/lỗi theo session, giới hạn message, deadline/disconnect, allowlist SEND/SUBSCRIBE | Queue/worker hữu hạn, idempotency, đo tải và các ca N01/T01 |
| Lịch/Can Chi | C01: hai REST đã chạy Server thật; đủ ngày 1900–2099/tháng nhuận/Can Chi; đã dùng cho TIME B04 và Tam Thế D03 | Tích hợp/nghiệm thu UI TV1 |
| Tra cứu quẻ, lịch sử | E02 có hai GET tra quẻ; H01 có cookie owner/CSRF,save/list/search/filter/detail/delete,đọc lại sau restart | TV1 tích hợp UI tra quẻ/lịch sử và bootstrap trước WebSocket |
| Client (TV1) | Có khung trang Mai Hoa/Tam Thế và hook/Panel từ các đợt trước; B03 đã bàn giao hợp đồng/fixtures và kiểm Server qua Client STOMP | TV1 phụ trách tích hợp, nghiệm thu biểu mẫu/hiển thị, trang tra quẻ/lịch/lịch sử và sơ đồ |
| Kiểm tra gần nhất | D03: 464 Java có DB; 24 fixtures/typecheck/12 test guard Client; STOMP Tam Thế263/1.034; TIME66/248, LINES387/1.546, OBJECT_COUNT324/1.276 và B02 đạt. Bootstrap lặp/chốt nguồn đạt; hash DB thật giữ nguyên; audit dữ liệu sau D02 50/0 FAIL/1 PENDING | REST tra quẻ-lịch sử, UI I01, mạng N01 và thực nghiệm còn việc |

Báo cáo kiểm toán: `scripts/generated/tv3_audit_report.md`. Sau D02 còn một PENDING dữ liệu là lời giải 64 quẻ E01. D03 giữ nguyên dữ liệu; số bản ghi/số PENDING không thay điều kiện nghiệm thu service, UI và toàn sản phẩm.

## 3. Những quyết định kỹ thuật chốt ngay

### 3.1. Công nghệ và môi trường

- Giữ Java 17+, Spring Boot, Next.js và PostgreSQL `huyenco` cài trực tiếp. Không thêm Docker vào đường bắt buộc để chạy/nộp bài.
- Server chịu mọi phép tính và truy vấn nguồn; Client chỉ nhận input và trình bày. STOMP dùng cho tính toán/tiến trình, REST dùng cho tra cứu/lịch/lịch sử.
- Hoàn thiện profile `database` + `db` thành cấu hình chạy bản đầy đủ; bản không DB chỉ phục vụ kiểm tra kết nối và test hàm thuần, phải ghi rõ giới hạn.
- Dùng repository JDBC trên `DataSource` do Spring/Hikari quản lý để đọc bảng hiện có. A02 dùng prepared statement trực tiếp, thay starter JPA bằng JDBC; không dùng ORM tạo lại bảng. Giữ Flyway là nơi duy nhất quản lý schema.
- Schema mới dùng V5 trở đi; không sửa checksum V1–V4 đã chạy. Dữ liệu nhập lại được, có kiểm đúng hash nguồn và transaction.
- Mọi mật khẩu lấy từ biến môi trường hoặc nhập ẩn; không đưa vào mã, CSV, log hay gói nộp.

### 3.2. Lịch, giờ và nghiệp vụ

- Múi giờ nghiệp vụ UTC+7 (`Asia/Ho_Chi_Minh`); phạm vi mục tiêu cho lịch Dương là 01/01/1900–31/12/2099. Chỉ công bố khoảng này khi bộ chuyển đổi và dữ liệu chuẩn đã kiểm; ngày ngoài khoảng trả lỗi rõ.
- Tách dịch vụ chuyển lịch và Can Chi khỏi Mai Hoa/Tam Thế. Chọn một thuật toán/thư viện có nguồn, giấy phép và bản cố định sau khi đọc tài liệu gốc; không tự phát minh lịch thiên văn. Không coi kiểm vòng Dương→Âm→Dương là chứng cứ độc lập duy nhất.
- Mai Hoa: năm/tháng/ngày lấy theo lịch âm; chỉ số năm/giờ theo Tý=1…Hợi=12. Giờ Tý 23:00–00:59; ngày đổi tại 00:00 giờ Việt Nam là quy ước triển khai cần ghi trong nguồn quy tắc. Không tự áp dụng cách đổi ngày lúc 23:00 của một hệ phái khác.
- TIME dùng tổng chia 6 tìm hào động; OBJECT_COUNT dùng số vật gốc và giờ theo quyết định nhóm: chia 8/8/6, dư 0 thành 8/8/6. Giữ nguyên chữ in gây mâu thuẫn trong dữ liệu nguồn.
- Tam Thế dùng mốc giờ theo từng tháng của Số 5, riêng tháng 5 dùng Dần theo quyết định đã xác nhận. Không dùng bảng giờ cố định của Mai Hoa cho Tam Thế. Tháng nhuận tra cùng số tháng thường theo mục nguồn đã định vị; mùa/tiết khí chỉ tính khi thật sự có quy tắc yêu cầu và có nguồn thuật toán.
- Tên quẻ giữ tên ngắn theo sách và 64 mã đã có; không đổi mã theo số thứ tự hoặc tên hiển thị. Không dùng lời giải do mô hình sinh thay cho dữ liệu sách.

### 3.3. Đối chiếu khi một người phụ trách hai vai trò

Thay việc treo task “chờ TV2” bằng hai lượt có bằng chứng:

1. Lượt nguồn: đọc ảnh trang gốc, ghi tên sách/hash/trang/ô và nguyên văn hoặc giá trị chép.
2. Lượt đối chiếu: mở lại trang gốc và kiểm đầu ra theo ca chuẩn hoặc bảng đối chiếu được lập riêng; không chỉ chạy kiểm thử từ cùng một danh sách nhập.
3. Ghi người/công cụ kiểm thực tế, ngày, kết quả và hạn chế. Một người kiêm vai trò không được ghi là hai người kiểm độc lập. Kiểm tra bằng hai cách từ cùng dữ liệu cũng không được gọi là nguồn độc lập.
4. Chỉ nâng VERIFIED đúng bản ghi đủ chứng cứ. Dòng mờ/thiếu/mâu thuẫn giữ trạng thái nguồn tương ứng và vẫn tiếp tục các task không phụ thuộc.

Đối với TIME và OBJECT_COUNT, chốt **tách trạng thái nguồn khỏi quyền chạy theo quy ước nhóm**: `executionPolicy` gồm DISABLED/SOURCE_VERIFIED/TEAM_DECISION, cùng lý do/phiên bản; giữ nguyên verification_status về nguồn. Kết quả có ruleBasis/sourceStatus/decisionReferences; UI ghi rõ “Theo quy ước nhóm; bản in có điểm chưa xác minh”. Không nâng nguồn để vượt gate runtime hoặc phát lời luận chưa duyệt. A01/A02 đã có registry nối DB; B01/B03/B04 đã mở LINES/OBJECT_COUNT/TIME, C01 cấp lịch đúng snapshot. TIME giữ xung đột nguồn và quyết định chia6/dân sự/nhuận. Xem biên bản 27.

Các trường hợp nguồn rõ và không có quyết định nhóm cho phép chạy vẫn phải đạt VERIFIED trước khi phát kết quả nghiệp vụ. F01/F02 chỉ được đánh dấu đạt ở chế độ quy ước nhóm khi UI, tài liệu và demo thể hiện đầy đủ căn cứ đó, kèm giới hạn; không gọi đó là xác minh thuật toán nguyên bản của ấn bản.

### 3.4. Giao thức, concurrency và lỗi

- Giữ envelope và đường dẫn hiện có. Hoàn thiện API v1.2 trước mỗi module, thêm ví dụ thành công/lỗi thực tế và TypeScript DTO tương ứng.
- Progress đi `/user/queue/progress`: `requestId`, `sequence` tăng dần, `step`, `message`. Các bước tối thiểu: ACCEPTED, VALIDATING, CALCULATING, LOOKUP; kết quả cuối vẫn qua results/errors. Không chèn độ trễ để tạo tiến trình giả.
- Sau khi có LINES thật, chụp baseline xử lý trực tiếp. Tiếp đó thêm chế độ `bounded`: 4 worker, queue 100, đầy trả SERVER_BUSY; tất cả cấu hình được.
- Idempotency theo `(sessionId, requestId)`, TTL 60 giây, tối đa 10.000 mục: payload/type chuẩn hóa giống nhau chỉ tính một lần; request đang chạy dùng chung công việc; kết quả cuối được replay trong thời hạn; khác payload trả INVALID_INPUT. Giới hạn áp dụng cho cả đang chạy và đã xong; không xóa khóa đang chạy rồi nhận lại để tính trùng.
- Ngắt kết nối phải giải phóng registry và subscription; bỏ công việc đang chờ của phiên đã đóng nếu có thể. Client không tự gửi lại phép tính nhạy cảm khi reconnect. Session mới có phạm vi idempotency mới.
- Timeout xử lý mục tiêu 10 giây, Client hiện 15 giây; tác vụ quá hạn trả lỗi có mã, hủy best effort, không phát thêm COMPLETED sau khi đã báo lỗi cuối.
- Validator, SQL tham số hóa, origin allowlist, message size, giới hạn tần suất theo phiên; chặn subscribe vào queue của người khác. Log chỉ mã yêu cầu/lỗi/thời gian, không in ngày sinh/câu hỏi/cookie/token.

### 3.5. Quyền sở hữu lịch sử

- Bản đầu dùng phiên người dùng ẩn danh bền vững theo trình duyệt; không bổ sung đăng ký/email chỉ để hoàn thành F08.
- Server phát token ngẫu nhiên ít nhất 256 bit, cookie HttpOnly/SameSite=Lax; lưu hash token và chủ sở hữu trong DB; thời hạn 30 ngày. Cookie Secure bật khi dùng HTTPS. Bản demo không có phục hồi lịch sử sau khi mất cookie hoặc chuyển thiết bị; phải ghi giới hạn.
- Dùng cùng hostname `localhost` trong cấu hình demo; REST qua proxy cùng origin của Next.js, chuyển cookie tới Server. Kiểm origin và header chống CSRF cho thao tác tạo phiên/lưu/xóa; không dựa vào SameSite một mình.
- Server suy chủ sở hữu từ token; không tin `ownerId` do Client gửi và không dùng `simpSessionId` làm owner lâu dài.
- Chỉ lưu khi người dùng chọn. Lưu snapshot kết quả đã hoàn tất, phiên bản quy tắc và nguồn; dùng allowlist trường, mặc định bỏ ngày sinh/câu hỏi đầu vào không cần thiết. Mất cookie không làm lộ lịch sử; kết quả của owner khác trả 404.
- Có phân trang, tìm, xem, xóa, TTL phiên và giới hạn số bản ghi; không biến API lưu lịch sử thành nơi Client đẩy nội dung tùy ý. Server chỉ lưu kết quả thuộc owner/phiên đã tính, được giữ tạm trong registry có TTL.

### 3.6. Đóng gói chạy mới

Luồng bootstrap phải xử lý được database trống: Flyway V1–V3 → seed nền → V4 → các migration tiếp theo → seed mở rộng → audit. V4 hiện phụ thuộc seed có sẵn; script hiện tại dành cho DB đã nhập, nên việc sửa bootstrap là task bắt buộc trước nộp. Dùng Flyway target được cấu hình trong quá trình bootstrap, không sửa V4 và không tự ghi lịch sử Flyway bằng SQL tay. Quy tắc/dữ liệu sẵn sàng kiểm sau bootstrap ở bước khởi tạo nghiệp vụ, không ép Server đọc bảng chưa seed rồi thất bại ở lần chạy đầu.

## 4. Thứ tự triển khai và đầu ra từng việc

`TODO` nghĩa là chưa thực hiện trong đợt kế hoạch này. Bằng chứng hiện trạng không được thay bằng dấu tích kế hoạch.

| ID | Trạng thái | Việc làm theo thứ tự | Đầu ra và điều kiện xong | Phụ thuộc |
| --- | --- | --- | --- | --- |
| A01 | DONE | Chốt hợp đồng v1.2, registry quy tắc và chính sách nguồn/TEAM_DECISION; cập nhật mẫu DTO, lỗi, trạng thái dữ liệu và quy trình review | API examples/TypeScript đồng bộ; trường basis/version/source đủ; không tự bật quy tắc thiếu căn cứ | Hiện trạng V4 |
| A02 | DONE | Repository JDBC đọc nguồn/quy tắc/quái, registry nối PostgreSQL; bootstrap V1–V3 → seed → V4/latest; health/readiness tách kho dữ liệu và nghiệp vụ | DB trống bootstrap hai lần, toàn bộ bản ghi giữ nguyên; 26 test Java đạt; HTTP có/không DB đạt; xem `17-A02-DATABASE-HANDOFF.md` | A01 |
| B01 | DONE | Hàm thuần LINES, service kiểm hai rule VERIFIED, index 64 cấu trúc, kết quả STOMP thật và fixture runtime | 422 test Java có DB đạt; 384 tổ hợp qua hai Client, cùng ID khác input vẫn đúng phiên; xem `18-B01-LINES-HANDOFF.md` | A01/A02 |
| B02 | DONE | Progress bước thật; JSON lỗi an toàn; vòng đời Run/deadline/disconnect; chặn SEND/SUBSCRIBE trái phép; Client reducer/Panel nhận tiến trình | Java có DB 429/429; Client 10/10; 1.546 progress + 387 terminal đúng; lỗi/reconnect/queue/timeout DB thật đạt. Xem `20-B02-PROGRESS-HANDOFF.md`; chưa có worker/idempotency N01 | B01 |
| S01 | DONE | Codex đối chiếu lượt hai theo sơ đồ và danh sách in, lưu CSV theo vị trí vòng tròn và biên bản; 64 tên VERIFIED có ngày/ghi chú duyệt | 64 tên/cặp quái/dãy hào khớp; đúng hash; reviewer nêu rõ cùng công cụ; bootstrap lặp không đổi metadata. Xem `19-S01-HEXAGRAM-NAME-REVIEW.md` | Bộ tên hiện có |
| S02 | DONE | Đã nhập/đối chiếu 30 cặp = 60 ánh xạ Can Chi→hành từ PDF11; V6 metadata, manifest/hash, bootstrap và audit | 60 ô + TT-NGU-HANH VERIFIED đúng phạm vi; không duyệt mô tả nạp âm; hai lượt cùng Codex ghi rõ giới hạn. Xem biên bản 22 | A02 |
| S03 | DONE | Đã khảo sát ảnh scan; lập 13 mục nguồn và 64 dòng nghĩa tên ứng viên; ghi input/cách tra/coverage/xung đột | Tài lộc PDF41-42, tình duyên chung PDF63-67, 64 nghĩa tên PDF269-271; kiểm hash/khóa/trang đạt. Chưa nhập/VERIFIED lời luận. Xem biên bản 24 | Bản PDF gốc |
| C01 | DONE | Cố định Time4J 5.9.4 ở build time, sinh/pin bảng UTC+7; Dương↔Âm/Can Chi, hai API; V8 nguồn ngoài sách và biên bản duyệt | 73.049 ngày khứ hồi, 48.213 ngày cross-check cùng thư viện và 16 ca HKO riêng; kiểm REST/DB/metadata. Không khẳng định lịch sử/Bát Tự; xem biên bản 26 | A01 |
| B03 | DONE | OBJECT_COUNT → registry bốn rule/bảng quái → ba quẻ/metadata/progress thật; MH-TRIGRAM duyệt có biên bản | 12/8→Dự/hỗ Kiển/biến Giải, hào 2; chu kỳ 24×12 và biên đạt; nguồn OBJECT_COUNT vẫn đa nghĩa | B01/A01 |
| B04 | DONE | TIME nối C01→Y/M/D/H→ba quẻ/progress STOMP; metadata năm rule và hai quyết định nhóm | 51.840 tổ hợp số học; 66 terminal/248 progress thật; ranh lịch/offset/nguồn/riêng tư và hồi quy đạt; MH-TIME vẫn BLOCKED_SOURCE_CONFLICT. Biên bản27 | B01/C01 |
| D01 | DONE | Đã chép/kiểm 51 giao điểm Số 11, 120 ô Số 13 và 12 đoạn; V7 giữ riêng nguồn/nhãn bảng và đoạn; nhập huyenco | 171 ô và 2 rule VERIFIED đúng phạm vi; sửa seed Thủy tháng 8; nhãn khác liên kết theo vị trí có biên bản. Bootstrap/guard/audit đạt; xem biên bản 25 | S02/S03 |
| D02 | DONE | Đọc hai lượt cùng Codex; nhập/duyệt 120 giao điểm Lộc, 60 ô LOVE/12 bài tám câu, 36 đoạn và đủ 12 mốc; V9 nguồn nhiều trang | Huyenco 447 ô/33 mục nguồn/12 rule VERIFIED; 455 Java/50 Python; bootstrap hai lần và tám chốt D02 đạt; audit 50/0 FAIL/1 PENDING (E01). Giữ khóa Lộc thiếu, nhãn khác/chữ mờ và 40 phút TEAM_DECISION; xem biên bản 29 | S03/C01 |
| D03 | DONE | TamTheService C01→Can Chi năm âm→hành S02→CAREER11/13, WEALTH, LOVE; snapshot JDBC nhất quán; kiểm từng row/metadata/trang; mở hai rule luận | 464 Java có DB; 263 terminal/1.034 progress Tam Thế thật, 24 fixtures/typecheck/12 guard Client và hồi quy Mai Hoa/B02 đạt. Khóa Lộc thiếu trả LOOKUP_NOT_AVAILABLE; không đổi DB/UI. F04 còn nghiệm thu TV1; xem biên bản 30 | C01/S02/D01/D02 |
| E01 | DONE | 64 nghĩa tên VERIFIED, V10 và importer idempotent; nhãn nguồn Ích/quẻ chuẩn Tỉnh được bảo tồn | Audit DB54/0 FAIL/0 PENDING, đúng phạm vi NAME_GLOSS và reviewer cùng công cụ; xem biên bản31 | S03/A02 |
| E02 | DONE | Hai GET tra quẻ, Unicode/tên/mã, lọc thượng/hạ, phân trang và chi tiết có nguồn | 470 Java DB/125 HTTP, TypeScript/27 fixtures đạt; huyenco không đổi, chỉ xuất NAME_GLOSS VERIFIED; xem biên bản32 | S01/E01 |
| H01 | DONE | V11 đã áp dụng huyenco; cookie owner/CSRF,5 REST,owner handshake và cache kết quả có giới hạn |480 Java DB,54 HTTP+8 terminal STOMP,2 HTTP không DB; restart/cách ly/quota đồng thời đạt; chỉ lưu snapshot thật; biên bản34 | A01/A02/B01 |
| N01 | TODO | Giữ mốc baseline LINES thật; thêm bounded executor và registry idempotency có giới hạn | Hàng đợi đầy/dedupe/khóa cùng ID khác payload/disconnect kiểm được; không rò bộ nhớ/nhận nhầm phiên | B01/B02 |
| I01 | TODO | TV2–TV3 bàn giao contract/fixtures/lỗi/progress; TV1 triển khai và tích hợp các màn hình | TV1 demo luồng UI thật sau mỗi module; sau E02/H01 có tra cứu/lịch/lịch sử; cập nhật bảng F01–F08 | Mỗi module tương ứng |
| T01 | TODO | Kiểm đầu cuối đủ F01–F08, dữ liệu nhạy cảm, reconnect, payload xấu, SQL/DB lỗi, timeout | Bảng đạt/chưa đạt gắn lệnh, kết quả và bằng chứng cụ thể; lỗi một phiên không làm hỏng các phiên khác | B/D/E/H/N/I |
| X01 | TODO | Benchmark direct/bounded: 1/5/20 Client, đo thật và phân tích | Raw CSV, môi trường, input, cấu hình, median/p95/throughput/lỗi/quá tải/sai phiên, script tái lập | N01/T01 tuyến LINES |
| R01 | TODO | Viết paper/README/kiến trúc/sequence/References/giới hạn/contribution từ kết quả thực | Report theo Instruction.md, đóng góp đúng người thực hiện; không điền kết quả chưa đo | Làm dần, chốt sau X01 |
| R02 | TODO | Chạy từ gói sạch/DB mới, diễn tập demo, Compilatio và đóng gói đúng Submission.md | Build/run/test trên bản đóng gói; báo cáo cuối đúng tên; nguồn/secret sạch; nộp trước hạn | T01/X01/R01 |

Không cần đợi hoàn thành toàn bộ dữ liệu trước B01/B02/N01 hoặc H01. S03 phải làm sớm vì nguồn tài lộc/tình duyên và lời giải 64 quẻ là rủi ro lớn nhất của phạm vi đầy đủ. Không đánh dấu E01 đạt bằng 64 tên hoặc 64 hình hào.

## 5. Mốc thực hiện từ 23 đến 31/10

| Ngày | Trọng tâm TV2 + TV3/Codex | Điểm cần TV1 tích hợp | Cổng cuối ngày |
| --- | --- | --- | --- |
| 23/10 | A01, bắt đầu A02/B01; khởi động S03 | Nhận mẫu response thật, thêm LINES nếu UI còn thiếu | Có kế hoạch/contract và phép LINES chạy service; biết vị trí rủi ro nguồn |
| 24/10 | Xong A02/B01/B02/B03; S01/S02 và kết luận khảo sát S03 | Ba quẻ/hào động, nguồn và progress | Có LINES + OBJECT_COUNT chạy mạng; danh sách nguồn thiếu rõ ràng |
| 25/10 | C01/B04; kiểm D01, bắt đầu D02 | Form thời gian, trang đổi lịch/Can Chi | TIME và lịch có ca chuẩn hoặc nêu blocker cụ thể; không dùng lịch giả |
| 26/10 | D01/D02/D03; E01/E02 theo nguồn đã khảo sát | Tam Thế từng category và trang tra quẻ | Chạy các tuyến có dữ liệu thật; F04/F05 còn thiếu phải liệt kê từng mục |
| 27/10 | H01/N01 và hoàn thiện phần dữ liệu đang chờ | Lịch sử, cookie, lỗi quá tải, reconnect | Lịch sử đúng owner; request trùng không tính lại; queue hữu hạn |
| 28/10 | T01/I01, đóng backlog F01–F08; bắt đầu X01 | Demo toàn luồng trên hai trình duyệt | Ma trận nghiệm thu F01–F08 và danh sách lỗi ưu tiên |
| 29/10 | Xong X01; R01: biểu đồ, discussion, novelty, references | Ảnh demo và phần Client | Có số đo thật tái lập được, paper bản đầu |
| 30/10 | Sửa lỗi chặn, R02 chạy gói sạch/DB mới; chuẩn bị Compilatio | Diễn tập và xác nhận thao tác UI | Đóng băng release candidate, đủ source/config/data/report |
| 31/10 | Hoàn tất Compilatio, đối chiếu bản cuối, đóng gói và nộp | Giải thích kiến trúc/message flow và demo | Mục tiêu nội bộ trước 20:00, hạn chính thức 23:59 |

Đây là lịch gấp: backend nghiệp vụ còn chủ yếu là khung. Không dành hết ngày cho dữ liệu rồi để phần mạng/thực nghiệm tới cuối. Mỗi ngày giữ một checkpoint chạy được; ưu tiên lỗi làm mất dữ liệu/sai kết quả/lộ lịch sử, sau đó mới sửa trình bày.

## 6. Cách phối hợp với TV1

| Gói giao nhận | TV2 + TV3/Codex giao | TV1 làm | Cách nghiệm thu |
| --- | --- | --- | --- |
| Mai Hoa/progress | JSON thành công/lỗi, ba dãy hào, step/sequence/source/basis | ResultPanel, sơ đồ ba quẻ, hiển thị quy ước nhóm và tiến trình | Cùng requestId, hào đúng chiều, kết quả hai phiên không lẫn |
| Lịch | Query/body và ví dụ đủ tháng nhuận, lỗi phạm vi | Màn đổi hai chiều và Can Chi | Ngày chuẩn đúng, không mất cờ nhuận |
| Tam Thế | categories, dữ liệu có nguồn, mã phần chưa đủ | Ba nhóm nội dung riêng, thông báo thiếu nguồn | Không hiện lời luận chưa duyệt; không trộn CAREER thành LOVE/WEALTH |
| Tra quẻ | Search/filter/pagination/detail và trạng thái nguồn | Danh sách/tìm/lọc/chi tiết | 64 mã, tìm dấu/không dấu, chi tiết nguồn đúng |
| Lịch sử | Phiên owner, cookie, CRUD, snapshot và lỗi | Nút lưu chủ động, danh sách/tìm/xem/xóa | Mở lại còn lịch sử; trình duyệt khác không truy cập được |

Thay đổi hợp đồng phải cập nhật `docs/02-API-CONTRACT.md`, `client/src/types/contract.ts` và ví dụ cùng một đợt. TV1 không phải đợi tác vụ import/check nguồn; có thể dùng fixtures có nhãn mock trong quá trình làm UI, nhưng demo nghiệm thu phải gọi Server thật. Không tự gửi tin nhắn hay coi TV1 đã nhận bàn giao khi chưa thực sự gửi.

## 7. Kiểm thử và thực nghiệm cần chứng minh

### Nghiệp vụ và dữ liệu

- LINES: toàn bộ 64 mẫu × 6 hào động; quẻ hỗ dựa vị trí 2–4/3–5; quẻ biến đổi đúng một hào.
- OBJECT_COUNT: giới hạn 1–999999 và 1–12; dư 0; ca 12/8; sai kiểu và số nguyên vượt kiểu Java không bị tràn/lọt validator.
- Lịch/TIME: ngày chuẩn từ nguồn độc lập có trích dẫn; Tết/năm âm khác năm Dương, tháng nhuận có/không, ngày không tồn tại, năm nhuận Gregorian/1900/2000, 22:59/23:00/00:00, thời điểm cùng instant khác offset. Kiểm vòng hai chiều chỉ là kiểm bổ sung.
- Tam Thế: đủ 60 khóa; đối chiếu tất cả ô bảng sử dụng; 12 mốc và 36 phần giờ không chồng/thiếu; giữ DAU/DAN tháng 5; nhiều kết quả nghề không bị rơi.
- Tra quẻ: phân biệt Bĩ/Bí, Ly/Lý, Càn/Cấn; Ký tế/Vị tế không đảo thượng/hạ; nội dung đủ nguồn và trạng thái duyệt riêng.

### Mạng và dữ liệu riêng tư

- Hai phiên và 20 Client, requestId giống nhau ở hai phiên vẫn độc lập; không subscribe được queue riêng của người khác.
- Request trùng khi đang chạy/khi đã xong/hết TTL; cùng ID khác payload; timeout, disconnect, queue đầy; registry không vượt giới hạn sau nhiều vòng.
- JSON hỏng, frame/payload lớn, thiếu field, số quá lớn, DB ngắt; trả lỗi phù hợp và Server phục hồi được. Không gửi trace/password/SQL cho Client.
- Owner A/B thử list/detail/delete/save chéo; cookie giả/hết hạn/thiếu; CSRF; tham số phân trang xấu; log không có token/ngày sinh/câu hỏi.
- Bootstrap vào DB trống và chạy lại bộ nhập; khởi động Server lại vẫn có dữ liệu/lịch sử hợp lệ.

### Thiết kế benchmark

So cùng tuyến **LINES thật**, cùng snapshot dữ liệu và phiên bản nghiệp vụ; baseline chỉ khác cơ chế điều phối, không so baseline trả lỗi với bản mới trả kết quả. Giữ một mốc Git có kết quả đúng trước khi thêm N01. Mỗi cấu hình chạy warm-up 10 giây và đo 60 giây, lặp ít nhất 3 lần ở 1/5/20 kết nối. Ghi mức request/giây thực tế và seed workload; dùng request ID mới cho phép đo thường, tách riêng bài request trùng. So latency kết quả thành công và phân bố lỗi riêng; không tính SERVER_BUSY như phản hồi thành công nhanh để kết luận cải tiến.

Lưu bản ghi request/response timestamps tại cùng máy Client đo, cấu hình phần cứng/hệ điều hành/JVM/DB, raw CSV, script và tổng hợp median/p95/throughput/error/busy/wrong-session. Cấu hình quá tải dùng workload có mô tả rõ; nếu có độ trễ giả lập, công bố là phép thử backpressure riêng. Chỉ viết contribution sau khi có mã và kết quả thực; kết quả không tốt hơn baseline vẫn phải báo đúng.

## 8. Xử lý rủi ro và điều kiện công bố hoàn thành

| Rủi ro | Hành động đã chốt |
| --- | --- |
| Không có bảng tài lộc/tình duyên hoặc quy tắc không đủ rõ trong hai sách | S03 làm ngay; ghi trang đã khảo sát và thiếu gì. Tiếp tục các tuyến khác; không tạo lời luận thay thế. Nếu không đáp ứng được, ghi F04 chưa đạt và cần giảng viên xác nhận điều chỉnh phạm vi; không tự coi tính năng bị bỏ |
| Hai sách không có đủ nội dung để luận riêng mọi quẻ | Phân biệt nghĩa tên/tri thức tra cứu với lời luận dự đoán. E01 lập bản đồ thật; thiếu phạm vi nào ghi rõ, không nhân bản một đoạn cho 64 quẻ để đủ số lượng |
| Lịch có sai khác theo múi giờ/thuật toán | Kiểm các ngày ranh có nguồn; cố định phiên bản và năm hỗ trợ. Không mở TIME/Tam Thế cho ngày chưa hợp lệ chỉ để demo |
| Một người kiêm hai vai trò, khó review độc lập | Hai lượt có lưu chứng cứ và nhận diện người/công cụ thực; không giả chữ ký hoặc tuyên bố hai reviewer |
| Không kịp UI | Bàn giao theo module hằng ngày, fixtures cùng contract; nghiệm thu Server và UI tách để nhìn rõ blocker, không coi API xong là cả F đã xong |
| V4 làm lỗi bootstrap DB mới | A02 sửa thứ tự target/seed trước; R02 bắt buộc kiểm trên DB trống, không chỉ thử database cá nhân đã có dữ liệu |
| Thời gian gấp | Không thêm chatbot/thanh toán/tài khoản nhiều vai trò. Giữ bản chạy được mỗi ngày và thời gian cho thực nghiệm/báo cáo; không âm thầm hạ yêu cầu F01–F08 |

Chỉ gọi **hoàn thành dự án** khi cả F01–F08 chạy đầu cuối theo hợp đồng/căn cứ đã công bố, kiểm thử đạt, dữ liệu có nguồn, quyền lịch sử được kiểm, concurrency/lỗi có bằng chứng, thực nghiệm có raw data, README/gói sạch chạy được và hồ sơ nộp đúng yêu cầu. Sau D02 còn một PENDING dữ liệu là E01; các service/UI/lịch sử/mạng chưa xong vẫn là task riêng, không suy hoàn thành sản phẩm từ số PENDING của kiểm toán dữ liệu.

## 9. Những thông tin bên ngoài còn cần trước khi nộp

Số nhóm, tên/mã sinh viên thực tế, phản hồi phê duyệt đề tài hoặc thay đổi phạm vi nếu có, link Drive do giảng viên thông báo, kết quả Compilatio và thao tác bàn giao USB/nộp bài. Các thông tin này không chặn việc viết mã trong workspace. Không tự đoán và không tự gửi tin cho giảng viên/TV1 hoặc nộp thay khi chưa được chỉ định.

Nguồn quy định: bốn file tại `C:/Users/abc/OneDrive/Desktop/final-project/`; danh mục chức năng `10-FUNCTIONAL-REQUIREMENTS.md`; hiện trạng nguồn `12-TV3-SOURCE-REVIEW.md`, `14-TV3-HEXAGRAM-NAMES.md` và báo cáo kiểm toán DB.

**Cập nhật hoàn thành A01 ngày 23/10:** hợp đồng v1.2, catalog 14 mã, registry tách policy/source, DTO/fixtures và cảnh báo UI đã có. Kiểm thử Java 21/21, TypeScript và 12 fixtures đều đạt. Đây là cơ chế hợp đồng, chưa có phép tính thật hoặc provider DB. Chi tiết tại `16-A01-CONTRACT-HANDOFF.md`.

**Cập nhật hoàn thành A02 ngày 23/10:** provider DB đã có; script bootstrap database trống và chạy lại giữ nguyên bản ghi; 26 test Java đạt, HTTP health/readiness đã kiểm với profile có/không DB. Kho dữ liệu sẵn sàng, nghiệp vụ vẫn chưa hoàn tất. B01 là tác vụ tiếp theo. Xem `17-A02-DATABASE-HANDOFF.md`; thông tin “chưa có provider DB” trong ghi nhận A01 là trạng thái lịch sử trước A02.

**Cập nhật B01 đêm 23–24/10:** LINES đã trả quẻ chủ/hỗ/biến thật qua STOMP, dùng hai rule VERIFIED và mã cấu trúc DB; tên chưa duyệt giữ null. 422 test Java có DB đạt; 387 phản hồi STOMP đúng gồm ma trận 384 và ca hai phiên/cùng ID/lỗi. Không có migration hay duyệt nguồn mới. B02 là tác vụ tiếp theo; ghi nhận “B01 tiếp theo/chưa có phép tính thật” trong các mốc A01/A02 là trạng thái lịch sử. Chi tiết tại `18-B01-LINES-HANDOFF.md`.

**Cập nhật S01 ngày 24/10:** 64 tên đã đối chiếu lượt hai và VERIFIED, reviewer ghi đúng Codex cùng công cụ; có manifest theo sơ đồ và biên bản `19-S01-HEXAGRAM-NAME-REVIEW.md`. V5 chỉ thêm metadata duyệt tên; các thuật toán khác giữ nguyên trạng thái. LINES đã trả tên thật, audit 0 FAIL/2 PENDING. Các số “3 PENDING/tên SOURCE_LOCATED” ở mốc cũ là lịch sử trước S01. B02 tiếp theo; B03 vẫn cần duyệt bảng số quái MH-TRIGRAM.

**Cập nhật B02 ngày 24/10:** progress thật và Client hiển thị đã có; deadline/dọn theo disconnect, JSON hỏng và truy cập broker trái phép đã kiểm. 429 test Java có DB, 10 test Client, 1.546 progress/387 terminal và timeout DB thật đạt; build Client đạt. Các ghi nhận “chưa progress” ở mốc A01/B01 là lịch sử. B03 tiếp theo trong chuỗi Mai Hoa; S02/S03 còn làm theo kế hoạch, N01 chưa có worker/queue/idempotency. Chi tiết `20-B02-PROGRESS-HANDOFF.md`.

**Cập nhật B03 ngày 24/10:** OBJECT_COUNT phía Server đã được kiểm qua chương trình Client STOMP; riêng MH-TRIGRAM được đối chiếu nguồn và VERIFIED với reviewer Codex cùng công cụ lượt hai. Công thức số vật giữ TEAM_DECISION/SOURCE_AMBIGUOUS. 12/8→Dự/hỗ Kiển/biến Giải, hào 2; chu kỳ chia dư/biên và cách ly hai phiên đạt. Fixture cập nhật từ runtime; ba thay đổi giao diện B03 đã hoàn tác theo nhắc nhở của chủ dự án, phần tích hợp UI thuộc TV1. Các ghi nhận “B03 tiếp theo/OBJECT_COUNT chưa chạy” trước đó là lịch sử. S02/S03 là các task nguồn tiếp theo, C01 mở đường cho B04; chưa coi TIME/Tam Thế/lịch sử hoặc UI I01 hoàn thành. Xem `21-B03-OBJECT-COUNT-HANDOFF.md`.

**Cập nhật S02 ngày 24/10:** đã chép/đối chiếu đủ 30 cặp = 60 ánh xạ Can Chi→hành từ Tam Thế PDF11/in12, nhập vào huyenco và VERIFIED từng ô + TT-NGU-HANH với phạm vi duyệt ghi rõ. Không duyệt mô tả nạp âm: dòng 28 có chữ mô tả bất nhất, biên bản giữ nguyên chứng cứ. V6 bổ sung metadata; bootstrap hai lần/4 chốt nguồn S02, 433 test Java có DB và 32 Python đạt. Audit 39 kiểm tra, 0 FAIL/2 nhóm PENDING; Số 11 vẫn 51 ô chưa duyệt. Không sửa giao diện; chưa có TamTheService/lịch đầy đủ. S03 tiếp theo; xem `22-S02-TAM-THE-YEAR-ELEMENTS.md`.

**Cập nhật S03 ngày 24/10:** hoàn tất ma trận 13 mục nguồn, 64 nghĩa tên ứng viên và hồ sơ hash/trang. Đã định vị WEALTH/LOVE, ghi nhận sai chiều công thức nghề Số 13, khóa tài lộc thiếu/nhiều kết quả và dòng Tỉnh in nhãn Ích. Kiểm hồ sơ chỉ đọc đạt; không nhập DB, không nâng VERIFIED hoặc sửa UI. Các mốc “S03 tiếp theo” ở phần lịch sử trước đó được thay bằng **C01 tiếp theo**. Chi tiết tại `24-S03-SOURCE-MAP.md`.

**Cập nhật D01 ngày 24/10:** sau S03, ưu tiên hoàn thành dữ liệu công danh theo yêu cầu tiếp tục công việc: đọc lại ảnh nguồn hai lượt cùng Codex; nhập/duyệt 171 ô và 2 quy tắc, gồm 12 đoạn Số 13; ghi riêng nhãn bảng/đoạn và căn cứ liên kết. `huyenco` đã sao lưu đầy đủ rồi áp dụng V7, có 231 ô tra/22 mục nguồn. 434 Java/38 Python, hai bootstrap giống nhau, 5 guard + 3 ca legacy D01 đạt; audit DB thật 42 kiểm tra/0 FAIL/2 PENDING. Không sửa giao diện TV1. Các ghi nhận “công danh chưa duyệt/D01 TODO” tại mốc trước là lịch sử. **C01 tiếp theo**, D02/D03/E01 chưa hoàn tất; chi tiết `25-D01-CAREER-DATA.md`.

**Cập nhật C01 ngày 24/10:** hoàn thành API lịch hai chiều/Can Chi, dữ liệu UTC+7 cố định 1900–2099 sinh từ Time4J 5.9.4 ở build time, pin hash và nguồn/giấy phép. Không lấy nguyên bảng HND cũ sau khi phát hiện khác biệt, không giả trang PDF cho thuật toán ngoài sách. Đã sao lưu huyenco rồi áp dụng V8 và biên bản LUNAR-CONVERSION. 447 Java có DB/41 Python/18 HTTP/16 fixtures đạt, audit 45 kiểm tra/0 FAIL/2 PENDING; hai bootstrap giống nhau/3 guard C01 đạt. **B04 tiếp theo**; không đánh dấu TIME, Tam Thế hoặc UI đã xong. Xem `26-C01-CALENDAR-HANDOFF.md`.

**Cập nhật B04 ngày 24/10:** TIME đã chạy ba quẻ thật qua STOMP với lịch C01, Y theo năm âm/Tết, ngày00:00/Tý23:00, tháng nhuận cùng số. Nguồn MH-TIME giữ BLOCKED_SOURCE_CONFLICT và TEAM_DECISION; thêm DEC-20261024-B04-CIVIL-TIME, không nâng VERIFIED hoặc thêm migration. 454 Java có DB/41 Python/17 fixtures/typecheck/11 test Client đạt; TIME66 terminal/248 progress, hồi quy LINES/OBJECT_COUNT/B02 đạt; audit DB thật45/0 FAIL/2 PENDING. **D02 tiếp theo**, UI TV1 và nghiệm thu toàn sản phẩm còn việc. Xem `27-B04-TIME-HANDOFF.md`.

**Hoàn thành E01 ngày 25/10 (DONE):** Đã lập biên bản 64 nghĩa tên ngắn từ Mai Hoa PDF 269–271 (trang in 276–278), tạo `data/e01_hexagram_gloss_review.csv` và manifest SHA-256, migration V10, importer và PowerShell `scripts/import_e01.ps1`. Người dùng chạy script đủ 6/6 bước trên PostgreSQL `huyenco`, tạo backup toàn DB trước schema, áp dụng V10, nhập 64 mục `SOURCE_LOCATED`, nâng đủ 64 `NAME_GLOSS` lên `VERIFIED` rồi chạy lại thành công (idempotent). Báo cáo DB thực tại `scripts/generated/tv3_audit_report.md`: **54 kiểm tra, 0 FAIL, 0 PENDING**, cả 5 kiểm E01 PASS. Quẻ thứ 48 giữ nhãn in `Ích` nhưng mã chuẩn `H_KHAM_TON`/tên `Tỉnh` và nghĩa `Giếng nước`. Reviewer là Codex lượt hai cùng công cụ, không được nhầm với xác minh độc lập bởi con người. Phạm vi DONE chỉ là nghĩa tên ngắn, chưa bao gồm lời luận từng hào hoặc API tra quẻ. Chi tiết `docs/31-E01-HEXAGRAM-GLOSSES.md`. **Task tiếp theo: E02 — API tra cứu quẻ.**
