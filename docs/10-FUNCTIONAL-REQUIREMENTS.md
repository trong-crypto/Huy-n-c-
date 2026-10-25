# Yêu cầu chức năng phía người dùng và điều kiện nghiệm thu

**Cập nhật D03 ngày 25/10:** phần Server F04 đã có CAREER/WEALTH/LOVE qua STOMP; tra theo năm/tháng âm thật, giữ nhiều kết quả và đầy đủ nguồn. 263 terminal/1.034 progress D03 và 464 Java có DB đạt; 24 fixtures/typecheck/12 kiểm thử guard Client đạt. **F04 còn nghiệm thu UI TV1**, đồng thời công bố nguồn Lộc chỉ phủ 60/120 khóa: khóa không có trả lỗi toàn request, không tạo lời luận. D03 không thêm migration hay đổi dữ liệu VERIFIED; E01/E02 tiếp theo. Xem `30-D03-TAM-THE-HANDOFF.md`; các mốc TamTheService chưa triển khai bên dưới là lịch sử.

**Cập nhật D02 ngày 25/10:** dữ liệu F04 đã bổ sung 120 giao điểm tài lộc/12 đoạn, 60 ô tình duyên chung/12 bài tám câu, 36 đoạn giờ và đủ 12 mốc, VERIFIED đúng phạm vi. Huyenco V9/447 ô tra; audit 0 FAIL/1 PENDING (E01), 455 Java có DB/50 Python đạt. **F04 vẫn chưa đạt: cần D03/TamTheService và UI TV1**, không phải chờ duyệt lại các mục đã chốt. Lộc chỉ phủ 60/120 khóa; 40 phút là TEAM_DECISION và chữ mờ được đánh dấu. Xem `29-D02-TAM-THE-DATA.md`; các mốc D02 chưa nhập ở dưới là lịch sử.

**Cập nhật theo xác nhận của chủ dự án:** MH-TIME đã được duyệt **VERIFIED cho quy tắc dự án dùng chia6**; không còn chờ xác nhận lại. TIME trả TEAM_DECISION/VERIFIED; câu chữ bản in được giữ trong ghi chú nguồn. Biên bản `docs/28-TIME-OWNER-APPROVAL.md` thay các ghi nhận BLOCKED/chưa duyệt của MH-TIME ở mốc trước.

**Bổ sung B04 ngày 24/10:** phần Server F01 đã có TIME→lịch C01→ba quẻ/hào động/progress qua STOMP, có ca ngày thật và fixture runtime. UTC+7 cố định, năm âm/Tết, ranh 00:00/23:00 và tháng nhuận cùng số đã chốt. `ruleBasis=TEAM_DECISION`, `sourceStatus=BLOCKED_SOURCE_CONFLICT`; không gọi MH-TIME đã xác minh nguyên bản. F01/F03/F07 còn tích hợp/kiểm UI TV1; F04 còn D02/D03. Xem `27-B04-TIME-HANDOFF.md`; các ghi nhận “TIME chưa triển khai” ở mốc cũ là lịch sử.

**Bổ sung C01 ngày 24/10:** phần Server của F06 đã có API đổi lịch hai chiều và Can Chi, phạm vi Dương 1900–2099, cờ nhuận/ngày thiếu hợp lệ; UTC+7 cố định, đổi năm tại Tết/ngày 00:00. Nguồn astronomy/giấy phép được pin; V8 và biên bản LUNAR-CONVERSION đã áp dụng vào huyenco. F06 còn tích hợp/nghiệm thu giao diện TV1; TIME B04 và Tam Thế D03 vẫn chưa hoàn thành. Xem `26-C01-CALENDAR-HANDOFF.md` về kiểm chứng và giới hạn lịch sử; không gọi đây là Bát Tự theo tiết khí.

**Bổ sung D01 ngày 24/10:** phần dữ liệu công danh đã có 51 giao điểm Số 11, 120 ô Số 13 và 12 đoạn, nhập/VERIFIED cùng hai rule trong phạm vi biên bản 25. V7 giữ riêng trang bảng/trang đoạn và nhãn khác nhau, có căn cứ liên kết theo thứ tự nguồn. Đây là dữ liệu cho F04; **F04 chưa đạt** vì còn C01/D02/D03 và tích hợp TV1. Không coi 120 ô là 120 đoạn khác nhau hoặc lời giải toàn bộ Tam Thế. Xem `25-D01-CAREER-DATA.md`; các mốc S02/S03 bên dưới là lịch sử trước D01.

**Bổ sung S03 ngày 24/10:** đã định vị tài lộc PDF41-42 và tình duyên chung PDF63-67 trong Tam Thế, cùng nghĩa tên 64 quẻ Mai Hoa PDF269-271. Đây là nguồn đã khảo sát, chưa phải dữ liệu lời luận VERIFIED hoặc API hoàn thành. F04 vẫn cần D01/D02/D03 và lịch; F05 cần E01/E02. Nghĩa tên ngắn được phân loại NAME_GLOSS, không thay cho dự đoán chi tiết nếu sản phẩm yêu cầu phần đó. Các dòng “chưa định vị” trong cột 22/10 là lịch sử. Xem `24-S03-SOURCE-MAP.md`.

**Hiện trạng 24/10 sau B03:** LINES và OBJECT_COUNT phía Server đã tính quẻ chủ/hỗ/biến thật qua registry/PostgreSQL/STOMP, có bốn bước progress B02; kiểm bằng chương trình Client giao thức. S01 duyệt 64 tên; B03 duyệt riêng MH-TRIGRAM bằng biên bản Codex cùng công cụ lượt hai. Công thức số vật giữ TEAM_DECISION/SOURCE_AMBIGUOUS. Giao diện và tích hợp biểu mẫu/kết quả thuộc TV1/I01; các sửa biểu mẫu B03 đã hoàn tác. TIME/lịch/Tam Thế/lời luận và các REST còn thiếu; chưa nghiệm thu F01–F08 toàn bộ. Cột hiện trạng 22/10 bên dưới là mốc ban đầu. Chi tiết tại `21-B03-OBJECT-COUNT-HANDOFF.md`.

**Bổ sung S02:** 60 Can Chi→hành đã nhập/VERIFIED theo cột mạng PDF11 và biên bản 22; không gồm mô tả nạp âm. Đây là dữ liệu nền cho F04/F06; TamTheService và bộ chuyển lịch vẫn chưa hoàn thành, không nâng F04/F06 thành đạt. Các dữ liệu khác của Tam Thế còn theo S03/D01/D02.

**Quyết định phạm vi ngày 22/10/2026:** chủ dự án yêu cầu đầy đủ các chức năng trong bảng này. Đây là đích nghiệm thu của sản phẩm, không phải tuyên bố rằng mã nguồn hiện đã hoàn thành. `MAI_HOA/LINES` chỉ là lát cắt kỹ thuật làm trước. Quy tắc và dữ liệu sách phải có trang nguồn, người nhập, người kiểm và ca chuẩn trước khi trả kết quả thật.

| Mã | Người dùng làm được gì | Đầu ra/điều kiện nghiệm thu | Chủ trì | Hiện trạng 22/10 |
| --- | --- | --- | --- | --- |
| F01 | Chọn ngày/giờ để lập quẻ Mai Hoa | Server chuẩn hóa lịch/múi giờ, tính quẻ chủ, hào động theo tổng chia 6 (0→6), quẻ hỗ, quẻ biến, các bước tính và nguồn | TV2; TV3 lịch/nguồn; TV1 UI | Quyết định chia 6 đã chốt; thuật toán còn bị chặn bởi lịch và test nguồn |
| F02 | Nhập số vật để lập quẻ Mai Hoa | `OBJECT_COUNT` nhận `objectCount` và `hourIndex`; thượng/hạ quái theo chia 8, hào động theo tổng chia 6; có ca chuẩn và kết quả như F01 | TV2; TV3 nguồn; TV1 UI | Hợp đồng/hàm số học đã cập nhật; cụm “số quẻ” trang 51 cần kiểm độc lập trước VERIFIED |
| F03 | Xem quẻ chủ, quẻ hỗ, quẻ biến, hào động | Sáu hào đúng thứ tự từ dưới lên, tên/mã nếu bảng 64 quẻ đã kiểm, từng bước biến đổi và `sourceReferences` | TV2 tính; TV3 bảng; TV1 trình bày | Chưa có phép tính thật; hợp đồng LINES v1.1 là điểm khởi đầu |
| F04 | Xem luận giải Tam Thế về công danh, tài lộc, tình duyên | Ba mục riêng, mỗi mục chỉ xuất nội dung đã nhập/kiểm đúng ô bảng và dẫn trang; không tự tạo văn bản dự đoán | TV3; TV2 tích hợp; TV1 UI | Form Tam Thế có; công danh mới định vị một phần; tài lộc/tình duyên chưa lập bản đồ nguồn |
| F05 | Tra cứu 64 quẻ | Tìm theo tên/mã, lọc theo thượng/hạ quái, xem sáu hào, nội dung và nguồn; đủ 64 bản ghi được kiểm, không trùng/thiếu | TV3 dữ liệu; TV2 API; TV1 UI | Chỉ có schema nháp, chưa có bộ 64 bản ghi được xác minh |
| F06 | Đổi lịch Dương–Âm và tính Can Chi | Chuyển hai chiều trong khoảng năm công bố, có tháng nhuận, giờ Việt Nam và Can Chi dùng thống nhất bởi F01/F04; kiểm bằng bộ ngày chuẩn độc lập | TV3; TV2 API; TV1 UI | Module lịch còn trống; phải chốt nguồn thuật toán, phạm vi năm và quy tắc tiết khí |
| F07 | Theo dõi quá trình lập quẻ và nhận kết quả thời gian thực | Sau khi gửi, Client thấy đang kết nối/đã nhận/đang tính/hoàn tất hoặc thất bại; các bước có thứ tự, cùng `requestId`, đúng phiên; reconnect/timeout rõ ràng | TV2 giao thức; TV1 UI | Có phản hồi cuối qua STOMP; chưa có progress hoặc bước tính |
| F08 | Lưu và tra cứu lịch sử của mình | Người dùng chủ động lưu/xem/tìm/xóa kết quả; Server bảo vệ quyền đọc theo chủ sở hữu, phân trang và không lộ dữ liệu giữa người dùng; test truy cập chéo | TV3 lưu trữ; TV2 API/bảo mật; TV1 UI | Chưa có bảng lịch sử hoặc API; cần PostgreSQL cài trực tiếp/chung, Docker không bắt buộc |

## Ràng buộc hợp đồng và riêng tư

- Giữ envelope `requestId`, `type`, `status`, `data`, `error` và phản hồi STOMP riêng theo session. Mở rộng hợp đồng lên v1.2 cho `TIME`, phương pháp số được kiểm, Tam Thế theo nhóm luận giải, tra cứu/lịch/lịch sử và `/user/queue/progress`. Tài liệu API phải chứa ví dụ request, response, lỗi cho từng chức năng trước khi tích hợp.
- Mỗi kết quả có `ruleVersion`, `sourceReferences`, `calculationSteps` khi có phép tính; các mục Tam Thế có `category` phân biệt `CAREER`, `WEALTH`, `LOVE`. Mã cấu trúc nội bộ dùng bộ 64 dãy hào đã kiểm đầy đủ; tên quẻ chỉ hiển thị khi bản ghi tên có nguồn/người duyệt và VERIFIED.
- Chỉ lưu lịch sử khi người dùng chủ động chọn lưu; không lưu bản rõ ngày sinh/câu hỏi nếu không cần cho việc xem lại. Xác định cơ chế sở hữu lịch sử và xóa dữ liệu trước khi bật F08. Không dùng session WebSocket ngắn hạn làm định danh sở hữu lâu dài.
- Tính theo Server; Client chỉ kiểm đầu vào sơ bộ và trình bày. Dữ liệu chưa xác minh không được trả như luận giải thật.

## Cổng nghiệm thu

1. TV3 lập ma trận `ruleCode → sách/ấn bản/mục/trang in/trang PDF → input/output → người kiểm` cho TIME, OBJECT_COUNT, Tam Thế ba nhóm, 64 quẻ và lịch. Mục tài lộc/tình duyên chưa tìm ra trong bản sách phải ghi `SOURCE_NOT_LOCATED`, không suy đoán.
2. Theo tổ chức mới, đối chiếu hai lượt có chứng cứ cho từng phép tính, ghi đúng người/công cụ thực hiện; test đơn vị và đầu cuối. Chỉ bật COMPLETED khi đủ policy/nguồn/dữ liệu/implementation theo hợp đồng v1.2. Quy ước nhóm phải có decisionReferences và cảnh báo, không biến thành xác minh thuật toán nguyên bản. Lời luận giải vẫn cần nguồn VERIFIED.
3. TV1 demo từng F01–F08 từ giao diện trên hai trình duyệt; TV2 xác nhận đúng `requestId`/session, xử lý lỗi, quá tải và không rò lịch sử.
4. Có dữ liệu đo thật cho 1, 5, 20 Client, báo cáo giới hạn và danh sách chức năng chưa đạt nếu còn. Chỉ gọi sản phẩm **đầy đủ** khi cả F01–F08 đạt các điều kiện trên.
