package com.huyenco.admin;

import com.huyenco.common.exception.ContractException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Profile("db")
final class MethodCatalogService {
    enum Group { MAI_HOA, TAM_THE, OTHER }
    enum State { LISTED, HIDDEN, UNAVAILABLE }
    private enum Action { CREATE_METHOD, UPDATE_METHOD, SHOW_METHOD, HIDE_METHOD, DELETE_METHOD }

    private static final String STATE = "CASE WHEN listed THEN 'LISTED' WHEN built_in THEN 'HIDDEN' ELSE 'UNAVAILABLE' END";
    private static final String FILTERS = """
            FROM divination_methods
            WHERE (strpos(lower(name),lower(?)) > 0 OR strpos(lower(code),lower(?)) > 0)
              AND (? = '' OR method_group = ?) AND (? = '' OR (%s) = ?)
            """.formatted(STATE);
    private static final String COLUMNS = "code,method_group,name,summary,introduction,instructions,required_input,built_in,listed,version";

    record Input(Group group, String name, String summary, String introduction, String instructions,
                 String requiredInput, boolean listed) {}
    record Summary(String code, Group group, String name, String summary, State state, int version,
                   String formPath, boolean guideSupported) {}
    record Detail(Summary method, String introduction, String instructions, String requiredInput) {}
    record Page(List<Summary> items, int page, int size, long totalElements, long totalPages) {}
    record PublicList(List<Detail> items) {}

    private final JdbcTemplate db;
    private final TransactionTemplate writes;
    private final TransactionTemplate reads;

    MethodCatalogService(JdbcTemplate db, PlatformTransactionManager transactions) {
        this.db = db;
        writes = new TransactionTemplate(transactions);
        reads = new TransactionTemplate(transactions);
        reads.setReadOnly(true);
        reads.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }

    Page list(String q, Group group, State state, int page, int size) {
        String groupName = group == null ? "" : group.name();
        String stateName = state == null ? "" : state.name();
        return reads.execute(tx -> {
            long total = db.queryForObject("SELECT count(*) " + FILTERS, Long.class, q, q, groupName, groupName, stateName, stateName);
            var items = db.query("SELECT " + COLUMNS + " " + FILTERS + " ORDER BY built_in DESC,code LIMIT ? OFFSET ?",
                    (row, index) -> summary(row), q, q, groupName, groupName, stateName, stateName, size, (long) page * size);
            return new Page(items, page, size, total, (total + size - 1) / size);
        });
    }

    Detail detail(String code) {
        return find(code, false);
    }

    PublicList published() {
        return new PublicList(db.query("SELECT " + COLUMNS + " FROM divination_methods WHERE listed ORDER BY code",
                MethodCatalogService::detail));
    }

    Detail create(String code, Input input, UUID actor) {
        return writes.execute(tx -> {
            if (builtinPath(code) != null) throw exists();
            requireListing(input, false);
            lockCode(code);
            if (Boolean.TRUE.equals(db.queryForObject("""
                    SELECT EXISTS (SELECT 1 FROM divination_method_events WHERE method_code=? AND action='DELETE_METHOD')
                    """, Boolean.class, code))) throw exists();
            int created = db.update("""
                    INSERT INTO divination_methods(code,method_group,name,summary,introduction,instructions,required_input)
                    VALUES (?,?,?,?,?,?,?) ON CONFLICT(code) DO NOTHING
                    """, code, input.group().name(), input.name(), input.summary(), input.introduction(),
                    input.instructions(), input.requiredInput());
            if (created == 0) throw exists();
            Detail next = detail(code);
            audit(code, 1, Action.CREATE_METHOD, actor, null, next.method().state());
            return next;
        });
    }

    Detail update(String code, int version, Input input, UUID actor) {
        return writes.execute(tx -> {
            Summary current = locked(code, version);
            boolean builtIn = current.formPath() != null;
            if (builtIn && current.group() != input.group()) {
                throw new ContractException("METHOD_PROTECTED", "Không thể đổi nhóm của phương pháp lõi.");
            }
            requireListing(input, builtIn);
            db.update("""
                    UPDATE divination_methods SET method_group=?,name=?,summary=?,introduction=?,instructions=?,
                      required_input=?,listed=?,version=version+1 WHERE code=?
                    """, input.group().name(), input.name(), input.summary(), input.introduction(), input.instructions(),
                    input.requiredInput(), input.listed(), code);
            Detail next = detail(code);
            State after = next.method().state();
            Action action = after == current.state() ? Action.UPDATE_METHOD
                    : after == State.LISTED ? Action.SHOW_METHOD : Action.HIDE_METHOD;
            audit(code, next.method().version(), action, actor, current.state(), after);
            return next;
        });
    }

    void delete(String code, int version, UUID actor) {
        writes.executeWithoutResult(tx -> {
            lockCode(code);
            Summary current = locked(code, version);
            if (current.formPath() != null) {
                throw new ContractException("METHOD_PROTECTED", "Phương pháp lõi chỉ có thể ẩn khỏi danh mục.");
            }
            if (Boolean.TRUE.equals(db.queryForObject("""
                    SELECT EXISTS (
                        SELECT 1 FROM cms_method_guides WHERE method_code=?
                        UNION ALL SELECT 1 FROM admin_calculation_daily_counts WHERE method=?
                        UNION ALL SELECT 1 FROM account_history WHERE result_snapshot->>'method'=?
                        UNION ALL SELECT 1 FROM interpretation_history WHERE result_snapshot->>'method'=?
                    )
                    """, Boolean.class, code, code, code, code))) {
                throw new ContractException("METHOD_IN_USE", "Phương pháp đang được dữ liệu khác tham chiếu.");
            }
            db.update("DELETE FROM divination_methods WHERE code=?", code);
            audit(code, version + 1, Action.DELETE_METHOD, actor, current.state(), null);
        });
    }

    // Keep a deleted code from being reused by a simultaneous or subsequent create.
    private void lockCode(String code) {
        db.query("SELECT pg_advisory_xact_lock(3812,hashtext(?))", row -> {}, code);
    }

    private Detail find(String code, boolean lock) {
        return db.query("SELECT " + COLUMNS + " FROM divination_methods WHERE code=?" + (lock ? " FOR UPDATE" : ""),
                MethodCatalogService::detail, code).stream().findFirst()
                .orElseThrow(() -> new ContractException("NOT_FOUND", "Không tìm thấy phương pháp."));
    }

    private Summary locked(String code, int version) {
        Summary current = find(code, true).method();
        if (current.version() != version) {
            throw new ContractException("VERSION_CONFLICT", "Phương pháp đã thay đổi. Hãy tải phiên bản mới.");
        }
        return current;
    }

    private void audit(String code, int version, Action action, UUID actor, State before, State after) {
        db.update("""
                INSERT INTO divination_method_events(method_code,version,action,actor_id,previous_state,new_state)
                VALUES (?,?,?,?,?,?)
                """, code, version, action.name(), actor, before == null ? null : before.name(), after == null ? null : after.name());
    }

    private static Detail detail(ResultSet row, int index) throws SQLException {
        return new Detail(summary(row), row.getString("introduction"), row.getString("instructions"), row.getString("required_input"));
    }

    private static Summary summary(ResultSet row) throws SQLException {
        String code = row.getString("code");
        State state = row.getBoolean("listed") ? State.LISTED : row.getBoolean("built_in") ? State.HIDDEN : State.UNAVAILABLE;
        return new Summary(code, Group.valueOf(row.getString("method_group")), row.getString("name"), row.getString("summary"),
                state, row.getInt("version"), builtinPath(code), switch (code) {
                    case "TIME", "OBJECT_COUNT", "LINES", "TAM_THE" -> true;
                    default -> false;
                });
    }

    private static String builtinPath(String code) {
        return switch (code) {
            case "TIME", "OBJECT_COUNT", "LINES", "TRUONG_XICH" -> "/mai-hoa";
            case "TAM_THE" -> "/tam-the";
            default -> null;
        };
    }

    private static void requireListing(Input input, boolean builtIn) {
        if (input.listed() && !builtIn) {
            throw new ContractException("METHOD_UNAVAILABLE", "Chưa có bộ xử lý tính toán cho phương pháp này.");
        }
    }

    private static ContractException exists() {
        return new ContractException("METHOD_EXISTS", "Mã phương pháp đã được sử dụng.");
    }
}
