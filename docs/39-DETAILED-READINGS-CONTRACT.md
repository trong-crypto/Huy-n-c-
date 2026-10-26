# Hợp đồng lời luận mở rộng — M02/M03/D04

**D04 hoàn thành ngày26/10 theo [42](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md):** Tam Thế wealthMode=EXTENDED đã trả ba tiểu mục thật, kiểm720 tổ hợp qua DB/STOMP và snapshot H01. LEGACY giữ nguyên, gồm lỗi thiếu khóa Lộc. Có năm capture d04-*; tổng62 fixtures. Root Tam Thế SOURCE_VERIFIED/VERIFIED mô tả nội dung đã duyệt; editorialDecisions vẫn mang TEAM_DECISION/SOURCE_AMBIGUOUS cho liên kết nhãn/tham chiếu. Các gate M02/M03 bên dưới là lịch sử, không phải hành vi hiện tại của service đã nối DB V12 đúng.

**M03 hoàn thành ngày26/10 theo [41](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md):** Mai Hoa có reading đã chạy thật cho ba phương pháp trên TEST V12. Có bốn capture m03-* và đã kiểm snapshot H01 bằng kết quả service thật. Tam Thế EXTENDED vẫn chờ D04. Các đoạn mô tả gate M02 dưới đây là lịch sử hợp đồng trước khi có interpreter.

**26/10/2026: đã triển khai DTO, validator, shared TypeScript và fixtures M02.** M01/phần dữ liệu xem [38](38-M01-M02-REVIEWED-KNOWLEDGE-HANDOFF.md); kết quả kiểm hợp đồng và bàn giao ở [40](40-M02-CONTRACT-HANDOFF.md). Giữ envelope1.2 và JSON cũ. Server nhận/kiểm đầu vào mới, nhưng chưa có service M03/D04: opt-in hợp lệ trả `RULE_NOT_AVAILABLE / IMPLEMENTATION_UNAVAILABLE` với `MH-DETAILED-READING` hoặc `TT-WEALTH-EXTENDED`, không bị hạ ngầm về kết quả cũ. Input sai vẫn trả INVALID_INPUT/INVALID_DATE trước chốt này.

## Mai Hoa

Giữ envelope/STOMP và các field phương pháp hiện tại. Thêm lựa chọn rõ ràng `payload.reading` khi TV1 yêu cầu lời luận chi tiết:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440031",
  "type": "MAI_HOA",
  "payload": {
    "method": "LINES",
    "linesBottomUp": [true, false, true, true, true, false],
    "movingLine": 1,
    "reading": {
      "topic": "LOVE",
      "context": {"datetime": "2026-10-26T09:00:00+07:00"}
    }
  }
}
```

- `reading` vắng: hành vi cũ. Có `reading`: object bắt buộc `topic` trong GENERAL/CAREER/WEALTH/LOVE, không null, không đoán topic từ câu hỏi. Câu hỏi trong TIME/OBJECT_COUNT vẫn là ngữ cảnh tối đa500 ký tự; không đưa nội dung vào SQL hoặc tự suy diễn mốc "năm sau".
- LINES/OBJECT_COUNT có thể thêm `reading.context.datetime` ISO8601 có offset, phải đổi ra ngày UTC+7 trong miền1900–2099. Thiếu context vẫn trả phần quan hệ/giai đoạn/lời luận; phần mùa mang `NOT_EVALUATED` với lý do `MISSING_READING_TIME`.
- TIME dùng `payload.datetime` đã chuẩn hóa để xét mùa. Cấm `reading.context` ở TIME để tránh hai thời điểm trái nhau. Context có nhưng sai ngày/offset/miền thì trả lỗi, không âm thầm bỏ qua.
- Cấm thêm `sourceStatus`, `ruleBasis`, `bodySide`, `relation`, rule code hoặc quyết định từ Client. Server quyết định và trả evidence đã kiểm.

Kết quả giữ toàn bộ field cũ; thêm `detailedReading` **chỉ khi được yêu cầu**, gồm:

| Trường | Ý nghĩa bắt buộc |
| --- | --- |
| `schemaVersion` | `1.0` cho phần lời luận; không thay tên method cũ |
| `bundleId`, `topic`, `textKind` | Bundle review đã dùng, chủ đề; `EDITORIAL_PARAPHRASE` |
| `body`, `use` | Mỗi bên có `side` UPPER/LOWER, `trigramCode`, `element`; Thể lấy từ quẻ chủ |
| `phases` | Bốn mục có thứ tự INITIAL_USE, MIDDLE_BODY_MUTUAL, MIDDLE_USE_MUTUAL, FINAL_USE; mỗi mục có quái đem so với Thể gốc, quan hệ có chiều, template code, lời luận và nguồn |
| `season` | EVALUATED hoặc NOT_EVALUATED, thời điểm/lịch/tháng khi có, lý do thiếu; bảng tháng quy ước và nguồn mùa đi riêng |
| `summary` | Tóm tắt các quan hệ đã nêu, không điểm số/xác suất/ngày ứng nghiệm tự tạo; nếu khác chiều phải giữ khác chiều |
| `calculationDecisions` | Các quyết định chọn Thể, vị trí/giai đoạn và mùa thực sự được dùng; từng mục có basis/status/limitation/source |
| `sourceReferences` | Nguồn trang/hash/section của mọi đoạn luận và quy ước; không chỉ nguồn tên quẻ |

`SOURCE_VERIFIED` mô tả nội dung/quan hệ đã duyệt. `TEAM_DECISION` mô tả việc chọn Thể/vị trí/tháng trong phần tính toán. Không gộp hai loại thành một cờ VERIFIED duy nhất rồi che giới hạn. Không dùng quyết định nhóm để vượt chốt INTERPRETATION của RuleRegistry; lớp nguồn lời luận phải kiểm bundle, template, reviewer, hash và quyết định liên kết riêng trước khi phát.

Mỗi phase có `kind`, `comparator`, `relation`, `templateCode`, `content`, `textKind`, `ruleBasis="SOURCE_VERIFIED"`, `sourceStatus="VERIFIED"` và nguồn không rỗng. Mỗi quyết định có `decisionId`, `purpose`, `ruleBasis="TEAM_DECISION"`, `sourceStatus`, `policy`, `description`, `limitation`, nguồn. `calculationDecisions` chỉ nhận purpose CALCULATION; phần biên tập Tam Thế nhận EDITORIAL_LINK hoặc CALCULATION theo hồ sơ. M03 đã tổng hợp evidence thực sự dùng: BODY/PHASES khiến kết quả tổng mang TEAM_DECISION/SOURCE_AMBIGUOUS, dù từng đoạn luận có SOURCE_VERIFIED/VERIFIED. Có hai calculationDecisions khi không context, bốn khi xét mùa (thêm SEASON và M03-SEASON-STRENGTH). Phân loại mùa là quy ước tính toán SOURCE_LOCATED, không phải đoạn luận mùa được nâng VERIFIED.

`season`: NOT_EVALUATED có reason MISSING_READING_TIME, các trường datetime/lunarDate/season/bodyStrength đều null, nguồn rỗng. EVALUATED có reason null, datetime có offset, lunarDate, season trong SPRING/SUMMER/AUTUMN/WINTER/EARTH_MONTH và bodyStrength VIGOROUS/WEAK/UNCLASSIFIED, nguồn riêng. UNCLASSIFIED nghĩa là không thuộc các hành vượng/suy được quy tắc nêu; không được đổi thành lời khẳng định cân bằng. Thiếu thời điểm không tạo một mùa mặc định.

Ví dụ nguồn kiểm quan hệ: quẻ Cách, dưới Ly/Hỏa, trên Đoài/Kim, hào1 động → Thể trên Đoài, Dụng dưới Ly; ban đầu Dụng khắc Thể; phía Dụng sau biến Cấn/Thổ sinh Thể. Hai quái hỗ xét riêng; không thay Thể bằng Thể của quẻ biến. Mẫu M02 schema-only được giữ nguyên lịch sử; đã có capture thật `m03-lines-reading.response.json` từ Server M03 và ba capture cho mùa/OBJECT_COUNT/TIME.

## Tam Thế

Thêm opt-in `payload.wealthMode="EXTENDED"` hoặc `"LEGACY"`; thiếu tương đương LEGACY. EXTENDED chỉ được dùng khi categories có WEALTH (hoặc thiếu categories nên mặc định ba nhóm). Chọn mở rộng không tự thay CAREER/LOVE hoặc dùng birthTime để tính lại các bảng năm–tháng chung.

Giữ **`categories[].entries`** như API thực tế; không đổi thành interpretations. WEALTH mở rộng thêm `subreadings` theo thứ tự LOC/SANG_HEN/DIEN_SAN. Mỗi mục có `code`, `status` MATCHED/NO_SOURCE_MATCH, `ruleCode`, `lookupKey`, `entries`, `reason`, `sourceReferences`, `decisionReferences` (dạng ReadingDecision). LOC không có giao điểm: NO_SOURCE_MATCH, entries rỗng, reason NO_PRINTED_INTERSECTION, vẫn có nguồn bảng. MATCHED: reason null và entries không rỗng; từng entry có `subreadingCode` khớp code tiểu mục. Sang hèn/Điền sản phải MATCHED. Danh sách phẳng categories[].entries phải bằng phép nối entries của ba tiểu mục theo thứ tự; không giấu/đổi nội dung giữa hai cách trình bày. Tên tiểu mục và cả hai nhãn in/tiêu đề được giữ trong title/ghi chú liên kết.

Kết quả mở rộng có `coverageMode="EXTENDED"`, `bundleId` và **`editorialDecisions`** chứa mọi quyết định dùng trong subreadings. Giữ `decisionReferences` cũ nguyên kiểu để Client cũ đọc được; không trộn ReadingDecision vào mảng DecisionReference cũ. Nội dung giữ SOURCE_VERIFIED; liên kết theo vị trí công khai TEAM_DECISION. Không bỏ nhãn Phú/Tướng linh/Phiên An hoặc coi nhà xuất bản đã sửa. Nếu thiếu nguồn/duyệt hoặc không tìm được khóa Sang hèn/Điền sản hợp lệ, trả RULE_NOT_AVAILABLE. LEGACY và request cũ vẫn trả đúng JSON cũ, không thêm các trường mở rộng bằng null.

## Bộ kiểm và tiến độ

M03 đã đạt mục2 bằng logic/JDBC và phần Mai Hoa của mục4 theo41. D04 đã đạt mục3 bằng DB/STOMP thật, phần Tam Thế của mục4 bằng HTTP/history và các chốt nguồn mục5 theo42. I02 và T02 toàn sản phẩm còn thực hiện. Danh sách dưới đây giữ yêu cầu cùng bằng chứng nền M02.

1. M02 đã kiểm input cũ/mới, unknown key/null, biên UTC+7 và context TIME; 5 request, 4 lỗi implementation unavailable được controller kiểm đối chiếu và 4 kết quả schema-only. Tên `.schema.response.json` bắt buộc phân biệt với capture service. Còn nghiệm thu thành công thực tế ở M03/D04/T02.
2. 64×6×4 cấu trúc Mai Hoa có nguồn cho bốn phase; đảo chiều quan hệ và biên hào3/4; mùa đủ12 tháng, nhuận, offset và thiếu context. Không dùng question để quyết định output.
3. 60 năm Can Chi×12 tháng với EXTENDED đủ ba category và phân biệt tình trạng LOC. LEGACY tiếp tục hành vi cũ.
4. M02 đã kiểm cache/lưu/đọc/xóa snapshot schema-only trên PostgreSQL TEST với hai owner và N01 fingerprint chứa reading/topic/context/wealthMode. M03/D04 vẫn phải kiểm lại snapshot do service thực tế sinh ra; không dùng round-trip DTO thay nghiệm thu tính toán.
5. Thiếu/sửa bundle, template, nhãn, reviewer, hash hoặc source thì không phát nội dung dưới nhãn đã duyệt. Chạy STOMP/progress/session thật trên TEST trước khi áp dụng DB dự án và bàn giao I02.
