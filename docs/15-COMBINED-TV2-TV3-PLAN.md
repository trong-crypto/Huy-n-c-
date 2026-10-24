# Huyền Cơ — Kế hoạch hoàn thành phần TV2 + TV3

Phiên bản 1.0, lập ngày 23/10/2026, múi giờ Asia/Ho_Chi_Minh. Hạn nộp theo `Submission.md`: **23:59 ngày 31/10/2026**. Các ngày dưới đây là mục tiêu thực hiện, chưa phải cam kết rằng chức năng đã hoàn thành.

## 1. Quyền quyết định và phân công mới

Chủ dự án hiện phụ trách cả TV2 và TV3, đã giao Codex quyền quyết định kỹ thuật để tiếp tục hoàn thành dự án. Codex triển khai Server, nghiệp vụ, dữ liệu, migration, kiểm thử, đo lường và tài liệu theo kế hoạch này; xử lý các lựa chọn kỹ thuật thông thường trong phạm vi đã giao mà không cần xin lại từng bước. **TV1 chịu trách nhiệm giao diện. Theo nhắc nhở sau B03, Codex không tự sửa trang, component, bố cục, biểu mẫu hoặc nội dung giao diện khi chưa có chỉ định riêng.** TV2–TV3 duy trì hợp đồng JSON/STOMP, kiểu dùng chung, fixtures và chương trình Client kiểm giao thức; bàn giao điểm tích hợp cho TV1.

Các yêu cầu F01–F08 vẫn giữ nguyên. Quyền quyết định triển khai không tự tạo ra bằng chứng nguồn sách, phản hồi giảng viên hoặc kết quả thực nghiệm. Tên người nhập/người kiểm trong dữ liệu phải phản ánh đúng người/công cụ đã thực hiện.

Kế hoạch này thay cách chia việc TV2/TV3 và các mốc còn lại trong tài liệu 08/09. Các quyết định nghiệp vụ đã chốt trước đó tiếp tục có hiệu lực.

## 2. Hiện trạng đã đọc trực tiếp — cập nhật sau S02 ngày 24/10

| Thành phần | Đã có | Còn thiếu |
| --- | --- | --- |
| PostgreSQL | Flyway V1–V6; 2 sách, 21 mục nguồn, 14 quy tắc, 8 quái; 12 mốc giờ; 111 ô tra (60 Can Chi + 51 công danh); 64 quẻ, 384 hào | Các bảng Tam Thế còn lại, nội dung tra cứu quẻ, schema lịch sử |
| Kiểm chứng | MH-TRIGRAM/MH-MUTUAL/MH-CHANGE/TT-NGU-HANH, 60 ô Can Chi→hành, 64 tên và riêng mốc tháng 5 VERIFIED; có giới hạn nguồn/reviewer trong biên bản | Mô tả nạp âm chưa duyệt; OBJECT_COUNT giữ đa nghĩa/TEAM_DECISION; các nguồn khác xem riêng |
| Mai Hoa | LINES và OBJECT_COUNT → registry/DB → STOMP, quẻ chủ/hỗ/biến và progress thật | TIME chưa có service/lịch; form LINES/sơ đồ và trình bày sản phẩm còn việc TV1/I01 |
| Tam Thế | Bản đồ một phần nguồn, seed; S02 đủ 60 ánh xạ hành đã duyệt | `TamTheService` vẫn chưa có implementation luận giải; thiếu các bảng S03/D01/D02, lịch và bộ tính D03 |
| Mạng | STOMP `/ws`, progress/kết quả/lỗi theo session, giới hạn message, deadline/disconnect, allowlist SEND/SUBSCRIBE | Queue/worker hữu hạn, idempotency, đo tải và các ca N01/T01 |
| Tra cứu, lịch, lịch sử | Thư mục/module dự kiến, mô tả API trong tài liệu | Chưa có các REST controller/service/repository tương ứng |
| Client (TV1) | Có khung trang Mai Hoa/Tam Thế và hook/Panel từ các đợt trước; B03 đã bàn giao hợp đồng/fixtures và kiểm Server qua Client STOMP | TV1 phụ trách tích hợp, nghiệm thu biểu mẫu/hiển thị, trang tra quẻ/lịch/lịch sử và sơ đồ |
| Kiểm tra gần nhất | S02: 433 test Java có DB, 32 Python đạt; audit 39 kiểm tra, 0 FAIL, 2 PENDING; bootstrap hai lần/4 chốt nguồn S02 đạt; các kiểm STOMP/Client B03 giữ là bằng chứng đợt trước | Chưa chứng minh TIME/Tam Thế/các REST, UI I01 và thực nghiệm đã hoàn thành |

Báo cáo kiểm toán: `scripts/generated/tv3_audit_report.md`. Hai PENDING còn lại là lời giải 64 quẻ và dữ liệu Tam Thế. Số bản ghi không thay thế điều kiện nghiệm thu chức năng.

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

Đối với TIME và OBJECT_COUNT, chốt **tách trạng thái nguồn khỏi quyền chạy theo quy ước nhóm**: cập nhật hợp đồng trước khi mở phép tính; bổ sung `executionPolicy` ở tầng quy tắc, gồm `DISABLED`, `SOURCE_VERIFIED`, `TEAM_DECISION`, cùng lý do/phiên bản. Giữ nguyên `verification_status` về nguồn. Kết quả chạy theo quyết định nhóm phải trả `ruleBasis`, `sourceStatus` và `decisionReferences`; UI ghi rõ “Theo quy ước nhóm; bản in có điểm chưa xác minh”. Không đổi SOURCE_AMBIGUOUS thành VERIFIED chỉ để vượt điều kiện runtime. Lời luận giải chưa xác minh vẫn không được phát ra. A01 đã có hợp đồng/registry/DTO, A02 đã nối DB, B01/B03 đã mở LINES/OBJECT_COUNT; TIME còn chờ C01/B04. Xem các biên bản 16–21.

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
| S03 | TODO | Khảo sát ngay mục lục và các mục tài lộc/tình duyên; lập bảng nguồn 64 lời giải; đánh dấu ô/chương có thể dùng | Ma trận category→quy tắc→input→trang→nội dung. Biết rõ chỗ nguồn không có/không đủ trước cuối 24/10 | Bản PDF gốc |
| C01 | TODO | Chọn/cố định thuật toán lịch có nguồn/giấy phép; cài Dương↔Âm và Can Chi; làm chuẩn độc lập | API lịch có khoảng năm, cờ nhuận; kiểm ngày Tết, đổi năm, nhuận, thế kỷ, ranh giờ; năm Can Chi khớp S02 | A01 |
| B03 | DONE | OBJECT_COUNT → registry bốn rule/bảng quái → ba quẻ/metadata/progress thật; MH-TRIGRAM duyệt có biên bản | 12/8→Dự/hỗ Kiển/biến Giải, hào 2; chu kỳ 24×12 và biên đạt; nguồn OBJECT_COUNT vẫn đa nghĩa | B01/A01 |
| B04 | TODO | Nối TIME→chuẩn hóa offset→lịch âm→chỉ số năm/giờ→ba quẻ | Cùng thời điểm khác offset cho cùng kết quả; ranh 23:00/00:00/Tết/nhuận đúng quy ước | B01/C01 |
| D01 | TODO | Chép và kiểm trực tiếp 51 ô Số 11, toàn bộ 120 ô Số 13 và phần giải nghĩa liên quan | So từng ô với ảnh nguồn; nhiều nghề không bị mất; công thức dịch vòng chỉ là tối ưu sau đối chiếu | S02/S03 |
| D02 | TODO | Kiểm đủ 12 mốc giờ, chép 36 phần giờ và các mục tài lộc/tình duyên đã tìm; xác định chính xác điều kiện tra | Nguồn cho từng mục; kiểm 05:19/05:20/07:19/07:20, ranh qua 0h, đầu/giữa/sau; không mặc định 40 phút là nguyên văn | S03/C01 |
| D03 | TODO | Tích hợp TamTheService theo từng category được yêu cầu; không dùng tuổi cố định bảng neo 1969 | CAREER/WEALTH/LOVE có ca thật riêng; mục yêu cầu chưa đủ trả RULE_NOT_AVAILABLE; không coi F04 đạt khi mới có CAREER | C01/S02/D01/D02 |
| E01 | TODO | Bổ sung trạng thái/editor/reviewer cho interpretations qua migration mới; nhập nội dung tra cứu thực có nguồn cho 64 quẻ | Đủ 64 mục tra cứu có nội dung phù hợp; truy vết từng đoạn; không hạ trạng thái bảng cũ/không sinh văn bản giả | S03/A02 |
| E02 | TODO | REST tra quẻ: tìm tên có/không dấu và mã, lọc thượng/hạ, phân trang, chi tiết | Không có mã trùng; tối đa page size 100; tên/nội dung chưa duyệt phân biệt rõ, không trình bày là đã xác minh | S01/E01 |
| H01 | TODO | Migration owner/session/history; phát cookie và registry kết quả có TTL; nối lưu/list/search/detail/delete | Xem lại sau khởi động Server; owner khác không đọc/xóa/lưu hộ; lưu chủ động, snapshot đúng nguồn/phiên bản | A01/A02/B01 |
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

Chỉ gọi **hoàn thành dự án** khi cả F01–F08 chạy đầu cuối theo hợp đồng/căn cứ đã công bố, kiểm thử đạt, dữ liệu có nguồn, quyền lịch sử được kiểm, concurrency/lỗi có bằng chứng, thực nghiệm có raw data, README/gói sạch chạy được và hồ sơ nộp đúng yêu cầu. Ba PENDING hiện tại cần được xử lý bằng nội dung và chứng cứ; không sửa công cụ kiểm toán để xóa cảnh báo cho đẹp báo cáo.

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
