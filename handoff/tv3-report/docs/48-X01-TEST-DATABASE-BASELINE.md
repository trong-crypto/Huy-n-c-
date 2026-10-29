# X01.1 — Database TEST và snapshot nền cho benchmark

**Hoàn thành ngày 29/10/2026, giờ Việt Nam. Trạng thái: PASS — database sẵn sàng cho benchmark.** Cập nhật tiếp: X01.2 đã triển khai runner và kiểm thử khói thật theo [biên bản 49](49-X01-RUNNER-BACKEND-HANDOFF.md); chưa chạy ma trận benchmark chính thức.

## 1. Database đã chốt trên máy chủ dự án

| Thông tin | Giá trị |
| --- | --- |
| Database benchmark | `huyenco_benchmark_test_20261029_010531` |
| PostgreSQL | `127.0.0.1:5432`, phiên bản `18.6` |
| JDBC URL | `jdbc:postgresql://127.0.0.1:5432/huyenco_benchmark_test_20261029_010531` |
| Username cục bộ | `postgres`; mật khẩu chỉ cấp qua môi trường khi chạy |
| Database nguồn được đọc | `huyenco_acceptance_test_20261028_184149` |
| Schema | V1–V12 thành công, 18 bảng public |
| Phiên ban đầu | `anonymous_sessions = 0` |
| Lịch sử ban đầu | `interpretation_history = 0` |
| Flyway khi benchmark | `SPRING_FLYWAY_ENABLED=false` |
| Backend benchmark dự kiến | `http://127.0.0.1:18091` |
| WebSocket dự kiến | `ws://127.0.0.1:18091/ws` |
| Origin cho runner | `http://127.0.0.1:3173` |

Đây là database trên máy hiện tại, không tự xuất hiện trên máy TV1 khi kéo Git. Mỗi máy tự chuẩn bị TEST hoặc runner TV1 kết nối Backend của máy này qua LAN theo tài liệu 46.

Backend/UI đang chạy dùng TEST nguồn, với 8 kết nối JDBC tại thời điểm kiểm tra. Cổng `18090` và Client `3173` đang được sử dụng; bước X01.1 giữ các tiến trình đó hoạt động. Chọn `18091` cho Backend benchmark riêng; đây mới là cấu hình dự kiến, chưa có Backend benchmark lắng nghe và phải kiểm tra cổng lại khi khởi động.

## 2. Thao tác đã thực hiện và kiểm chứng

1. Đọc metadata PostgreSQL để xác nhận TEST nguồn tồn tại và kiểm V12/nguồn mở rộng.
2. Tạo archive custom format từ schema public của TEST nguồn, **loại dữ liệu hai bảng phiên/lịch sử**. Các bảng và ràng buộc của chúng vẫn được giữ để schema đầy đủ.
3. Tạo database benchmark mới từ template0 và khôi phục archive trong một transaction. Không migrate/import lại sách, không sửa approval hoặc bảng nguồn.
4. So từng dòng của **16 bảng tri thức/migration**, cùng cấu trúc cột, ràng buộc và index giữa nguồn với bản sao: khớp. Hai bảng runtime được kiểm trống riêng.
5. So hash dữ liệu tri thức/schema của nguồn trước/sau: không đổi trong lượt chuẩn bị.
6. Chạy kiểm toán nền thật trên TEST mới: **54 kiểm tra, 0 FAIL, 0 PENDING**. Kiểm toán mở hai PDF cục bộ và đối chiếu các hồ sơ nguồn hiện có.
7. Chạy audit V12 riêng: **PASS**, đúng bundle, review, nội dung, nhãn và ánh xạ; không có constraint chưa validated. Dữ liệu mở rộng đúng **1 bundle / 20 mẫu Mai Hoa / 19 đoạn Tam Thế / 204 ánh xạ**.
8. Truy vấn độc lập sau chuẩn bị xác nhận đúng database, 12 migration thành công, 18 bảng và 0 phiên/0 lịch sử.

Việc khôi phục đầu tiên gặp xung đột schema public có sẵn trong database mới. Transaction đó đã rollback; database rỗng do lượt lỗi tạo đã được kiểm không có bảng/kết nối khác rồi dọn. Database cuối trong mục 1 là lượt chuẩn bị PASS. Script hiện dùng `pg_restore --clean --if-exists --single-transaction` **chỉ sau khi chính script tạo thành công một database mới**; từ chối ghi đè database đã có hoặc thay target manifest đã chốt.

Không thực hiện thao tác ghi vào `huyenco` hoặc TEST nguồn; không dừng Backend/UI hiện tại. Các quyền PostgreSQL của tài khoản không bị thay đổi. Đây là snapshot đã đối chiếu bằng hash, không phải cơ chế khóa database bất biến; cần đối chiếu hash trước/sau các lượt benchmark.

## 3. Số lượng dữ liệu nền

| Bảng / nhóm | Số bản ghi |
| --- | ---: |
| `source_books` | 2 |
| `source_sections` | 33 |
| `calculation_rules` | 14 |
| `trigrams` | 8 |
| `hexagrams` | 64 |
| `hexagram_lines` | 384 |
| `interpretations` | 64 |
| `tam_the_hour_anchors` | 12 |
| `tam_the_lookup_entries` | 447 |
| `tam_the_lookup_source_pages` | 231 |
| `external_sources` | 1 |
| `reading_source_bundles` | 1 |
| `mai_hoa_reading_templates` | 20 |
| `tam_the_supplement_results` | 19 |
| `tam_the_supplement_mappings` | 204 |
| `flyway_schema_history` | 12 |

Các số lượng này mô tả snapshot, không có nghĩa mọi lời luận ngoài phạm vi dữ liệu đã duyệt đều được hỗ trợ. Nghiệm thu chức năng và hiệu năng là các bước riêng.

## 4. Artifact cục bộ đã lưu

Target manifest không có mật khẩu:

`scripts/generated/x01_benchmark_target.json`

Thư mục bằng chứng:

`scripts/generated/x01_preparation_20261029_010531/`

| File | Nội dung |
| --- | --- |
| `knowledge_snapshot.dump`, `archive_toc.txt` | Snapshot schema/tri thức, không có dữ liệu phiên/lịch sử nguồn |
| `source_baseline.json`, `source_after.json` | Count/hash từng bảng và schema nguồn trước/sau |
| `target_baseline.json` | Count/hash TEST benchmark và xác nhận runtime trống |
| `baseline_audit.md`, `baseline_audit.log` | Kết quả 54 kiểm tra nền |
| `source_v12_audit.json`, `target_v12_audit.json` | Audit review/nội dung V12 ở nguồn và bản sao |
| `source_artifact_hashes.json` | SHA-256 các file dữ liệu và migration trong checkout |
| `preparation_report.json` | Kết quả chuẩn bị PASS |
| `independent_identity_check.json` | Truy vấn đối chiếu DB/V12/count độc lập |
| `environment-preparation.json` | OS/CPU/RAM, phiên bản công cụ, Git và tiến trình/cổng quan sát được |

Fingerprint:

- Tri thức/migration: `115d9ced12f174341833dbe88ed5a15850a40f63e05a3922244bb6c2d77a01cc`.
- Schema cột/ràng buộc/index: `16bc7fcec71e6af200a9f2f80a33da0ac87dd48888b586500dd0361b8b25752a`.
- Archive: `a770ca1400d2aadd237c9087abdbb0427e3c534113c01be390c3446fe494c44d` (102.309 byte).

Artifact `scripts/generated/x01_*` đã được Git bỏ qua. Mã chuẩn bị và biên bản có thể bàn giao; target/dump/log là dữ liệu cục bộ, không phải file tự chạy được trên mọi máy. Không có mật khẩu/cookie/CSRF trong target manifest.

## 5. Môi trường quan sát và việc tiếp theo

Máy hiện tại: Windows 11 Home Single Language 64-bit, Intel Core i7-13620H (10 core/16 logical processor), RAM hệ thống báo 25.458.917.376 byte; Node `24.21.0`, Python `3.12.0`, PostgreSQL `18.6`. `java` trên PATH hiện trả `24.0.2`; JDK và JAR dùng đo phải được chốt lại ở X01.2, dùng cùng một bản cho hai mode. Commit quan sát `45f07a6fd8dd2c8b3dfaec09869e182545ce8ab7`, working tree có thay đổi; chưa coi đây là binary benchmark đã được build/pin.

Đã chạy **4 test bảo vệ quy trình chuẩn bị**, đạt: chặn tên database ngoài TEST/ngày sai/chuỗi SQL, phân biệt nguồn và target, từ chối lệch tri thức/schema hoặc runtime không trống, không ghi đè manifest. Kiểm toán trực tiếp và clone round-trip ở mục 2 là bằng chứng DB thật, tách với bốn test này.

**X01.2 đã tiếp tục hoàn thành** runner/wrapper, JDK17/JAR pin và health/readiness/fixture qua kiểm thử khói thật trên 18091; xem [biên bản 49](49-X01-RUNNER-BACKEND-HANDOFF.md). Tiếp theo X01.3 pilot, rồi ma trận 18 lượt trong [tài liệu 47](47-X01-BENCHMARK-2-5-20-PLAN.md).

Không cần chạy lại `prepare_x01_test_database.py` để tạo database lần nữa. Script chủ động dừng nếu target manifest đã tồn tại, giúp tránh tạo nhầm TEST hoặc thay snapshot ngoài ý muốn. Database benchmark này dành cho tải STOMP ẩn danh; lịch sử trên giao diện tiếp tục dùng TEST nghiệm thu riêng.
