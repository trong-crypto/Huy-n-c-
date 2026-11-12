package com.huyenco.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.admin.AdminSourceCatalog.Kind;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.validation.CmsInput;
import com.huyenco.knowledge.KnowledgeDataException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("db")
public class AdminSourceProposals {
    enum Action { SUBMIT, RETURN, APPROVE }
    enum Status { DRAFT, PENDING_REVIEW, APPROVED }
    enum BookField { AUTHOR, PUBLISHER;
        String snapshotField() {
            return this == AUTHOR ? "author" : "publisher";
        }
    }
    record BookChange(BookField field, String value) {}
    record Revision(Kind kind, String id, int version, String proposal, String reason,
                    JsonNode sourceSnapshot, UUID createdBy, String createdAt, BookChange bookChange) {}
    record Event(int sequence, int revision, Action action, UUID actorId, String occurredAt, String note) {}
    record Workflow(int version, int draftVersion, Status status, Integer approvedVersion, Event lastEvent) {}
    private static final String FIELDS = "version,proposal,reason,source_snapshot,created_by,created_at,book_field,book_value";

    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    private final AdminSourceCatalog catalog;
    private final Clock clock;

    AdminSourceProposals(JdbcTemplate db, ObjectMapper mapper, AdminSourceCatalog catalog, Clock clock) {
        this.db = db;
        this.mapper = mapper;
        this.catalog = catalog;
        this.clock = clock;
    }

    public Revision read(Kind kind, String id, Integer version) {
        Object key = key(kind, id);
        String query = "SELECT " + FIELDS + " FROM cms_source_proposal_revisions WHERE " + column(kind) + "=?";
        return (version == null
                ? db.query(query + " ORDER BY version DESC LIMIT 1", (row, index) -> revision(kind, id, row), key)
                : db.query(query + " AND version=?", (row, index) -> revision(kind, id, row), key, version))
                .stream().findFirst().orElseThrow(AdminSourceProposals::missing);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Revision save(Kind kind, String id, Integer expectedVersion, String proposal, String reason,
                         BookChange bookChange, UUID actor) {
        Object key = key(kind, id);
        lockSource(kind, key);

        Integer latest = latestVersion(kind, key);
        if (expectedVersion == null && latest != null) {
            throw new ContractException("SOURCE_PROPOSAL_EXISTS", "Mục nguồn đã có bản nháp đề xuất.");
        }
        if (expectedVersion != null && latest == null) {
            throw missing();
        }
        if (expectedVersion != null && !expectedVersion.equals(latest)) {
            throw new ContractException("VERSION_CONFLICT", "Bản nháp đề xuất nguồn đã thay đổi. Hãy tải phiên bản mới.");
        }
        int version = latest == null ? 1 : Math.incrementExact(latest);
        JsonNode snapshot = mapper.valueToTree(catalog.snapshot(kind, id));
        if (bookChange != null) {
            if (kind != Kind.BOOK_PAGE) throw CmsInput.invalid("bookField");
            if (bookChange.value().equals(snapshot.path("book").path(bookChange.field().snapshotField()).textValue())) {
                throw CmsInput.invalid("bookValue");
            }
        }
        Revision saved = db.queryForObject("""
                INSERT INTO cms_source_proposal_revisions(source_section_id,external_source_id,
                    version,proposal,reason,source_snapshot,created_by,created_at,book_field,book_value)
                VALUES (?,?,?,?,?,?::jsonb,?,?,?,?) RETURNING
                """ + FIELDS, (row, index) -> revision(kind, id, row), kind == Kind.BOOK_PAGE ? key : null,
                kind == Kind.EXTERNAL_ALGORITHM ? key : null, version, proposal, reason, snapshot.toString(), actor,
                clock.instant().atOffset(ZoneOffset.UTC), bookChange == null ? null : bookChange.field().name(),
                bookChange == null ? null : bookChange.value());
        approveDirectly(kind, key, saved, actor);
        return saved;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Workflow workflow(Kind kind, String id) {
        return loadWorkflow(kind, key(kind, id));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Workflow transition(Kind kind, String id, int expectedVersion, Action action, String note, UUID actor) {
        Object key = key(kind, id);
        lockSource(kind, key);
        Workflow current = loadWorkflow(kind, key);
        if (current.version() != expectedVersion) {
            throw new ContractException("VERSION_CONFLICT", "Trạng thái duyệt đề xuất đã thay đổi. Hãy tải phiên bản mới.");
        }
        if (current.status() != (action == Action.SUBMIT ? Status.DRAFT : Status.PENDING_REVIEW)) {
            throw invalidTransition();
        }
        int sequence = current.lastEvent() == null ? 1 : Math.incrementExact(current.lastEvent().sequence());
        db.update("""
                INSERT INTO cms_source_proposal_events(source_section_id,external_source_id,sequence,revision,action,actor_id,
                    occurred_at,note) VALUES (?,?,?,?,?,?,?,?)
                """, kind == Kind.BOOK_PAGE ? key : null, kind == Kind.EXTERNAL_ALGORITHM ? key : null,
                sequence, current.draftVersion(), action.name(), actor, clock.instant().atOffset(ZoneOffset.UTC), note);
        return loadWorkflow(kind, key);
    }

    private Workflow loadWorkflow(Kind kind, Object key) {
        Integer draft = latestVersion(kind, key);
        if (draft == null) throw missing();
        Event event = lastEvent(kind, key);
        Integer approved = db.queryForObject("SELECT max(revision) FROM cms_source_proposal_events WHERE "
                + column(kind) + "=? AND action='APPROVE'", Integer.class, key);
        return new Workflow(Math.addExact(draft, event == null ? 0 : event.sequence()),
                draft, status(draft, event), approved, event);
    }

    private static Status status(int draft, Event event) {
        if (event == null || event.revision() != draft) return Status.DRAFT;
        return switch (event.action()) {
            case SUBMIT -> Status.PENDING_REVIEW;
            case RETURN -> Status.DRAFT;
            case APPROVE -> Status.APPROVED;
        };
    }

    private Integer latestVersion(Kind kind, Object key) {
        return db.queryForObject("SELECT max(version) FROM cms_source_proposal_revisions WHERE " + column(kind) + "=?",
                Integer.class, key);
    }

    private Event lastEvent(Kind kind, Object key) {
        return db.query("SELECT sequence,revision,action,actor_id,occurred_at,note FROM cms_source_proposal_events WHERE "
                + column(kind) + "=? ORDER BY sequence DESC LIMIT 1",
                (row, index) -> new Event(row.getInt(1), row.getInt(2), Action.valueOf(row.getString(3)),
                        row.getObject(4, UUID.class), row.getObject(5, OffsetDateTime.class).toInstant().toString(),
                        row.getString(6)), key).stream().findFirst().orElse(null);
    }

    private void lockSource(Kind kind, Object key) {
        String lock = kind == Kind.BOOK_PAGE ? "SELECT 1 FROM source_sections s JOIN source_books b ON b.id=s.source_book_id WHERE s.id=? FOR UPDATE OF s,b"
                : "SELECT 1 FROM external_sources WHERE source_id=? FOR UPDATE";
        if (db.queryForList(lock, Integer.class, key).isEmpty()) throw AdminSourceCatalog.missing();
    }

    private void approveDirectly(Kind kind, Object key, Revision revision, UUID actor) {
        int sequence = db.queryForObject("SELECT COALESCE(max(sequence),0)+1 FROM cms_source_proposal_events WHERE "
                + column(kind) + "=?", Integer.class, key);
        OffsetDateTime now = clock.instant().truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC);
        db.update("""
                INSERT INTO cms_source_proposal_events(source_section_id,external_source_id,sequence,revision,action,actor_id,
                    occurred_at,note) VALUES (?,?,?,?, 'APPROVE',?,?,?)
                """, kind == Kind.BOOK_PAGE ? key : null, kind == Kind.EXTERNAL_ALGORITHM ? key : null,
                sequence, revision.version(), actor, now, "Cập nhật trực tiếp bởi Admin; đã lưu căn cứ và ảnh chụp nguồn.");
        if (revision.bookChange() == null) return;
        if (kind != Kind.BOOK_PAGE) throw CmsInput.invalid("bookField");
        long section = (Long) key;
        var rows = db.query("""
                SELECT b.id,b.author,b.publisher FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
                WHERE s.id=? FOR UPDATE OF s,b
                """, (row, index) -> new Object[]{row.getLong("id"), row.getString("author"), row.getString("publisher")}, section);
        if (rows.isEmpty()) throw AdminSourceCatalog.missing();
        Object[] book = rows.get(0);
        long bookId = (long) book[0];
        String before = revision.bookChange().field() == BookField.AUTHOR ? (String) book[1] : (String) book[2];
        String statement = revision.bookChange().field() == BookField.AUTHOR
                ? "UPDATE source_books SET author=? WHERE id=?" : "UPDATE source_books SET publisher=? WHERE id=?";
        db.update(statement, revision.bookChange().value(), bookId);
        db.update("""
                INSERT INTO cms_source_proposal_applications(source_section_id,revision,book_id,field,before_value,
                    after_value,applied_by,applied_at) VALUES (?,?,?,?,?,?,?,?)
                """, section, revision.version(), bookId, revision.bookChange().field().name(), before,
                revision.bookChange().value(), actor, now);
    }

    private static ContractException missing() {
        return new ContractException("NOT_FOUND", "Không tìm thấy bản nháp đề xuất nguồn.");
    }

    private static ContractException invalidTransition() {
        return new ContractException("INVALID_TRANSITION", "Trạng thái hiện tại không cho phép thao tác.");
    }

    private Revision revision(Kind kind, String id, ResultSet row) throws SQLException {
        try {
            String bookField = row.getString("book_field");
            BookChange change = bookField == null ? null : new BookChange(BookField.valueOf(bookField), row.getString("book_value"));
            return new Revision(kind, id, row.getInt("version"), row.getString("proposal"), row.getString("reason"),
                    mapper.readTree(row.getString("source_snapshot")), row.getObject("created_by", UUID.class),
                    row.getObject("created_at", OffsetDateTime.class).toInstant().toString(), change);
        } catch (JsonProcessingException failure) {
            throw new KnowledgeDataException();
        }
    }

    private static String column(Kind kind) {
        return kind == Kind.BOOK_PAGE ? "source_section_id" : "external_source_id";
    }

    private static Object key(Kind kind, String id) {
        return kind == Kind.BOOK_PAGE ? AdminSourceCatalog.sectionId(id) : id;
    }
}
