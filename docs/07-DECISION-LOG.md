# Nhật ký quyết định

## Xác nhận chủ dự án — MH-TIME chia6 đã duyệt

Chủ dự án nhắc lại quyết định đã chốt: dùng tổng chia6, dư0→6. Ghi nhận **MH-TIME 1.0 VERIFIED trong phạm vi quy tắc dự án**, giữ bản in/trang nguồn và ghi đúng reviewer là chủ dự án xác nhận qua hội thoại, Codex ghi nhận. Không chờ thêm xác nhận hoặc ấn bản khác. Chính sách TEAM_DECISION giữ căn cứ hiệu chỉnh và quy ước dân sự; trạng thái nguồn phát ra của TIME là VERIFIED khi các rule phụ thuộc đã duyệt. Xem `28-TIME-OWNER-APPROVAL.md`; mục này thay quyết định giữ BLOCKED/chưa VERIFIED trong lịch sử phía dưới.

## Bổ sung B04 - 24/10/2026

**DEC-20261024-B04-CIVIL-TIME:** trong quyền quyết định TV2–TV3 đã giao, chốt TIME dùng UTC+7 cố định của C01; năm âm đổi tại Tết, ngày dân sự đổi00:00, Tý23:00–00:59; tháng nhuận dùng cùng số tháng và giữ cờ nhuận. Quy ước này được ghi riêng trong catalog/decisionReferences; không nhận là sách đã đặc tả đầy đủ múi giờ/lịch sử/nhuận.

- Đã mở lại ảnh PDF43–45/in48–50 của Mai Hoa: công thức năm/tháng/ngày, cộng giờ và bảng chỉ số được giữ, câu cuối PDF45 vẫn xung đột chia8/6. Quyết định chia6 từ22/10 tiếp tục có hiệu lực. **Không nâng MH-TIME VERIFIED**; kết quả tổng TEAM_DECISION/BLOCKED_SOURCE_CONFLICT, có nguồn lịch C01 riêng.
- Phạm vi kiểm sau chuẩn hóa ngày sang UTC+7, không dựa năm thô trong chuỗi input. Không echo datetime thô/question; lunarDate và các bước số học được trả theo hợp đồng. Tháng nhuận cùng số tháng là quyết định triển khai, không tự sửa trang scan.
- TIME đã được nối vào service/registry/DB/STOMP; giữ envelope1.2, thêm fixture runtime và TIME_NUMBERS theo DTO đã có. TV1 nhận cảnh báo/cờ nhuận/ba quẻ/nguồn để tích hợp; không sửa giao diện.
- 454 Java có DB/41 Python/17 fixtures/typecheck/11 test Client đạt; 51.840 tổ hợp số học và TIME66 terminal/248 progress thật; LINES/OBJECT_COUNT/B02 hồi quy đạt. Audit DB thật45/0 FAIL/2 PENDING. B04 không thêm migration hoặc duyệt DB; D02 tiếp theo. Xem `27-B04-TIME-HANDOFF.md`.

## Bổ sung C01 - 24/10/2026

- Chốt lịch tính UTC+7 cố định, Dương 1900-01-01…2099-12-31. Không phục dựng mọi lịch Việt lịch sử. Can Chi năm đổi tại Tết, ngày đổi tại 00:00, tháng nhuận giữ Can Chi tháng cùng số; không là Bát Tự tiết khí hoặc bảng giờ Tam Thế.
- Bảng HND 0.8 ban đầu có 120 ngày khác Time4J sau 1968, bắt đầu năm 2054, và khác biệt lịch sử trước 1968. Chọn sinh toàn bộ dataset bằng Time4J 5.9.4 astronomy + quy luật UTC+7; giữ bản tham chiếu, không sửa tay để làm test đạt. Ghi rõ giới hạn mô hình thiên văn sát nửa đêm trong tương lai.
- Time4J ở test/build time, không đưa thư viện vào runtime; source/hash/giấy phép lưu manifest và THIRD_PARTY_NOTICES. Decoder/Can Chi dẫn HND, giữ notice phi thương mại phù hợp bài tập lớn.
- V8 lưu nguồn thuật toán ngoài sách riêng, không giả PDF. Đã sao lưu rồi duyệt LUNAR-CONVERSION đúng dataset trong huyenco; không thay trạng thái lời luận/quy tắc sách.
- 447 Java có DB, 41 Python, 18 HTTP và 16 fixtures/typecheck đạt; bootstrap hai lần giữ metadata, 3 guard C01 đạt, audit DB thật 45 kiểm tra/0 FAIL/2 PENDING. Đối chiếu Time4J là cross-check cùng thư viện; 16 ngày HKO là ca nguồn riêng, không dùng HKO UTC+8 cho mọi ngày Việt. B04 tiếp theo. Biên bản `26-C01-CALENDAR-HANDOFF.md`.

## Bổ sung D01 - 24/10/2026

Codex thực hiện hai lượt đọc ảnh trong quyền TV2/TV3 đã được giao; ghi đúng reviewer cùng công cụ, không ghi là hai người kiểm độc lập. Biên bản `25-D01-CAREER-DATA.md` lưu phạm vi, hash và kết quả áp dụng vào huyenco.

- Số 11: ảnh PDF32 ghi Thủy câu/chài **2,4,6,8,11**. Sửa lỗi nhập tháng 9 của seed thành tháng 8; chỉ loại ô legacy chưa duyệt nếu khớp toàn bộ dữ liệu cũ, không ghi đè ô đã duyệt/sửa khác.
- Số 13: đủ 120 ô bảng và 12 đoạn đã đối chiếu lại; dùng tra bảng tường minh, kiểm dấu trừ khớp toàn bảng. Bốn cặp nhãn khác được giữ riêng và liên kết biên tập theo thứ tự nguồn (`POSITIONAL_EDITORIAL_LINK`), không tự sửa thành cùng một tên.
- V7 chỉ bổ sung provenance đoạn/nhãn; duyệt qua biên bản/hash riêng. Đã sao lưu rồi nhập/VERIFIED 171 ô và 2 rule; không mở TamTheService hoặc sửa giao diện TV1.
- Kiểm toán DB thật: 42 kiểm tra, 0 FAIL, 2 PENDING. 434 Java/38 Python đạt; bootstrap hai lần không đổi dữ liệu/giờ duyệt, guard dữ liệu và ca legacy đạt. C01 tiếp theo; tài lộc/tình duyên, 36 phần giờ và nghĩa tên quẻ còn task riêng.

## Bổ sung S03 - 24/10/2026 (mốc khảo sát trước D01)

Codex thực hiện trong phạm vi TV2/TV3 đã được chủ dự án giao quyền quyết định. Đây là chốt hướng triển khai sau khảo sát ảnh, không là duyệt lời luận hoặc bật rule runtime. Chi tiết/ca nguồn tại `24-S03-SOURCE-MAP.md`.

- LOVE ban đầu dùng phần nam nữ chung cuối Tam Thế PDF63 và bảng PDF64, đoạn đến PDF67; hành mệnh + tháng âm, không bổ sung giới tính/người thứ hai. Các bảng riêng giới tính giữ là subrule khác.
- CAREER Số 13 dùng bản chép 120 ô PDF35; loại công thức dấu cộng cũ vì sai chiều tra. Công thức dấu trừ chỉ là ứng viên rút gọn cần đối chiếu đủ ô.
- WEALTH giữ tất cả giao điểm theo thứ tự; khóa không có hoặc nhãn chưa giải quyết phải báo chưa sẵn sàng, không tự điền/fallback sang nội dung khác chủ đề.
- E01 chuẩn bị nội dung NAME_GLOSS cho tra cứu 64 quẻ từ PDF269-271; không coi là 64 bài luận dự đoán. Giữ riêng nhãn Ích tại vị trí quẻ Tỉnh, không đổi mã/tên đã duyệt ở S01.

## Nhật ký trước S03

| Ngày | Quyết định | Lý do | Ảnh hưởng | Người duyệt |
| --- | --- | --- | --- | --- |
| 2026-10-22 | Khung JSON/STOMP v1.0 là baseline; hợp đồng P0 v1.1 bổ sung LINES | Cho ba thành viên làm song song, giữ envelope và định tuyến phiên | Client, Server, tài liệu | Quyết định triển khai tại `09-DECISIONS-TO-START.md` |
| 2026-10-22 | Hai bản PDF đã được định vị theo trang; chưa bật kết quả thật | Còn thiếu test, dữ liệu tra và review chéo | Mai Hoa, Tam Thế | TV2/TV3 review |
| 2026-10-22 | Giữ `NUMBER` hai số như hợp đồng cũ nhưng ẩn khỏi UI | Mục “số vật” của sách không chứng minh phép hai số; bước lấy hào còn mơ hồ | Client, API, Mai Hoa | TV2/TV3 chốt nguồn |
| 2026-10-22 | Tạm lấy hào động TIME theo chia 6 | Tr. 50 bản Mai Hoa in “trừ 8”, trái mục “Hào trừ 6” và nguyên văn trước đó | MH-TIME | TV2/TV3 đối chiếu ví dụ |
| 2026-10-22 | Giữ cờ xung đột cho dòng đầu tháng 5 | Bản Tam Thế in “Dậu” ở mốc 05:20 dù chuỗi tiếp là Mão…Mùi | TT-GIO-SINH | TV3/TV2 chốt trước nhập bảng |
| 2026-10-22 | Chọn `MAI_HOA`/`LINES` làm P0 | Quẻ hỗ và quẻ biến có quy tắc định vị tr. 46–48; tránh phụ thuộc lịch âm và xung đột của TIME | Client, API v1.1, Server, test | Quyết định triển khai theo yêu cầu chủ dự án; TV2/TV3 phải kiểm nguồn trước VERIFIED |
| 2026-10-22 | Không dùng PostgreSQL/Docker cho P0 | Tập trung chức năng mạng, đo lường và hạn nộp 31/10 | Build/demo, dữ liệu | Quyết định triển khai; giữ migration cho P1 |
| 2026-10-22 | Novelty dự kiến: worker pool/queue hữu hạn và idempotency trong phiên | Baseline hiện xử lý trực tiếp, chưa có kiểm soát tải/request lặp | TV2, benchmark, README, báo cáo | Chỉ công bố là đóng góp sau khi code, test và đo thật |
| 2026-10-22 | Khóa hợp đồng P0 ở `02-API-CONTRACT.md` v1.1 | Cho TV1/TV2/TV3 làm song song từ cùng request/response | Cả nhóm | Thay đổi tiếp theo qua PR kèm mock/test |
| 2026-10-22 | Chủ dự án yêu cầu F01–F08 đều có trong sản phẩm | Danh sách chức năng đầy đủ thay phân loại P1/P2 cũ | Client, Server, nguồn sách, lịch, 64 quẻ, lịch sử, kế hoạch | Xem `10-FUNCTIONAL-REQUIREMENTS.md`; LINES chỉ là lát cắt đầu, không phải đích cuối |
| 2026-10-22 | Mở rộng hợp đồng lên v1.2 theo từng chức năng, chưa coi quy tắc mới là VERIFIED | TIME/NUMBER, Tam Thế ba nhóm, tiến trình, tra cứu, lịch và lịch sử cần đầu vào/đầu ra rõ | TV1/TV2/TV3 đồng bộ mock, test và nguồn trước tích hợp | Không trả COMPLETED giả hoặc lưu lịch sử chưa có kiểm soát truy cập |
| 2026-10-22 | **Chốt** hào động Mai Hoa theo tổng chia 6, dư 0 thành hào 6 | Chủ dự án chọn cách cài nhất quán với mục “Hào trừ 6”; tr. 50 vẫn in “trừ 8” | TV2 dùng cho TIME và ghi xung đột bản in trong nguồn/test | Quyết định nhóm; toàn tuyến chỉ VERIFIED sau test/lịch và TV3 kiểm |
| 2026-10-22 | **Chốt** tháng 5 Tam Thế 05:20–07:19 là giờ Dần | Chuỗi sau đó là Mão…Mùi, bản in ghi Dậu | TV3 lưu cả chữ gốc Dậu và giá trị dùng Dần; test ranh giờ | Quyết định nhóm; TV2 kiểm toàn bảng trước VERIFIED |
| 2026-10-22 | **Thay** NUMBER hai số bằng `OBJECT_COUNT` | Chủ dự án chốt `objectCount`, `hourIndex`, phép chia 8/8/6 theo số vật gốc | TV1 form; TV2 validator/hàm; JSON mẫu và smoke test đổi theo v1.2 | Cụm “số quẻ” tr. 51 còn mơ hồ; chưa gọi công thức là VERIFIED theo bản in |
| 2026-10-23 | **Đã nhận xác nhận TV2** cho `MH-MUTUAL` (PDF 42), `MH-CHANGE` (PDF 41) và riêng mốc tháng 5 `TT-GIO-SINH-5` (PDF 14) | Chủ dự án thông báo TV2 đã xác nhận cả hai mục PENDING từ báo cáo kiểm toán: hai phép quẻ và ô giờ tháng 5 | Flyway V4 ghi `VERIFIED` cho đúng 2 quy tắc Mai Hoa và bản ghi **tháng 5**, lưu người kiểm là `TV2 (project owner confirmation)`; chữ gốc `DAU` và giá trị dùng `DAN` được giữ nguyên | Xác nhận gián tiếp qua chủ dự án ngày 23/10; chưa nhận tài liệu ký tay/nhật ký test riêng của TV2 |
| 2026-10-23 | Nạp 64 tên quẻ có nguồn vào 64 cấu trúc hiện có | Tên PDF 269–271/in 276–278, sơ đồ PDF 274/in 281; SHA-256 khớp bản cung cấp | `name_kind=CANONICAL_TITLE`, SOURCE_LOCATED; thêm 4 mục nguồn, không tạo lời luận giải | TV3 chép với hỗ trợ AI; TV2 chưa xác nhận bộ tên, xem `14-TV3-HEXAGRAM-NAMES.md` |
| 2026-10-23 | Gộp phụ trách TV2 + TV3; giao Codex quyết định và triển khai kỹ thuật | Chủ dự án nhận cả hai vai trò và yêu cầu kế hoạch tiếp tục | Kế hoạch `15-COMBINED-TV2-TV3-PLAN.md` thay phân công/mốc cũ; review hai lượt ghi đúng người thực; chốt lộ trình LINES → nguồn/lịch → nghiệp vụ → lịch sử/mạng → nghiệm thu/nộp | Chủ dự án ủy quyền trong cuộc trò chuyện; thay đổi trạng thái nguồn vẫn cần chứng cứ |
| 2026-10-23 | Hoàn thành A01: hợp đồng v1.2 và registry tách nguồn/quyền chạy | Triển khai quyền được giao trong kế hoạch TV2 + TV3 | Catalog 14 mã; ruleBasis/sourceStatus/decisionReferences; đóng quyền khi chưa có state DB; 21 test Java và 12 JSON fixtures đạt; chưa mở phép tính thật | Codex triển khai theo ủy quyền chủ dự án; xem `16-A01-CONTRACT-HANDOFF.md` |
| 2026-10-23 | Hoàn thành A02: JDBC/provider DB, probe kho dữ liệu và bootstrap DB trống | V4 cần seed có trước; registry cần trạng thái thật từ PostgreSQL | Giữ checksum V1–V4, bootstrap target V3 → seed → latest; starter JDBC thay JPA; 26 test Java, bootstrap hai lần và HTTP probe đạt; chưa mở nghiệp vụ | Codex triển khai/kiểm theo ủy quyền; không duyệt thêm nguồn, xem `17-A02-DATABASE-HANDOFF.md` |
| 2026-10-24 | Hoàn thành B01: phép biến đổi LINES thật qua STOMP | Hai rule MH-MUTUAL/MH-CHANGE đã VERIFIED; B01 không phụ thuộc lịch hoặc phép số Tiên thiên | Dùng registry và 64 cấu trúc DB; tên chưa duyệt giữ null; bổ sung KNOWLEDGE_DATA_INCOMPLETE; 422 test Java có DB và 387 phản hồi STOMP đúng, gồm ma trận 384 và hai phiên cùng ID khác input | Codex triển khai/kiểm theo ủy quyền trong đêm 23–24/10; không duyệt thêm sách, chưa nghiệm thu UI/toàn F03, xem `18-B01-LINES-HANDOFF.md` |
| 2026-10-24 | S01: duyệt 64 tên theo đúng bản scan và biên bản lượt hai | Hai PDF còn trên máy, hash khớp; đối chiếu tên chữ in PDF269–271 với sơ đồ PDF274, ghi nhận cách viết khác ở PDF500–501 | V5 thêm metadata; script có hash manifest, backup, transaction và bảo vệ reviewer; huyenco 64 tên VERIFIED; audit 0 FAIL/2 PENDING; tên đã xuất hiện trong LINES | Reviewer là Codex cùng công cụ lượt hai, không giả hai người kiểm độc lập; giới hạn ấn bản/nhãn viết tay được ghi trong `19-S01-HEXAGRAM-NAME-REVIEW.md`; không duyệt thuật toán khác/lời luận |
| 2026-10-24 | Hoàn thành B02: progress thật, vòng đời yêu cầu và Client | Phải thấy bước thực, kết quả đúng phiên và dừng chờ khi lỗi/deadline/disconnect | Giữ xử lý trực tiếp; scheduler 10 giây khóa kết thúc Run; UTF-8/JSON nghiêm ngặt; allowlist SEND/SUBSCRIBE; Client tổng 15 giây không auto resend; 429 test Java/10 Client, progress và timeout DB thật đạt | Không triển khai hay công bố worker/idempotency N01; không đổi nguồn/migration; xem `20-B02-PROGRESS-HANDOFF.md` |
| 2026-10-24 | B03: mở OBJECT_COUNT và duyệt riêng MH-TRIGRAM | Đối chiếu số quái PDF39–40, hành PDF23–24/35 và hình hào với mô tả PDF35/sơ đồ S01 | Tổng số vật gốc + giờ chia 6; registry bốn rule, tám quái/64 cấu trúc kiểm đủ; 12/8 → Dự/hỗ Kiển/biến Giải, hào 2; metadata quyết định không có field ngoài hợp đồng | Reviewer Codex cùng công cụ lượt hai; chỉ MH-TRIGRAM VERIFIED, OBJECT_COUNT giữ SOURCE_AMBIGUOUS/TEAM_DECISION; xem `21-B03-OBJECT-COUNT-HANDOFF.md` |
| 2026-10-24 | S02: duyệt 60 Can Chi→hành theo cột mạng Số 4 | PDF Tam Thế11/in12 có 30 cặp; hai manifest và hai lượt nhìn ảnh gốc | V6 thêm metadata; nhập 60 ô và TT-NGU-HANH VERIFIED; không nhập/duyệt mô tả nạp âm, ghi nhận dòng Mậu Ngọ/Kỷ Mùi in Hỏa nhưng mô tả cây lựu đá; không thay bằng sách khác | Codex cùng công cụ lượt hai, giới hạn được ghi rõ; 433 Java/32 Python, bootstrap lặp và 4 chốt nguồn đạt; không sửa giao diện TV1. Xem `22-S02-TAM-THE-YEAR-ELEMENTS.md` |
| 2026-10-24 | TV2 trả lời T2-D01…D13 cho TV1 | Đối chiếu câu hỏi Google Docs với code/DTO/fixtures hiện có | Client chờ 15s, Server Run 10s; connect riêng 10s là cấu hình TV1 cần thêm. N01 giữ TTL60s từ terminal, khóa chạy giữ tới kết thúc; không cache lỗi SERVER_BUSY chưa tiếp nhận. REST qua proxy cùng origin, owner cookie Path=/ và binding handshake thuộc H01 | Mới chốt/bàn giao các điểm thiết kế còn thiếu, không tuyên bố đã implement TIME/Tam Thế/REST/dedup/proxy; 18 JSON khớp TypeScript; không sửa giao diện hoặc Google Docs nguồn. Xem `23-TV2-CONTRACT-REPLIES-TO-TV1.md` |

Mọi thay đổi JSON, schema hoặc quy tắc phải có Pull Request cập nhật tài liệu, mock và kiểm thử trước khi merge.

Các dòng “chờ duyệt” là việc của nhóm, chưa được coi là quyết định học thuật hay xác minh nguồn. Khi chốt, thêm ngày, người duyệt và ca đối chiếu; không sửa mất nguyên trạng bản in.

**Giới hạn cập nhật ngày 23/10:** `TT-GIO-SINH` trong `calculation_rules` vẫn `BLOCKED_SOURCE_CONFLICT` cho **quy tắc tổng thể 12 tháng**, vì việc xác nhận riêng ô tháng 5 chưa chứng minh 11 tháng còn lại đã được TV2 kiểm đủ. Các phép `MH-TIME`, `MH-OBJECT-COUNT`, `MH-THE-DUNG`, tên 64 quẻ và nội dung luận giải giữ trạng thái trước đó.


## Mã quyết định dùng trong hợp đồng v1.2

**Ghi nhận triển khai D03 ngày 25/10:** TamTheService đã nối C01/S02/D01/D02 cho CAREER/WEALTH/LOVE, mở hai rule WEALTH/LOVE bằng SOURCE_VERIFIED và giữ kiểm từng bản ghi/nguồn. Đây là triển khai các cách tra đã chốt, không duyệt sách lại hoặc thay dữ liệu. CAREER gồm mọi nghề Số11 + một đoạn Số13; Số11 có câu tóm tắt ghi rõ là bảng, các đoạn giữ nguyên bản chép. Khóa Lộc không có trong nguồn trả RULE_NOT_AVAILABLE/LOOKUP_NOT_AVAILABLE cho cả request, không dùng fallback; birthTime kiểm định dạng nhưng không tác động ba bảng năm/tháng chung. Phản hồi thật, kiểm thử và phạm vi UI ở `30-D03-TAM-THE-HANDOFF.md`. Các dòng chưa triển khai D03 tại mốc cũ là lịch sử.

- `DEC-20261025-D02-EDITORIAL` (25/10, Codex theo ủy quyền TV2 + TV3): giữ nhãn bảng Bất lộc/Bịch lộc và tiêu đề Bối Lộc/Bịnh Lộc; liên kết theo thứ tự cột 3/11 trong chuỗi 12 mục. Một chữ mờ Hưởng Lộc lưu `[CHU_MO]`, không đoán. LOVE lấy đúng tám câu, loại tóm tắt in nghiêng. Hồ sơ hai lượt cùng công cụ ở `data/tam_the_d02_review.json`, biên bản 29; không tuyên bố review độc lập.
- `DEC-20261025-D02-HOUR-PARTS` (25/10, Codex theo quyền quyết định kỹ thuật đã giao): dùng Số 5 để kiểm giờ dù Số 8 dẫn “Số 4”; chia mỗi Chi 120 phút thành ba khoảng nửa kín 40 phút, quấn 24h ở độ chính xác phút. Giữ bản in Dậu và xác nhận TV2 dùng Dần tháng 5; PDF15 đêm tháng 11 in 3:40–5:30, triển khai 3:40–5:39 để tiếp 5:40, ghi rõ hiệu chỉnh. Catalog TT-GIO-SINH TEAM_DECISION; TT-36-PHAN SOURCE_VERIFIED chỉ duyệt nội dung, không duyệt 40 phút là chữ in. **D02 đã VERIFIED đủ bốn quy tắc và 12 mốc theo phạm vi**, thay tình trạng BLOCKED toàn bảng giờ của mốc 23/10 bên trên.

- `DEC-20261022-MH-TIME-MOD6`: quyết định ngày 22/10 chọn tổng chia 6 cho TIME; giữ chữ in trừ 8 ở PDF 45.
- `DEC-20261022-MH-OBJECT-COUNT`: quyết định ngày 22/10 dùng số vật gốc cộng hourIndex rồi chia 6; giữ ghi chú cụm “số quẻ” PDF 46 đa nghĩa.

A01 chỉ cấu hình hai quyết định này làm căn cứ phép tính; không nâng trạng thái nguồn và không cho phép áp dụng quyết định nhóm để tạo lời luận giải chưa kiểm.
