package com.huyenco.admin;

import com.huyenco.common.exception.ContractException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("db")
public class AdminMetricsService {
    private static final Logger LOG = LoggerFactory.getLogger(AdminMetricsService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final List<Method> METHODS = List.of(
            new Method("TIME", "Theo thời điểm"), new Method("OBJECT_COUNT", "Theo số vật đếm được"),
            new Method("LINES", "Nhập sáu hào"), new Method("TAM_THE", "Tam Thế"),
            new Method("TRUONG_XICH", "Trượng xích chiêm"));

    private record Method(String id, String name) {}
    record MethodCount(String id, String name, long count) {}
    record AccountCounts(long users, long consultants, long admins, long active, long locked) {}
    record Metrics(String date, String timeZone, String trackingStartedAt, String calculationCoverage,
                   long users, Long calculations, long pendingContent, long consultants,
                   AccountCounts accounts, List<MethodCount> methods) {}

    private final JdbcTemplate db;
    private final Clock clock;

    AdminMetricsService(JdbcTemplate db, Clock clock) {
        this.db = db;
        this.clock = clock;
    }

    /** Telemetry runs after the successful STOMP terminal. A storage failure must not replace that result. */
    public void recordCompletion(String method) {
        LocalDate date = currentDate();
        try {
            db.update("""
                    INSERT INTO admin_calculation_daily_counts(local_date, method, completed_count)
                    VALUES (?, ?, 1)
                    ON CONFLICT (local_date, method) DO UPDATE
                    SET completed_count = admin_calculation_daily_counts.completed_count + 1
                    """, date, method);
        } catch (DataAccessException failure) {
            LOG.warn("Could not record Admin calculation count, date={}, method={}, failure={}",
                    date, method, failure.getClass().getSimpleName());
        }
    }

    private LocalDate currentDate() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Metrics read(LocalDate date) {
        LocalDate today = currentDate();
        LocalDate day = date == null ? today : date;
        if (day.isAfter(today)) throw new ContractException("INVALID_INPUT", "Ngày thống kê không thể ở tương lai.");

        OffsetDateTime startedAt = db.queryForObject(
                "SELECT tracking_started_at FROM admin_calculation_metrics_origin WHERE singleton", OffsetDateTime.class);
        LocalDate firstDay = startedAt.atZoneSameInstant(ZONE).toLocalDate();
        AccountCounts accounts = db.queryForObject("""
                SELECT count(*) FILTER (WHERE role='USER'), count(*) FILTER (WHERE role='CONSULTANT'),
                       count(*) FILTER (WHERE role='ADMIN'), count(*) FILTER (WHERE status='ACTIVE'),
                       count(*) FILTER (WHERE status='LOCKED')
                FROM accounts
                """, (row, index) -> new AccountCounts(row.getLong(1), row.getLong(2), row.getLong(3),
                row.getLong(4), row.getLong(5)));
        long pending = db.queryForObject(
                "SELECT count(*) FROM cms_method_guides WHERE working_status='PENDING_REVIEW'", Long.class);
        if (day.isBefore(firstDay)) {
            return new Metrics(day.toString(), ZONE.getId(), startedAt.toInstant().toString(), "UNAVAILABLE",
                    accounts.users(), null, pending, accounts.consultants(), accounts, List.of());
        }
        var counts = db.query("""
                SELECT method, completed_count FROM admin_calculation_daily_counts WHERE local_date=?
                """, result -> {
            var values = new HashMap<String, Long>();
            while (result.next()) values.put(result.getString(1), result.getLong(2));
            return values;
        }, day);
        List<MethodCount> methods = METHODS.stream()
                .filter(method -> !"TRUONG_XICH".equals(method.id()) || counts.containsKey(method.id()))
                .map(method -> new MethodCount(method.id(), method.name(), counts.getOrDefault(method.id(), 0L))).toList();
        long total = methods.stream().mapToLong(MethodCount::count).sum();
        return new Metrics(day.toString(), ZONE.getId(), startedAt.toInstant().toString(),
                day.equals(firstDay) ? "PARTIAL" : "AVAILABLE", accounts.users(), total,
                pending, accounts.consultants(), accounts, methods);
    }
}
