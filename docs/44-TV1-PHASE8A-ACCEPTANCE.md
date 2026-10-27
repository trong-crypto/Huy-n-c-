# TV1 Phase 8A kiểm toán Client và ma trận nghiệm thu

Ngày 27/10/2026. Branch `bmanh812`, baseline `c2271405a9f785d8d1e6d83e3404f910a537ff24`. Phase 6 ở `b1e4965`, Phase 7 ở `dc6dda0`; merge main `9905c40` đã hoàn tất trước lượt này. Đây là audit/tài liệu và sửa UI nhỏ, không phải tuyên bố toàn sản phẩm COMPLETE.

## Đối chiếu kế hoạch gốc

Đã đọc bản local `C:\Users\ADMIN\Downloads\HuyenCo_TV1_KeHoach_ChiTiet.docx`, đặc biệt Phase 8/P8 T01–T05 và ma trận kiểm thử. Kế hoạch yêu cầu test sau tích hợp, demo hai phiên, kiểm lỗi/keyboard/mobile, README, kịch bản F01–F08, bằng chứng và kiểm bản sạch. Trong 8A: thực hiện review Client, regression, tài liệu và browser fixture. Chưa thực hiện live H01, thử mất Server thật, benchmark hoặc kiểm máy sạch. Không tự mở thêm tính năng ngoài F01–F08.

Quy ước trạng thái: **IMPLEMENTED** = có code; **MOCK ACCEPTED** = đã kiểm Client bằng mock, không chứng minh nghiệp vụ/ACL thật; **LIVE ACCEPTED** chỉ dùng kèm môi trường/ca thực tế; **BLOCKED** ghi rõ phụ thuộc. Bằng chứng Server trong các biên bản dưới là nghiệm thu Backend được bàn giao, không tự nâng UI TV1 thành LIVE ACCEPTED. Không chạy lại chúng trong 8A.

## Ma trận F01–F08

Đường dẫn test/code dưới đây tương đối với `client/`; mỗi nhóm đều thuộc full regression của lượt này, không cộng trùng số ca giữa các F.

| F / phần đã làm | Trạng thái Client | Test và file liên quan | Bằng chứng Server có sẵn | Giới hạn / blocker / người làm tiếp |
| --- | --- | --- | --- | --- |
| F01 TIME, gửi offset +07:00, nhận lịch/ba quẻ | IMPLEMENTED; mock regression | `src/app/mai-hoa/page.tsx`, `page.test.tsx`, `result-flow.test.tsx`, `components/mai-hoa/maiHoaInput.test.ts`, `types/contractValidation.test.ts` | [B04](27-B04-TIME-HANDOFF.md), [chốt chia6](28-TIME-OWNER-APPROVAL.md); fixture TIME runtime | Quy ước nhóm, UTC+7 cố định; TV1/TV2 kiểm lại UI live sau thay đổi session H01. |
| F02 OBJECT_COUNT, số vật/giờ Chi độc lập | IMPLEMENTED; mock regression | `components/mai-hoa/maiHoaInput.ts`, `.test.ts`, `app/mai-hoa/page.test.tsx`, `result-flow.test.tsx` | [B03](21-B03-OBJECT-COUNT-HANDOFF.md), fixture `mai-hoa-object-count` | TEAM_DECISION/SOURCE_AMBIGUOUS không được gọi công thức nguyên bản đã xác minh. TV1/TV2 demo live. |
| F03 LINES và quẻ chủ/hỗ/biến, hào động | IMPLEMENTED; mock regression | `LinesForm`, `linesInput`, `MaiHoaResultView`, `HexagramView` và các test cùng tên | [B01](18-B01-LINES-HANDOFF.md), ví dụ `mai-hoa-lines`, [M03](41-M03-MAI-HOA-INTERPRETATION-HANDOFF.md) | Hào 1 ở dưới; LINES là nhập cấu trúc, không thay TIME/OBJECT_COUNT. Lời luận opt-in giữ nguồn và quyết định. |
| F04 Tam Thế CAREER/WEALTH/LOVE, EXTENDED | IMPLEMENTED; mock regression | `app/tam-the/page.tsx`, `.test.tsx`, `tamTheInput`, `wealthInput`, `results/ReadingResults.test.tsx`, `types/d04Wealth.test.ts` | [D03](30-D03-TAM-THE-HANDOFF.md), [D04](42-D04-TAM-THE-EXTENDED-WEALTH-HANDOFF.md); 720 tổ hợp được Backend báo nghiệm thu | Không bù lời luận cho khóa Lộc thiếu; LEGACY/EXTENDED khác semantics. TV1 kiểm UI live + nguồn cùng TV2/TV3. |
| F05 tìm/lọc/phân trang/chi tiết 64 quẻ | IMPLEMENTED; mock regression | `app/hexagrams/page.tsx`, `.test.tsx`, `HexagramDetailPanel.test.tsx`, `rest/hexagrams.test.ts`, `hexagramValidation.test.ts` | [E02](32-E02-HEXAGRAM-LOOKUP-HANDOFF.md), fixture `hexagrams-list`/`hexagram-tinh` | NAME_GLOSS không phải lời luận chi tiết. Mock browser 8A chỉ dùng ba mẫu, không chứng minh đủ 64 bản ghi. TV1/TV3 kiểm live dataset. |
| F06 đổi lịch hai chiều và Can Chi | IMPLEMENTED; mock regression | `app/calendar/page.tsx`, `components/calendar/*`, `rest/calendar.test.ts`, `calendarValidation.test.ts` | [C01](26-C01-CALENDAR-HANDOFF.md): báo 18 ca HTTP thật; fixture lịch từ HTTP | Dương 1900–2099, UTC+7 cố định; leap month do Server xác nhận. TV1 đối chiếu ca chuẩn UI/API live. |
| F07 progress, timeout/disconnect/reconnect | IMPLEMENTED; mock regression | `websocket/useCalculation*.test.ts`, `calculationState.ts`, `ResultPanel.test.tsx`, `scripts/calculation-state.test.mjs` | [B02](20-B02-PROGRESS-HANDOFF.md), [N01](36-N01-CONCURRENCY-IDEMPOTENCY-HANDOFF.md), [V12](43-HUYENCO-V12-DEPLOYMENT-ACCEPTANCE.md) | Không resend tự động; replay terminal không cần progress giả. TV1/TV2 còn demo network/two-session live cuối. |
| F08 bootstrap/save/list/search/detail/delete | MOCK ACCEPTED; live BLOCKED trong lượt này | `app/history/*`, `components/history/HistoryUI.test.tsx`, `rest/history.test.ts`, `session/SessionProvider.test.tsx`, `historyValidation.test.ts` | [H01](34-H01-SESSION-HISTORY-HANDOFF.md) báo test Server hai-owner; không phải acceptance UI TV1 hiện tại | **LIVE PENDING**: cần phép thao tác TEST và hai context độc lập, kiểm đọc/xóa chéo tại Server. TV1 + TV2/TV3 phối hợp. |

## Review và sửa tập trung

- Trang chủ còn hai nhãn TIME/Tam Thế “đang phát triển”; thay bằng tên các phương pháp/category hiện có, không gắn nhãn live thành công.
- ResultPanel idle còn thông báo “kiểm tra hợp đồng giao tiếp”; thay bằng hướng dẫn nhập/gửi để xem tiến trình và kết quả. Cập nhật assertion câu chữ tương ứng, giữ kiểm trạng thái kết nối.
- Browser tái hiện tiêu đề history 100 chữ `W` hợp lệ làm `scrollWidth=3242` tại viewport320; thêm `overflow-wrap:anywhere` cho heading của PageHeader. Không đổi dữ liệu hoặc validator để né lỗi.
- Navigation có đủ 6 mục và skip link; detail có link trở lại collection. Không tạo thêm trang hoặc redesign.
- Loading/error/empty, input focus lỗi, nguồn/TEAM_DECISION, REST cancellation và vòng đời STOMP được review theo code/test hiện có. Không đổi API, timer hoặc thuật toán.

## Ma trận lỗi và lifecycle

| Ca | Bằng chứng Client |
| --- | --- |
| INVALID_INPUT, INVALID_DATE, RULE_NOT_AVAILABLE, DATABASE_UNAVAILABLE, SERVER_BUSY, PROCESSING_TIMEOUT | `useCalculation.test.ts` ca “T02 retains matching Server failure”; `contractValidation.test.ts`; lịch có thêm mapping HTTP trong `rest/calendar.test.ts`. |
| INVALID_SESSION, CSRF_REJECTED | `rest/history.test.ts`, `SessionProvider.test.tsx`, `HistoryUI.test.tsx`: không báo thành công, ẩn state riêng tư, không tự retry mutation. |
| Client timeout, late response, duplicate final | `useCalculation.test.ts`, `scripts/calculation-state.test.mjs`: deadline tổng không gia hạn bằng progress, terminal cũ/trùng không ghi đè. |
| Disconnect/reconnect, không resend | `useCalculation.test.ts`, `useCalculation.connection.test.ts`; ca H01 phục hồi session không replay request cũ. |
| Stale REST, unmount, repeated submit | `app/hexagrams/page.test.tsx`, `CalendarForm.test.tsx`, `HistoryUI.test.tsx`, `rest/hexagrams.test.ts`: abort/ignore response cũ; guard pending. |

Đây là test mock/thuần Client. Lượt 8A không gây lỗi trên Server thật hoặc ngắt kết nối của người khác.

## Responsive, accessibility và bằng chứng browser

Kiểm tra bằng preview production cô lập `127.0.0.2:3183`, mock `127.0.0.2:8183`. Session API mock chỉ trả canned DTO, không Set-Cookie/tạo owner/session thật; history POST/DELETE bị chặn. Snapshot là fixture được duyệt; riêng tiêu đề 100 chữ W là ca stress tổng hợp. Không dùng output này để chứng minh công thức, đủ dataset hay ownership.

Kết quả browser 8A:

- **32/32 kiểm tra route × viewport PASS**: tám route nêu trong README tại320,375,768,1440px; không có horizontal overflow hoặc nội dung role=alert tại lúc đo. Trang detail history dùng M03 snapshot cùng tiêu đề stress100 chữ W; không dùng dữ liệu cá nhân.
- Tiêu đề stress sau sửa tại320px: document scrollWidth305px bằng clientWidth305px,heading scrollWidth256px; trước sửa document scrollWidth3242px. Ngắt dòng giữ toàn bộ tiêu đề,không cắt hoặc đổi dữ liệu.
- Skip link nhận focus bằng Tab và có outline rõ. Submit TIME trống báo lỗi,aria-invalid và focus về `maihoa-datetime`. Nhãn input hiển thị đầy đủ.
- Dialog ở375px: focus đầu Hủy → Tab tới Xác nhận xóa → Shift+Tab về Hủy; Escape đóng và trả focus về nút Xóa ban đầu. **Không bấm xác nhận xóa.**
- Tam Thế EXTENDED từ canned STOMP có đủ ba tiểu mục và no-match Lộc; phần lời luận/nguồn nhìn được ở375px. Saved snapshot cùng fixture được kiểm thêm ở320px: scrollWidth=clientWidth305px. Nhập giờ native bằng phím được kiểm; không thay input/validator do hạn chế fill của công cụ.
- Browser console không có warning/error ở lần đọc cuối. Mock stats cuối:36 canned session responses,10 history GET,1 calculation fixture,**0 history mutation requests**. Các response phiên mẫu không tạo cookie,owner,session thật hoặc dòng DB.

Ảnh và helper lưu ngoài repo trong thư mục `visualizations/2026/10/01/01a0f781-cc34-7c43-9631-a90ccb2f9129` của Codex: `huyenco-phase8a-responsive.json`, `huyenco-phase8a-title-before.jpg`, `huyenco-phase8a-title-after.jpg`, `huyenco-phase8a-home-desktop.jpg`, `huyenco-phase8a-validation-mobile.jpg`, `huyenco-phase8a-tam-the-mobile.jpg`, `huyenco-phase8a-dialog-mobile.jpg`. Không đưa screenshot tạm vào commit. Bằng chứng mock lưu/xóa Phase7 thuộc lượt trước;8A không gửi save/delete. Đây là review UI/keyboard,không phải chứng nhận accessibility toàn diện hoặc test ownership thật. Đã reset viewport,đóng tab và dừng hai process mock/preview do lượt8A tạo;không restart Backend.

## Verification cuối

Baseline trước 8A: 1213 Vitest +12 Node =1225 test PASS,62 fixture, typecheck/build PASS.

Kết quả test8A: **35 file Vitest/1213 test PASS**,**12 Node calculation/reducer test PASS**,tổng**1225 PASS/0 failed/0 skipped**;**62 JSON fixture PASS**. Lượt đầu có1 failure do assertion ResultPanel còn tìm câu idle cũ;đã đổi assertion sang câu mới,không xóa test hoặc nới kiểm trạng thái. Lượt full regression kế tiếp PASS toàn bộ;không thêm test logic trùng vì các ca lỗi/lifecycle đã có coverage.

Typecheck cuối: **PASS**. Production build bằng cấu hình thông thường: **PASS**,đủ tám route yêu cầu;diff check của các thay đổi code: **PASS**. Hai build có đích mock chỉ dùng nghiệm thu visual,trong đó build thứ hai sau sửa overflow;không coi chúng là bản production thật. Đã dừng mock trước build cuối,không mở UI nối Backend thật. Các biến mock chỉ đặt trong process kiểm thử,không sửa `.env.local` hoặc cấu hình được track.

## Blocker và bàn giao tiếp

1. Live H01 save/delete và hai-owner TV1: PENDING; cần cho phép đúng TEST DB và phối hợp kiểm quyền tại Server. Kể cả mở trang thật cũng bootstrap phiên và có thể ghi DB.
2. UI/network F01–F07 cuối sau tích hợp session: chưa nghiệm thu lại toàn trình ở 8A; không thay bằng số test mock.
3. Cài/chạy trên máy/cấu hình sạch, demo hai browser, gói nộp và bằng chứng báo cáo còn cần thực hiện theo P8 T02/T04/T05. Không có script `test:e2e` trong package hiện tại; không ghi là đã chạy.
4. Không có benchmark mới trong 8A; TV2 cung cấp số đo thật nếu dùng trong báo cáo. Không chạy 739-case E2E/load test để đóng 8A.

Không commit/push 8A. Không đổi Server/DB/fixture gốc; giữ audit artifact untracked có sẵn. README này và kịch bản demo là tài liệu bàn giao để nhóm review, không phải nghiệm thu cuối toàn sản phẩm.
