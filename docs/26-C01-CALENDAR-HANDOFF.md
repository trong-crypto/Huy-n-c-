# C01 — Lịch Âm–Dương và Can Chi

Ngày triển khai: **24/10/2026**. Phạm vi TV2–TV3, giao diện thuộc TV1. Đây là lịch tính theo mô hình/múi giờ đã cố định, không phục dựng tất cả lịch từng dùng ở Việt Nam trong lịch sử.

## 1. Quyết định triển khai

- Ngày Dương hợp lệ: **1900-01-01 đến 2099-12-31**, bao gồm hai đầu. Ngày Âm phải đổi ra ngày Dương trong khoảng này; một phần cuối năm âm 1899 được nhận cho các ngày đầu 1900. Không nhận toàn bộ năm âm 1899 hoặc 2099 ngoài phạm vi Dương.
- Múi giờ phép tính: **UTC+07:00 cố định**. `timezone=Asia/Ho_Chi_Minh` giữ nhãn trong hợp đồng v1.2, không áp dụng lịch sử offset của Java ZoneId. Ngày trước 1968 vẫn dùng UTC+7 theo quy ước sản phẩm; không tuyên bố giống lịch in lịch sử.
- Ngày đầu tháng là ngày địa phương chứa Sóc; tháng 11 chứa Đông chí. Khi có 13 tháng giữa hai tháng 11, tháng đầu tiên sau tháng 11 không có trung khí là tháng nhuận.
- Không gọi mạng khi xử lý request. Dataset 201 năm âm 1899–2099 được sinh trước, có hash và đóng gói cùng Server. Module thuần có thể dùng từ B04/D03; API nghiệp vụ vẫn yêu cầu trạng thái quy tắc từ DB.

## 2. Nguồn, phiên bản và giấy phép

**Thiên văn:** `net.time4j:time4j-base:5.9.4` (LGPL-2.1), chỉ ở test/build time. Jar SHA-256 `4676119f628d4ee1a11101d369c31bf065ee59541cdda1cd3d6fcbbbcedc193b`. Generator dùng [MoonPhase.NEW_MOON](https://javadoc.io/static/net.time4j/time4j-base/5.9.4/net/time4j/calendar/astro/MoonPhase.html), AstronomicalSeason.WINTER_SOLSTICE và [SolarTerm](https://javadoc.io/static/net.time4j/time4j-base/5.9.4/net/time4j/calendar/SolarTerm.html). Không chép thư viện vào mã ứng dụng hoặc chạy nó trên từng request.

**Quy luật lịch Việt:** [mô tả Hồ Ngọc Đức](https://www.xemamlich.uhm.vn/calrules.html). **Định dạng mã năm, decoder và Can Chi:** [thư viện 0.8 của tác giả](https://www.xemamlich.uhm.vn/JavaScript/amlich-hnd.js); giữ thông báo bản quyền/quyền dùng cá nhân phi thương mại trong `THIRD_PARTY_NOTICES.md`. Không coi đây là giấy phép thương mại chung. Can Chi được dùng theo ngày dân sự/tháng âm ở mục 4.

Nguồn được khóa tại `data/c01_calendar_source.json`: URL, snapshot JS gốc, hash jar, hash dataset và bản chép tham chiếu HND. Dataset runtime `server/src/main/resources/calendar/vn-fixed7-year-codes.csv` có SHA-256 **`48d0e58f613fe6151961ceb776b5bffd704c6edadb390e050b93bce33bb653f6`** (LF). Java kiểm hash lúc khởi tạo; script duyệt kiểm manifest/dataset trước khi cập nhật DB.

### Vì sao không dùng nguyên bảng HND 0.8?

Lượt đầu đối chiếu đủ ngày 1968–2099 phát hiện **120 ngày khác** giữa bảng cũ và module lịch Time4J, thuộc 2054/2072/2077/2085. Bảng cũ còn có các khác biệt trước 1968 do lịch sử/quy tắc của dữ liệu nguồn. Vì sản phẩm đã chốt UTC+7 cố định, không lấy bảng lịch sử làm lịch cố định và không sửa tay từng ô để làm test đạt.

Đã chuyển sang **sinh lại toàn bộ dataset bằng thiên văn và quy luật UTC+7**, giữ bảng HND tại `data/c01_hnd_reference.csv` để truy vết lựa chọn. Ví dụ độc lập: [HKO 2054](https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2054e.txt) ghi 7/5 là 30/3, 8/5 là 1/4. [Almanac của Fred Espenak](https://astropixels.com/almanac/almanac41/almanac2054gmt.html) đặt Sóc 7/5 khoảng 17:00 UTC, sát 00:00 ngày sau UTC+7. Dataset mới lấy **8/5/2054**, không lấy 7/5 như bảng HND cũ. Với các thời điểm tương lai sát nửa đêm, kết quả thuộc mô hình thiên văn/Delta-T đã pin; không phải bảo đảm mọi niên lịch tương lai sẽ dùng cùng kết quả.

## 3. Hai API đã triển khai

### POST `/api/v1/calendar/convert`

```json
{"calendarType":"LUNAR","year":2023,"month":2,"day":1,"isLeapMonth":true}
```

Trả envelope `{requestId,status,data,error}`, trong đó `data.solarDate="2023-03-22"`, `lunarDate` giữ cờ nhuận; có `timezone` và đầy đủ ResultEvidence. SOLAR buộc `isLeapMonth=false`. Bắt buộc tất cả năm/tháng/ngày/cờ nhuận, không ép chuỗi hoặc số thực thành số nguyên.

### POST `/api/v1/calendar/can-chi`

```json
{"date":{"calendarType":"SOLAR","year":2024,"month":2,"day":10,"isLeapMonth":false},"time":"23:59"}
```

Trả thêm `year/month/day/hour` dạng `{stem,branch}` bằng mã đã dùng trong seed (`GIAP`, `AT`, …, `TY`, `SUU`, …, `TI` cho Tỵ). Bỏ `time` thì `hour=null`; thời gian có mặt phải đúng `HH:mm` 00:00–23:59, không nhận null/giây/24:00.

Lỗi: HTTP400 `INVALID_INPUT` cho cấu trúc/kiểu/trường lạ/JSON hỏng hoặc trùng key; HTTP400 `INVALID_DATE` cho ngày không tồn tại, tháng nhuận sai, ngày 30 của tháng thiếu hoặc ngoài phạm vi. JSON UTF-8 tối đa 16.000 byte theo cổng controller; giới hạn này là kiểm ứng dụng sau khi Spring đã đọc body, chưa thay giới hạn ở reverse proxy. HTTP422 `RULE_NOT_AVAILABLE` khi thiếu duyệt hoặc source snapshot không khớp; HTTP503 `DATABASE_UNAVAILABLE` khi mất DB. Không trả SQL, URL kết nối, mật khẩu hoặc stack trace.

## 4. Quy ước Can Chi

| Thành phần | Cách tính / ranh giới |
| --- | --- |
| Năm | Dựa **năm âm** sau đổi lịch, đổi tại Tết; Can=(năm+6)%10, Chi=(năm+8)%12 |
| Tháng | Can=(năm âm×12+tháng âm+3)%10, Chi=(tháng+1)%12; tháng nhuận giữ Can Chi của tháng cùng số, cờ nhuận vẫn riêng |
| Ngày | JDN dân sự = LocalDate.toEpochDay()+2440588; Can=(JDN+9)%10, Chi=(JDN+1)%12; đổi ngày tại 00:00 |
| Giờ | Tý 23:00–00:59, Sửu 01:00–02:59, …; Can giờ=(Can ngày×2+chỉ số Chi giờ)%10. 23:xx dùng Can của ngày dân sự hiện tại, không tự cộng ngày |

Ví dụ 10/2/2024: năm Giáp Thìn, tháng Bính Dần, ngày Giáp Thìn; 23:59 giờ Giáp Tý. 9/2/2024 vẫn thuộc năm Quý Mão. Đây **không phải Bát Tự đổi tháng/năm theo tiết khí** và không thay giờ sinh Tam Thế Số 5 theo tháng. `VietnameseLunarCalendar.localDate(OffsetDateTime)` chuẩn hóa cùng thời điểm về UTC+7; B04 còn phải nối hàm này vào TIME.

## 5. Database và duyệt nguồn

V8 thêm `external_sources` và FK `calculation_rules.external_source_id`, cho rule VERIFIED dẫn nguồn sách **hoặc** nguồn thuật toán ngoài sách; không tạo trang PDF giả, không đổi checksum V1–V7. Repository đọc nguồn ngoài thành SourceReference có URL/version/hash, `pdfPage/printedPage=null`.

`verify_calendar_rule.py` chỉ duyệt `LUNAR-CONVERSION 1.0` từ DRAFT nguyên gốc hoặc giữ nguyên bản duyệt C01 chính xác. Chặn source/hash/reviewer khác và không thay `reviewed_at` khi chạy lại. Có transaction/lock/backup JSON; `import_all.ps1` đã nối bước này sau D01. Reviewer ghi Codex đúng công cụ thực hiện, không giả danh người kiểm độc lập. VERIFIED xác nhận phép tính/dataset trong phạm vi này; không duyệt sách tử vi, lời luận hoặc tính khoa học của dự đoán.

## 6. Kiểm chứng và bàn giao

- Kiểm khứ hồi đủ **73.049 ngày**, kiểm tháng đủ/thiếu, nhuận không tồn tại, phạm vi, năm thế kỷ 1900/2000 và hai đầu dataset.
- Sinh lại 201 mã năm từ astronomy phải khớp tuyệt đối dataset đã pin. So với VietnameseCalendar riêng của Time4J đủ **48.213 ngày 1968–2099**, gồm năm âm/tháng/ngày/cờ nhuận. Đây là **cross-check cùng thư viện thiên văn**, không gọi là nguồn độc lập.
- **16 ca HKO riêng** trong `data/c01_control_dates.csv`, có URL từng ca, trải từ 1901 đến 2099: Tết, năm 2000, nhuận tháng 2 năm 2023, nhuận tháng 11 năm 2033, ranh tháng 5/2054 và cuối phạm vi. Bổ sung ca từ nguồn quy luật HND: tháng 2 nhuận 2004 và ranh UTC+7 khác UTC+8. HKO là lịch UTC+8, chỉ dùng những ca đã kiểm không khác ngày theo múi giờ, không thay toàn bộ lịch Việt bằng lịch HKO. Generator và CSV ngày chuẩn cũng được khóa hash trong manifest.
- Kiểm REST thật qua MockMvc, gate nguồn/snapshot sai, mất DB, JSON/UTF-8/đầu vào sai và ranh Can Chi Tết/00:00/23:00. Kiểm bootstrap V8 hai lần và bảo vệ nguồn trước DB thật.

### Kết quả thực thi

| Cổng kiểm | Kết quả ngày 24/10/2026 |
| --- | --- |
| Java có PostgreSQL | **447 kiểm thử đạt**, 0 lỗi, 0 bỏ qua; gồm lịch/Can Chi, repository đọc nguồn ngoài sách và hồi quy luồng hiện có |
| Python | **41 kiểm thử đạt**, gồm phát hiện thay manifest/dataset, source hash/reviewer sai và kiểm toán |
| HTTP Server thật với huyenco | **18 ca đạt**: hai chiều, tháng nhuận, hai đầu phạm vi, JSON/UTF-8 lỗi, Can Chi, request song song; Server tạm đã dừng |
| Hợp đồng bàn giao | **16 JSON fixtures** khớp TypeScript, typecheck đạt; fixtures lịch chụp từ HTTP thật, chỉ cố định requestId |
| Database tạm | Bootstrap V8 hai lần có toàn bộ hàng/metadata duyệt giống nhau; **3 guard C01** chặn thay hash/URL/reviewer, các guard S02/D01 vẫn đạt; DB tạm đã xóa |
| Database huyenco | Đã áp dụng V8/biên bản C01 lúc **17:59 UTC+7**, có 1 external source và tổng 7 rule VERIFIED; 231 ô tra/22 mục nguồn sách giữ nguyên |
| Kiểm toán DB thật | **45 kiểm tra: 43 PASS, 0 FAIL, 2 PENDING** (lời giải quẻ và dữ liệu Tam Thế còn thiếu) |

Trước khi cập nhật huyenco đã sao lưu đầy đủ bằng `pg_dump -Fc`, kiểm danh mục bằng `pg_restore -l`: `scripts/generated/db-backups/before-c01-full-20261024-175842.dump`. Script duyệt còn lưu backup JSON riêng. Log: `c01_bootstrap.log`, `c01_python.log`, `c01_http.log`, `c01_http_result.json`, `c01_live_import.log`, `tv3_audit_report.md` trong `scripts/generated/` (ignored).

TV1 nhận hợp đồng/fixtures tại `docs/02-API-CONTRACT.md`, `docs/examples/calendar-*.json`; không cần triển khai lại phép lịch ở Client. Giao diện chưa được nghiệm thu từ các kiểm Server này. Nếu Server hiện có đã được mở trước cập nhật mã, khởi động lại theo cấu hình database để dùng hai API mới.

**B04 — nối TIME vào lịch và phép lập ba quẻ** là task kế tiếp, chưa được hoàn thành chỉ nhờ C01. F04 còn D02/D03, F05 còn E01/E02, lịch sử và thực nghiệm vẫn theo kế hoạch.
