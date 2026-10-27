# Kịch bản demo Client TV1 theo F01–F08

Kịch bản cho bản Client ở baseline `c227140` cộng sửa nhỏ Phase 8A. Dùng dữ liệu mẫu đã có trong `docs/examples/`, không dùng ngày sinh/câu hỏi cá nhân. Không tự suy luận lời luận hoặc phép tính để điền kết quả mong đợi.

## Điều kiện và cách ghi kết quả

- Xem [README Client](../client/README.md) và [ma trận nghiệm thu](44-TV1-PHASE8A-ACCEPTANCE.md). Ghi commit, browser, URL, môi trường TEST và người kiểm khi chạy live.
- Backend/TEST V12 phải được nhóm xác nhận; không dùng protected DB `huyenco` cho demo mutation. Không bootstrap/import/restart theo kịch bản này.
- **Mở trang Client có thể tự POST session và ghi DB.** Chỉ kết nối UI thật khi được phép. Phase 8A không chạy các bước live dưới đây, không tạo owner hoặc ghi/xóa history thật.
- Unit/component PASS, mock browser PASS và biên bản Backend PASS là ba lớp bằng chứng riêng. Mỗi ca dưới ghi trạng thái hiện có; live UI chưa kiểm lại thì giữ PENDING.
- Với mock, thông báo rõ “fixture demo”; các số ngày/quẻ/lời luận chỉ là trình bày response đã duyệt. Bản sản phẩm không có công tắc mock mặc định.

## Các ca demo

| Ca / route | Input và thao tác | Kết quả mong đợi / nguồn đối chiếu | Trạng thái và giới hạn |
| --- | --- | --- | --- |
| D01 TIME `/mai-hoa` | Chọn TIME, nhập `2024-02-10T00:00` theo giờ Việt Nam; để detailed reading tắt; gửi một lần. | Body có `datetime=2024-02-10T00:00:00+07:00`. Ba quẻ/hào động/lịch/nguồn theo `mai-hoa-time.request.json` và `.response.json`; bỏ qua requestId UUID mới khi đối chiếu. | Component/contract PASS; live UI cuối PENDING. TIME là quy ước nhóm chia6, không khẳng định phục dựng mọi câu chữ sách. |
| D02 OBJECT_COUNT `/mai-hoa` | Số vật `12`, giờ Chi `8` (Mùi), reading tắt. | Request theo `mai-hoa-object-count.request.json`; ba quẻ, hào động, bước tính và TEAM_DECISION theo response cùng tên. Không gửi `NUMBER` hai số cũ. | Component/contract PASS; live UI PENDING. Không tự chuyển SOURCE_AMBIGUOUS thành SOURCE_VERIFIED. |
| D03 LINES `/mai-hoa` | Hào 1→6: Dương, Âm, Dương, Âm, Dương, Âm; hào động2; reading tắt. | Khớp `mai-hoa-lines.request.json`/response; hào1 ở dưới, quẻ chủ/hỗ/biến và chỉ một hào động. | Component/renderer PASS; live UI PENDING. LINES nhập sẵn cấu trúc, không phải lập quẻ TIME. |
| D04 detailed TIME | Như D01, bật luận giải chi tiết, chọn Tổng quan. | `m03-time-reading.request.json`/response: Thể/Dụng,4 giai đoạn,tóm tắt,mùa và nguồn/quyết định; không tự tạo thời hạn ứng nghiệm. | Component/guard PASS; Backend M03 có biên bản41; live UI PENDING. |
| D05 detailed LINES thiếu thời điểm | Hào1→6 `[true,false,true,true,true,false]`,động1; reading LOVE; không nhập context. | `m03-lines-reading.request.json`/response: có quan hệ/lời luận; mùa NOT_EVALUATED, không dùng đồng hồ máy. | Component/contract PASS; live UI PENDING. Không thêm context tự động. |
| D06 Tam Thế EXTENDED `/tam-the` | Chọn Âm lịch,ngày `1984-02-01`,giờ `08:30`,không nhuận,cả3 category,Tài lộc Mở rộng. | `d04-wealth-no-loc.request.json`/response: CAREER/WEALTH/LOVE; Lộc không có giao điểm nguồn, Sang hèn/Điền sản vẫn có dữ liệu hợp lệ. | Component/guard PASS; Backend D04 có biên bản42; live UI PENDING. Không điền lời luận Lộc thay thế; LEGACY có thể trả FAILED toàn request. |
| D07 tra quẻ `/hexagrams` | Tìm `Tỉnh` hoặc `H_KHAM_TON`; có thể thử Bĩ/Bí,không dấu và lọc thượng/hạ; mở chi tiết. | GET query đúng contract; quẻ Tỉnh theo `hexagram-tinh.response.json`;6 hào,NAME_GLOSS và nguồn. `hexagrams-list.response.json` là ví dụ trang size2,không phải toàn bộ64 quẻ. | Component/REST PASS; E02 có bằng chứng Backend; UI live/dataset64 PENDING trong8A. Mock browser chỉ là tập con3 mẫu. |
| D08 đổi lịch `/calendar` | Dương: năm2000,tháng1,ngày1; gửi Đổi lịch. Sau đó nhập Âm1999/tháng11/ngày25,không nhuận để kiểm chiều ngược trên Server thật. | `calendar-convert.request.json`/response: Dương2000-01-01 ↔ Âm25/11/1999,tháng thường. Chiều ngược cần phản hồi Server tương ứng,không dùng mock cố định làm bằng chứng round-trip. | Client tests PASS; live UI round-trip PENDING. Dương1900–2099,UTC+7 cố định; Server xác nhận ngày/tháng nhuận. |
| D09 Can Chi `/calendar` | Dương2024-02-10,giờ23:59; bấm Tra Can Chi. | `calendar-can-chi.request.json`/response: năm Giáp Thìn,tháng Bính Dần,ngày Giáp Thìn,giờ Giáp Tý. Bỏ giờ phải nhận `hour=null`,không tự lấy giờ hiện tại. | Client tests PASS; live UI PENDING. 23:xx dùng ngày dân sự hiện tại,không phải Bát Tự theo tiết khí. |
| D10 history list/detail `/history` | Với TEST đã được phép,bootstrap cùng hostname; GET list,tìm tiêu đề,lọc type,phân trang,mở UUID của owner. | Theo `history-list.response.json` và `history-detail.response.json`: snapshot Mai Hoa/Tam Thế cùng ruleVersion/nguồn,không tính lại. | **LIVE PENDING**. Mock UI PASS; việc GET trang trước đó có thể bootstrap ghi phiên. Không dùng UUID mẫu để đoán record tồn tại trên TEST. |
| D11 history save | Sau calculation owned COMPLETED,bấm Lưu,tiêu đề tùy chọn “Demo TEST đã được phép”. | Chỉ POST requestId/title; HTTP201 hợp lệ mới báo thành công; bấm lặp không tạo hai thao tác song song. `history-save.request.json` mô tả body,không phải requestId sống trên TEST. | **LIVE PENDING — KHÔNG CHẠY TRONG8A.** Cache tối đa15 phút,có thể mất sớm; không gửi snapshot/ngày sinh/ownerId. |
| D12 history delete | Mở xác nhận,Hủy trước; sau khi được phép mới xác nhận xóa bản demo do chính mình tạo. | Hủy không DELETE; xác nhận chờ HTTP200 `{deleted:true}`; mục cuối trang chuyển trang hợp lệ. | **LIVE PENDING — KHÔNG XÓA TRONG8A.** Mock confirm/cancel có test; delete không có khôi phục trong UI. |

## Kiểm riêng tư hai owner khi được phép sau này

1. Dùng hai browser context A/B không chia cookie; hai tab cùng profile không đủ.
2. Trên TEST đã được phép,A tạo calculation owned và lưu bản demo; B tạo phiên riêng.
3. B gọi detail/delete với ID của A: Server phải từ chối theo H01,không tiết lộ record thuộc người khác; A vẫn truy cập được. Không lấy việc UI B không liệt kê record làm bằng chứng.
4. Kiểm expiry/CSRF,không log cookie/token hoặc ghi chúng vào ảnh báo cáo. Chỉ dọn dữ liệu demo theo quyền đã được cấp; không xóa lịch sử của người khác.

**Toàn bộ mục này LIVE PENDING**, không thực hiện bằng browser/DB thật trong8A. Backend H01 đã có biên bản34; cần nghiệm thu lại UI TV1 đúng môi trường hiện tại.

## Kiểm lỗi và kết nối cho buổi demo được duyệt

Ma trận mock hiện có kiểm INVALID_INPUT,INVALID_DATE,RULE_NOT_AVAILABLE,DATABASE_UNAVAILABLE,SERVER_BUSY,PROCESSING_TIMEOUT,INVALID_SESSION,CSRF_REJECTED; timeout,disconnect,reconnect,late/duplicate final,unmount và repeated submit. Có thể chạy các unit test này mà không đổi Server thật.

Buổi live cuối cần TV2 phối hợp để gây lỗi/quá tải/ngắt Server trên TEST chuyên dụng; không tự tắt Server đang dùng. Quan sát progress đúng requestId,FAILED không thành success,reconnect không resend yêu cầu cũ; retry chủ động là calculation mới. Dùng Mai Hoa/Tam Thế ở hai phiên để kiểm không nhận lẫn kết quả.

Ghi kết quả theo mẫu: `ca | commit | môi trường | input fixture | expected | actual | loại bằng chứng | PASS/FAIL/PENDING | người kiểm`. Giữ riêng raw evidence/anonymized screenshot theo quy định nhóm; không tạo số liệu benchmark từ số test. Chưa diễn tập hoặc xác minh máy sạch trong8A.
