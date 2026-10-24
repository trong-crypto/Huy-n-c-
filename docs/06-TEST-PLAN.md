# Kế hoạch kiểm thử

Theo phạm vi mới, F01–F08 ở `10-FUNCTIONAL-REQUIREMENTS.md` đều cần test đầu cuối trước khi coi là hoàn thành. Các test LINES bên dưới chỉ kiểm lát cắt đầu tiên.

## Hợp đồng

- Yêu cầu TIME/OBJECT_COUNT/LINES/TAM_THE hợp lệ và không hợp lệ.
- UUID và `type` đúng; ngày/giờ, tháng nhuận; `OBJECT_COUNT` hợp lệ nhưng thiếu bất kỳ điều kiện nguồn/policy/dữ liệu/implementation bắt buộc trả `RULE_NOT_AVAILABLE`; TEAM_DECISION hợp lệ giữ nguyên trạng thái nguồn và phải có cảnh báo; `NUMBER` cũ trả `INVALID_METHOD`.
- `COMPLETED`/`FAILED`, `data`/`error` và mã lỗi thống nhất.

## Thuật toán

- Đối chiếu từng phép tính với ví dụ của đúng ấn bản, ghi expected result và trang nguồn.
- Quy tắc DRAFT không được trả kết quả suy đoán.
- P0 `MAI_HOA`/`LINES`: sáu boolean từ dưới lên, hào động 1 và 6, quẻ hỗ từ hào 2–4/3–5, quẻ biến chỉ đảo một hào; `movingLine` ngoài 1–6, thiếu/thừa hào và sai kiểu trả `INVALID_INPUT`. Chạy test cấu trúc với mọi 64 mẫu hào × 6 vị trí; TV3 kiểm ít nhất các ví dụ nguồn trước khi chuyển `MH-MUTUAL`/`MH-CHANGE` thành `VERIFIED`.
- Mai Hoa: số dư 0 của 8/6, hào 1/6, quẻ hỗ hào 2–4 và 3–5; đối chiếu xung đột tr. 50 của bản in.
- Quyết định mới: TIME dùng tổng chia 6 (dư 0→6), giữ dấu vết dòng tr. 50 in “trừ 8”. OBJECT_COUNT dùng 12 vật, giờ Mùi=8 → thượng 4, hạ 8, hào 2; kiểm dư 0→8/6, `objectCount` 0 hoặc quá 999999, `hourIndex` 0/13, `NUMBER` cũ bị từ chối. TV3 cần ca đối chiếu trang 51 cho cách hiểu “số quẻ” trước VERIFIED.
- Tam Thế: 60 cặp Can Chi; 7 nhóm mốc giờ theo tháng, 36 phần giờ; xung đột tháng 5; tra đa nhãn nghề và đủ 120 ô Can×tháng.
- Tháng 5 Tam Thế: 05:19 trước Dần; 05:20–07:19 dùng Dần, 07:20 bắt đầu Mão; dữ liệu nguồn vẫn giữ chữ gốc Dậu và lý do sửa của nhóm.

## Mạng và riêng tư

- Ít nhất 20 Client đồng thời; mỗi kết quả đúng `requestId` và session.
- Mất kết nối, kết nối lại, timeout, request trùng, quá tải (`SERVER_BUSY`); lỗi một phiên không lan sang phiên khác.
- WSS, origin allowlist, payload sai/quá lớn, không lưu hoặc log ngày sinh tại Server.

## Thực nghiệm cho bài tập lớn

- So baseline xử lý trực tiếp với phương án worker pool/hàng đợi hữu hạn và idempotency **sau khi phương án được triển khai**. Cùng máy, cùng workload, cùng cấu hình và dữ liệu.
- Chạy 1, 5 và 20 Client đồng thời, lặp lại có ghi số lần; đo median/p95 thời gian phản hồi, throughput, số hoàn tất, lỗi, `SERVER_BUSY` và phản hồi sai phiên.
- Lưu raw CSV, script/câu lệnh chạy, môi trường, input, cấu hình, biểu đồ và phần giải thích. Không ghi số liệu dự kiến thành kết quả thực.
- Có test requestId trùng cùng payload, requestId trùng khác payload, disconnect khi đang chờ, hàng đợi đầy, input sai, lỗi database nếu bật database và một tuyến nghiệp vụ thật đã `VERIFIED`.

## Nghiệm thu chức năng đầy đủ

- F01/F02: ca chuẩn từ sách cho TIME và phương pháp số đã chốt; so quẻ chủ/hỗ/biến, hào động, bước tính và nguồn; test ranh số dư, lịch nhuận và thời điểm đổi ngày.
- F04: công danh, tài lộc, tình duyên có ca chuẩn riêng; ô chưa có nguồn trả lỗi rõ, không trộn nhãn hoặc tự sinh lời giải.
- F05: kiểm đủ 64 mã duy nhất, tìm tên/mã, lọc thượng/hạ quái, sáu hào và nguồn; không hiển thị tên/quẻ suy đoán.
- F06: chuyển Dương↔Âm hai chiều, tháng nhuận, phạm vi năm, ranh ngày và Can Chi theo bộ chuẩn độc lập.
- F07: progress có thứ tự, đúng requestId/session; hai Client không nhận nhầm bước hoặc kết quả; timeout/disconnect không hiện thành hoàn tất.
- F08: lưu theo yêu cầu, liệt kê/tìm/xem/xóa của đúng chủ sở hữu; phân trang, truy cập chéo và dữ liệu nhạy cảm trong log/DB.


## A01 đã chạy ngày 23/10/2026

Java 21/21 kiểm thử đạt, TypeScript typecheck đạt, 12 JSON fixtures khớp DTO Client qua `npm run check:contract`. Kiểm registry: thiếu state, version sai, thiếu nguồn/review, DISABLED, TEAM_DECISION giữ SOURCE_AMBIGUOUS và không được dùng cho lời luận giải. Validator chặn policy do Client gửi, số nguyên quá lớn, UUID rút gọn và categories Tam Thế không hợp lệ. Chi tiết ở `16-A01-CONTRACT-HANDOFF.md`; đây không phải kiểm thử đầu cuối phép tính B01.

## B01 đã kiểm đêm 23–24/10/2026

422 test Java có DB, 0 lỗi/0 bỏ qua; gồm ma trận hàm thuần 64 dãy × 6 hào động, kiểm bất biến/đầu vào/gate nguồn/dữ liệu cấu trúc và service nối DB thật. `npm run smoke:lines` kiểm 384 tổ hợp qua hai kết nối STOMP, thêm hai request cùng ID khác input và một lỗi đầu vào: 387 phản hồi đúng, không lẫn phiên. `smoke:stomp` cũ vẫn đạt với OBJECT_COUNT/Tam Thế chưa triển khai. Đây là kiểm chức năng, không phải benchmark, kiểm SUBSCRIBE chéo hay nghiệm thu toàn bộ F01–F08. Cách tái lập và giới hạn ở `18-B01-LINES-HANDOFF.md`.

## B02 đã kiểm ngày 24/10/2026

429 test Java có DB, 0 lỗi/0 bỏ qua; thêm controller JSON lỗi/UTF-8/deadline/disconnect/một terminal, giới hạn transient state và interceptor. Client 10/10 test reducer/guard/render Panel; typecheck, 12 fixtures và production build đạt. STOMP thật: 1.546 progress có thứ tự và 387 terminal đúng; ca JSON lỗi/phục hồi, prefix lỗi, reconnect, chặn queue/SEND và timeout tác vụ DB thật với hạn kiểm tra 1 ms đạt. Test unit giữ handler bằng latch để xác nhận kết quả trả sau timeout/disconnect bị bỏ. Không có sleep trong nghiệp vụ sản phẩm. Xem `20-B02-PROGRESS-HANDOFF.md`; chưa nghiệm thu worker/idempotency, tải hoặc toàn bộ UI F01–F08.
