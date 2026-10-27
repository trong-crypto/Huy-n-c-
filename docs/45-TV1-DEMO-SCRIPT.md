# Kịch bản demo Client TV1 theo F01–F08

Kịch bản ban đầu cho Client baseline `c227140` cộng sửa nhỏ Phase 8A; trạng thái dưới đây đã cập nhật bằng live 8E/8F ngày 27/10/2026 tại HEAD `d95c92651e37f840eb158f284dd1c23056130e9f`, branch `bmanh812`. Dùng dữ liệu mẫu đã có trong `docs/examples/`, không dùng ngày sinh/câu hỏi cá nhân. Không tự suy luận lời luận hoặc phép tính để điền kết quả mong đợi.

## Điều kiện và cách ghi kết quả

- Xem [README Client](../client/README.md) và [ma trận nghiệm thu](44-TV1-PHASE8A-ACCEPTANCE.md). Ghi commit, browser, URL, môi trường TEST và người kiểm khi chạy live.
- Backend/TEST V12 phải được nhóm xác nhận; không dùng protected DB `huyenco` cho demo mutation. Không bootstrap/import/restart theo kịch bản này.
- **Mở trang Client có thể tự POST session và ghi DB.** Chỉ kết nối UI thật khi được phép. Phase 8A không chạy các bước live dưới đây, không tạo owner hoặc ghi/xóa history thật.
- Unit/component PASS, mock browser PASS và biên bản Backend PASS là ba lớp bằng chứng riêng. Mỗi ca dưới ghi trạng thái hiện có; live UI chưa kiểm lại thì giữ PENDING.
- Với mock, thông báo rõ “fixture demo”; các số ngày/quẻ/lời luận chỉ là trình bày response đã duyệt. Bản sản phẩm không có công tắc mock mặc định.
- Bằng chứng live mới ở [ma trận Phase 8](44-TV1-PHASE8A-ACCEPTANCE.md): 8E run `20261027143334086`, 8F run `20261027145705907`. Dùng TEST local `huyenco_test_tv1`, Backend `127.0.0.1:8080`, Frontend `127.0.0.1:3173`, Flyway tắt, Playwright1.62.1/Chromium headless156.0.8078.4. Các lượt đã kết thúc; chạy lại session/calculation/history vẫn cần phạm vi cho phép phù hợp, không tự động có quyền mutation từ tài liệu demo.
- **Checkpoint8G:** đã đối chiếu JSON8E/8F,README và plan TV1 gốc. `npm ci`,62 fixture,typecheck,production build đều PASS từ committed checkout tách biệt **trên cùng máy**,không mở browser hoặc chạy lại demo. Đây không phải CLEAN MACHINE PASS. Phần handoff cuối của ma trận44 phân công rõ TV1/TV2/TV3 cho các mục còn PENDING; các trạng thái LIVE của D01–D12 dưới đây giữ đúng lượt đã có bằng chứng.

## Các ca demo

| Ca / route | Input và thao tác | Kết quả mong đợi / nguồn đối chiếu | Trạng thái và giới hạn |
| --- | --- | --- | --- |
| D01 TIME `/mai-hoa` | Chọn TIME, nhập `2024-02-10T00:00` theo giờ Việt Nam; để detailed reading tắt; gửi một lần. | Body có `datetime=2024-02-10T00:00:00+07:00`. Ba quẻ/hào động/lịch/nguồn theo `mai-hoa-time.request.json` và `.response.json`; bỏ qua requestId UUID mới khi đối chiếu. | **8F LIVE PASS** request/data/UI,4 progress/1 COMPLETED. TIME là quy ước nhóm chia6, không khẳng định phục dựng mọi câu chữ sách. |
| D02 OBJECT_COUNT `/mai-hoa` | Số vật `12`, giờ Chi `8` (Mùi), reading tắt. | Request theo `mai-hoa-object-count.request.json`; ba quẻ, hào động, bước tính và TEAM_DECISION theo response cùng tên. Không gửi `NUMBER` hai số cũ. | **8F LIVE PASS**; source summary giữ SOURCE_AMBIGUOUS,không đổi thành SOURCE_VERIFIED. Không chạy bộ tổ hợp lớn. |
| D03 LINES `/mai-hoa` | Hào 1→6: Dương, Âm, Dương, Âm, Dương, Âm; hào động2; reading tắt. | Khớp `mai-hoa-lines.request.json`/response; hào1 ở dưới, quẻ chủ/hỗ/biến và chỉ một hào động. | **8F LIVE PASS** request/data/ba figure và thứ tự hào. LINES nhập sẵn cấu trúc,không phải lập quẻ TIME. |
| D04 detailed TIME | Như D01, bật luận giải chi tiết, chọn Tổng quan. | `m03-time-reading.request.json`/response: Thể/Dụng,4 giai đoạn,tóm tắt,mùa và nguồn/quyết định; không tự tạo thời hạn ứng nghiệm. | **8F LIVE PASS đại diện**; body/use,chiều quan hệ,nội dung/summary/nguồn đúng. Biên bản41 giữ phạm vi1536 tổ hợp Backend riêng. |
| D05 detailed LINES thiếu thời điểm | Hào1→6 `[true,false,true,true,true,false]`,động1; reading LOVE; không nhập context. | `m03-lines-reading.request.json`/response: có quan hệ/lời luận; mùa NOT_EVALUATED, không dùng đồng hồ máy. | **8F LIVE PASS đại diện**,mùa NOT_EVALUATED và không thêm datetime. Không suy thành toàn bộ tổ hợp/chủ đề. |
| D06 Tam Thế EXTENDED `/tam-the` | Chọn Âm lịch,ngày `1984-02-01`,giờ `08:30`,không nhuận,cả3 category,Tài lộc Mở rộng. | `d04-wealth-no-loc.request.json`/response: CAREER/WEALTH/LOVE; Lộc không có giao điểm nguồn, Sang hèn/Điền sản vẫn có dữ liệu hợp lệ. | **8F LIVE PASS đại diện**,không có entry Lộc bù; Sang hèn/Điền sản được giữ. Không chạy720 ca hoặc nghiệm thu lại LEGACY. |
| D07 tra quẻ `/hexagrams` | Đi đủ các trang; tìm `Tỉnh` và `H_KHAM_TON`,lọc thượng KHAM/hạ TON,rồi mở Tỉnh. Các tìm kiếm Bĩ/Bí/không dấu là ca mở rộng chưa chạy trong8F. | Quẻ Tỉnh theo `hexagram-tinh.response.json`:6 hào,NAME_GLOSS và nguồn. `hexagrams-list.response.json` size2 chỉ là ví dụ. | **8F LIVE PASS** bốn trang20/20/20/4,64 code phân biệt; tìm tên/mã,lọc riêng/kết hợp,detail Tỉnh. Giữ gloss Giếng nước và nhãn in Ích; không phải dự đoán hoặc kiểm từng detail64 quẻ. |
| D08 đổi lịch `/calendar` | Dương: năm2000,tháng1,ngày1; gửi Đổi lịch. Sau đó nhập Âm1999/tháng11/ngày25,không nhuận để kiểm chiều ngược trên Server thật. | `calendar-convert.request.json`/response: Dương2000-01-01 ↔ Âm25/11/1999,tháng thường. Chiều ngược cần phản hồi Server tương ứng,không dùng mock cố định làm bằng chứng round-trip. | **8F LIVE PASS**,hai POST HTTP200 và result round-trip bằng nhau. Không suy thành mọi ngày/tháng nhuận trong miền1900–2099. |
| D09 Can Chi `/calendar` | Dương2024-02-10,giờ23:59; bấm Xem Can Chi. Sau đó xóa giờ và gửi lại chủ động. | `calendar-can-chi.request.json`/response: năm Giáp Thìn,tháng Bính Dần,ngày Giáp Thìn,giờ Giáp Tý. Bỏ giờ phải nhận `hour=null`,không tự lấy giờ hiện tại. | **8F LIVE PASS** hai POST HTTP200,request/data đúng; bỏ giờ không gửi field time,UI ghi Chưa xét giờ. Không phải Bát Tự theo tiết khí. |
| D10 history list/detail `/history` | Với TEST đã được phép,bootstrap cùng hostname; GET list,tìm tiêu đề,lọc type,phân trang,mở UUID của owner. | Theo `history-list.response.json` và `history-detail.response.json`: snapshot Mai Hoa/Tam Thế cùng ruleVersion/nguồn,không tính lại. | **8E LIVE PASS** list/search/type/detail của hai owner; **live pagination nhiều trang PENDING**. Không lặp lại H01 trong8F. Không dùng UUID mẫu để đoán record trên TEST. |
| D11 history save | Sau calculation owned COMPLETED,bấm Lưu,tiêu đề tùy chọn “Demo TEST đã được phép”. | Chỉ POST calculationRequestId/title; HTTP201 hợp lệ mới báo thành công; bấm lặp không tạo hai thao tác song song. `history-save.request.json` mô tả body,không phải requestId sống trên TEST. | **8E LIVE PASS** hai save201,snapshot khớp,bấm đôi một POST/context. Cache tối đa15 phút,có thể mất sớm; không gửi snapshot/ngày sinh/ownerId. Không save trong8F. |
| D12 history delete | Mở xác nhận,Hủy trước; sau khi được phép mới xác nhận xóa bản demo do chính mình tạo. | Hủy không DELETE; xác nhận chờ HTTP200 `{deleted:true}`; mục cuối trang chuyển trang hợp lệ. | **8E LIVE PASS** Hủy/Escape/focus và cleanup đúng2 record,detail sau xóa404. Chuyển trang sau xóa trong dataset nhiều trang vẫn chỉ có mock evidence; không DELETE trong8F. |

## Kịch bản riêng tư hai owner — bằng chứng 8E đã có

1. Dùng hai browser context A/B không chia cookie; hai tab cùng profile không đủ.
2. Trên TEST đã được phép,A tạo calculation owned và lưu bản demo; B tạo phiên riêng.
3. B gọi detail/delete với ID của A: Server phải từ chối theo H01,không tiết lộ record thuộc người khác; A vẫn truy cập được. Không lấy việc UI B không liệt kê record làm bằng chứng.
4. Kiểm expiry/CSRF,không log cookie/token hoặc ghi chúng vào ảnh báo cáo. Chỉ dọn dữ liệu demo theo quyền đã được cấp; không xóa lịch sử của người khác.

**8E đã LIVE PASS** đọc/xóa chéo hai chiều404,thiếu/sai CSRF403,record gốc được giữ,sau đó cleanup đúng hai record. Không thực hiện trong8A và không lặp trong8F. Expiry phiên không được cố tình kích hoạt trong lượt8E; giữ bằng chứng Backend/component riêng. Biên bản34 và ma trận44 ghi rõ từng lớp bằng chứng; mọi lượt ghi/xóa mới cần được cấp phép riêng.

## Kiểm lỗi và kết nối cho buổi demo được duyệt

Ma trận mock hiện có kiểm INVALID_INPUT,INVALID_DATE,RULE_NOT_AVAILABLE,DATABASE_UNAVAILABLE,SERVER_BUSY,PROCESSING_TIMEOUT,INVALID_SESSION,CSRF_REJECTED; timeout,disconnect,reconnect,late/duplicate final,unmount và repeated submit. Có thể chạy các unit test này mà không đổi Server thật.

Buổi live cuối cần TV2 phối hợp để gây lỗi/quá tải/ngắt Server trên TEST chuyên dụng; không tự tắt Server đang dùng. Quan sát progress đúng requestId,FAILED không thành success,reconnect không resend yêu cầu cũ; retry chủ động là calculation mới. Dùng Mai Hoa/Tam Thế ở hai phiên để kiểm không nhận lẫn kết quả.

Ghi kết quả theo mẫu: `ca | commit | môi trường | input fixture | expected | actual | loại bằng chứng | PASS/FAIL/PENDING | người kiểm`. Giữ riêng raw evidence/anonymized screenshot theo quy định nhóm; không tạo số liệu benchmark từ số test. 8F đã kiểm luồng thành công trên hai context:6 SEND/24 progress/6 terminal,mỗi request đúng UUID,không nhận lẫn. **Live reconnect/timeout/server-loss/late hoặc duplicate terminal fault injection vẫn PENDING**; không tắt Backend để ép lỗi. **Máy sạch/gói nộp còn PENDING**,không có load benchmark mới. History nhiều trang chỉ có mock evidence; không nhầm với4 trang thư viện64 quẻ đã LIVE PASS.
