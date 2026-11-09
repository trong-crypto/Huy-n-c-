# METHOD-01 và METHOD-DATA-01 · Trượng xích chiêm V28

Mã tính, dữ liệu nguồn và các ca chuẩn theo [PH5-PH-01](78-PH5-PH-01-TRUONG-XICH-PROPOSAL.md). Catalog mở `MH-TRUONG-XICH` bằng `TEAM_DECISION`, tham chiếu `DEC-20261108-MH-TRUONG-XICH` theo xác nhận của chủ dự án.

## Hợp đồng và dữ liệu

- Dùng `SEND /app/mai-hoa/calculate`, `type=MAI_HOA` và payload `{"method":"TRUONG_XICH","truong":2,"thuoc":4}`. `truong` là số nguyên 1–999.999, `thuoc` là số nguyên 0–9. Trường lạ, dữ liệu sai kiểu và giá trị ngoài miền trả `INVALID_INPUT`. Thiếu bản ghi nguồn hoặc quy tắc chung chưa đủ điều kiện vẫn trả `RULE_NOT_AVAILABLE`.
- Server dùng tổng hai số gốc để lấy hào. Phản hồi giữ DTO Mai Hoa, `lunarDate: null`, ba quẻ và bước `TRUONG_XICH_NUMBERS` trước `MUTUAL` và `CHANGE`. Xem [form Client và cách nghiệm thu](80-PH5-PH-02-TRUONG-XICH-CLIENT-ACCEPTANCE.md).
- Flyway V28 liên kết quy tắc với **trang in 61, PDF 56** theo hash của ấn bản đã ghim. Quy tắc được nhập `SOURCE_LOCATED`. Bootstrap cũng có mục nguồn này để lần nhập sau vẫn bổ sung được dữ liệu nếu schema đã migrate trước khi có PDF. Cả hai đường đều giữ kết quả đối chiếu đã có khi chạy lại.
- Dữ liệu quái, quẻ và lưu lịch sử dùng cấu trúc hiện có. V28 mở rộng ràng buộc bảng đếm để ghi nhận lượt tính thành công của phương pháp này. Dashboard chỉ thêm dòng Trượng xích vào ngày đã có lượt tính.

## Điều kiện môi trường

Dùng Client và Server cùng bản V28. Chạy Flyway V28 trên database đã seed đúng ấn bản. Đối chiếu `MH-TRUONG-XICH` có `calculationAuthorized=true` ở readiness trước khi nghiệm thu. Dữ liệu vẫn giữ `SOURCE_LOCATED` để phân biệt việc xác nhận quy ước nhóm với đối chiếu nguồn.

## Kết quả kiểm ban đầu trước khi nhóm duyệt

- Tạo bản sao `huyenco_truong_xich_test_20261108_223659` từ TEST V27. Flyway migrate và validate V28 thành công. Dấu vân tay 34 bảng ngoài hai bảng lưu mục nguồn và quy tắc khớp trước/sau. Quy tắc mới giữ `SOURCE_LOCATED`. Flyway báo PostgreSQL 18.6 mới hơn mốc hỗ trợ đã được thử của bản Flyway hiện tại.
- Catalog phát hành trả đúng lỗi khóa cho một yêu cầu hợp lệ và từ chối chín ca sai đầu vào qua STOMP. Với catalog tổng hợp tạm trên bản TEST, sáu ca chuẩn trả đúng ba quẻ, hào động, bước tính và trang nguồn. Bản chạy tổng hợp đã được dọn sau khi kiểm.
- Kiểm lưu, đọc lại, từ chối tài khoản ngoài quyền, xóa lịch sử TEST và đếm đúng sáu lượt Trượng xích. Bảy fixture hồi quy Mai Hoa, Tam Thế và lịch đạt.
- 2.267 kiểm thử Backend đạt, 30 ca tích hợp bỏ qua trong Maven. 1.380 kiểm thử Client, 62 fixture hợp đồng, kiểm kiểu TypeScript và 79 kiểm thử Python đạt.
