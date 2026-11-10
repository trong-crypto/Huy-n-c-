# Khôi phục mật khẩu tài khoản TEST trên localhost

Công cụ dành cho người quản lý PostgreSQL TEST đã được phép thao tác trên tài khoản đích. Công cụ chạy từ terminal tương tác, dùng bộ băm Argon2id của Backend và không khởi động Spring Boot.

## Môi trường được hỗ trợ

| Host | Cổng | Database |
|---|---:|---|
| `127.0.0.1` | 55488 | `huyenco_recovery_cms_test_tv1v33` |
| `127.0.0.1` | 5433 | `huyenco_tv1_8b4b_clone` |

Chuẩn bị JDK 17 và JAR đã đóng gói bằng Maven profile `database`. Chạy từ thư mục `server`. Dùng role PostgreSQL TEST được cấp quyền đọc định danh và cập nhật mật khẩu, phiên trong đúng database. Công cụ yêu cầu nhập tên role, không chấp nhận role `postgres`.

```powershell
.\mvnw.cmd -Pdatabase -DskipTests package
$recovery = @(
  '-Dloader.main=com.huyenco.auth.TestAccountRecovery',
  '-cp', '.\target\huyen-co-server-0.1.0-SNAPSHOT.jar',
  'org.springframework.boot.loader.launch.PropertiesLauncher',
  '--host', '127.0.0.1',
  '--port', '5433',
  '--database', 'huyenco_tv1_8b4b_clone',
  '--user', '<TEST role đã xác nhận>',
  '--identifier', '<identifier chuẩn hóa>',
  '--account-id', '<UUID tài khoản>'
)
java @recovery --dry-run
```

Nhập mật khẩu PostgreSQL ở prompt ẩn. Dry-run chỉ đọc và in host, cổng, database, role kết nối, phiên bản Flyway, UUID, identifier, role và trạng thái tài khoản. Công cụ kiểm đầy đủ V1–V27 trên clone hoặc V1–V33 trên disposable. Kết quả dự kiến là `DRY_RUN accounts_updated=0 sessions_revoked=0`.

Sau khi người quản lý xác nhận database, quyền và tài khoản đích, chạy `java @recovery`. Nhập đúng chuỗi xác nhận do công cụ hiển thị theo thứ tự database, identifier và UUID. Nhập hai lần mật khẩu mới ở prompt ẩn. Mật khẩu dùng 8–128 điểm mã Unicode và giữ nguyên khoảng trắng.

Kết quả `COMMITTED accounts_updated=1 sessions_revoked=N` cho biết giao dịch đã cập nhật một tài khoản và thu hồi `N` phiên còn hiệu lực. Công cụ kiểm lại trạng thái tài khoản dưới khóa trước khi cập nhật. Lỗi khi ghi mật khẩu hoặc thu hồi phiên khiến giao dịch rollback. Xác minh bằng cách đăng nhập với mật khẩu mới và đối chiếu UUID, quyền và lịch sử.

## Kiểm thử trên V33 disposable

Chỉ bật `HUYENCO_RUN_RECOVERY_DISPOSABLE_TEST=1` khi cụm disposable đã được xác minh trên cổng 55488. Chạy `.\mvnw.cmd -Pdatabase -Dtest=TestAccountRecoveryTest test`. Các ca có database tạo tài khoản, phiên, lịch sử và một trigger thử lỗi có phạm vi hẹp trên bản sao disposable.
