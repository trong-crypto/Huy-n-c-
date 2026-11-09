# PH5-PH-02 · Tích hợp form Trượng xích chiêm

## Chạy thử trên TEST V28

Dùng Backend V28 và PostgreSQL TEST theo [bàn giao V28](79-TV2-TV3-TRUONG-XICH-HANDOFF.md). Chọn **Trượng xích chiêm** trong trang Mai Hoa. Form có sẵn trong Client cùng bản V28. Dùng `NEXT_PUBLIC_ACCOUNT_HISTORY=1` và cấu hình proxy ở [hướng dẫn INT-01](77-TV1-INT01-V27-TEST-HANDOFF.md#3-chạy-client) nếu kiểm lịch sử tài khoản.

- Form nhận số trượng 1–999.999 và số thước lẻ 0–9. Số đo tròn trượng nhập `0` thước. Form gửi đúng hai trường số với mã phương pháp `TRUONG_XICH`. Phạm vi v1 là lập quẻ.
- Nhập `2` và `4`. Chờ bốn bước tiến độ, kết quả Tùy → Tiệm → Vô vọng, hào động 6, trang in 61 / PDF 56. Đăng nhập, chủ động lưu kết quả, mở lại chi tiết và dùng tài khoản khác để kiểm quyền đọc.

Server thực thi theo `TEAM_DECISION`. Hồ sơ nguồn ở `SOURCE_LOCATED` và phản hồi nêu cả hai trạng thái.

## Kết quả kiểm ban đầu trước khi nhóm duyệt

- Chromium chạy Next.js, Backend và PostgreSQL TEST `huyenco_truong_xich_ui_test_20261108_234209`. Nhập thước `10` báo lỗi tại trường nhập. Trên catalog mặc định, ca `2/4` hiển thị lỗi khóa.
- Catalog tổng hợp tạm trả bốn bước tiến độ, ba quẻ, hào động và đúng trang nguồn. Sau khi đóng WebSocket, Client kết nối lại, giữ dữ kiện và giữ số lượt SEND ở một. Tài khoản chủ lưu, mở lại và thấy đúng bản lưu. Tài khoản thứ hai bị từ chối khi mở cùng URL.
- Kiểm kiểu TypeScript, 62 fixture hợp đồng và 1.382 kiểm thử Client đạt. Hồ sơ V28 ghi sáu ca chuẩn được kiểm ở Server. Bản chạy dùng catalog tổng hợp đã được dọn sau nghiệm thu.
- Các kết quả trên ghi nhận lượt kiểm trước khi nhóm duyệt.

## Kết quả nghiệm thu với catalog đã duyệt

- PostgreSQL TEST `huyenco_truong_xich_approved_test_20261108_234932`, Flyway validate V28 thành công. Readiness trả `READY` và `calculationAuthorized=true` cho `MH-TRUONG-XICH`. Quy tắc giữ `SOURCE_LOCATED`.
- Chạy trực tiếp JAR đóng gói với quyết định `DEC-20261108-MH-TRUONG-XICH`. Sáu ca chuẩn, chín ca từ chối đầu vào và bảy fixture hồi quy Mai Hoa, Tam Thế và lịch đều đạt. Kiểm lưu, đọc, xóa và cách ly bản ghi lịch sử theo tài khoản đạt.
- Chromium kiểm danh mục, form mặc định, bốn bước tiến độ, ba quẻ, hào động và trang nguồn. Sau khi ngắt socket, Client kết nối lại, giữ hai giá trị nhập và giữ số lần SEND ở một. Chủ tài khoản mở lại được bản lưu, tài khoản khác bị từ chối.
- Kiểm kiểu TypeScript, 62 fixture hợp đồng, 1.382 kiểm thử Client và 2.267 kiểm thử Backend đạt. Maven bỏ qua 30 ca tích hợp opt-in.
