# E02 — API tra cứu 64 quẻ: bàn giao TV1 (25/10/2026)

**DONE phần Server.** Đã chạy hai GET với dữ liệu thật `huyenco`; E01 V10/64 nghĩa tên VERIFIED được giữ nguyên. Giao diện và nghiệm thu F05 toàn luồng thuộc TV1/I01.

## 1. Kế hoạch và kết quả

| Bước | Việc thực hiện | Kết quả |
| --- | --- | --- |
| 1 | Đọc hợp đồng v1.2 và dữ liệu S01/E01 | Giữ URL, envelope, sort code, page từ0 và size tối đa100 |
| 2 | Repository snapshot nhất quán chỉ đọc | JDBC REPEATABLE_READ, SQL timeout3 giây, tối đa65 dòng mỗi loại để phát hiện thừa |
| 3 | Service tìm/lọc/phân trang/chi tiết | Đủ64 mã, Unicode NFC, tìm dấu/không dấu, lọc AND, offset không tràn |
| 4 | Controller và lỗi | Envelope đúng HTTP, kiểm tham số lạ/lặp/rỗng/ngoài ranh; không lộ diagnostics |
| 5 | Kiểm Java/DB/bootstrap/HTTP | 470 Java có DB, 123 HTTP có DB +2 HTTP không DB đạt |
| 6 | Kiểu TypeScript và fixtures thật | Typecheck và27 fixtures đạt, không sửa giao diện |
| 7 | Bàn giao và chốt phạm vi | E02 DONE; H01 là task tiếp theo |

## 2. Hai endpoint

| Yêu cầu | Dữ liệu trả về |
| --- | --- |
| `GET /api/v1/hexagrams` | `{items,page,size,totalElements,totalPages}` trong envelope |
| `GET /api/v1/hexagrams/H_KHAM_TON` | Tỉnh,6 hào và1 nghĩa tên `Giếng nước`, nguồn và quyết định nhãn in |

Query danh sách: `q`, `upperTrigramCode`, `lowerTrigramCode`, `page` (mặc định0), `size` (mặc định20,1–100). Sắp `code` tăng ổn định. Kết hợp q/thượng/hạ bằng AND. Trang vượt cuối trả `items=[]`, tổng vẫn đúng.

Ví dụ:

```text
/api/v1/hexagrams?page=0&size=20
/api/v1/hexagrams?q=bi
/api/v1/hexagrams?q=B%C4%A9
/api/v1/hexagrams?q=h_kham_ton
/api/v1/hexagrams?upperTrigramCode=KHAM&lowerTrigramCode=TON
/api/v1/hexagrams/H_KHAM_TON
```

- Tên có dấu tìm chuỗi con giữ dấu, không phân biệt hoa/thường; `Bĩ` phân biệt `Bí`, `Càn` phân biệt `Cấn`. NFC/NFD cho cùng kết quả.
- Tên không dấu bỏ dấu và đổi đ→d; `bi` trả Bĩ/Bí, `ly` trả Ly/Lý, `can` trả Càn/Cấn. TV1 giữ tên có dấu trên danh sách để người dùng chọn đúng quẻ.
- Tìm mã bằng truy vấn bắt đầu `H_`, không phân biệt hoa/thường, cho phép tiền tố/chuỗi con mã; `H_` trả mọi mã. `%` và `_` không được coi là wildcard SQL.
- Bộ lọc quái nhận đúng `CAN,DOAI,LY,CHAN,TON,KHAM,CAN2,KHON`; `CAN2`=Cấn.
- `linesBottomUp[0]` là hào1 ở đáy, `linesBottomUp[5]` là hào6 ở đỉnh; true=Dương, false=Âm. Ký tế `H_KHAM_LY`, Vị tế `H_LY_KHAM`, không đảo thượng/hạ.

## 3. Trạng thái và phạm vi nghĩa tên

Tên quẻ có `nameKind`, `verificationStatus` và `sourceReferences` riêng; có thể là bản chép chưa duyệt với trạng thái tương ứng. `interpretations` chỉ trả `NAME_GLOSS` đã VERIFIED, kèm đủ reviewer/thời điểm/ghi chú/nguồn hợp lệ; thiếu duyệt trả mảng rỗng. Không trả các loại lời luận ngoài phạm vi E01.

Mỗi nghĩa có các field của InterpretationEntry và:

```text
resultCode = NAME_GLOSS
category = NAME_GLOSS
verificationStatus = VERIFIED
sourceOrder = 1..64
printedSourceLabel = nhãn thực tế trên bản in
verificationNote = phạm vi và quyết định đối chiếu
```

**Tỉnh (48):** tên chuẩn Tỉnh, mã `H_KHAM_TON`, content=`Giếng nước`, printedSourceLabel=`Ích`. Ghi chú giải thích chuẩn hóa danh tính từ vị trí nguồn và S01; không đổi nhãn nguồn thành Tỉnh. Reviewer E01 là Codex lượt hai cùng công cụ, không phải hai người kiểm chứng độc lập. SourceReference giữ thông tin ấn bản in chưa được xác minh riêng.

Đây là nghĩa tên ngắn, không phải lời dự đoán đầy đủ hoặc lời luận384 hào. Không thay dữ liệu Tam Thế hoặc phê duyệt quy tắc mới.

## 4. Lỗi

| HTTP | code | Khi xảy ra |
| --- | --- | --- |
| 400 | INVALID_INPUT | q>100 ký tự, bộ lọc sai, số âm/thập phân/quá lớn, size ngoài1–100, field lạ/lặp, mã chi tiết sai cú pháp |
| 404 | NOT_FOUND | Mã đúng cú pháp `H_[A-Z0-9]+_[A-Z0-9]+` tối đa64 ký tự nhưng không có trong snapshot |
| 503 | DATABASE_UNAVAILABLE | Không bật profile db, mất DB hoặc không đọc được schema cần thiết |
| 503 | KNOWLEDGE_DATA_INCOMPLETE | Bộ64 thiếu/thừa/trùng mã hoặc thiếu cấu trúc/metadata tên bắt buộc |
| 500 | INTERNAL_ERROR | Lỗi ngoài dự kiến, thông điệp chung |

Envelope `{requestId,status,data,error}`; UUID do Server tạo riêng cho từng request, error cùng kiểu STOMP. Không có SQL/trace/password trong lỗi public. Tham số sai được từ chối trước khi đọc DB.

## 5. Mã nguồn và mẫu bàn giao

- `server/src/main/java/com/huyenco/hexagram/HexagramController.java`
- `server/src/main/java/com/huyenco/hexagram/HexagramLookupService.java`
- `server/src/main/java/com/huyenco/knowledge/HexagramLookupRepository.java`
- `server/src/main/java/com/huyenco/knowledge/HexagramLookupSnapshot.java`
- `JdbcKnowledgeRepository.lookupSnapshot()` và bean fallback không DB trong `RuleRegistryConfig`.
- `client/src/types/contract.ts`: Page, HexagramRecord, HexagramNameGloss, HexagramDetail, RestResponse.
- `docs/examples/hexagrams-list.response.json`: list size2, tổng64.
- `docs/examples/hexagram-tinh.response.json`: chi tiết Tỉnh, nhãn in Ích, nguồn PDF271/in278.
- `docs/examples/hexagram-not-found.response.json`: lỗi404.

Fixtures được chụp qua HTTP thật rồi cố định requestId;27 mẫu vượt kiểm TypeScript. Không sửa page/component/UI hoặc gửi tin nhắn cho TV1. TV1 gọi từ backend đang chạy qua cấu hình REST/proxy cùng origin theo hợp đồng; proxy/UI còn là phần tích hợp TV1.

## 6. Bằng chứng kiểm thử

- **470 Java có PostgreSQL: 0 lỗi,0 bỏ qua.** Có5 test E02 service/controller và1 test JDBC thật kiểm64 quẻ/64 nghĩa, Tỉnh, Ký tế/Vị tế. Lỗi readiness cũ kỳ vọng interpretations trống trước E01 đã được cập nhật thành64 mục hiện có.
- **Bootstrap2 lần:** dữ liệu và reviewed_at không thay đổi; các guard nguồn sẵn có đạt. DB tạm `huyenco_a02_057ffa324dea` đã xóa. Log `scripts/generated/e02_bootstrap.log`, báo cáo `scripts/generated/a02_bootstrap_result.json`.
- **HTTP123 yêu cầu có DB +2 không DB:** kiểm mọi quẻ/nguồn/nghĩa/hình hào, dấu/không dấu,16 bộ lọc, phân trang/overflow, tham số lỗi,404, requestId riêng qua yêu cầu đồng thời và503 không DB. Log `scripts/generated/e02_http.json`, `e02_no_db_http.json`, `e02_live.log`.
- **TypeScript/27 fixtures và54 Python:** đạt. Package profile database build thành công, log `scripts/generated/e02_package.log`.
- **huyenco không đổi:** hash snapshot các bảng tri thức/schema trước và sau HTTP đều `124f20a073b0887cf75cd9a39cc404b76912f76003b594b9f194e70f1eaed5c1`. Log `scripts/generated/e02_database_unchanged.json`. Trong phép kiểm này Flyway bị tắt, datasource đặt read-only, các Server tạm đã dừng.

## 7. Chạy và kiểm lại

Khởi động lại backend bằng hướng dẫn profile `db` trong README để nạp mã E02 mới. E02 không có migration mới sau V10, không cần nạp lại E01 hoặc cài PostgreSQL extension.

Khi backend đang chạy với dữ liệu E01:

```powershell
python scripts/smoke_e02_hexagrams.py --url http://localhost:8080
```

Kiểm bootstrap2 lần và Java tích hợp: `python scripts/test_a02_bootstrap.py` (nhận PGPASSWORD từ môi trường, chỉ ghi DB tạm do script tạo). Kiểm HTTP toàn bộ với hai Server tạm và so dữ liệu trước/sau: `python scripts/verify_e02.py` (cần JAR đã build bằng `-Pdatabase`, nhận PGPASSWORD qua môi trường). Cổng mặc định18082/18083 phải trống; script dừng đúng các process nó tạo. `--write-fixtures` chỉ dùng khi muốn cập nhật các JSON mẫu từ runtime.

**Task tiếp theo H01:** phiên owner/cookie/CSRF, lưu và tra lịch sử. E02 không tạo session hoặc chứng minh lịch sử, bounded executor, benchmark hay UI đã hoàn thành.
