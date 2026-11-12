package com.huyenco.cms;

import com.huyenco.common.exception.ContractException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Profile("db")
final class MethodGuideService {
    enum Method {
        TIME, OBJECT_COUNT, LINES, TAM_THE;
        String group() { return this == TAM_THE ? "TAM_THE" : "MAI_HOA"; }
    }
    enum Action { SAVE_DRAFT, SUBMIT_REVIEW, RETURN_TO_DRAFT, PUBLISH, SHOW, HIDE }
    enum Status { DRAFT, PENDING_REVIEW, PUBLISHED }
    record Draft(String title, String body, String editorNote) {}
    record Revision(int revision, String title, String body, String editorNote) {}
    record Publication(int revision, String title, String body, String editorNote, String publishedAt) {}
    record Summary(Method methodCode, String group, String title, Status status, boolean visible, int version, String updatedAt) {}
    record Detail(Method methodCode, String group, String title, Status status, boolean visible, int version, String updatedAt,
                  Revision working, Publication published) {
        Summary summary() { return new Summary(methodCode, group, title, status, visible, version, updatedAt); }
    }
    record Event(int version, String action, int revision, UUID actorId, String occurredAt, String reason) {}
    record PublicGuide(Method methodCode, String title, String body, int revision, String publishedAt) {}
    record PublicList(List<PublicGuide> items) {}
    record Page<T>(List<T> items, int page, int size, long totalElements, long totalPages) {
        static <T> Page<T> of(List<T> items, int page, int size, long total) {
            return new Page<>(items, page, size, total, (total + size - 1) / size);
        }
    }
    private record Head(int version, Integer workingRevision, Status workingStatus, Integer publishedRevision,
                        OffsetDateTime publishedAt, boolean visible) {
        int activeRevision() { return workingRevision != null ? workingRevision : publishedRevision; }
    }

    private static final String DETAILS = """
            SELECT g.method_code,g.version,g.working_status,g.visible,g.updated_at,g.published_at,
                   w.revision AS w_revision,w.title AS w_title,w.body AS w_body,w.editor_note AS w_note,
                   p.revision AS p_revision,p.title AS p_title,p.body AS p_body,p.editor_note AS p_note
            FROM cms_method_guides g
            LEFT JOIN cms_method_guide_revisions w ON (w.method_code,w.revision)=(g.method_code,g.working_revision)
            LEFT JOIN cms_method_guide_revisions p ON (p.method_code,p.revision)=(g.method_code,g.published_revision)
            """;
    private final JdbcTemplate db;
    private final Clock clock;
    private final TransactionTemplate writes;
    private final TransactionTemplate reads;

    MethodGuideService(JdbcTemplate db, PlatformTransactionManager transactionManager, Clock clock) {
        this.db = db;
        this.clock = clock;
        writes = new TransactionTemplate(transactionManager);
        reads = new TransactionTemplate(transactionManager);
        reads.setReadOnly(true);
        reads.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }

    Detail create(Method method, Draft draft, UUID actor) {
        return writes.execute(tx -> {
            OffsetDateTime now = now();
            int created = db.update("""
                    INSERT INTO cms_method_guides(method_code,version,published_revision,published_at,visible,created_at,updated_at)
                    VALUES (?,1,1,?,TRUE,?,?) ON CONFLICT (method_code) DO NOTHING
                    """, method.name(), now, now, now);
            if (created == 0) throw new ContractException("GUIDE_EXISTS", "Phương pháp đã có bài hướng dẫn.");
            insertRevision(method, 1, draft, actor, now);
            event(method, 1, 1, "CREATE", actor, now, null);
            return detail(method);
        });
    }

    Detail update(Method method, int expectedVersion, Action action, Draft draft, String reason, UUID actor) {
        return writes.execute(tx -> {
            Head current = db.query("""
                    SELECT version,working_revision,working_status,published_revision,published_at,visible
                    FROM cms_method_guides WHERE method_code=? FOR UPDATE
                    """, (row, index) -> new Head(row.getInt("version"), row.getObject("working_revision", Integer.class),
                    status(row.getString("working_status")), row.getObject("published_revision", Integer.class),
                    row.getObject("published_at", OffsetDateTime.class), row.getBoolean("visible")), method.name())
                    .stream().findFirst().orElseThrow(MethodGuideService::notFound);
            if (current.version() != expectedVersion) {
                throw new ContractException("VERSION_CONFLICT", "Bài hướng dẫn đã thay đổi. Hãy tải phiên bản mới.");
            }
            OffsetDateTime now = now();
            Head next = advance(method, current, action, draft, actor, now);
            db.update("""
                    UPDATE cms_method_guides
                    SET version=?,working_revision=?,working_status=?,published_revision=?,published_at=?,visible=?,updated_at=?
                    WHERE method_code=?
                    """, next.version(), next.workingRevision(),
                    next.workingStatus() == null ? null : next.workingStatus().name(), next.publishedRevision(),
                    next.publishedAt(), next.visible(), now, method.name());
            int eventRevision = action == Action.SHOW || action == Action.HIDE ? next.publishedRevision() : next.activeRevision();
            event(method, next.version(), eventRevision, action.name(), actor, now, reason);
            return detail(method);
        });
    }

    private Head advance(Method method, Head current, Action action, Draft draft, UUID actor, OffsetDateTime now) {
        int version = Math.incrementExact(current.version());
        Integer working = current.workingRevision(), published = current.publishedRevision();
        Status status = current.workingStatus();
        OffsetDateTime publishedAt = current.publishedAt();
        boolean visible = current.visible();
        switch (action) {
            case SAVE_DRAFT -> {
                int last = db.queryForObject("""
                        SELECT max(revision) FROM cms_method_guide_revisions WHERE method_code=?
                        """, Integer.class, method.name());
                int revision = Math.incrementExact(last);
                insertRevision(method, revision, draft, actor, now);
                working = null;
                status = null;
                published = revision;
                publishedAt = now;
                visible = true;
            }
            case SUBMIT_REVIEW -> {
                require(status == Status.DRAFT);
                status = Status.PENDING_REVIEW;
            }
            case RETURN_TO_DRAFT -> {
                require(status == Status.PENDING_REVIEW);
                status = Status.DRAFT;
            }
            case PUBLISH -> {
                require(status == Status.PENDING_REVIEW);
                visible = published == null || visible;
                published = working;
                publishedAt = now;
                working = null;
                status = null;
            }
            case SHOW, HIDE -> {
                boolean requested = action == Action.SHOW;
                require(published != null && visible != requested);
                visible = requested;
            }
        }
        return new Head(version, working, status, published, publishedAt, visible);
    }

    Detail detail(Method method) {
        return db.query(DETAILS + " WHERE g.method_code=?", MethodGuideService::detail, method.name())
                .stream().findFirst().orElseThrow(MethodGuideService::notFound);
    }

    Page<Summary> list(String query, String group, Status status, int page, int size) {
        // There is at most one guide for each of the four fixed method codes.
        String q = query.toLowerCase(Locale.ROOT);
        List<Summary> matches = db.query(DETAILS + " ORDER BY g.updated_at DESC,g.method_code ASC", MethodGuideService::detail)
                .stream().filter(item -> group == null || item.group().equals(group))
                .filter(item -> status == null || item.status() == status)
                .filter(item -> contains(item.methodCode().name(), q)
                        || item.working() != null && contains(item.working().title(), q)
                        || item.published() != null && contains(item.published().title(), q))
                .map(Detail::summary).toList();
        return Page.of(matches.stream().skip((long) page * size).limit(size).toList(), page, size, matches.size());
    }

    Page<Event> events(Method method, int page, int size) {
        return reads.execute(tx -> {
            detail(method);
            long total = db.queryForObject("SELECT count(*) FROM cms_method_guide_events WHERE method_code=?",
                    Long.class, method.name());
            var items = db.query("""
                    SELECT version,action,revision,actor_id,occurred_at,reason
                    FROM cms_method_guide_events WHERE method_code=? ORDER BY version DESC LIMIT ? OFFSET ?
                    """, (row, index) -> new Event(row.getInt("version"), row.getString("action"),
                    row.getInt("revision"), row.getObject("actor_id", UUID.class), instant(row, "occurred_at"),
                    row.getString("reason")), method.name(), size, (long) page * size);
            return Page.of(items, page, size, total);
        });
    }

    PublicList published() {
        return new PublicList(db.query("""
                SELECT g.method_code,p.title,p.body,p.revision,g.published_at
                FROM cms_method_guides g JOIN cms_method_guide_revisions p
                  ON (p.method_code,p.revision)=(g.method_code,g.published_revision)
                WHERE g.visible ORDER BY g.method_code
                """, (row, index) -> new PublicGuide(Method.valueOf(row.getString("method_code")), row.getString("title"),
                row.getString("body"), row.getInt("revision"), instant(row, "published_at"))));
    }

    private void insertRevision(Method method, int revision, Draft draft, UUID actor, OffsetDateTime now) {
        db.update("""
                INSERT INTO cms_method_guide_revisions(method_code,revision,title,body,editor_note,created_by,created_at)
                VALUES (?,?,?,?,?,?,?)
                """, method.name(), revision, draft.title(), draft.body(), draft.editorNote(), actor, now);
    }

    private void event(Method method, int version, int revision, String action, UUID actor, OffsetDateTime now, String reason) {
        db.update("""
                INSERT INTO cms_method_guide_events(method_code,version,revision,action,actor_id,occurred_at,reason)
                VALUES (?,?,?,?,?,?,?)
                """, method.name(), version, revision, action, actor, now, reason);
    }

    private static Detail detail(ResultSet row, int index) throws SQLException {
        Method method = Method.valueOf(row.getString("method_code"));
        Integer workingRevision = row.getObject("w_revision", Integer.class);
        Integer publishedRevision = row.getObject("p_revision", Integer.class);
        Revision working = workingRevision == null ? null
                : new Revision(workingRevision, row.getString("w_title"), row.getString("w_body"), row.getString("w_note"));
        Publication published = publishedRevision == null ? null : new Publication(publishedRevision,
                row.getString("p_title"), row.getString("p_body"), row.getString("p_note"), instant(row, "published_at"));
        return new Detail(method, method.group(), working == null ? published.title() : working.title(),
                working == null ? Status.PUBLISHED : status(row.getString("working_status")), row.getBoolean("visible"),
                row.getInt("version"), instant(row, "updated_at"), working, published);
    }

    private static boolean contains(String text, String q) { return text.toLowerCase(Locale.ROOT).contains(q); }
    private static Status status(String value) { return value == null ? null : Status.valueOf(value); }
    private static String instant(ResultSet row, String column) throws SQLException {
        return row.getObject(column, OffsetDateTime.class).toInstant().toString();
    }
    private OffsetDateTime now() { return clock.instant().truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC); }
    private static void require(boolean valid) {
        if (!valid) throw new ContractException("INVALID_TRANSITION", "Trạng thái hiện tại không cho phép thao tác.");
    }
    private static ContractException notFound() { return new ContractException("NOT_FOUND", "Chưa có bài hướng dẫn."); }
}
