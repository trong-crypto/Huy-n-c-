# D03 — bàn giao TamTheService cho TV1

Hoàn thành phần Server ngày **25/10/2026**. TV2 + TV3/Codex triển khai; giao diện thuộc TV1. Không có migration, import hoặc thay đổi trạng thái VERIFIED trong D03. Dữ liệu dùng S02/D01/D02 và lịch C01 đã được duyệt trước đó.

## 1. Luồng đã chạy

STOMP `SEND /app/tam-the/calculate`, nhận `/user/queue/progress`, `/user/queue/results`, `/user/queue/errors`. Giữ hợp đồng **v1.2**. Request gồm `birthDate`, `birthTime`, `calendarType`, `isLeapMonth`, `categories?`; xem các fixture trong `docs/examples/`.

1. Kiểm đầu vào nghiêm ngặt, ngày Dương/Âm thực sự tồn tại và phạm vi quy đổi Dương 1900–2099 của C01.
2. Đổi lịch C01, lấy Can Chi **năm âm**; năm đổi tại Tết, không dùng bảng tuổi cố định neo 1969.
3. Đọc các rule và bảng cần cho category yêu cầu trong **một transaction PostgreSQL READ ONLY, REPEATABLE READ**. Query dùng tham số bind, timeout 3 giây từng statement, đóng kết nối sau khi đọc.
4. Cấp quyền từng rule theo snapshot, kiểm VERIFIED/metadata của từng bản ghi, đúng hash/trang nguồn, số lượng/khóa bảng và đủ trang nối. Mất dữ liệu bảng không được giả thành “không có kết quả”.
5. Tra hành mệnh bằng 60 khóa S02; tra category theo Can năm/hành mệnh + tháng âm.
6. Chỉ trả COMPLETED khi tất cả category được yêu cầu có kết quả; bổ sung đầy đủ nguồn của bảng và đoạn vào từng entry, từng rule và hợp nguồn toàn kết quả.

`birthTime` được kiểm đúng HH:mm nhưng **không làm thay đổi ba tuyến chung CAREER/WEALTH/LOVE**, vì các bảng này dùng năm và tháng. D03 không gọi bảng giờ theo mùa/36 phần hoặc thêm category ngoài hợp đồng. Tháng nhuận lấy số tháng do C01 trả để tra cùng cột bảng; không tạo lời luận riêng cho tháng nhuận. Ngày/giờ sinh không được echo trong response, lưu vào DB hay ghi log bởi luồng mới.

## 2. Kết quả từng nhóm

| Category | Cách tra | Thứ tự/kết quả |
| --- | --- | --- |
| CAREER | Số 11: hành + tháng; Số 13: Can năm + tháng | Mọi nghề Số 11 theo thứ tự Mua bán, Câu/chài, Làm thợ; sau đó một đoạn Số 13 |
| WEALTH | Tìm mọi cột có tháng nhập trong hàng Can năm của PDF41 | Hai đoạn Lộc theo thứ tự cột, hoặc lỗi nếu khóa không có trong bảng |
| LOVE | Hành mệnh + tháng trong bảng nam nữ chung PDF64 | Một bài thơ tám câu, có đủ nguồn của các trang nối |

Số 11 chỉ là bảng nghề, không có đoạn văn luận: content được ghi rõ **“Bảng Số 11 ghi nghề: ….”** để phân biệt câu tóm tắt bảng với nguyên văn lời luận. Số 13/WEALTH/LOVE dùng nội dung đã nhập. Khi nhãn bảng khác tiêu đề đoạn (không chỉ khác chữ hoa/thường), title giữ nhãn bảng và thêm `(đoạn: …)`; không sửa hai tên thành giống nhau. Chữ mờ `[CHU_MO]` của Hưởng Lộc vẫn được giữ theo biên bản D02.

Nguồn tài lộc chỉ có **60/120 khóa Can–tháng**. Ví dụ Giáp/tháng 1 có Hưởng Lộc + Sát Lộc; Giáp/tháng 2 không có giao điểm. Trả **FAILED / RULE_NOT_AVAILABLE / ruleCode=TT-TAI-LOC / reason=LOOKUP_NOT_AVAILABLE**, `data=null` cho cả request nếu WEALTH được yêu cầu. Không trả riêng CAREER/LOVE như thể đủ ba mục, không đổi kết quả thiếu thành dự đoán xấu hoặc dùng bảng khác bù.

Số 11 có thể không có nghề ở một khóa; CAREER vẫn có đoạn Số 13, không kết luận người dùng không có nghề. Chỉ kiểm dữ liệu/nguồn của category được yêu cầu; LOVE lỗi nguồn không tự chặn CAREER riêng.

## 3. Hợp đồng và bằng chứng

- Bỏ `categories` → `[CAREER,WEALTH,LOVE]`; khi truyền thì giữ đúng thứ tự Client. Giá trị lạ/trùng/mảng rỗng bị từ chối.
- Catalog WEALTH/LOVE đã mở **SOURCE_VERIFIED**. YEAR dùng CALCULATION, các bảng luận dùng INTERPRETATION. Không đổi TEAM_DECISION thành nguồn VERIFIED để phát nội dung chưa duyệt.
- TamTheResult vẫn có `ruleVersion=1.0`, `ruleBasis=SOURCE_VERIFIED`, `sourceStatus=VERIFIED`, `rules`, `sourceReferences`, `decisionReferences`, `categories`. Không thêm trường ngoài DTO; `decisionReferences=[]` cho ba tuyến chung đã triển khai.
- CAREER chỉ cần C01 + TT-NGU-HANH + TT-CONG-DANH-11/13; WEALTH cần thêm TT-TAI-LOC; LOVE cần TT-TINH-DUYEN. Chỉ đưa rule sử dụng vào kết quả.
- Mỗi entry có `resultCode,title,content,sourceReferences`; nguồn gồm cả trang bảng và trang đoạn. Quan Đài/Suy/Tuyệt có đủ hai trang đoạn từ V9; không chỉ lấy trang đầu.
- Thêm reason **LOOKUP_NOT_AVAILABLE** vào Java, TypeScript và runtime guard dùng chung. Không sửa bố cục, trang, form, component hoặc hook nghiệp vụ UI của TV1.

## 4. Progress và lỗi

Thành công phát đúng bốn bước `ACCEPTED → VALIDATING → CALCULATING → LOOKUP`, sequence 1–4. Kiểm lịch, quyền nguồn, snapshot và cấu trúc bảng diễn ra ở VALIDATING. CALCULATING xác định hành/khóa, LOOKUP chọn/ghép nội dung từ snapshot. Các truy vấn snapshot được làm trước LOOKUP để có nguồn nhất quán; không giả đây là truy vấn diễn ra sau progress LOOKUP.

- Input/ngày/nguồn chưa được cấp quyền: chỉ tiền tố 1–2 rồi FAILED.
- Khóa tài lộc thực sự không có trong bảng: đã đi tới tra cứu, phát đủ 1–4 rồi FAILED với LOOKUP_NOT_AVAILABLE.
- Bản ghi chưa VERIFIED hoặc thiếu metadata review: RULE_NOT_AVAILABLE/SOURCE_UNVERIFIED hoặc MISSING_SOURCE_REVIEW.
- Thiếu bảng/khóa bắt buộc, mã sai, sai phiên bản dữ liệu, thiếu trang nối: KNOWLEDGE_DATA_INCOMPLETE.
- Không truy cập JDBC: DATABASE_UNAVAILABLE; không đẩy SQL/password/stack trace vào message.
- Deadline/disconnect dùng vòng đời Run B02, bỏ progress/kết quả muộn; chưa triển khai worker/idempotency N01.

## 5. Các tệp TV1 dùng ngay

| Fixture | Trường hợp |
| --- | --- |
| `tam-the.request/response.json` | Dương 10/2/2024 → âm 1/1 Giáp Thìn, đủ CAREER/WEALTH/LOVE |
| `tam-the-career.request/response.json` | Âm 1/10/1984: ba nghề Số 11 và một đoạn Số 13 |
| `tam-the-wealth.request/response.json` | Âm 1/1/1984: hai đoạn Lộc, không làm rơi kết quả thứ hai |
| `tam-the-love.request/response.json` | Âm 1/1/1984: Kim/tháng 1 → Tuyệt, trang bảng64 và đoạn66–67 |
| `tam-the-no-match.request.json` + `tam-the-unavailable.response.json` | Âm 1/2/2024: WEALTH không có khóa; không có kết quả một phần |

Tất cả response ở bảng trên chụp từ **Server thật qua STOMP**, requestId cố định. Fixture không được dùng thay service. TV1 hiển thị từng category/entry và nguồn, trình bày lỗi thiếu khóa; chỉ UI chạy thật mới nghiệm thu F04 đầu cuối.

## 6. Kết quả kiểm tra thực tế

- **464 kiểm thử Java có PostgreSQL đạt, không bỏ qua**, gồm chín ca D03: Spring wiring, ba category, alias/nhiều nghề, source page nối, category riêng, ngày Âm/Dương/tháng nhuận/Tết, 60 năm × 12 tháng (360 kết quả đủ ba mục, 360 lỗi WEALTH đúng), dữ liệu hỏng/chưa duyệt, outage an toàn.
- Bootstrap database trống hai lần giống toàn bộ bản ghi/metadata; mọi chốt nguồn S01/S02/D01/D02/C01/MH-TIME còn đạt; DB tạm đã xóa.
- Sau khi chụp fixtures, **7 kiểm thử Java DTO/context đạt**; 24 JSON fixtures khớp TypeScript, typecheck đạt, **12 kiểm thử guard/trạng thái Client đạt**.
- **263 terminal / 1.034 progress D03 STOMP đạt**: 120 khóa Can–tháng, 60 ô LOVE đủ năm hành, 60 năm Can Chi, category thứ tự khác nhau, tháng nhuận, input lỗi và hai phiên cùng ID khác input.
- Hồi quy STOMP/B02/reconnect/đích broker trái phép đạt; TIME 66 terminal/248 progress, LINES 387/1.546, OBJECT_COUNT 324/1.276 vẫn đạt.
- Khi kiểm trên `huyenco`, Server tạm bind localhost và **tắt Flyway**; đã so hash toàn bộ bảng trước/sau: dữ liệu/review giữ nguyên. Server tạm đã dừng. Không triển khai bản chạy dài hạn hay commit/push.

Lệnh tái lập:

```powershell
# Mật khẩu chỉ đặt trong môi trường tiến trình, không ghi vào file.
python scripts/test_a02_bootstrap.py
cd server
.\mvnw.cmd -B -ntp -Pdatabase package
cd ..
python scripts/smoke_d03_tam_the.py
```

Chạy kèm `--write-fixtures` chỉ khi muốn chụp lại các JSON sau kiểm. Kiểm tương thích trong `client`: `npm run check:contract`, `npm run typecheck`, `npm run test:calculation`. Bằng chứng cục bộ Git bỏ qua: `scripts/generated/d03_bootstrap.log`, `d03_smoke.log`, `d03_stomp.json`, `d03_database_unchanged.json`, `d03_fixtures_java.log`.

## 7. Trạng thái dự án

**D03 hoàn thành phần Server theo phạm vi dữ liệu đã công bố.** F04 còn tích hợp/nghiệm thu UI TV1; giới hạn thiếu 60 khóa WEALTH vẫn được báo đúng. Không coi ba category có service là database đã chứa mọi nội dung của cả hai sách.

Task tiếp theo theo kế hoạch là **E01: đối chiếu, duyệt và nhập 64 nghĩa tên quẻ** từ hồ sơ S03 (phân loại NAME_GLOSS, xử lý nhãn Tỉnh/Ích), rồi E02 mở API tra cứu. H01/N01, thực nghiệm và báo cáo vẫn còn; readiness toàn sản phẩm không được đổi thành hoàn tất chỉ vì D03 xong.
