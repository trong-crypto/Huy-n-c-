# Kế hoạch kiểm thử

## Hợp đồng

- Yêu cầu TIME/NUMBER/TAM_THE hợp lệ và không hợp lệ.
- UUID và `type` đúng; ngày/giờ, tháng nhuận; `NUMBER` hai số hiện trả `RULE_NOT_AVAILABLE`.
- `COMPLETED`/`FAILED`, `data`/`error` và mã lỗi thống nhất.

## Thuật toán

- Đối chiếu từng phép tính với ví dụ của đúng ấn bản, ghi expected result và trang nguồn.
- Quy tắc DRAFT không được trả kết quả suy đoán.
- Mai Hoa: số dư 0 của 8/6, hào 1/6, quẻ hỗ hào 2–4 và 3–5; đối chiếu xung đột tr. 50 của bản in.
- Tam Thế: 60 cặp Can Chi; 7 nhóm mốc giờ theo tháng, 36 phần giờ; xung đột tháng 5; tra đa nhãn nghề và đủ 120 ô Can×tháng.

## Mạng và riêng tư

- Ít nhất 20 Client đồng thời; mỗi kết quả đúng `requestId` và session.
- Mất kết nối, kết nối lại, timeout, quá tải; lỗi một phiên không lan sang phiên khác.
- WSS, origin allowlist, payload sai/quá lớn, không lưu hoặc log ngày sinh tại Server.

