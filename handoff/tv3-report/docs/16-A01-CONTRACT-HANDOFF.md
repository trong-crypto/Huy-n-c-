# A01 — Hợp đồng và registry quy tắc đã hoàn thành

Ngày: 23/10/2026. Phạm vi là task A01 trong kế hoạch 15; chưa phải hoàn thành các phép tính B01/B03/B04 hay repository A02.

## Đầu ra đã có

| Hạng mục | Bằng chứng trong repo |
| --- | --- |
| Chốt envelope, request/response/progress, nguồn/quyết định, lỗi và REST dự kiến | `docs/02-API-CONTRACT.md` v1.2 |
| DTO chung có kiểu dữ liệu cụ thể | `client/src/types/contract.ts`, Java `common/dto/` |
| Danh sách đúng 14 quy tắc và policy tách khỏi trạng thái nguồn | `server/src/main/resources/rules/execution-catalog.json` |
| Registry kiểm nguồn/version/review/quyết định trước khi cấp quyền | Java `knowledge/RuleRegistry.java`, `RuleStateProvider.java` |
| Provider mặc định không tự bịa trạng thái DB | `config/RuleRegistryConfig.java`; A02 thay bằng provider thật |
| Metadata không che khuất rule theo quy ước nhóm | `EvidenceSummary`; top-level TEAM_DECISION khi bất kỳ rule theo nhóm |
| Chặn quy ước nhóm cho lời luận giải chưa kiểm | RulePurpose.INTERPRETATION và DTO TamTheResult |
| Mẫu cho TV1 | 12 JSON trong `docs/examples/`; README giải thích fixtures không phải kết quả runtime |
| Cảnh báo quy ước nhóm trên UI khi có kết quả phù hợp | `client/src/components/ResultPanel.tsx` |
| Chặn input ngoài hợp đồng/số nguyên tràn/UUID không chuẩn/categories sai | ContractValidator và unit tests |
| Không để request Client tự truyền policy để nâng quyền | Payload whitelist và registry chỉ dùng catalog phía Server |

## Cách kiểm tra và kết quả đã chạy

- Java: **21 kiểm thử đạt, 0 lỗi, 0 bỏ qua**. Gồm validator (5), fixture/DTO (4), context registry (1), chính sách registry (8), số học Mai Hoa có sẵn (3). Báo cáo Surefire ở `server/target/surefire-reports/`.
- Client: `npm run typecheck` đạt.
- `npm run check:contract`: **12 JSON fixtures khớp kiểu Client**; kiểm trực tiếp JSON bằng TypeScript compiler, không tạo file kiểm tạm trong repo.
- Java đã dùng JDK 17 và Maven 3.9.16 trong cache wrapper. Chạy lại tại `server/`: `./mvnw.cmd test`; nếu máy có nhiều Java, đặt JAVA_HOME tới JDK 17 của máy trong phiên PowerShell trước khi chạy. Lần đầu có thể cần tải dependency kiểm thử Maven.

Các kiểm thử này xác nhận hợp đồng và cơ chế cấp quyền; chúng không chứng minh lịch/Tam Thế/LINES đã được triển khai đầu cuối. Kiểm thử cấu hình Spring dùng context registry gọn, không phụ thuộc Mockito attach agent hoặc mở cổng Server.

## Các quy tắc quan trọng khi tích hợp

1. A02 cung cấp RuleStateProvider đọc module/version/status/source/reviewer/reviewedAt từ PostgreSQL. Không copy trạng thái VERIFIED vào catalog.
2. Mỗi tuyến nghiệp vụ gọi authorizeAll cho đúng bộ rule và purpose trước khi tính/trả kết quả. Cần kiểm thêm dữ liệu bảng đủ và đã duyệt, không suy mọi ô đúng từ một rule chung.
3. MH-TIME/MH-OBJECT-COUNT có TEAM_DECISION từ quyết định chủ dự án ngày 22/10. State DRAFT hoặc thiếu nguồn vẫn bị từ chối. State VERIFIED dù policy TEAM_DECISION cũng phải có reviewer/thời gian kiểm; không được dùng policy che dữ kiện thiếu.
4. SOURCE_VERIFIED cần đúng phiên bản, nguồn hợp lệ và review thực. DISABLED luôn chặn, kể cả DB đang VERIFIED.
5. Dùng EvidenceSummary để giữ ruleBasis/sourceStatus/decisionReferences đầy đủ; Client hiện cảnh báo nếu TEAM_DECISION. Không bỏ metadata khi lưu lịch sử.
6. Thiếu category Tam Thế được yêu cầu thì FAILED; không trả COMPLETED một phần. Không có categories nghĩa là cả CAREER/WEALTH/LOVE.
7. Chưa có source state/provider DB: RULE_STATE_UNAVAILABLE. Service chưa triển khai: IMPLEMENTATION_UNAVAILABLE. Hai điều kiện khác nhau; không kết luận quy tắc đã mất VERIFIED từ một lỗi implementation.

## Phạm vi chưa thực hiện ở A01

Không chạy migration hoặc sửa dữ liệu PostgreSQL trong task này. Không nâng 64 tên hay các bảng Tam Thế lên VERIFIED. Hai service nghiệp vụ hiện vẫn là placeholder trả lỗi; các mẫu success chưa được dùng làm dữ liệu giả trong Server. Progress và REST trong hợp đồng là chuẩn dành cho B02/C01/E02/H01, chưa có endpoint/controller tương ứng.

## Việc tiếp theo — A02

Thêm repository JDBC/provider trạng thái từ DB, kiểm đủ dữ liệu và health/readiness; sửa bootstrap DB trống (V1–V3 → seed → V4 → phần tiếp theo) mà không sửa checksum migration cũ. Sau A02 mới nối phép LINES ở B01 để trả kết quả thật theo registry.
