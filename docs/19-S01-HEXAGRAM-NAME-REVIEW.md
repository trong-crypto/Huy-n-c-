# S01 — Đối chiếu tên 64 quẻ với bản PDF cung cấp

Ngày kiểm: 24/10/2026. Người/công cụ kiểm: **Codex, lượt đối chiếu nguồn thứ hai**. Lượt nhập trước: TV3 với hỗ trợ AI ngày 23/10. Đây là hai lượt của công cụ trong cùng dự án, không phải hai người kiểm độc lập hay chữ ký TV2. Chủ dự án đang kiêm TV2 + TV3 và đã giao quyền thực hiện các bước kỹ thuật/đối chiếu theo kế hoạch 15.

## Phạm vi VERIFIED

Xác nhận bộ **tên ngắn tiếng Việt gắn với sáu hào/cặp quái** khớp bản scan được cung cấp. Không xác nhận học thuật mọi lời luận, không xác thực nhà xuất bản/năm in chưa rõ của ấn bản, không nâng các quy tắc tính số hoặc Tam Thế. Tên có chữ viết tay trong sơ đồ được kiểm chéo với danh sách chữ in trong cùng tệp; không tuyên bố nhãn viết tay là bút tích của tác giả.

## Nguồn đã mở và đối chiếu

- Mai Hoa Dịch Số trong Downloads, 672 trang; SHA-256 `225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de` đã tính lại, khớp hồ sơ nhập.
- Tên/thứ tự: PDF 269–271, trang in 276–278. Sơ đồ tên/hình sáu hào: PDF 274, trang in 281, hình tròn dưới Hình 3. Danh sách phụ PDF 500–501, trang in 509–510 chỉ dùng để kiểm cách viết, không dùng thay các tên khác biệt của danh sách chính.
- PDF 274 được render lại trực tiếp từ tệp ở 300/600 dpi. Dùng ảnh gốc và các dải đọc hình tròn để quan sát tên/sáu vạch. Phóng to không tạo thêm chi tiết vượt scan gốc. Chẩn đoán nhận dạng vạch tự động thử nghiệm không đủ tin cậy, **không dùng làm bằng chứng duyệt**; quyết định dựa trên đối chiếu trực quan và bảng chép lượt hai.
- Tam Thế vẫn hiện diện và hash khớp `7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d`; không cần sách này để duyệt tên 64 quẻ.

## Biên bản từng dòng

`data/hexagram_name_review.csv` là bảng lượt hai theo **vị trí quanh sơ đồ**, tách khỏi thứ tự Thượng/Hạ kinh của file nhập `hexagram_names.csv`. Vị trí 0 là Càn ở đáy, đi về phía Cấu; vị trí 32 là Khôn ở đỉnh; kết thúc Quải ở vị trí 63. Chuỗi sáu ký tự ghi hào **từ dưới lên**, `1` dương, `0` âm. Cột trang ghi địa chỉ tên chữ in và sơ đồ.

Đối chiếu cả 64 dòng với tên/cặp quái của dữ liệu nhập. Chú ý:

| Cặp dễ nhầm | Kết quả đối chiếu |
| --- | --- |
| Ký tế / Vị tế | 101010 = Khảm trên Ly; 010101 = Ly trên Khảm; đoạn chữ in cuối PDF 271 cũng phân biệt thủy trên hỏa với hỏa trên thủy |
| Thái / Bĩ | 111000 = Khôn trên Càn; 000111 = Càn trên Khôn |
| Bí / Bĩ | 101001 = Cấn trên Ly; 000111 = Càn trên Khôn; giữ khác dấu |
| Càn / Cấn | 111111 và 001001; CAN và CAN2 là mã nội bộ khác nhau |
| Ly / Lý | 101101 = Ly trên Ly; 110111 = Càn trên Đoài; mục “Lễ” của danh sách chính viết “Ly”, dùng “Lý” từ danh sách bổ sung PDF 500 và nhãn tương ứng để phân biệt tên; đây là chuẩn hóa có ghi nhận |
| Hoán | Giữ tên Hoán trong danh sách chính PDF 271 và sơ đồ; không lấy chữ “Hi” ở danh sách phụ PDF 501 thay thế |
| Tỉnh, Truân, Bí | Danh sách phụ có các cách ghi Đồn/Bôn; tên sử dụng theo danh sách chính và sơ đồ. Không âm thầm sửa nguyên văn các trang sách |

Kết quả lượt đối chiếu: 64 tên và 64 dãy hào khớp bộ nhập, không cần sửa cặp thượng/hạ. Quyết định chuẩn hóa nêu trên nằm trong ghi chú duyệt; không coi mọi chỗ in trong sách hoàn toàn nhất quán.

## Cập nhật có kiểm soát

V5 chỉ thêm `reviewed_at`, `verification_note`; không sửa V1–V4 và không tự duyệt dữ liệu trong migration. `scripts/verify_hexagram_names.py` kiểm hash PDF, bảng lượt hai và bảng nhập, sau đó chỉ duyệt đúng 64 dòng có tên, cặp quái, dãy hào và nguồn khớp. Gặp dữ liệu khác hoặc reviewer khác thì dừng; không ghi đè người kiểm thủ công. Có bản sao lưu trước cập nhật và transaction. Reviewer ghi `Codex source review 2026-10-24 (same-tool second pass)`; thông tin này không mạo nhận xác nhận TV2 độc lập.

Đợt này hoàn tất S01 về bộ tên. Các trạng thái của MH-TRIGRAM/TIME/OBJECT_COUNT, Tam Thế và interpretations giữ nguyên. B03 vẫn phải kiểm và duyệt MH-TRIGRAM cùng các phụ thuộc trước khi mở OBJECT_COUNT; việc duyệt tên không tự cấp quyền cho bảng số quái.

## Kết quả đã áp dụng và kiểm tra

- Database `huyenco`: V5 đã áp dụng; **64/64 tên VERIFIED**, có reviewer, reviewed_at và verification_note. Hai rule biến đổi VERIFIED vẫn là hai rule cũ; không duyệt thêm thuật toán.
- Kiểm toán DB thật: **33 kiểm tra, 0 FAIL, 2 PENDING**. Hai mục còn thiếu là lời giải và dữ liệu Tam Thế; báo cáo `scripts/generated/tv3_audit_report.md`.
- Bootstrap DB tạm từ trống và chạy lại: bản ghi/metadata duyệt giữ nguyên; DB tạm đã được xóa. Java với DB: **422/422**, không bỏ qua; Python: **24/24**; Client typecheck và 12 fixtures đạt.
- STOMP sau duyệt: **387 phản hồi đúng**, gồm 384 tổ hợp và ca hai phiên/cùng ID/lỗi. Ví dụ LINES trả Ký tế → hỗ Vị tế → biến Nhu với nameStatus VERIFIED. Readiness báo 64 tên đã duyệt, 2 rule VERIFIED; `businessFeaturesReady` vẫn false.
- Fixture LINES đã cập nhật từ phản hồi thật sau duyệt, cố định requestId. Chứng cứ cục bộ: `scripts/generated/b01_names_verified_stomp.json`. Server kiểm tra cổng 18081 đã dừng.
