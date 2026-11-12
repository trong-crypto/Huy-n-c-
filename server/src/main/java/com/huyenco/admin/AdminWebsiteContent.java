package com.huyenco.admin;

import com.huyenco.common.exception.ContractException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("db")
public class AdminWebsiteContent {
    enum Section { INTRODUCTION, USAGE_GUIDE }
    enum Action { SAVE_DRAFT, SUBMIT_REVIEW, RETURN_TO_DRAFT, PUBLISH }
    enum Status { EMPTY, DRAFT, PENDING_REVIEW, PUBLISHED }
    record Draft(String title, String body, String editorNote) {}
    record Revision(int revision, String title, String body, String editorNote, UUID createdBy) {}
    record Publication(int revision, String title, String body, String publishedAt) {}
    record Detail(Section sectionCode, int version, Status status, Revision working, Publication published) {}
    record PublicSection(Section sectionCode, int revision, String title, String body, String publishedAt) {}
    record Event(int version, String action, int revision, UUID actorId, String occurredAt, String reason) {}
    record Page(List<Event> items, int page, int size, long totalElements, long totalPages) {}

    private final JdbcTemplate db;
    private final Clock clock;

    AdminWebsiteContent(JdbcTemplate db, Clock clock) {
        this.db = db;
        this.clock = clock;
    }

    public Detail detail(Section section) {
        return db.queryForObject("""
                SELECT s.version,s.working_status,s.published_at,w.revision AS w_revision,w.title AS w_title,
                       w.body AS w_body,w.editor_note,w.created_by,p.revision AS p_revision,p.title AS p_title,p.body AS p_body
                FROM cms_website_sections s
                LEFT JOIN cms_website_revisions w ON (w.section_code,w.revision)=(s.section_code,s.working_revision)
                LEFT JOIN cms_website_revisions p ON (p.section_code,p.revision)=(s.section_code,s.published_revision)
                WHERE s.section_code=?
                """, (row, index) -> {
            Revision working = row.getObject("w_revision") == null ? null : new Revision(row.getInt("w_revision"),
                    row.getString("w_title"), row.getString("w_body"), row.getString("editor_note"), row.getObject("created_by", UUID.class));
            Publication published = row.getObject("p_revision") == null ? null : new Publication(row.getInt("p_revision"),
                    row.getString("p_title"), row.getString("p_body"), instant(row, "published_at"));
            int version = row.getInt("version");
            Status status = working != null ? Status.valueOf(row.getString("working_status"))
                    : version == 0 ? Status.EMPTY : Status.PUBLISHED;
            return new Detail(section, version, status, working, published);
        }, section.name());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Detail update(Section section, int expectedVersion, Action action, Draft draft, String reason, UUID actor) {
        String code = section.name();
        int version = db.queryForObject("SELECT version FROM cms_website_sections WHERE section_code=? FOR UPDATE", Integer.class, code);
        if (version != expectedVersion) throw new ContractException("VERSION_CONFLICT", "Nội dung đã thay đổi. Hãy tải phiên bản mới.");
        Detail current = detail(section);
        Status status = current.status();
        int next = Math.incrementExact(version);
        OffsetDateTime now = clock.instant().truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC);
        int revision;
        if (action == Action.SAVE_DRAFT) {
            revision = next;
            db.update("""
                    INSERT INTO cms_website_revisions(section_code,revision,title,body,editor_note,created_by,created_at)
                    VALUES (?,?,?,?,?,?,?)
                    """, code, revision, draft.title(), draft.body(), draft.editorNote(), actor, now);
            db.update("""
                    UPDATE cms_website_sections SET version=?, working_revision=NULL, working_status=NULL,
                        published_revision=?, published_at=? WHERE section_code=?
                    """, next, revision, now, code);
        } else {
            require(action == Action.SUBMIT_REVIEW ? status == Status.DRAFT : status == Status.PENDING_REVIEW);
            revision = current.working().revision();
            switch (action) {
                case SUBMIT_REVIEW -> setWorking(code, next, revision, Status.PENDING_REVIEW);
                case RETURN_TO_DRAFT -> setWorking(code, next, revision, Status.DRAFT);
                case PUBLISH -> {
                    if (actor.equals(current.working().createdBy())) {
                        throw new ContractException("FORBIDDEN", "Cần Admin khác người soạn để công bố phiên bản này.");
                    }
                    db.update("""
                            UPDATE cms_website_sections SET version=?, working_revision=NULL, working_status=NULL,
                                published_revision=?, published_at=? WHERE section_code=?
                            """, next, revision, now, code);
                }
                default -> throw new IllegalStateException("Unsupported action");
            }
        }
        db.update("""
                INSERT INTO cms_website_events(section_code,version,revision,action,actor_id,occurred_at,reason)
                VALUES (?,?,?,?,?,?,?)
                """, code, next, revision, action.name(), actor, now, reason);
        return detail(section);
    }

    private void setWorking(String code, int version, int revision, Status status) {
        db.update("UPDATE cms_website_sections SET version=?, working_revision=?, working_status=? WHERE section_code=?",
                version, revision, status.name(), code);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page events(Section section, int page, int size) {
        long total = db.queryForObject("SELECT count(*) FROM cms_website_events WHERE section_code=?", Long.class, section.name());
        var rows = db.query("""
                SELECT version,action,revision,actor_id,occurred_at,reason FROM cms_website_events
                WHERE section_code=? ORDER BY version DESC LIMIT ? OFFSET ?
                """, (row, index) -> new Event(row.getInt("version"), row.getString("action"), row.getInt("revision"),
                row.getObject("actor_id", UUID.class), instant(row, "occurred_at"), row.getString("reason")),
                section.name(), size, (long) page * size);
        return new Page(rows, page, size, total, (total + size - 1) / size);
    }

    public List<PublicSection> published() {
        return db.query("""
                SELECT s.section_code,r.revision,r.title,r.body,s.published_at
                FROM cms_website_sections s JOIN cms_website_revisions r
                  ON (r.section_code,r.revision)=(s.section_code,s.published_revision)
                ORDER BY s.section_code
                """, (row, index) -> new PublicSection(Section.valueOf(row.getString("section_code")), row.getInt("revision"),
                row.getString("title"), row.getString("body"), instant(row, "published_at")));
    }

    private static void require(boolean valid) {
        if (!valid) throw new ContractException("INVALID_TRANSITION", "Trạng thái hiện tại không cho phép thao tác.");
    }

    private static String instant(ResultSet row, String field) throws SQLException {
        return row.getObject(field, OffsetDateTime.class).toInstant().toString();
    }
}
