# B04 — Mai Hoa theo thời gian: bàn giao Server cho TV1

**Cập nhật theo xác nhận của chủ dự án:** MH-TIME đã được duyệt **VERIFIED cho quy tắc dự án dùng chia6**; không còn chờ xác nhận lại. TIME trả TEAM_DECISION/VERIFIED; câu chữ bản in được giữ trong ghi chú nguồn. Biên bản `docs/28-TIME-OWNER-APPROVAL.md` thay các ghi nhận BLOCKED/chưa duyệt của MH-TIME ở mốc trước.

Ngày: **24/10/2026**. B04 hoàn thành phần Server/contract/kiểm STOMP. TV1 tích hợp giao diện; các quy tắc sách có trạng thái nguồn riêng.

## 1. Luồng đã triển khai

`TIME` → đọc datetime có offset → chuẩn hóa cùng thời điểm về **UTC+07:00 cố định** → C01 đổi ngày Dương sang Âm → lấy chỉ số Chi năm âm và Chi giờ → tính thượng/hạ/hào → đọc bảng quái → tạo ba quẻ → tra tên đã VERIFIED → trả kết quả riêng theo session.

- Phạm vi được kiểm **sau chuẩn hóa UTC+7**: 1900-01-01…2099-12-31. Ví dụ `1899-12-31T17:00:00Z` vẫn hợp lệ vì là 00:00 ngày 1/1/1900 tại UTC+7; `2100-01-01T10:59:00+18:00` vẫn thuộc ngày 31/12/2099 UTC+7.
- Năm âm đổi tại Tết; ngày đổi tại **00:00**, không tự cộng ngày ở 23:00. Tý 23:00–00:59; Sửu 01:00–02:59… Hợi 21:00–22:59.
- Tháng nhuận dùng **cùng số tháng 1…12** để cộng, giữ `isLeapMonth=true` trong kết quả; không cộng thành tháng 13 hoặc tự đổi sang tháng sau. Đây là quy ước triển khai được ghi riêng, không khẳng định sách đã đặc tả rõ tháng nhuận.
- Giữ nguồn/giới hạn của C01: UTC+7 cố định kể cả trước 1968, không phục dựng mọi lịch lịch sử. Giờ Mai Hoa không thay giờ Tam Thế Số 5 theo tháng.

## 2. Công thức và căn cứ

Đã mở lại ảnh sách Mai Hoa **PDF43–45 / trang in48–50** trong B04. PDF43–44 nêu năm/tháng/ngày cho quẻ trên, cộng giờ cho quẻ dưới và chia 6 lấy hào. PDF44–45 ghi số Chi năm/giờ Tý=1…Hợi=12. Câu cuối PDF45 vẫn in phép trừ 8 cho hào, được bảo lưu trong nguồn và rule DB.

Đặt Y=chỉ số Chi **năm âm**, M=tháng âm, D=ngày âm, H=chỉ số Chi giờ:

```text
dateSum = Y + M + D
timeSum = dateSum + H
upper = dateSum % 8, dư 0 -> 8
lower = timeSum % 8, dư 0 -> 8
movingLine = timeSum % 6, dư 0 -> 6
```

`Y = floorMod(lunarYear+8,12)+1`. Không dùng số năm Dương hoặc Can của năm thay Y. Thượng/hạ quái dùng đúng số Tiên thiên từ bảng đã duyệt, không coi số quái là thứ tự bit.

Ca 10/2/2024 00:00 UTC+7: âm 1/1/2024, năm Thìn=5, giờ Tý=1. Tổng 7/8 → thượng Cấn/hạ Khôn, hào2 → **Bác**, hỗ **Khôn**, biến **Mông**. Đây là **ca dựng từ công thức và ngày chuẩn**, không phải ví dụ ngày Dương được chép nguyên từ sách.

### Trạng thái nguồn vẫn được giữ riêng

| Quy tắc | Căn cứ chạy | Trạng thái nguồn |
| --- | --- | --- |
| LUNAR-CONVERSION | SOURCE_VERIFIED, đúng snapshot C01 | VERIFIED |
| MH-TIME | TEAM_DECISION — chủ dự án đã duyệt | VERIFIED trong phạm vi quy tắc dự án |
| MH-TRIGRAM / MH-MUTUAL / MH-CHANGE | SOURCE_VERIFIED | VERIFIED |

Kết quả tổng **TEAM_DECISION/VERIFIED**. Sau xác nhận lại của chủ dự án, MH-TIME đã VERIFIED trong phạm vi công thức dự án dùng chia6; ghi chú chữ in vẫn được giữ. Không tạo lời luận hay Thể/Dụng. Có hai decisionReferences: `DEC-20261022-MH-TIME-MOD6` (chia6) và `DEC-20261024-B04-CIVIL-TIME` (UTC+7/ngày/năm/giờ/nhuận). Quyết định mới nằm trong execution catalog và nhật ký07; không ghi đè trạng thái nguồn DB.

## 3. Hợp đồng cho TV1

Không đổi contractVersion **1.2** hoặc ruleVersion **1.0**. Gửi STOMP `/app/mai-hoa/calculate`:

```json
{
  "requestId":"550e8400-e29b-41d4-a716-446655440000",
  "type":"MAI_HOA",
  "payload":{"method":"TIME","datetime":"2024-02-10T00:00:00+07:00","question":"Công việc sắp tới"}
}
```

Phản hồi đã chụp tại `docs/examples/mai-hoa-time.response.json`; request tương ứng cùng thư mục. Kết quả có `lunarDate` thật (khác null ở LINES/OBJECT_COUNT), ba quẻ/tên đã duyệt, hào động, bằng chứng năm rule, nguồn lịch ngoài sách và nguồn Mai Hoa.

`calculationSteps` gồm **TIME_NUMBERS, MUTUAL, CHANGE**. `TIME_NUMBERS.values` có `lunarYear/lunarMonth/lunarDay/isLeapMonth`, `yearBranchIndex/hourIndex`, `dateSum/timeSum`, `upperTrigram/lowerTrigram/movingLine`, `utcOffset`, `dayBoundary`, `leapMonthPolicy`. Chỉ số năm/giờ Tý=1…Hợi=12. Các giá trị này nằm trong steps, không thêm `yearBranch/hourBranch` ở top-level ngoài DTO.

TV1 hiển thị cảnh báo quy ước nhóm, cờ tháng nhuận, ba quẻ/hào động và nguồn. Gửi ISO8601 có offset; không bỏ offset hoặc tự cộng UTC+7 vào chuỗi đã có offset. Hai chuỗi cùng instant cho cùng kết quả. Không hiển thị trạng thái nguồn xung đột như lỗi xử lý: request vẫn có thể COMPLETED theo TEAM_DECISION.

## 4. Progress, lỗi và riêng tư

- Thành công có **ACCEPTED → VALIDATING → CALCULATING → LOOKUP**, sequence1…4. VALIDATING gồm chuẩn hóa/kiểm lịch và các gate nguồn; CALCULATING là phần số học/quẻ, LOOKUP là tra mã/tên quẻ. Không chèn sleep tạo tiến trình.
- Thiếu/sai kiểu datetime hoặc trường lạ → INVALID_INPUT; ngày sai, thiếu offset, tràn khi chuẩn hóa hoặc ngoài phạm vi → INVALID_DATE. Không trả lỗi 500 cho năm cực trị được parse hợp lệ nhưng chuẩn hóa bị tràn.
- Thiếu nguồn/duyệt lịch, snapshot sai hoặc một rule không được phép chạy → RULE_NOT_AVAILABLE với ruleCode/reason; thiếu/sai bảng quái/quẻ → KNOWLEDGE_DATA_INCOMPLETE; mất DB → DATABASE_UNAVAILABLE. Không phát kết quả tính một phần.
- Toàn bộ năm gate nguồn phải qua trước khi đọc bảng quái/quẻ hoặc phát CALCULATING. Tên chỉ gắn khi bản ghi tên đủ điều kiện đã duyệt. Không tự mở quyền lời luận.
- `question` tối đa500 ký tự theo validator; không trả câu hỏi hoặc datetime thô trong kết quả/progress. `lunarDate` và các bước ngày âm cần cho việc kiểm phép tính được trả theo hợp đồng. Kết quả đi đúng session/requestId; B02 vẫn áp dụng deadline/disconnect và chặn broker queue trái phép. N01 chưa có dedup/worker/queue hữu hạn.

## 5. Kiểm đã chạy

| Kiểm | Kết quả |
| --- | --- |
| Java có DB | **454 kiểm thử đạt**, 0 lỗi/0 bỏ qua; gồm TIME service, Spring wiring thật, fixture runtime và hồi quy |
| Hàm số học TIME | **51.840** tổ hợp Y×M×D×H (12×12×30×12), kiểm số dư và bit độc lập cho ba quẻ; đây là miền số học, không khẳng định mọi tổ hợp đều là ngày lịch có thật |
| Ngày/giờ service | Cùng instant khác offset, 23:00/00:00/Tết, nhuận cùng số tháng, hai đầu phạm vi sau chuẩn hóa; nguồn thiếu/snapshot sai/JSON và năm cực trị bị chặn |
| STOMP TIME thật | **58 thành công + 8 lỗi = 66 terminal**, **248 progress**; 16 ngày HKO ×3 thời điểm + ca biên, hai phiên dùng cùng ID khác input; không lẫn phiên hoặc echo câu hỏi |
| Hồi quy STOMP | OBJECT_COUNT **324 terminal/1.276 progress**; LINES **387 terminal/1.546 progress**; smoke giao thức cũ và progress/error/reconnect/chặn SEND-SUBSCRIBE đạt |
| Hợp đồng | **17 JSON fixtures** khớp TypeScript, typecheck và **11 test Client** đạt; guard nhận TIME có lunarDate/nguồn ngoài sách; fixture chụp runtime, chỉ cố định requestId |
| Python / bootstrap | **41 Python đạt**; DB tạm bootstrap hai lần giống dữ liệu/giờ duyệt, guard S02/D01/C01 còn đạt; DB tạm đã xóa |

Log ignored trong `scripts/generated/`: `b04_unit.log`, `b04_bootstrap.log`, `b04_stomp.log`, `b04_time_stomp.json`, `b04_progress.log`, `b04_python.log`, `b04_client_guard.log`, `b04_live_audit.log`. Kiểm toán DB thật sau B04: **45 kiểm tra, 0 FAIL, 2 PENDING** (lời giải quẻ và dữ liệu Tam Thế còn thiếu). Server smoke chạy cổng localhost riêng và đã dừng; không chiếm Server đang dùng của nhóm. Không có migration mới; MH-TIME đã được cập nhật VERIFIED bằng biên bản28 sau xác nhận chủ dự án. PostgreSQL vẫn V8, 231 ô tra/22 mục nguồn sách +1 nguồn thuật toán ngoài sách.

## 6. Cách chạy lại và việc kế tiếp

Khởi động lại Server bằng cấu hình database như README để nhận mã B04 mới. Khi Server đang chạy:

```powershell
cd client
npm run smoke:time
```

Script Node dùng `WS_URL` nếu khác cổng8080. Để tự mở/dừng Server tạm, sau khi đóng gói `-Pdatabase` và có PGPASSWORD của tiến trình, chạy từ repo root:

```powershell
python scripts/smoke_b04_time.py
python scripts/smoke_b04_time.py --progress-only
```

Chỉ dùng `--write-fixture` sau khi nguồn/ca chuẩn đã được đối chiếu; không lấy fixture mới để thay bằng chứng nguồn. B04 hoàn thành phần TIME Server; giao diện/kiểm UI F01 thuộc TV1/I01. **Task kế tiếp: D02 — đối chiếu và nhập dữ liệu Tam Thế còn thiếu**, sau đó D03 tích hợp theo category. N01/H01/E01 và nghiệm thu toàn sản phẩm còn theo kế hoạch.
