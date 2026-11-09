# PH5-PH-01 · Đề xuất Trượng xích chiêm cho Huyền Cơ

**Trạng thái: Nhóm đã duyệt phạm vi v1 theo xác nhận của chủ dự án ngày 08/11/2026.** Mã phương pháp `TRUONG_XICH`, quy tắc `MH-TRUONG-XICH` phiên bản `1.0`. Các đề xuất dưới đây là hồ sơ làm căn cứ cho [quyết định nhóm](07-DECISION-LOG.md#trượng-xích-chiêm).

## Căn cứ theo đúng bản scan

- *Mai Hoa Dịch Số*, trang in **61**, PDF **56** (tính từ 1), mục **Xem bằng trượng thước**. Mục này lấy số trượng để lập thượng quái, số thước để lập hạ quái, cộng hai số gốc để lấy hào. Mục **Xem bằng thước tấc** ngay bên dưới là phép khác và có cộng số giờ. Với Trượng xích chiêm, đề xuất dùng cách tính theo mục riêng, tức chỉ cộng số trượng và số thước.
- Quy tắc quy đổi số quái ở trang in **44–45**, PDF **39–40**. Quy tắc chia 6 và đảo hào ở trang in **46**, PDF **41**. Công thức dựng quẻ hỗ được tái sử dụng theo [quy ước hiện hành của Huyền Cơ](04-MAIHOA-RULES.md#mh-mutual-mh-change-mh-the-dung).
- PDF có 672 trang, SHA-256 `225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de`, khớp bản đã ghim trong hồ sơ nguồn. Nhãn thư mục của ấn bản in tiếp tục theo metadata hiện có.

Trang 61 nêu cách lấy số cho hai quái và hào. Trang này chưa quy định cách chuẩn hóa trường nhập trên website, trường hợp số thước bằng 0 hay giới hạn số nguyên. Phần mở đầu về quẻ hỗ ở trang in 47, PDF 42 còn có cách nói riêng cho Càn và Khôn. Phương án dưới đây giữ hành vi hiện có của Huyền Cơ là lấy hào giữa cho mọi quẻ, kể cả Càn/Khôn, để các phương pháp thống nhất khi có cùng sáu hào.

## Phạm vi v1 đề xuất để duyệt

| Nội dung | Đề xuất |
| --- | --- |
| Số trượng `truong` | Bắt buộc, số nguyên JSON từ 1 đến 999.999. Cận trên là giới hạn kỹ thuật, cùng cỡ với `OBJECT_COUNT`. |
| Số thước lẻ `thuoc` | Bắt buộc, số nguyên JSON từ 0 đến 9. Nhập hai thành phần theo dạng đã chuẩn hóa. Tròn trượng nhập `0` thước, tương ứng Khôn theo quy ước đề xuất. |
| Đơn vị | Nhập trực tiếp theo tên đơn vị trong sách. Phiên bản này chỉ nhận cặp trượng/thước, chưa quy đổi từ mét, cm hay số đo có phần tấc. |
| Tính quẻ | `upper = quai(truong)`, `lower = quai(thuoc)`, `movingLine = hao(truong + thuoc)`. Cộng hai số gốc trước khi quy đổi. `quai(n)` lấy dư khi chia 8, dư 0 dùng 8. `hao(n)` lấy dư khi chia 6, dư 0 dùng 6. |
| Đầu ra | Quẻ chủ, quẻ hỗ, quẻ biến, hào động, bước tính và nguồn. v1 chỉ lập quẻ. |
| Lịch sử | Đề xuất dùng thao tác lưu chủ động của H01 sau khi tích hợp kiểu dữ liệu mới. Kiểm xem lại đúng tài khoản và dữ liệu lịch sử cũ vẫn đọc được. |
| Xác minh | Ghi `SOURCE_LOCATED` cho quy tắc đề xuất. Khi nhóm xác nhận các quy ước riêng, ghi biên bản quyết định và dùng chính sách `TEAM_DECISION` nếu được duyệt thực thi. Trạng thái đối chiếu nguồn và quyền thực thi được ghi riêng. |

## Hợp đồng STOMP dự thảo

Dùng cùng luồng `/app/mai-hoa/calculate`, `type: MAI_HOA`, không tạo kênh STOMP mới. Ví dụ sau là đề xuất payload, dùng để bàn giao cho METHOD-01.

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440056",
  "type": "MAI_HOA",
  "payload": {
    "method": "TRUONG_XICH",
    "truong": 2,
    "thuoc": 4
  }
}
```

- Giữ envelope, tiến độ `ACCEPTED → VALIDATING → CALCULATING → LOOKUP` và cơ chế trả kết quả riêng theo phiên hiện có. DTO Mai Hoa dùng `lunarDate: null` và bổ sung bước `TRUONG_XICH_NUMBERS` trước `MUTUAL` và `CHANGE`. Bước mới ghi hai số gốc, tổng, hai chỉ số quái và số hào.
- Thiếu trường, sai kiểu, ngoài miền hoặc trường ngoài hợp đồng như `hourIndex`, `datetime`, `reading` trả `INVALID_INPUT` sau khi phương pháp được nhận diện. Quy tắc đã có trong hợp đồng nhưng chưa được phép chạy trả `RULE_NOT_AVAILABLE`. Thiếu bảng quái/quẻ dùng lỗi dữ liệu hiện hành.
- Ghi tham chiếu PDF 56 cho quy tắc mới và tái sử dụng tham chiếu của các quy tắc chung đã duyệt. Hợp đồng hiện tại chỉ thay đổi khi METHOD-01 triển khai cùng Client.

## Ca chuẩn tính tay

Chỉ số quái là thứ tự Tiên thiên. Mã quẻ theo thứ tự thượng trước, hạ sau. Hào đếm từ dưới lên. Các kết quả dưới đây đã được tính lại từ cấu trúc sáu hào và đối chiếu mã/tên với danh mục E01. Chúng là ca chuẩn đề xuất, chưa phải phản hồi từ Server.

| Trượng | Thước | Thượng / hạ | Hào | Quẻ chủ | Quẻ hỗ | Quẻ biến | Mục đích |
| ---: | ---: | --- | ---: | --- | --- | --- | --- |
| 2 | 4 | 2 Đoài / 4 Chấn | 6 | Tùy `H_DOAI_CHAN` | Tiệm `H_TON_CAN2` | Vô vọng `H_CAN_CHAN` | Tổng 6, đổi hào trên cùng. |
| 8 | 8 | 8 Khôn / 8 Khôn | 4 | Khôn `H_KHON_KHON` | Khôn `H_KHON_KHON` | Dự `H_CHAN_KHON` | Dư 0 ở cả hai quái, dùng hành vi quẻ hỗ hiện hành. |
| 1 | 0 | 1 Càn / 8 Khôn | 1 | Bĩ `H_CAN_KHON` | Tiệm `H_TON_CAN2` | Vô vọng `H_CAN_CHAN` | Biên dưới, tròn trượng, đổi hào dưới cùng. |
| 9 | 5 | 1 Càn / 5 Tốn | 2 | Cấu `H_CAN_TON` | Càn `H_CAN_CAN` | Độn `H_CAN_CAN2` | Tổng số gốc là 14, tránh lấy tổng chỉ số quái là 6. |
| 999.999 | 9 | 7 Cấn / 1 Càn | 6 | Đại súc `H_CAN2_CAN` | Quy muội `H_CHAN_DOAI` | Thái `H_KHON_CAN` | Hai cận trên, thước 9 quy về 1. |
| 24 | 0 | 8 Khôn / 8 Khôn | 6 | Khôn `H_KHON_KHON` | Khôn `H_KHON_KHON` | Bác `H_CAN2_KHON` | Chia hết cho cả 8 và 6, cùng quy ước thước 0. |

Ví dụ ca `2 / 4`: dãy quẻ chủ từ dưới lên là `100110` với 1 là dương. Ghép hào 2–4 và 3–5 được `001011`. Đảo hào 6 của quẻ chủ được `100111`.

Ca từ chối đề xuất: `truong=0`, `truong=1000000`, `thuoc=-1`, `thuoc=10`, `thuoc=1.5`, `truong="2"`, thiếu `thuoc`, `thuoc=null`, và thêm `hourIndex`. Kiểm hồi quy ba phương pháp Mai Hoa hiện có, giữ đúng định tuyến phiên và `requestId`.

## Bàn giao sau khi nhóm duyệt

1. **TV3 – METHOD-DATA-01:** ghi vị trí nguồn, hash và ca chuẩn được chấp thuận. Dùng lại bảng tám quái và 64 quẻ. Bổ sung dữ liệu quy tắc theo cơ chế hiện có và giữ biên bản cho số thước bằng 0 cùng cách xử lý quẻ hỗ Càn/Khôn.
2. **TV2 – METHOD-01:** cập nhật validator, kiểu dữ liệu, cách lấy hai quái và hào. Tái sử dụng logic dựng ba quẻ và cơ chế lưu chủ động đã chốt cho v1. Mở quyền thực thi sau khi thông qua kiểm thử trên TEST.
3. **TV1/TV2/TV3 – PH5-PH-02:** chạy Client–Server thật trên TEST. Đối chiếu số nhập, bước tính, ba quẻ, nguồn, ca bị từ chối và cách ly lịch sử.
