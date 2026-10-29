# B03 — Lập quẻ theo số vật

Ngày thực hiện: 24/10/2026. **Trạng thái: DONE trong phạm vi Server B03.** Tuyến `OBJECT_COUNT` được kiểm bằng chương trình Client STOMP, registry và PostgreSQL đến quẻ chủ/hỗ/biến; giữ các trạng thái nguồn riêng với quyền chạy theo quyết định nhóm. Giao diện sản phẩm thuộc TV1.

## 1. Nguồn đã đối chiếu và phạm vi duyệt

PDF Mai Hoa người dùng cung cấp có 672 trang, SHA256 `225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de`. Chưa xác minh đầy đủ danh tính ấn bản in. Trang PDF tính từ 1.

| Nội dung | Trang PDF / trang in | Kết quả |
| --- | --- | --- |
| Tám số Tiên thiên | 39 / 44 | Càn 1, Đoài 2, Ly 3, Chấn 4, Tốn 5, Khảm 6, Cấn 7, Khôn 8 |
| Chia dư 8 | 39–40 / 44–45 | Dư 0 là Khôn; ví dụ 9, 25, 49 cùng ra Càn |
| Ngũ hành | 23–24 / 28–29; 35 / 40 | Càn/Đoài Kim, Chấn/Tốn Mộc, Khảm Thủy, Ly Hỏa, Cấn/Khôn Thổ |
| Ba hào của quái | 35 / 40; đối chiếu sơ đồ đã kiểm ở S01, PDF 274 / 281 | Mô tả hào đầu/giữa/thượng cho sáu quái con; quy về bit từ dưới lên như bảng dưới |
| Xem bằng số vật | 46 / 51 | Số vật làm thượng, giờ làm hạ; cụm “số quẻ” trong phép lấy hào còn đa nghĩa |

| Mã | Quái | Số | Hành | Ba hào dưới→trên (1=dương, 0=âm) |
| --- | --- | ---: | --- | --- |
| CAN | Càn | 1 | KIM | 111 |
| DOAI | Đoài | 2 | KIM | 110 |
| LY | Ly | 3 | HOA | 101 |
| CHAN | Chấn | 4 | MOC | 100 |
| TON | Tốn | 5 | MOC | 011 |
| KHAM | Khảm | 6 | THUY | 010 |
| CAN2 | Cấn | 7 | THO | 001 |
| KHON | Khôn | 8 | THO | 000 |

Lượt nhập ban đầu có trong seed; lượt hai đối chiếu ảnh gốc và mô tả hào/manifest riêng ở `data/trigram_source_review.csv`. Người/công cụ kiểm thực tế: **Codex source review 2026-10-24 (same-tool second pass)**. Đây là cùng công cụ AI ở hai lượt, không phải hai người kiểm độc lập hoặc xác nhận mới từ TV2.

Chỉ nâng `MH-TRIGRAM` phiên bản 1.0 sang VERIFIED. `MH-OBJECT-COUNT` giữ **SOURCE_AMBIGUOUS**, policy **TEAM_DECISION** với `DEC-20261022-MH-OBJECT-COUNT`. Việc chạy đúng công thức nhóm không chứng minh cụm từ trong ấn bản đã được giải quyết. Không duyệt thêm TIME, Thể–Dụng, luận giải hoặc dữ liệu Tam Thế.

## 2. Phép tính và đầu ra

1. Kiểm JSON: số vật nguyên 1–999999, giờ Chi nguyên 1–12, câu hỏi tùy chọn tối đa 500 ký tự.
2. Registry cấp quyền đúng phiên bản cho cả bốn mã: OBJECT-COUNT, TRIGRAM, MUTUAL, CHANGE. Thiếu một quy tắc phụ thuộc được duyệt thì không tính.
3. Đọc và kiểm snapshot đủ tám quái, số 1–8, mã/mẫu hào không trùng. Báo CALCULATING khi bắt đầu phép tính.
4. Lấy thượng = `N % 8` (0→8), hạ = `H % 8` (0→8), hào = `(N + H) % 6` (0→6). Tổng dùng **số gốc**, không dùng số thượng/hạ đã rút gọn.
5. Ghép ba hào hạ rồi ba hào thượng. Quẻ hỗ lấy vị trí 2–4/3–5; quẻ biến đảo đúng hào động.
6. Báo LOOKUP; kiểm đủ 64 cấu trúc và quan hệ với bảng quái, tra mã/tên đã duyệt. Dữ liệu thiếu/sai trả KNOWLEDGE_DATA_INCOMPLETE; lỗi DB trả DATABASE_UNAVAILABLE.
7. Trả kết quả cùng source/decision metadata và các bước số học. Không phản chiếu câu hỏi, không lưu lịch sử ở task này. `lunarDate=null` vì input đã có chỉ số giờ; không cần giả lập chuyển lịch.

Ca đã chốt: **12 vật, giờ Mùi (8)** → thượng Chấn (4), hạ Khôn (8), tổng 20 → hào 2; quẻ chủ **Dự** (`H_CHAN_KHON`), hỗ **Kiển** (`H_KHAM_CAN2`), biến **Giải** (`H_CHAN_KHAM`).

Root `ruleBasis=TEAM_DECISION`, `sourceStatus=SOURCE_AMBIGUOUS`. Riêng ba rule phụ thuộc có SOURCE_VERIFIED/VERIFIED. Metadata tên quẻ VERIFIED thuộc phạm vi S01, không nâng trạng thái công thức số vật.

## 3. Cách áp dụng trên database

Không có migration/schema mới; V1–V5 giữ nguyên checksum. `verify_trigram_rule.py` kiểm hash PDF và manifest, so đúng tám bản ghi (tên/số/hành/hào), nguồn trang 39/35 và trạng thái reviewer. Script sao lưu metadata quy tắc vào thư mục ignored trước khi áp dụng; transaction khóa các bảng liên quan và chỉ cập nhật MH-TRIGRAM. Bản ghi có reviewer khác hoặc nguồn/dữ liệu đổi bị từ chối. Chạy lại giữ nguyên thời điểm duyệt. Script không sửa tám bản ghi để ép khớp kết quả.

`import_all.ps1` đã gọi bước này sau seed, migration và duyệt tên; dùng lại cho DB mới và DB hiện có. Mật khẩu nhập ẩn hoặc qua biến môi trường, không lưu vào file.

## 4. Client và bàn giao TV1

TV2–TV3 bàn giao payload, phản hồi JSON, mã lỗi, metadata nguồn/quyết định và bốn sự kiện progress. TV1 phụ trách biểu mẫu, lựa chọn mặc định, nội dung hiển thị, sơ đồ ba quẻ và tích hợp kết quả vào giao diện. TIME phía Server chưa sẵn sàng; TV1 thể hiện trạng thái theo hợp đồng. Không gọi F02/F03 hoàn thành trên giao diện chỉ từ kết quả kiểm STOMP.

**Điều chỉnh theo nhắc nhở của chủ dự án:** B03 từng sửa ba chỗ trong trang Mai Hoa (phương pháp mặc định, lời giới thiệu, nhãn TIME). Đã hoàn tác riêng cả ba thay đổi đó về trạng thái trước B03. Các sửa giao diện trong những đợt trước vẫn có trong lịch sử làm việc; từ đây Codex chỉ triển khai phạm vi TV2–TV3 và bàn giao yêu cầu tích hợp cho TV1, không tự sửa giao diện khi chưa có chỉ định riêng.

Ví dụ runtime đã lưu ở `docs/examples/mai-hoa-object-count.response.json`; chỉ thay requestId bằng ID ổn định của fixture. Không coi fixture là biên bản duyệt nguồn.

## 5. Kiểm tra và bằng chứng

Các kết quả thực chạy được ghi ở phần hoàn tất bên dưới; các lệnh tái lập:

```powershell
# Repo root, PGPASSWORD trong process hoặc script nhập ẩn
python -m unittest discover -s scripts/tests -v
python scripts/test_a02_bootstrap.py
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/import_all.ps1
# Client; cần Server profile db đang chạy cho smoke
npm run smoke:object-count
npm run smoke:lines
npm run smoke:progress
npm run smoke:stomp
npm run check:contract
npm run test:calculation
npm run build
```

Kiểm chức năng không thay benchmark N01/T01. TIME/lịch, Tam Thế, API tra cứu/lịch sử và UI I01 vẫn theo kế hoạch 15; không dùng B03 để tuyên bố toàn dự án đã hoàn thành.

## 6. Kết quả hoàn tất

| Kiểm tra thực chạy | Kết quả |
| --- | --- |
| Java với PostgreSQL tạm | **432 test, 0 failure/error, 0 skip**; gồm kiểm Spring wiring và toàn bộ response khớp fixture runtime |
| Oracle OBJECT_COUNT | 24 số × 12 giờ + hai số 999998/999999 × 12 giờ; khớp ba mẫu hào tính độc lập bằng bit, đúng số gốc và nguồn/quyết định |
| Bootstrap | DB trống chạy hai lần, mọi bản ghi/metadata giữ nguyên; ba ca đổi dữ liệu/reviewer/trang nguồn đều bị từ chối; DB tạm đã xóa |
| Python | **26/26** đạt; manifest thay đổi không được dùng lại để duyệt |
| STOMP OBJECT_COUNT | **314 kết quả hợp lệ + 10 lỗi input**, **1.276 progress** đúng; hai phiên cùng ID/khác input không lẫn |
| STOMP LINES hồi quy | **387 terminal + 1.546 progress** đúng; cả ma trận 64×6 và hai phiên đạt |
| STOMP lỗi/quyền | JSON hỏng/phục hồi, TIME/Tam Thế chưa có, reconnect, chặn SUBSCRIBE/SEND trái phép đạt |
| Client | **10/10**, typecheck, **12 fixtures TypeScript**, production build Webpack đạt |
| Database huyenco | Đã áp dụng biên bản MH-TRIGRAM; readiness READY thuộc KNOWLEDGE_STORAGE, businessFeaturesReady=false; ba rule VERIFIED và 64 tên VERIFIED |
| Kiểm toán huyenco | **35 kiểm tra, 0 FAIL, 2 PENDING**: lời giải 64 quẻ và dữ liệu Tam Thế còn thiếu |

Kiểm fixture từ phản hồi thật phát hiện Jackson tự xuất `complete` từ helper `DecisionReference.isComplete()`. Đã gắn JsonIgnore cho helper, giữ hợp đồng bốn trường; kiểm round-trip Java, response DB khớp fixture và kiểm khóa runtime STOMP đã đạt sau sửa. Không thêm trường nội bộ vào TypeScript để che lệch hợp đồng.

Bằng chứng cục bộ được ignore trong `scripts/generated/`: `b03_bootstrap.log`, `a02_bootstrap_result.json`, `b03_live_import.log`, `b03_object_count_stomp.json`, `b03_lines_regression.json`, `b03_progress_errors.json`, `b03_readiness.json`, `tv3_audit_report.md`; Java ở `server/target/surefire-reports/`. Server kiểm tra cổng 18081 đã dừng sau đợt kiểm. Snapshot đầu của B03 từng chứa `complete`; báo cáo OBJECT_COUNT đã được chạy lại và thay bằng phản hồi bản sửa.

Tiếp theo: **S02**, chép và đối chiếu đủ 60 Can Chi/hành mệnh từ Tam Thế; S03 tiếp tục bản đồ nội dung. C01 cần hoàn tất lịch trước khi mở TIME ở B04. Các thay đổi thuộc B03 chưa được commit/merge tự động.
