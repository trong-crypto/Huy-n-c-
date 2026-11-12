# Kho luận giải 64 quẻ · bàn giao TV1 / TV2 / TV3

## Công bố theo phê duyệt của chủ dự án ngày 11/11/2026

Chủ dự án yêu cầu duyệt toàn bộ gói hiện có và bổ sung vào database `huyenco`. Đã sao lưu database V34, khôi phục một bản riêng, nhập thử và chạy lặp để kiểm chống trùng trước khi áp dụng. Đã công bố 64 tổng quan, 64 phần hình tượng, 64 phần diễn nghĩa, 64 phần gợi ý và 384 đoạn giải hào. Có 62 nguyên văn lời quẻ; hai bài Bác và Cách tiếp tục để trống trường này vì dị bản đã ghi nhận. Toàn bộ phần tiếng Việt là nội dung biên soạn theo nguồn Chu Dịch Hán cổ, ngoài phạm vi nghĩa tên E01 từ sách Mai Hoa.

Nguồn CMS được ghi `VERIFIED` theo phê duyệt của chủ dự án cho gói biên tập, kèm URL phiên bản ghim và ghi chú phạm vi trong `reuseNote`. Các tệp nguồn trong `data/` vẫn giữ nguyên trạng thái bản nháp để truy vết. Lượt nhập dùng hai tài khoản lưu vết `system.editorial-import` và `system.owner-approval`, đều `LOCKED`, đại diện cho thao tác nhập và phê duyệt của chủ dự án. Đây là lưu vết phê duyệt đã nhận trong cuộc trò chuyện, không phải một lượt đối chiếu độc lập mới của người thứ hai.

Công cụ `scripts/publish_hexagram_interpretations.py` mặc định chỉ kiểm gói. Với `--database huyenco --apply`, công cụ chỉ chấp nhận SHA-256 của gói đã duyệt, sau đó sao lưu, thử trên bản khôi phục và nhập trong một giao dịch. Gói đã nhập được nhận diện bằng SHA-256 và không tạo thêm phiên bản khi chạy lại. Các bản nháp mới được nhập vào database TEST bằng `scripts/import_hexagram_interpretations.py` theo hướng dẫn trong [local-demo.md](hexagram-interpretation/local-demo.md).

Gói SHA-256 `2012ab61cad531b8429a9527990b12cc97f90c1b8810b9a2ea053bcd49ef33cb`. Bản sao lưu ở `scripts/generated/db-backups/huyenco-before-editorial-20261111031049.dump`; bằng chứng nằm tại `server/target/hexagram-publication/publication-evidence.json`. Các mục bên dưới giữ mốc khảo sát và kiểm thử trước khi công bố.

Baseline thực tế là `d026a86` trên `bmanh812`. Commit này nối tiếp trực tiếp baseline `1ecebe1` và bổ sung Trợ lý AI.

## Kiểm kê V33

Kiểm toán trên PostgreSQL 18 disposable khôi phục từ dump TEST đã đối chiếu SHA-256, có backup trước khi đưa lên V33. Sau 33 migration, truy vấn chỉ đọc xác nhận:

| Dữ liệu | Số lượng và phạm vi |
| --- | --- |
| `hexagrams`, `hexagram_lines` | 64 quẻ, 384 hào, 0 lệch âm dương giữa mảng và dòng hào |
| `interpretations` | 64 `NAME_GLOSS` VERIFIED, 0 category khác |
| Tổng quan, quái từ, giải từng hào, ứng dụng theo quẻ | 0 bản trong kho diễn giải quẻ |
| `source_books`, `source_sections` | 2 sách, 34 mục. Mai Hoa Dịch Số 13 mục, Diễn Cầm Tam Thế Diễn Nghĩa 21 mục |
| `external_sources` | 1 nguồn thuật toán |
| CMS nghĩa tên | 0 phiên bản nháp, 0 sự kiện trong bộ TEST mới dựng |

Các mẫu `mai_hoa_reading_templates` và `reading_source_bundles` phục vụ cách luận theo phương pháp Mai Hoa. Chúng không phải bài giải cố định cho từng quẻ hay từng hào. `hexagram_lines` chỉ lưu thứ tự và âm/dương. `interpretations` có trường TEXT nhưng thiếu cấu trúc phần nội dung, lịch sử phiên bản và ranh giới công bố. V21–V23 và API E02 đã có quy trình riêng cho `NAME_GLOSS`, với bản nháp tối đa 500 ký tự.

## Nguồn và phạm vi sử dụng

- **E01.** Mai Hoa Dịch Số, Thiệu Khang Tiết, Ông Văn Tùng dịch/chú thích, NXB Văn hóa – Thông tin, bản scan 672 trang. Ấn bản in chưa xác định đầy đủ. SHA-256 `225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de` khớp PDF và registry. PDF 269–271 tương ứng trang in 276–278, dùng đối chiếu thứ tự, tên và nghĩa tên. Mục 48 ghi nhãn in **Ích**, nhưng mã chuẩn là `H_KHAM_TON` **Tỉnh**. PDF 131/in 137 nêu vai trò Thể, Dụng, Hỗ, Biến và là nguồn phương pháp riêng. Các trang này không được dùng để gán lời hào cho 64 quẻ.
- **Chu Dịch Hán cổ.** Chỉ mục [Wikisource tiếng Trung, bản 7907208](https://zh.wikisource.org/w/index.php?title=%E5%91%A8%E6%98%93&oldid=7907208) cung cấp thứ tự và hình tượng cho 64 quẻ. Đã mở trực tiếp các chương [Càn](https://zh.wikisource.org/w/index.php?title=%E5%91%A8%E6%98%93%2F%E4%B9%BE&oldid=2404991), [Khôn](https://zh.wikisource.org/w/index.php?title=%E5%91%A8%E6%98%93%2F%E5%9D%A4&oldid=2404999) và [Đại súc](https://zh.wikisource.org/w/index.php?title=%E5%91%A8%E6%98%93%2F%E5%A4%A7%E7%95%9C&oldid=10646304). Tách lời quẻ/hào trong mục 易經 khỏi Thoán và Tượng. Đại súc có dị tự ở hào 2 và 4, đã ghi chú thay vì chốt dị bản.
- **Chú giải cổ.** [Chu Dịch tập chú, quyển 1, bản Tứ Khố Toàn Thư](https://zh.wikisource.org/wiki/周易集註_(四庫全書本)/卷01) của Lai Tri Đức là nguồn đối chiếu cách đọc Càn. [Chu Dịch chính nghĩa, Đại súc](https://zh.wikisource.org/wiki/周易正義/03大畜) là ứng viên đối chiếu riêng. Không đưa nguyên văn chú giải vào dữ liệu runtime.
- **Quyền dùng.** Phần Hán cổ có chỉ dấu phạm vi công cộng trong [chỉ mục bản số hóa](https://zh.wikisource.org/w/index.php?title=%E5%91%A8%E6%98%93&oldid=7907208). Lưu URL, phiên bản và phân biệt tác phẩm cổ với đóng góp số hóa có điều kiện ghi công/chia sẻ tương tự. Xem [hướng dẫn dùng lại của Wikisource](https://en.wikisource.org/wiki/Wikisource:Reusing_Wikisource_content). Chỉ lấy vài đoạn Hán cổ ngắn cho mẫu, giữ tiếng Việt là văn bản biên soạn mới. Không đưa bản scan, bản dịch tiếng Việt hiện đại hoặc bản dịch tiếng Anh chuyển thể vào gói. [CTP FAQ](https://ctext.org/faq) phân biệt tác phẩm cổ với phần biên tập/bản dịch của dịch vụ; lần mở nội dung quẻ bị HTTP 403, nên không lấy văn bản từ CTP.

## Gói bản nháp

- `data/hexagram_interpretation_sources.csv` là ma trận 64 mã, thứ tự, danh tính Hán và Hán Việt, thượng/hạ quái, sáu hào, trang E01 và phiên bản chương Chu Dịch. Cả 64 quẻ đã được đọc chương trực tiếp và ghi `SOURCE_LOCATED`. Đây là trạng thái đối chiếu nguồn của bản nháp.
- `data/hexagram_interpretation_pilot.draft.json` có ba bài Càn, Khôn và Đại súc với tổng quan, hình tượng, trích đoạn lời quẻ, diễn nghĩa, sáu đoạn giải hào và gợi ý suy ngẫm.
- `data/hexagram_interpretation_overviews.draft.json` có 61 tổng quan đã đối chiếu với từng chương, dùng cho biên tập. Các file ở ngoài bundle của website và không được import tự động.
- Tổng cộng có 64 tổng quan và 94 phần nội dung DRAFT, gồm 33 phần của ba bài mẫu và 61 tổng quan. Mỗi tổng quan dài 150–300 đơn vị phân cách bằng khoảng trắng. Kết quả theo từng mã quẻ, dị bản và thứ tự ưu tiên nằm trong [bảng rà soát nguồn](hexagram-interpretation/source-review.md). Cả gói chờ người duyệt độc lập.
- Trạng thái xuất bản `DRAFT` và mức đối chiếu nguồn là hai trường khác nhau. Ngày soạn hoặc có link không tự chuyển thành VERIFIED. Các đề xuất ứng dụng là gợi ý đọc biểu tượng.

## Hợp đồng triển khai riêng

Đề xuất SQL ở [schema-proposal.sql](hexagram-interpretation/schema-proposal.sql) giữ ngoài thư mục Flyway tự động. TV3 review, chọn số migration và lập kế hoạch đăng ký nguồn trước khi triển khai DB nhóm. Bật thử bằng `HUYENCO_HEXAGRAM_INTERPRETATION_ENABLED=true` phía Spring và `NEXT_PUBLIC_HEXAGRAM_INTERPRETATIONS=1` phía Next. Bản public hiện hành vẫn dùng E02 cho tên, cấu trúc và nghĩa tên. Client dùng mã quẻ Server trả, không suy lại hào.

| Endpoint | Hợp đồng |
| --- | --- |
| `GET /api/v1/hexagrams/{code}/interpretation` | Public đọc phiên bản PUBLISHED. Trả `{code, publication}`, trong đó `publication` là null khi chưa có bài. |
| `GET /api/v1/admin/hexagrams/{code}/interpretation` | Admin đọc trạng thái hiện hành, danh mục nguồn theo quẻ và danh sách số phiên bản. |
| `GET /api/v1/admin/hexagrams/{code}/interpretation/revisions/{version}` | Admin xem nội dung, tác giả, thời điểm và snapshot nguồn của một phiên bản. |
| `PUT /api/v1/admin/hexagrams/{code}/interpretation` | Admin lưu phiên bản nháp mới với `expectedVersion`, nội dung từng phần và ID nguồn. |
| `POST /api/v1/admin/hexagrams/{code}/interpretation/workflow` | Admin gửi `SUBMIT`, `RETURN` hoặc `PUBLISH` cùng `expectedVersion`; RETURN và PUBLISH cần ghi chú. |

Yêu cầu ghi dùng phiên Admin, CSRF và kiểm tra Origin hiện có. Ghi theo từng quẻ trong transaction và trả `VERSION_CONFLICT` khi thông tin trên màn hình đã cũ. Người soạn phiên bản không thể tự công bố. Phiên bản đã công bố vẫn đọc được khi có bản nháp mới. Chỉ trả phần đã công bố và nguồn đã snapshot cho trang công khai. Phần luận và hào động trên Mai Hoa chỉ lấy từ mã quẻ và vị trí hào đã được Server xác nhận.

`expectedVersion` là phiên bản workflow, bắt đầu ở 0 và tăng sau mỗi lần lưu hoặc đổi trạng thái. Số phiên bản bài chỉ tăng khi lưu nháp. Trường `content` gồm `overview`, `image`, `original`, `paraphrase`, `lines` và `application`. `overview` bắt buộc, các phần khác có thể rỗng. `lines` luôn có đúng sáu chuỗi tính từ hào dưới lên. `sourceIds` chứa 1–8 ID không trùng, phải thuộc quẻ đang biên tập. Backend đóng băng nguồn khi lưu nháp và đối chiếu lại trạng thái cùng snapshot khi công bố.

TV2/TV3 cần duyệt độ chính xác, đối chiếu quyền sử dụng và ghi nhận nguồn chính thức trước khi đưa gói biên tập lên môi trường chung. Chỉ các đoạn đã duyệt mới được dùng về sau làm dữ liệu tham chiếu AI.

## Bằng chứng nghiệm thu

- Chromium trên PostgreSQL V33 disposable, có backup trước khi áp dụng SQL thử nghiệm. Admin A lưu, xem trước và gửi duyệt. Tự công bố bị từ chối. Admin B công bố. Kiểm thêm CSRF, xung đột phiên bản, đọc bản cũ và khả năng tiếp tục hiển thị bản đã công bố khi có nháp mới.
- Trang tra cứu hiển thị bài thử đã công bố. Mai Hoa đọc ba vai trò và chỉ hiển thị hào động đúng vị trí. Checksum E01, dữ liệu nghĩa tên và các bảng CMS nghĩa tên khớp trước và sau. Smoke Auth, History, danh mục tư vấn viên, CMS nghĩa tên và Trượng Xích đạt. Tam Thế được kiểm qua bộ hồi quy, chưa chạy một ca Tam Thế live riêng trong lượt này.
- TypeScript, build production, Vitest 1424/1424, Calculation 12/12, contract fixtures 63/63, kiểm dữ liệu Python 3/3. Maven 2299 đạt trên tổng 2351, 52 bỏ qua và 0 lỗi. Gói biên soạn vẫn ở trạng thái DRAFT, tách khỏi dữ liệu thử luồng công bố.

## Phạm vi file

- Dữ liệu biên tập gồm `data/hexagram_interpretation_sources.csv`, `data/hexagram_interpretation_pilot.draft.json` và `data/hexagram_interpretation_overviews.draft.json`. Kiểm tra dữ liệu ở `scripts/test_hexagram_interpretation_data.py`.
- Backend gồm `server/src/main/java/com/huyenco/admin/HexagramInterpretationController.java` và `server/src/main/java/com/huyenco/admin/HexagramInterpretations.java`. Đề xuất cơ sở dữ liệu ở `docs/hexagram-interpretation/schema-proposal.sql`.
- Frontend Admin gồm `client/src/components/admin/AdminContentWorkspace.tsx`, `client/src/components/admin/AdminHexagramCatalog.tsx` và `client/src/components/admin/HexagramInterpretationWorkspace.tsx`.
- Frontend công khai gồm `client/src/components/hexagrams/HexagramDetailPanel.tsx`, `client/src/components/hexagrams/PublishedInterpretation.tsx`, `client/src/components/hexagrams/publishedInterpretation.module.css` và `client/src/components/results/MaiHoaResultView.tsx`. Cấu hình và API client ở `client/next.config.ts`, `client/src/config/client.ts` và `client/src/services/rest/hexagramInterpretations.ts`.
- Kiểm thử Frontend ở `client/src/components/hexagrams/PublishedInterpretation.test.tsx`. Trình nạp `client/scripts/lib/load-ui-module.mjs` ánh xạ CSS Module khi render component thật bằng Node. Kiểu dáng thực tế được kiểm qua Next.js và Chromium.

## Bài thơ diễn nghĩa

Mỗi phiên bản luận giải có thể lưu một bài thơ trong `cms_hexagram_interpretation_revisions.content` (JSONB). `PUT /api/v1/admin/hexagrams/{code}/interpretation` nhận trường `content.poem` với `title` (tối đa 120 ký tự), `body` (8.000), `author` (160) và `source` tùy chọn (500). Ba trường đầu bắt buộc khi có bài thơ. Nội dung giữ nguyên xuống dòng.

Khi yêu cầu lưu không gửi `poem`, Backend giữ bài thơ của bản mới nhất. Gửi `poem: null` để lưu một phiên bản không có bài thơ. Bản đã công bố chỉ thay đổi sau khi phiên bản mới được công bố theo quy trình hiện có. Bản ghi phiên bản lưu người soạn và thời điểm lưu. Các sự kiện gửi duyệt, trả về và công bố ghi người thực hiện và thời điểm trong `cms_hexagram_interpretation_events`.
