# Huyền Cơ - Mở rộng lời luận chi tiết và độ bao phủ đầu vào

**Đã triển khai DB dự án26/10 theo yêu cầu chủ dự án:** huyenco đã backup/khôi phục thử, nâng V12 và nhập bộ đã duyệt; M03/D04 nghiệm thu trên chính DB đạt theo [43](43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md). Mọi dòng V11 giữ nguyên, dữ liệu mới khớp TEST. Các dòng chưa triển khai DB dự án bên dưới là mốc trước43. I02/T02 toàn sản phẩm vẫn còn làm.

**Ngày chốt yêu cầu: 26/10/2026. Chủ dự án yêu cầu bổ sung lời luận Mai Hoa chi tiết và luận giải cho mọi đầu vào hợp lệ trong phạm vi sản phẩm.** Tài liệu này bổ sung yêu cầu F09 và F04 mở rộng; thay giới hạn cũ coi nghĩa tên NAME_GLOSS hoặc lỗi thiếu khóa Lộc là đầu ra cuối cùng đủ cho sản phẩm mở rộng.

## 1. Sản phẩm cần trả gì

Với một yêu cầu Mai Hoa hợp lệ, người dùng nhận được ba quẻ/hào động/bước tính như hiện có, cộng với: xác định Thể và Dụng, hành của từng quái, quan hệ sinh/khắc/tỷ hòa có chiều, phân tích giai đoạn đầu/giữa/cuối, lời luận theo chủ đề, phần tổng hợp và nguồn của từng nhận định. Chủ đề gồm GENERAL (tổng quan), CAREER (công danh), WEALTH (tài lộc), LOVE (hôn nhân/tình duyên trong phạm vi nguồn).

Với Tam Thế, yêu cầu đủ CAREER/WEALTH/LOVE hợp lệ phải nhận đủ ba nhóm có nội dung truy nguồn. WEALTH mở rộng gồm các tiểu mục có tên riêng: Lộc, Sang hèn và Điền sản. Nếu bảng Lộc không có giao điểm, hiển thị đúng tình trạng đó và dùng các tiểu mục bổ sung đã duyệt; không gọi chúng là một kết quả Lộc bị thiếu trước đây. Đây là thay đổi nghiệp vụ được chủ dự án yêu cầu, cần contract và test mới trước khi mở runtime.

"Mọi đầu vào" được kiểm trong miền công bố: lịch Dương 1900-01-01 đến 2099-12-31, ngày âm đổi ra miền này, tháng nhuận hợp lệ; LINES sáu hào và một hào động 1-6; OBJECT_COUNT 1-999999 và hourIndex 1-12; TIME có offset; topic được hỗ trợ. Input sai, mất DB, thiếu nguồn hoặc lỗi hệ thống vẫn phải trả lỗi. Bao phủ không có nghĩa trả success giả cho những tình huống này.

Lời luận được ghép bằng quy tắc và nội dung đã duyệt, có diễn giải rõ điều kiện. Không dùng API AI hoặc tự bịa câu trả lời để lấp ô thiếu. Câu hỏi tự do là ngữ cảnh, không phải căn cứ để suy đoán nghề, người yêu, thời điểm hay sự kiện cụ thể. Các cụm thời gian trong câu hỏi như "năm sau" không tự trở thành thời hạn đã tính; nếu cần luận theo một thời điểm đích, phải đặc tả trường riêng.

**Tiến độ triển khai26/10:** M01/M02/**M03/D04 đã hoàn thành** trong phạm vi Backend theo [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md)/[42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md). Mai Hoa1536 tổ hợp logic/DB và Tam Thế720 tổ hợp DB/STOMP thật đạt, có lịch sử/owner/replay. WEALTH EXTENDED công bố no-match Lộc và trả hai phép bổ sung. Có62 fixtures/452 Client tests. **Tiếp theo I02/T02**; DB huyenco vẫn V11, TEST V12, UI thuộc TV1. Các mục khảo sát dưới đây giữ đúng trạng thái ban đầu S04, không thay lịch sử khảo sát thành VERIFIED.

## 2. Khảo sát S04 ban đầu

Đã mở ảnh trang đầy đủ của hai PDF đúng hash đang dùng. Hồ sơ máy đọc được: [s04_reading_source_survey.json](../data/s04_reading_source_survey.json). Trạng thái là **SOURCE_SURVEY_ONLY / runtimeApproval=false**, không phải dữ liệu mới đã VERIFIED. Ảnh làm việc ở `work/m01/`, không đưa scan vào Git.

| Phần | Trang PDF / trang in | Phát hiện và việc cần đối chiếu |
| --- | --- | --- |
| Thể/Dụng và quan hệ năm hành | Mai Hoa 131-135 / 137-141 | Đã định vị quy tắc quan hệ có chiều; một số câu dịch có lỗi chủ ngữ nên phải đối chiếu nguyên văn. |
| Cách chọn Thể theo hào động | Mai Hoa 224-225 / 231-232 | Ví dụ Cách có hào 1 động ở Ly bên dưới và Thể là Đoài bên trên. Chưa tìm được câu tổng quát cho sáu vị trí; ghi rõ là điểm chưa xác minh theo ấn bản. |
| Quẻ hỗ và biến theo giai đoạn | Mai Hoa 227-228 / 234-235 | Có phân chia Dụng/Hỗ/Biến và hai quái hỗ. Câu mở đầu bản dịch có điểm không nhất quán; chưa tự duyệt cách gộp. |
| Vượng/suy theo mùa | Mai Hoa 131,133 / 137,139 | Có quy tắc theo mùa và tháng Thìn/Tuất/Sửu/Mùi; cần quyết định lịch/thiếu thời điểm. |
| Luận công danh | Mai Hoa 156-157 / 162-163 | Đã định vị đủ năm quan hệ; có phân biệt dễ thành/chậm thành/hao tổn. |
| Luận tài lộc | Mai Hoa 158 / 164 | Đã định vị đủ năm quan hệ; không suy ra số tiền hay xác suất. |
| Luận hôn nhân | Mai Hoa 150-151 / 156-157 | Đã định vị đủ năm quan hệ; giới hạn theo việc hôn nhân, không phải lời hứa sự kiện tình yêu cụ thể. |
| Địa Chi và tháng sinh - Sang hèn | Tam Thế 43-44 / 44-45 | Bản chép ứng viên 12 Chi x 12 tháng = 144 khóa; một kết quả mỗi khóa. Cần kiểm lại ô mờ, Vong sát/Vong Thần và tiêu đề Thiên an. |
| Hành và tháng sinh - Điền sản | Tam Thế 49-50 / 50-51 | Bản chép ứng viên 5 hành x 12 tháng = 60 khóa; bảy nhóm kết quả. Cần giải quyết nhãn Phú/Phá và tham chiếu Số 6/Số 4. |

Đã ghi 20 đoạn diễn giải ứng viên Mai Hoa (4 chủ đề x 5 quan hệ), tách rõ bản diễn giải của dự án với câu trích nguyên văn. Những đoạn này chưa phải bộ 64 bài luận hoặc 384 lời hào chép từ sách. Luận chi tiết cho 64 x 6 tổ hợp có thể được sinh có cấu trúc từ quy tắc đã kiểm; nếu phát lời hào nguyên văn phải có nguồn và review riêng cho chính lời hào đó.

Phép kiểm `scripts/check_s04_reading_sources.py` chỉ kiểm hồ sơ, hash PDF tùy chọn và miền khóa của các bảng ứng viên. Số khóa đủ không chứng minh nội dung đúng bản in; không dùng nó để đổi trạng thái nguồn.

Lệnh đã chạy đạt từ repo root:

```powershell
python .\scripts\check_s04_reading_sources.py --pdf-dir "$env:USERPROFILE\Downloads"
```

Kết quả: hai PDF khớp hash, 7 mục nguồn Mai Hoa, 20 diễn giải ứng viên, 144 khóa Sang hèn và 60 khóa Điền sản; `runtimeApproval=false`, `databaseChanged=false`, `verificationPromoted=false`. Đường dẫn `--pdf-dir` có thể đổi theo nơi giữ hai bản gốc. Không cần chạy lại toàn bộ test Backend cho đợt chỉ thêm hồ sơ khảo sát này.

## 3. Các quyết định kỹ thuật

1. Giữ các công thức TIME chia6, OBJECT_COUNT theo số vật gốc và hiệu chỉnh giờ Tam Thế tháng5 đã chốt. Không yêu cầu xác nhận lại.
2. Nếu chưa tìm được câu tổng quát chọn Thể/Dụng, tách riêng quy tắc **tính toán** chọn phía không chứa hào động làm Thể, phía chứa hào động làm Dụng thành TEAM_DECISION có chứng cứ ví dụ; duyệt **nội dung luận** riêng theo SOURCE_VERIFIED. Kết quả tổng giữ dấu vết quy ước này, không nâng thuật toán chưa xác minh thành nguyên văn sách.
3. So từng quái hỗ với Thể gốc và công bố từng vai trò; không lấy trung bình điểm hoặc chọn tùy tiện một trong hai quái hỗ để tạo kết luận chắc chắn. Với quẻ biến, giữ Thể gốc và phân tích quái ở phía Dụng đã biến.
4. TIME có ngày lập quẻ; LINES/OBJECT_COUNT thiếu tháng hiện tại. Đặc tả `readingContext` trước khi dùng mùa; thiếu thời điểm thì trả phần quan hệ và nêu phần chưa xét, không tự lấy ngày máy. Nếu cần kết quả đủ cả mùa cho mọi phương pháp, UI/contract phải yêu cầu thời điểm rõ ràng.
5. API nhận chủ đề có cấu trúc. Triển khai tương thích với Client cũ bằng chế độ tính hiện tại và lựa chọn lời luận mở rộng; chốt DTO/fixtures trước khi TV1 tích hợp. Hợp đồng hiện tại không tự thay đổi trong S04.
6. Lộc dùng Can-tháng, Sang hèn dùng Chi-tháng, Điền sản dùng hành-tháng. Mỗi tiểu mục có rule/version, nhãn, nội dung và nguồn riêng. Những mâu thuẫn giữa tiểu mục được hiển thị, không gộp thành một phán quyết bằng điểm số tự nghĩ ra.
7. Tên sách, file hash, trang PDF/in, loại văn bản (nguyên văn/diễn giải), người nhập/người kiểm và ghi chú xung đột là bắt buộc. Hai lượt do cùng Codex thực hiện phải ghi đúng cùng công cụ, không gọi là hai người độc lập.

## 4. Công việc triển khai theo thứ tự

| Task | Trạng thái | TV2/TV3 thực hiện | Điều kiện hoàn thành |
| --- | --- | --- | --- |
| S04 | DONE phần khảo sát ban đầu | Định vị nguồn, chép bảng ứng viên, lập vấn đề và kiểm miền khóa | JSON/nguồn/144+60 khóa ứng viên được kiểm; chưa cấp quyền runtime |
| M01 | DONE phạm vi biên bản38 | Đã đọc lượt hai 18 trang nguồn, duyệt 20 mẫu Mai Hoa/19 đoạn Tam Thế và 204 ánh xạ; ghi 7 quyết định; chốt thiết kế hợp đồng39 | Hai lượt cùng Codex được ghi đúng; mâu thuẫn và quy ước không bị nâng thành chữ sách đã xác minh |
| M02 | DONE phạm vi40 | V12/importer/wrapper, DTO/validation/shared types/guards,44 fixtures; opt-in có chốt IMPLEMENTATION_UNAVAILABLE | TEST dữ liệu nhập lặp,492 Java+4 snapshot DB,441 Client/12 Node,13 terminal STOMP thật đạt. Service M03/D04 chưa mở; huyenco chưa đổi |
| M03 | DONE theo41 | `MaiHoaInterpretationService` và provider kiểm bundle/DB; cả ba phương pháp, bốn chủ đề/giai đoạn, nguồn và mùa có context; nối STOMP/H01 |1536 tổ hợp đạt qua logic/DB;15 terminal/42 progress/22 HTTP thật, bốn lịch sử và cách ly owner đạt. BODY/PHASES vẫn TEAM_DECISION/SOURCE_AMBIGUOUS; UI thuộc I02 |
| D04 | DONE theo42 | Service EXTENDED có ba tiểu mục, metadata coverage và liên kết biên tập; đọc dữ liệu nền/bổ sung cùng snapshot, không đổi Lộc |720 tổ hợp qua JDBC/STOMP đạt,360 Lộc có/360 no-match vẫn đủ ba category;737 terminal/2928 progress/27 HTTP/năm history thật, nguồn lỗi và LEGACY đạt |
| I02 | TV1 | Thêm chọn chủ đề/thời điểm, trình bày lời luận/giai đoạn/nguồn/xung đột và tiểu mục Tam Thế | UI dùng DTO mới, không tự tính hoặc tạo lời luận; Client cũ tiếp tục chạy tuyến cũ |
| T02 | TODO | Kiểm DB TEST, REST/STOMP, nguồn thiếu, dữ liệu lỗi, owner/history/replay N01 và phiên bản Client cũ/mới | Có bảng ca chuẩn, lỗi, raw evidence; 0 khóa hợp lệ thiếu nội dung do dữ liệu trong phạm vi mới |

TV2/TV3 chịu trách nhiệm M01-M03/D04/T02; TV1 chịu I02. Khi cần thay shared TypeScript/fixtures, TV2/TV3 bàn giao contract và dữ liệu mẫu; không tự sửa UI TV1. T01 của bản nền và việc dựng DB TEST vẫn có thể làm trong lúc chuẩn bị phạm vi mở rộng.

## 5. Phương án database và triển khai

- Giữ V1-V11 đã áp dụng; không sửa nội dung migration cũ.
- M02 thiết kế bảng mẫu luận Mai Hoa theo `topic + relation + rule_version`, metadata review và nguồn. Không tạo 384 dòng giống nhau để gọi là đã chép 384 lời hào.
- Quyết định triển khai M02: dùng `tam_the_supplement_results`/`tam_the_supplement_mappings` và bundle review riêng, thay phương án có thể tái dùng bảng cũ. Giữ nguyên catalog/bảng tra cũ trong lúc triển khai phiên bản mới. Audit bản nền không được dùng để khẳng định phạm vi mới đã đầy đủ; đã có bộ kiểm M02 riêng.
- Tạo database TEST riêng, backup đầy đủ trước thay đổi DB đã có dữ liệu; chạy migration/import ở TEST trước. Chỉ áp dụng `huyenco` sau khi kiểm lặp, rollback/guard và ca nghiệp vụ đạt. Credentials vẫn ở biến môi trường.
- Chỉ đổi policy runtime khi bản ghi nguồn và review tương ứng có thật; không mở `MH-THE-DUNG` chỉ vì đã thêm Java class hoặc đủ số test.
- H01 lưu snapshot DTO mới cùng nguồn; kết quả cũ vẫn đọc lại được. N01 tiếp tục phân biệt payload/topic để không replay kết quả của một chủ đề sang chủ đề khác.

## 6. Ma trận nghiệm thu bắt buộc

| Nhóm | Miền kiểm/điều kiện |
| --- | --- |
| Mai Hoa | 64 quẻ x 6 hào động x 4 chủ đề = 1536 trường hợp cấu trúc; kiểm cả vị trí 3/4, năm quan hệ và phase đầu/giữa/cuối |
| Ngũ hành | 25 cặp có chiều; 8 quái ánh xạ đúng hành; đảo Thể/Dụng không được giữ cùng quan hệ sinh/khắc |
| Mùa | Đủ 12 tháng và các ranh đã công bố; thiếu context, nhuận, khác offset; không tự lấy thời gian máy |
| Tam Thế | 60 Can Chi năm âm x 12 tháng = 720 nhóm năm-tháng cho mọi category; nhiều kết quả/không có Lộc phải được bảo tồn |
| Nguồn | Thiếu reviewer, trang, đoạn nối, hash sai, DRAFT, policy không cho phép: không phát lời luận như đã xác minh |
| Hợp đồng | Input mới hợp lệ/sai; Client cũ; không biến nội dung câu hỏi thành mã rule hoặc SQL; cùng ID khác topic bị N01 phát hiện |
| Lịch sử/mạng | Lưu/xem/xóa DTO cũ/mới đúng owner; 20 phiên, timeout/queue/replay/reconnect, progress và mỗi nhận định đều truy nguồn |

Kiểm 1536 cấu trúc không thay kiểm số học TIME/OBJECT_COUNT và miền lịch; tái sử dụng các bộ chuẩn đang có rồi bổ sung ca chi tiết. Test một bảng chép không phải lượt đối chiếu sách độc lập.

## 7. Thứ tự ưu tiên và lịch mục tiêu

Ngày 26/10 ưu tiên M01 và chốt contract; 27/10 M02/M03 và D04; 28/10 I02/T02; 29/10 X01 và báo cáo; 30/10 chạy gói sạch/R02; 31/10 đối chiếu và nộp. Đây là lịch mục tiêu, không phải tuyên bố các task đã hoàn thành. Khi một phần nguồn còn mơ hồ, giữ phạm vi và ghi blocker cụ thể; không làm giả dữ liệu để đáp ứng lịch.

**Bước tiếp theo: I02 — TV1 tích hợp UI, và T02 — TV2/TV3 nghiệm thu cùng Client mới.** M03/D04 đã sinh kết quả thật theo41/42; huyenco vẫn V11, TEST V12. Chưa tự áp dụng V12 vào DB dự án hoặc coi các kiểm Backend đã thay nghiệm thu giao diện, tải/mạng và toàn sản phẩm.
