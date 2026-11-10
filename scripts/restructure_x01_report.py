"""Arrange the reviewed X01 report to match the course report outline.

This keeps the pinned measurement blocks and figures intact. New prose only
connects existing project evidence; it does not change benchmark values.
"""

from __future__ import annotations
import re


def restructure(blocks, authors):
    b = blocks
    assert b[7]["text"] == "1 Giới thiệu"
    assert b[99]["text"] == "15 Tài liệu tham khảo"
    def h(text, level=1): return {"kind": "heading", "text": text, "level": level}
    def p(text): return {"kind": "paragraph", "text": text}
    def page(): return {"kind": "page"}
    def table(caption, headers, rows, widths=None):
        return {"kind": "table", "caption": caption, "headers": headers, "rows": rows, "widths": widths}
    out = list(b[:7])

    # 1. Introduction: measurable criteria are declared before the results.
    out += [h("1. Giới thiệu (Introduction)"), h("1.1. Bối cảnh và động lực xây dựng Huyền Cơ", 2), b[8],
        h("1.2. Mục tiêu và phạm vi hệ thống", 2),
        p("Hệ thống tách Client Next.js, Server Spring Boot và PostgreSQL. Server tính Mai Hoa theo LINES, OBJECT_COUNT, TIME; tra cứu Tam Thế, 64 quẻ, lịch Âm–Dương/Can Chi; Client hiển thị tiến trình và kết quả, người dùng có thể lưu/xem/xóa lịch sử theo phiên sở hữu. Báo cáo chỉ đánh giá những nhánh đã có mã và bằng chứng nghiệm thu; không coi nội dung luận giải là dự đoán khoa học. [9–13]"),
        h("1.3. Các chức năng chính và yêu cầu Lập trình mạng", 2), b[9],
        p("Yêu cầu mạng là tương quan requestId với đúng phiên STOMP, trả progress và một terminal, giới hạn yêu cầu đang chạy, xử lý gửi lặp, mất kết nối và từ chối quá tải có mã. REST phục vụ tra cứu, lịch, phiên và lịch sử; STOMP phục vụ phép tính có tiến trình. [8,9,11]"),
        h("1.4. Tiêu chí đánh giá chức năng, hiệu năng và độ tin cậy", 2),
        p("Chức năng được đánh giá bằng ca Client–Server–PostgreSQL TEST đại diện: ba phương pháp Mai Hoa, Tam Thế, tra cứu quẻ, lịch, lưu/xem/xóa lịch sử và quyền sở hữu. Một ca chỉ đạt khi input, requestId, tiến trình, kết quả, trạng thái nguồn và mã lỗi phù hợp hợp đồng; các ca đại diện không chứng minh toàn bộ miền input. [9,13]"),
        p("Hiệu năng được mô tả bằng latency median/P95/P99, throughput và số lỗi của ma trận 2/5/20 Client × direct/bounded × ba lần, cùng phương pháp cohort đã chốt trước khi tổng hợp. Nhóm không đặt SLA hay ngưỡng thắng tuyệt đối trước phép đo, nên không đổi số đo thành nhãn đạt/chưa đạt tùy kết quả. [5,7]"),
        p("Độ tin cậy được kiểm riêng bằng bảy tình huống quá tải/idempotency, định tuyến phiên, replay, reconnect và TTL. Trạng thái dữ liệu phải có căn cứ theo từng bản ghi; SOURCE_VERIFIED không được suy từ một mục đã duyệt sang toàn bộ sách. [6,10,12]"),
        h("1.5. Cấu trúc báo cáo", 2),
        p("Mục 2–4 trình bày cơ sở, bài toán và giải pháp; mục 5–7 mô tả kiến trúc, giao tiếp mạng và triển khai. Mục 8 nêu thiết lập đo, mục 9 công bố kết quả, mục 10 thảo luận. Mục 11–14 nêu đóng góp, giới hạn, hướng phát triển và kết luận; phụ lục A–F giữ hợp đồng, cách chạy, fixture và bằng chứng chi tiết."), page()]

    # 2. The compared baseline is internal and is not presented as an external product.
    out += [h("2. Background / Related Work"), h("2.1. Client–Server, HTTP/REST, STOMP WebSocket và PostgreSQL", 2), b[12], b[13],
        p("HTTP/REST phù hợp truy vấn và thao tác tài nguyên; STOMP/WebSocket giữ một kết nối để Server đẩy tiến trình, kết quả và lỗi theo phiên. PostgreSQL giữ dữ liệu sách, trạng thái duyệt và lịch sử; khác nhau ở vai trò, các công nghệ này không phải các phương án benchmark thay thế cho nhau. [1–3,9,11]"),
        h("2.2. Các hệ thống và giải pháp liên quan", 2),
        p("Báo cáo xét ba giải pháp kỹ thuật có thể kiểm chứng: WebSocket/STOMP theo đặc tả và Spring; ThreadPoolExecutor với hàng đợi hữu hạn; và baseline direct trong chính Huyền Cơ. Chưa có phép so sánh chức năng hoặc thực nghiệm với một sản phẩm Dịch học bên ngoài, vì vậy không gán các kết quả nội bộ cho hệ thống khác. [1–4,8]"),
        table("Đối chiếu các giải pháp liên quan", ["Giải pháp", "Vai trò", "Khoảng trống được Huyền Cơ xử lý"], [
            ["WebSocket/STOMP + Spring", "Vận chuyển và định tuyến frame", "Hợp đồng requestId, progress/terminal và quyền theo phiên do ứng dụng định nghĩa"],
            ["ThreadPoolExecutor", "Worker, queue và từ chối khi đầy", "Admission, deadline, cleanup và ánh xạ SERVER_BUSY vào STOMP"],
            ["Baseline direct nội bộ", "Tính trên luồng gọi dispatcher", "Đối chứng cùng service, dữ liệu và idempotency với bounded"]], [4.0, 4.3, 8.3]),
        h("2.3. Nhận xét và vị trí của Huyền Cơ so với các giải pháp liên quan", 2), b[14],
        p("Đóng góp nằm ở cách tích hợp các cơ chế đã biết cho yêu cầu có nguồn, đúng phiên và kiểm soát quá tải, cộng với phép so sánh direct/bounded có cùng workload. Không tuyên bố sáng tạo một protocol hoặc thuật toán hàng đợi mới. [5–8]"), page()]

    out += [h("3. Problem Definition"),
        p("Bài toán là xử lý yêu cầu tính/tra cứu tri thức từ nhiều Client sao cho kết quả đúng nghiệp vụ, không lẫn phiên, không thực hiện trùng không cần thiết và không nhận vô hạn khi tài nguyên đã kín. Dữ liệu sách có phạm vi xác minh khác nhau; Server chỉ sử dụng quy tắc/nội dung được phép và trả trạng thái nguồn đúng hồ sơ. [8–12]"), b[16], b[17],
        p("Đầu ra thành công có requestId, type, trạng thái COMPLETED, dữ liệu và căn cứ; đầu ra thất bại có FAILED cùng mã lỗi. Với lịch sử, Client chỉ gửi requestId của kết quả đã tính, còn Server lưu snapshot thuộc owner. Hiệu năng được đo trên một lát cắt LINES cố định, không đại diện tự động cho tất cả chức năng. [5,9,11]"), page()]

    out += [h("4. Proposed Approach"), h("4.1. Ý tưởng tổng thể", 2), b[20],
        h("4.2. Các quyết định thiết kế", 2), b[21],
        p("Các quyết định nhóm được ghi tách khỏi văn bản sách: phép chia 6 lấy dư xác định hào động; dư 0 ứng với hào 6; OBJECT_COUNT nhận objectCount và hourIndex, không dùng mảng numbers hai phần tử. Chỗ nguồn mờ hoặc chưa xác minh ấn bản được công bố đúng trạng thái, không đổi thành SOURCE_VERIFIED chỉ vì nhóm đã chốt cách thực thi. [9,10]"),
        h("4.3. Thuật toán Mai Hoa, Tam Thế, lịch Âm–Dương và Can Chi; căn cứ sách và quyết định nhóm", 2),
        p("Mai Hoa LINES dựng quẻ từ sáu hào, quẻ hỗ từ hào 2–4 và 3–5, quẻ biến bằng đảo một hào động. OBJECT_COUNT lấy objectCount mod 8, hourIndex mod 8 và (objectCount + hourIndex) mod 6 với dư 0 quy về 8 hoặc 6 tương ứng; TIME dùng lịch/giờ Việt Nam UTC+7 và quy ước nhóm đã công bố. Tam Thế dùng khóa Can Chi năm âm, tháng sinh và mục luận. Chi tiết triển khai và giới hạn nằm ở 7.3–7.4. [9,10,12]"),
        h("4.4. Data flow và communication flow", 2),
        p("Client kiểm biểu mẫu → REST tạo phiên khi cần lịch sử → STOMP kết nối và SUBSCRIBE → SEND requestId/payload → Server kiểm hợp đồng và nguồn → dispatcher nhận hoặc từ chối → service/JDBC tính/tra cứu → progress và terminal về đúng socket. Lưu lịch sử là thao tác REST riêng sau terminal; sơ đồ thành phần ở mục 5 và trình tự frame ở mục 6. [8,9,11]"), page()]

    out += [h("5. System Architecture"), b[23], b[24],
        p("Đây là kiến trúc logic của bản chạy thử: Client có thể ở máy khác, còn Backend kết nối PostgreSQL qua JDBC. Phép đo X01 đặt runner, Backend và PostgreSQL trên cùng máy qua loopback; sơ đồ không hàm ý benchmark đã đo mạng LAN hoặc triển khai Internet. [5]"), page()]

    out += [h("6. Network Communication Design"),
        h("6.1. HTTP/REST, STOMP qua WebSocket /ws và cổng cấu hình của Client, Backend, PostgreSQL", 2),
        p("Client gọi các route /api/v1 qua proxy Next.js tới Backend. Các phép tính có tiến trình dùng STOMP trên /ws. Trong ma trận X01, Backend HTTP/WS dùng 127.0.0.1:18091, Client origin 127.0.0.1:3173; đó là cấu hình đo, không phải cổng cố định của sản phẩm. PostgreSQL chỉ cần Backend truy cập và không phải mở cho Client. [5,9,11]"),
        h("6.2. Hợp đồng JSON: requestId, type, payload, progress, kết quả và mã lỗi", 2), b[29], b[30],
        h("6.3. Trình tự khởi tạo phiên → kết nối STOMP → gửi yêu cầu → nhận tiến trình và kết quả", 2), b[28],
        h("6.4. Thiết kế kênh REST và STOMP WebSocket", 2),
        h("6.4.1. REST: phiên người dùng, tra cứu quẻ, chuyển đổi lịch và lịch sử", 3),
        p("GET /api/v1/hexagrams và /api/v1/hexagrams/{code} tra quẻ; POST /api/v1/calendar/convert và /api/v1/calendar/can-chi xử lý lịch. POST /api/v1/session cấp phiên; POST/GET /api/v1/history, GET/DELETE /api/v1/history/{id} phục vụ lịch sử. GET /api/v1/health kiểm tiến trình HTTP, còn /api/v1/readiness kiểm kho tri thức/schema/seed. Hợp đồng chi tiết ở Phụ lục A và [9,11]."),
        h("6.4.2. STOMP: destination gửi/nhận, định tuyến theo phiên và đối chiếu requestId", 3),
        p("Client SEND tới /app/mai-hoa/calculate hoặc /app/tam-the/calculate, sau khi SUBSCRIBE /user/queue/progress, /user/queue/results và /user/queue/errors. Client ghép frame theo requestId và type; Server chặn truy cập trực tiếp broker queue hoặc user queue của phiên khác. [9]"),
        h("6.4.3. Origin, cookie phiên, CSRF, giới hạn thông điệp và quyền truy cập lịch sử", 3), b[33],
        p("Cookie huyenco_session là HttpOnly, SameSite=Lax; thao tác ghi/xóa cần X-HuyenCo-Request và X-CSRF-Token. Frame/body tối đa 16.000 byte và giải mã UTF-8 nghiêm ngặt. Khi chạy hai máy phải cấu hình Origin và cookie theo hostname thật; không tắt kiểm tra để vượt lỗi kết nối. [9,11]"),
        h("6.5. Quản lý kết nối: heartbeat, mất kết nối, kết nối lại và hết hạn phiên", 2),
        p("Client đặt connection timeout 10 giây và reconnect delay 3 giây. Disconnect hủy Run/timer và registry của socket; reconnect tạo STOMP session mới, nên cùng requestId có thể tạo phép tính mới. H01 owner cookie có vòng đời riêng 30 ngày. Chưa có bằng chứng cấu hình nhịp heartbeat cụ thể hoặc nghiệm thu live mọi kiểu mất mạng, vì vậy mục này chỉ mô tả các timeout/reconnect đã có. [8,11,13]"),
        h("6.6. Xử lý lỗi đầu vào, dữ liệu chưa sẵn sàng, quá tải và lỗi database", 2), b[32],
        p("Các mã nghiệp vụ gồm INVALID_INPUT, RULE_NOT_AVAILABLE, SERVER_BUSY, PROCESSING_TIMEOUT, KNOWLEDGE_DATA_INCOMPLETE và DATABASE_UNAVAILABLE. Lỗi hợp đồng trả về terminal hoặc HTTP error theo kênh; không trả SQL/secret cho Client. [9]"), page()]

    out += [h("7. Implementation"), h("7.1. Nền tảng Java/Spring Boot, Next.js/React, PostgreSQL và cấu hình mạng", 2), b[36],
        h("7.2. Số hóa tri thức, database và tra cứu 64 quẻ", 2),
        h("7.2.1. Cấu trúc mã nguồn và phân chia module", 3),
        p("Repo tách client/, server/, docs/, scripts/ và report/. Backend có module websocket, maihoa, tamthe, calendar, hexagram, history và knowledge; Client giữ form, dịch vụ HTTP/STOMP và thành phần kết quả. Bảng thành phần ở 7.1 nêu ranh giới trách nhiệm. [8,9,11]"),
        h("7.2.2. Mô hình dữ liệu quẻ, lời luận, quy tắc và nguồn sách", 3),
        p("PostgreSQL lưu cấu trúc 8 quái/64 quẻ, sáu hào, quy tắc tính, nghĩa tên, các mục luận và metadata sách/trang/reviewer/status. Dữ liệu kết quả mang provenance theo từng mục; 64 nghĩa tên đã duyệt trong phạm vi NAME_GLOSS không kéo theo duyệt mọi lời luận. [10,12]"),
        h("7.2.3. Migration Flyway, nhập dữ liệu, ràng buộc toàn vẹn và trạng thái duyệt", 3), b[40],
        h("7.2.4. API tra cứu 64 quẻ và hiển thị nguồn trên Client", 3),
        p("API trả danh sách phân trang và chi tiết theo mã H_UPPER_LOWER, hỗ trợ tên có/không dấu và lọc quái; Client trình bày tên, cấu trúc và căn cứ thay vì suy nguồn từ giao diện. Không biến NAME_GLOSS đã VERIFIED thành xác nhận tất cả văn bản quẻ. [9,10,13]"),
        h("7.3. Lập quẻ và luận giải Mai Hoa, Tam Thế", 2),
        h("7.3.1. Đầu vào, đầu ra và giới hạn của từng nghiệp vụ", 3),
        p("LINES nhận sáu boolean từ dưới lên và movingLine 1–6; OBJECT_COUNT nhận objectCount/hourIndex; TIME nhận thời điểm có offset. Tam Thế nhận lịch sinh, tháng nhuận và chủ đề. Lời luận Mai Hoa chi tiết là lựa chọn riêng; dữ liệu Tam Thế không khớp nguồn được ghi rõ, không sinh bù. [9,10,12]"),
        h("7.3.2. Kiểm tra đầu vào, chọn quy tắc và điều kiện nguồn được duyệt", 3),
        p("Server kiểm kiểu/miền giá trị và rule registry trước khi chạy. Kết quả ghi ruleVersion, ruleBasis, sourceStatus và tham chiếu; SOURCE_VERIFIED và TEAM_DECISION được phân biệt theo hồ sơ. [9,10]"),
        h("7.3.3. Mai Hoa LINES, OBJECT_COUNT, TIME: quẻ chủ, quẻ hỗ, quẻ biến và hào động", 3), b[38],
        h("7.3.4. Sinh lời luận Mai Hoa: Thể–Dụng, ngũ hành, giai đoạn và căn cứ nguồn", 3),
        p("M03 đọc bộ mẫu đã review, xác định Thể/Dụng theo vị trí hào động và quan hệ ngũ hành, rồi trình bày nhận xét theo chủ đề và giai đoạn kèm căn cứ. Kết quả chi tiết có phạm vi dữ liệu; không hứa lời luận hoàn chỉnh cho mọi đầu vào ngoài bộ nguồn đã duyệt. [10]"),
        h("7.3.5. Tam Thế: khóa tra cứu và luận giải theo từng chủ đề được hỗ trợ", 3), b[39],
        h("7.3.6. Trả tiến trình thời gian thực và hiển thị kết quả, nguồn, quyết định nhóm", 3),
        p("Server phát bốn bước progress và terminal theo socket; Client hiển thị ba quẻ, lời luận khi có, nguồn sách và quyết định nhóm tách biệt. Một yêu cầu thất bại có mã lỗi thay vì kết quả giả. [9,13]"),
        h("7.3.7. Kiểm thử thuật toán, dữ liệu nguồn và hợp đồng kết quả", 3),
        p("Kiểm thử module kiểm phép biến hào, lookup, điều kiện nguồn và DTO; fixture hợp đồng và nghiệm thu UI đại diện bổ sung bằng chứng tích hợp. Các số test ở mốc khác nhau không cộng thành một tổng chung. [9,10,13]"),
        h("7.4. Chuyển đổi lịch Âm–Dương, tháng nhuận và tính Can Chi", 2),
        p("C01 chuyển đổi trong miền 1900–2099 theo UTC+7, xử lý tháng nhuận và Can Chi; dataset cố định được cross-check với Time4J 5.9.4. Kiểm cùng thư viện không là xác minh thiên văn độc lập. [12]"),
        h("7.5. Xử lý đồng thời: direct, bounded, hàng đợi hữu hạn và idempotency", 2),
        p("N01 dùng cùng service cho direct/bounded. Bounded có 4 worker, queue 100, deadline gồm cả thời gian chờ; registry theo sessionId/requestId chia sẻ in-flight, replay terminal trong TTL 60 giây và chặn xung đột payload. Stress riêng kiểm hành vi đầy queue; số đo ở mục 9 không đo lợi ích idempotency riêng. [6,8]"),
        h("7.6. Phiên người dùng, chủ động lưu kết quả và tra cứu/xóa lịch sử", 2),
        p("H01 chỉ lưu khi Client gọi POST history sau kết quả; Server lấy snapshot kết quả đã tính theo calculationRequestId và owner, không nhận snapshot tự khai. GET list/detail và DELETE kiểm quyền owner; ghi/xóa cần cookie, custom header và CSRF. [11,13]"),
        h("7.7. Kiểm thử đơn vị, hợp đồng, tích hợp và nghiệm thu Client–Server–PostgreSQL", 2), b[41],
        p("Bằng chứng chức năng 8E/8F thuộc ca live đại diện, còn X01 là workload LINES riêng trên TEST. Chúng xác nhận các phạm vi khác nhau và được công bố tách ở mục 9.1–9.5. [5,13]"), page()]

    out += [h("8. Experimental Setup"), h("8.1. Máy chạy thử, phiên bản Backend, cấu hình JVM, PostgreSQL TEST và mô hình kết nối", 2), b[45], b[46], b[47],
        h("8.2. Seed, nguồn đã duyệt, fixture và phạm vi dữ liệu của từng phép thử", 2), b[50], b[51],
        h("8.3. Ma trận X01: 2/5/20 Client × direct/bounded × 3 lần = 18 lượt", 2),
        p("Sáu ô cấu hình được lặp ba lần theo thứ tự cân bằng, mỗi lượt JVM mới và cùng JAR, schema/seed, runner và giới hạn Client. Direct và bounded chỉ khác điều phối. Mục 9.2 công bố kết quả tổng hợp; toàn bộ 18 lượt ở Phụ lục D. [5,7]"),
        h("8.4. Warm-up, cửa sổ đo, nhịp gửi, chỉ số độ trễ/thông lượng/lỗi và cách tổng hợp", 2), b[52], b[54], b[55],
        h("8.5. Kịch bản quá tải, idempotency, replay, xung đột payload, TTL và kết nối lại", 2),
        p("X01.5 chạy tách khỏi ma trận: burst 160 yêu cầu, giới hạn 2 worker/queue 4 và khóa ngắn trên database TEST để giữ hàng đợi, rồi ROLLBACK. Các ca còn lại kiểm in-flight, terminal replay, payload conflict, 20 phiên cùng ID, reconnect và TTL 60 giây. SERVER_BUSY là đáp án mong đợi trong stress, không cộng vào tỷ lệ lỗi benchmark thường. [6]"),
        h("8.6. Phân biệt kiểm thử chức năng có lịch sử với benchmark chỉ lập quẻ; đường dẫn bằng chứng", 2),
        p("8E/8F dùng Client thật và có ca lịch sử; X01 chỉ là STOMP LINES không reading, không cookie, không ghi history. Raw/manifest, tài liệu 51–53 và report/evidence-index.json cho phép truy vết từng kết luận. Gói bằng chứng không chứa PDF sách, mật khẩu hoặc database dump. [5–7,13]"), page()]

    out += [h("9. Results"), h("9.1. Kết quả nghiệm thu Mai Hoa, Tam Thế, tra cứu quẻ, lịch và lịch sử", 2),
        p("Biên bản 8E xác nhận hai owner trên Client thật: lưu/xem/xóa lịch sử, truy cập chéo 404 và thiếu/sai CSRF 403. 8F xác nhận ca đại diện TIME, OBJECT_COUNT, LINES, M03/D04, tra cứu 64 mã quẻ, lịch/Can Chi; sáu phép tính có 24 progress và sáu COMPLETED đúng phiên. Đây là phạm vi nghiệm thu, chưa bao phủ mọi tổ hợp. [13]"),
        h("9.2. Hiệu năng 2/5/20 Client: median, p95, p99, thông lượng và tỷ lệ lỗi", 2), b[59], b[60], b[61],
        h("9.3. Kết quả quá tải, idempotency, định tuyến phiên và các kiểm thử bảo mật có bằng chứng", 2), b[66], b[67],
        p("Các ca bảo mật live 8E kiểm quyền lịch sử và CSRF; suite X01.5 kiểm định tuyến socket và idempotency. Không coi hai bộ này là kiểm thử bảo mật toàn diện của hệ thống Internet. [6,13]"),
        h("9.4. So sánh baseline direct và phương án bounded qua ba lần lặp", 2), b[62], b[63],
        h("9.5. Kiểm toán dữ liệu đo, độ đúng của kết quả/progress và sai lệch biên cửa sổ đo", 2), b[68], b[69],
        p("46.027 SEND thuộc cohort hoàn tất hợp lệ; một dòng mang nhãn measurement gửi muộn 0,022 ms được giữ raw và loại theo timestamp. strictSendWindowSatisfied=false cho bản gốc, không sửa số liệu bằng cách xóa dòng. Chi tiết ở Phụ lục D. [5,7]"), page()]

    out += [h("10. Thảo luận"), h("10.1. Kết quả đạt tiêu chí nào ở mục 1.4, chưa đạt tiêu chí nào", 2),
        p("Các ca đại diện đáp ứng tiêu chí chức năng trong phạm vi 8E/8F; bảy tình huống X01.5 đáp ứng các tình huống độ tin cậy được chọn. Ma trận không quan sát lỗi ở các mức tải đã đo, song không có SLA định trước nên không tuyên bố đạt ngưỡng hiệu năng tuyệt đối. Chưa đạt bằng chứng cho mọi đầu vào, mọi lỗi mạng live hay triển khai hai máy/Internet. [5–7,13]"),
        h("10.2. Độ trễ và thông lượng thay đổi từ 2 lên 5 và 20 Client", 2), b[73], b[75],
        h("10.3. Phân tích CPU, bộ nhớ, hàng đợi và độ trễ theo bằng chứng; giới hạn suy luận về nút thắt", 2),
        p("Node được lấy mẫu trong cửa sổ đo, Java được lấy mẫu toàn vòng đời; peak RSS Node khoảng 170,65 MiB và peak working set Java khoảng 402,27 MiB. Không có CPU PostgreSQL hoặc thời gian queue/JDBC tách riêng, vì vậy không xác định nút thắt từ những số liệu này. Queue đầy chỉ được chứng minh trong stress có cấu hình 2/4, không suy từ ma trận 4/100. [6,7]"),
        h("10.4. Trường hợp hệ thống hoạt động tốt và trường hợp còn yếu", 2), b[74],
        p("Độ đúng theo phiên và phục hồi sau quá tải có bằng chứng ở ca đã chọn; điểm còn yếu là đuôi P99 bounded ở 20 Client và khoảng trống kiểm live lỗi mạng/đầu vào rộng. [5–7,13]"),
        h("10.5. Đánh đổi giữa direct và bounded: chi phí điều phối, độ trễ đuôi và kiểm soát quá tải", 2), b[77],
        h("10.6. Hạn chế thí nghiệm: môi trường local, tải closed-loop, số lần lặp và phạm vi nghiệp vụ benchmark", 2), b[79], page()]

    out += [h("11. Tính mới và đóng góp"), h("11.1. Baseline direct và phạm vi so sánh", 2),
        p("Baseline direct tính trên luồng gọi dispatcher; bounded giao việc cho pool/queue, còn service, dữ liệu và idempotency giữ nguyên. So sánh chỉ trong cùng ứng dụng, không là kết luận về hệ thống khác hoặc một thuật toán mới. [5,8]"),
        h("11.2. Bảng đóng góp của ba thành viên và bằng chứng triển khai", 2), b[96],
        p("Bảng vai trò là phân công kỹ thuật TV1/TV2/TV3, không tự gán từng họ tên vì hồ sơ hiện chưa đối chiếu họ tên với vai trò. Theo tổ chức hiện tại, một người đảm nhiệm cả TV2 và TV3; khi nộp nhóm cần xác nhận cách ghi công theo thực tế. [8,11,13]"),
        h("11.3. Đóng góp của bounded, idempotency, phản hồi thời gian thực và truy vết nguồn", 2), b[82], b[83],
        p("Công cụ AI hỗ trợ thiết kế, mã, kiểm thử, phân tích và soạn tài liệu; thành viên chịu trách nhiệm hiểu, kiểm tra và giải thích phần nộp. Sự tồn tại của công cụ không là bằng chứng xác minh nguồn hoặc kết quả thực nghiệm."), page()]

    out += [h("12. Các giới hạn của hệ thống"), b[85], b[86], b[87], page(),
        h("13. Hướng phát triển"), b[90], b[91],
        h("14. Tổng kết"), b[93], b[94], page(),
        h("References")]
    for item in b[100:114]:
        if item["kind"] == "paragraph":
            item = dict(item)
            item["text"] = item["text"].replace("Phụ lục A", "Phụ lục D")
        out.append(item)
    out += [page(), h("Appendix"),
        h("Phụ lục A: Danh mục REST API, destination STOMP và mẫu JSON", 2),
        p("REST: GET /api/v1/health, GET /api/v1/readiness; GET /api/v1/hexagrams, GET /api/v1/hexagrams/{code}; POST /api/v1/calendar/convert, POST /api/v1/calendar/can-chi; POST /api/v1/session; POST/GET /api/v1/history; GET/DELETE /api/v1/history/{id}. STOMP: /ws; SEND /app/mai-hoa/calculate hoặc /app/tam-the/calculate; SUBSCRIBE /user/queue/progress, /user/queue/results, /user/queue/errors. Định dạng đầy đủ và lỗi ở docs/02-API-CONTRACT.md. [9,11]"), b[29],
        p("Mẫu trên là LINES. OBJECT_COUNT dùng objectCount/hourIndex; TIME dùng thời điểm có offset theo hợp đồng. Không dùng numbers: [a,b]. Progress có requestId/type/sequence/step; terminal có requestId/type/status/data/error. [9]"),
        h("Phụ lục B: Cấu hình môi trường và hướng dẫn chạy với PostgreSQL TEST", 2),
        p("Dùng database TEST riêng đã backup và seed/migrate V12. Cấu hình DB_URL, DB_USERNAME, DB_PASSWORD bằng biến môi trường riêng; không ghi credential vào repo. Backend dùng profile db với Flyway theo quy trình bootstrap, rồi kiểm GET /api/v1/health và /api/v1/readiness. Client đặt HUYENCO_API_URL cho REST proxy và NEXT_PUBLIC_WS_URL cho WebSocket; ALLOWED_ORIGINS trên Backend phải khớp origin thực. Xem https://github.com/trong-crypto/Huy-n-c-/blob/50cba56a19d6e90be5f3aef01a4e67b91c8da92d/docs/35-TV1-BACKEND-POSTGRES-INTEGRATION-GUIDE.md; không chạy import trên database chung chỉ để demo. [9,11]"),
        h("Phụ lục C: Kịch bản nghiệm thu chức năng và fixture mẫu", 2),
        p("Theo 8E: hai owner độc lập, lưu/xem/xóa snapshot, truy cập chéo 404, thiếu/sai CSRF 403. Theo 8F: gửi LINES, OBJECT_COUNT, TIME và Tam Thế, kiểm requestId, bốn progress, terminal đúng phiên, ba quẻ, trạng thái nguồn; tra mã quẻ và đổi lịch/Can Chi ca đại diện. Fixture JSON nằm trong docs/examples/ và biên bản docs/44-TV1-PHASE8A-ACCEPTANCE.md; không cộng số ca này vào benchmark. [9,13]"),
        h("Phụ lục D: Ma trận 18 lượt benchmark, bảng số liệu và biểu đồ", 2)]
    appendix_table = dict(b[116]); appendix_table["caption"] = appendix_table["caption"].replace("Bảng A1.", "Bảng D1.")
    out += [appendix_table, b[117], b[118], b[119]]
    for item in b[120:125]:
        item = dict(item); item.pop("appendixStart", None); out.append(item)
    out += [{"kind": "portrait_section"},
        h("Phụ lục E: Bằng chứng quá tải, idempotency, log và manifest kiểm tra toàn vẹn", 2),
        p("Bảy ca X01.5 được mô tả ở docs/52-X01-OVERLOAD-IDEMPOTENCY-ACCEPTANCE.md. Raw/control transcript, auditor độc lập và snapshot database nằm trong gói report/evidence/X01-Evidence.zip với hash tại report/evidence/package-manifest.json và report/evidence-index.json. Burst 2 worker/queue 4 cho 6 nhận, 154 SERVER_BUSY; rollback mở khóa rồi sáu yêu cầu hoàn tất. Đây là stress trên TEST, không phải tỷ lệ lỗi của ma trận 18 lượt. [6]"),
        h("Phụ lục F: Bảng đối chiếu nguồn sách, trạng thái duyệt và quyết định nhóm", 2),
        p("Mai Hoa Dịch Số: bản scan 672 trang, chưa xác minh đầy đủ ấn bản in; quy tắc hào động modulo 6 là quyết định nhóm. OBJECT_COUNT giữ hồ sơ TEAM_DECISION/SOURCE_AMBIGUOUS khi căn cứ bản in chưa rõ. Diễn Cầm Tam Thế Diễn Nghĩa: bản scan 360 trang, ấn bản chưa xác minh đầy đủ; chỗ tháng 5 sửa Dậu thành Dần theo quyết định nhóm. E01 duyệt 64 nghĩa tên quẻ trong phạm vi NAME_GLOSS; không suy ra toàn bộ lời luận đã VERIFIED. Dẫn trang/trạng thái chính xác cần tra hồ sơ từng mục ở docs/04-MAIHOA-RULES.md, docs/05-TAMTHE-RULES.md, docs/28-TIME-OWNER-APPROVAL.md và bản ghi provenance trong DB. [10,12]")]
    # Caption numbers follow reading order; D1 is a separate appendix series.
    counter = 0
    for item in out:
        if item["kind"] == "table" and not item["caption"].startswith("Bảng D"):
            counter += 1
            item["caption"] = re.sub(r"^(?:Bảng \d+\. )?", f"Bảng {counter}. ", item["caption"], count=1)
    for item in out:
        if item["kind"] == "paragraph":
            item["text"] = item["text"].replace("Phụ lục A;", "Phụ lục D;").replace("Phụ lục A.", "Phụ lục D.")
    return out
