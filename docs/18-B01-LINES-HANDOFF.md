# B01 — Tính cấu trúc quẻ LINES qua STOMP

Triển khai và kiểm tra trong đêm 23–24/10/2026. **B01 hoàn thành**: Server đã có phép tính thật từ sáu hào do Client nhập. B02 là tác vụ tiếp theo để phát tiến trình. B01 không hoàn tất toàn bộ F01–F08.

**Cập nhật S01 ngày 24/10:** bộ 64 tên đã được đối chiếu lượt hai bởi Codex và chuyển VERIFIED có provenance; kết quả hiện trả tên Ký tế/Vị tế/Nhu cho ví dụ bên dưới. Các mô tả name=null/số tên chưa duyệt trong biên bản B01 này là trạng thái lúc nghiệm thu B01 trước S01. Fixture hiện đã cập nhật sau S01. Xem `19-S01-HEXAGRAM-NAME-REVIEW.md`.

## 1. Luồng đã chạy

1. Client gửi request `MAI_HOA`, `payload.method=LINES` đến `/app/mai-hoa/calculate`.
2. Controller kiểm envelope, UUID, kiểu dữ liệu, đúng sáu boolean và hào động 1–6. Service kiểm lại payload để không phụ thuộc duy nhất vào controller.
3. Registry yêu cầu **cả MH-MUTUAL và MH-CHANGE** được cấp quyền với nguồn VERIFIED, phiên bản đúng, có trang sách, người duyệt và thời điểm duyệt. Không đạt thì dừng trước khi tính/trả kết quả.
4. `MaiHoaLines` thực hiện biến đổi thuần: quẻ chủ giữ sáu hào; hỗ lấy hào 2–4 làm ba hào dưới và 3–5 làm ba hào trên; biến đảo duy nhất hào động tính từ dưới lên.
5. Repository đọc một bộ 64 cấu trúc từ PostgreSQL cho request đó. `HexagramIndex` kiểm đủ 64 dãy sáu hào duy nhất, mã đúng cấu trúc thượng/hạ, tám nhóm ba hào có ánh xạ nhất quán ở cả hai vị trí, rồi tìm ba mã quẻ.
6. Tạo `MaiHoaResult` từ chứng cứ registry và các bước đã tính; gửi COMPLETED đến `/user/queue/results` của đúng session. Lỗi gửi `/user/queue/errors` của session đó.

Không đọc fixture để tạo kết quả. Hàm thuần không truy cập DB hoặc đồng hồ; không sửa dãy hào của người gọi. Không giữ trạng thái kết quả trong service singleton. Hiện vẫn xử lý trực tiếp, chưa có queue/worker/idempotency hay lưu lịch sử; đây là nền để đo baseline trước N01.

Mỗi request đọc lại quyền duyệt và bộ cấu trúc, không cache trạng thái nguồn/tên. Đây chưa phải tối ưu hiệu năng; không dùng thời gian chạy kiểm chức năng để tuyên bố throughput/latency hay contribution.

## 2. Request và kết quả đã kiểm

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "MAI_HOA",
  "payload": {
    "method": "LINES",
    "linesBottomUp": [true, false, true, false, true, false],
    "movingLine": 2
  }
}
```

`true` là hào dương, `false` là hào âm; mảng luôn đi từ dưới lên.

| Quẻ | Mã cấu trúc | Sáu hào từ dưới lên |
| --- | --- | --- |
| Chủ | H_KHAM_LY | true, false, true, false, true, false |
| Hỗ | H_LY_KHAM | false, true, false, true, false, true |
| Biến | H_KHAM_CAN | true, true, true, false, true, false |

Response đầy đủ tại `docs/examples/mai-hoa-lines.response.json`: được lấy từ phản hồi STOMP B01 và cố định lại requestId cho fixture. Chứng cứ gốc cục bộ: `scripts/generated/b01_stomp_results.json`.

Metadata phép biến đổi có `ruleVersion=1.0`, `ruleBasis=SOURCE_VERIFIED`, `sourceStatus=VERIFIED`, hai rule tương ứng và nguồn Mai Hoa PDF 42/in 47, PDF 41/in 46. Đây là trạng thái của **hai quy tắc biến đổi**, không phải chứng nhận mọi bảng trong DB hoặc toàn bộ hệ thống. `lunarDate=null`; LINES không cần chuyển lịch hay quy tắc số Tiên thiên.

Ba mã `H_<THƯỢNG>_<HẠ>` là định danh cấu trúc nội bộ đã có trong seed. Tên quẻ vẫn `name=null`, `nameStatus=SOURCE_LOCATED` vì bộ tên chưa được duyệt. Không tự nâng tên hoặc `MH-TRIGRAM` lên VERIFIED. Không xuất Thể–Dụng, cát/hung hoặc lời luận giải.

## 3. Trường hợp bị từ chối

| Tình huống | Kết quả |
| --- | --- |
| Sai kiểu/số hào/hào động | INVALID_INPUT, data=null |
| Thiếu state DB hoặc một quy tắc chưa VERIFIED/thiếu review | RULE_NOT_AVAILABLE với ruleCode và reason từ registry |
| Không có đủ 64 cấu trúc, trùng mã/dãy hoặc ánh xạ không nhất quán | **KNOWLEDGE_DATA_INCOMPLETE**, data=null, ruleCode/reason=null |
| Không truy cập được DB | DATABASE_UNAVAILABLE, thông điệp cố định, không SQL/credential |
| TIME hoặc OBJECT_COUNT hợp lệ | Vẫn RULE_NOT_AVAILABLE / IMPLEMENTATION_UNAVAILABLE cho tới B03/B04 |

Không trả thành công một phần nếu thiếu quẻ chủ/hỗ/biến. Không bật profile DB thì provider rỗng; LINES bị đóng bằng RULE_STATE_UNAVAILABLE. Hợp đồng và kiểu TypeScript đã bổ sung lỗi tri thức, không đổi hình dạng envelope.

## 4. Kiểm tra đã thực hiện

| Lớp kiểm tra | Bằng chứng |
| --- | --- |
| Hàm thuần | 384 tổ hợp 64 × 6; oracle số nguyên dùng cửa sổ bit và XOR, khác cách cắt mảng của hàm chính; kiểm đúng chiều, chỉ một hào đổi và không sửa input |
| Ca cụ thể và đầu vào xấu | Dãy bất đối xứng nêu trên; hào 1/6 nằm trong ma trận; thiếu/null hào, ngoài phạm vi; output bất biến |
| Service | Kiểm hai nguồn, metadata, mã ba quẻ, ẩn tên chưa duyệt, thiếu/nhân đôi/cấu trúc sai, mất kết nối, chưa bật các method khác |
| Spring profile db + PostgreSQL thật | `LinesDatabaseIntegrationTest` nối service → registry → repository; kiểm mã/dãy hào và nguồn thực |
| Java có biến test DB | **422 test, 0 failure/error, 0 skip**; DB tạm `huyenco_a02_ef21fd935953` được bootstrap hai lần, bản ghi giữ nguyên và đã xóa sau kiểm |
| STOMP thật trên DB huyenco | **384 tổ hợp + 2 request cùng ID ở hai session với input khác nhau + 1 input sai = 387 phản hồi**, đúng dãy hào, metadata, queue và session; 0 phản hồi lẫn phiên |
| Kiểm khung còn lại | `smoke:stomp` đạt cho OBJECT_COUNT/Tam Thế chưa triển khai và INVALID_INPUT |
| Tương thích Client | TypeScript và 12 fixtures hợp đồng đạt; fixture LINES chứa mã/trạng thái tên thực tế |

Oracle bit kiểm chứng việc cài công thức; không được gọi là một ấn bản sách độc lập hoặc review nguồn mới. Chứng cứ VERIFIED cho hai rule vẫn là xác nhận đã ghi trong V4. Phép thử hai session chứng minh định tuyến trong các ca đó; chưa chứng minh đã chặn việc subscribe trực tiếp queue của người khác, quá tải hoặc reconnect. Những việc đó thuộc B02/N01/T01.

### Chạy lại

Sau bootstrap, chạy Server profile db với `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` trong môi trường. Từ `client/`:

```powershell
npm run smoke:lines
npm run smoke:stomp
```

Mặc định dùng `ws://localhost:8080/ws`; đổi bằng `WS_URL`. Muốn lưu phản hồi vào vùng sinh dữ liệu:

```powershell
$env:LINES_REPORT_PATH = "../scripts/generated/b01_stomp_results.json"
npm run smoke:lines
```

Kiểm Java thuần từ `server/`: `.\mvnw.cmd test`. Lệnh này bỏ qua 5 test cần DB nếu không có biến kiểm thử; không được ghi là 422 test đều đã thực thi. Kiểm toàn bộ DB qua `python scripts/test_a02_bootstrap.py` từ repo root với `PGPASSWORD` trong môi trường; script cấp biến kiểm thử đúng tên DB tạm và dùng Maven profile database. Không lưu mật khẩu vào repo.

Các Server cổng 18081 dùng cho kiểm tra đã được dừng sau khi hoàn tất, không thay Server đang chạy của người dùng. Dữ liệu `huyenco` chỉ được đọc trong phép tính; không có migration mới hoặc đợt duyệt nguồn mới ở B01.

## 5. Bàn giao TV1 và bước tiếp theo

TV1 có thể gửi payload trên bằng hợp đồng đang có, hiển thị ba dãy hào với chỉ số 1 ở dưới và đánh dấu hào động; dùng mã cấu trúc khi name=null, không tự suy ra tên hoặc lời luận. Trang Mai Hoa hiện chỉ có form TIME/OBJECT_COUNT, chưa có form nhập LINES; thêm form/hiển thị quẻ nằm trong I01/việc phối hợp TV1. B01 đã nghiệm thu Server qua Client STOMP kiểm tra, không tuyên bố F03 đã hoàn tất giao diện.

**B02:** phát progress thực tế vào `/user/queue/progress` với requestId/sequence/step đúng phiên; cập nhật hook Client và kiểm trật tự/lỗi. B03 làm OBJECT_COUNT khi S01 hoàn tất các quy tắc phụ thuộc. TIME, lịch, Tam Thế và dữ liệu lời luận vẫn theo kế hoạch riêng, giữ nguyên các điểm chưa xác minh theo ấn bản.
