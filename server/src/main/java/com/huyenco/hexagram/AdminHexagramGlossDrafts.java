package com.huyenco.hexagram;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.exception.ContractException;
import com.huyenco.common.validation.CmsInput.FieldFailure;
import com.huyenco.knowledge.KnowledgeDataException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Profile("db")
public final class AdminHexagramGlossDrafts {
    public enum Action { SUBMIT, RETURN, PUBLISH, HIDE, SHOW }
    public enum Status { DRAFT, PENDING_REVIEW, PUBLISHED }
    public record Event(int sequence, int revision, Action action, UUID actorId, String occurredAt,
                        String reason, String printedSourceLabel, String verificationNote) {}
    public record Workflow(int version, int draftVersion, Status status, Integer publishedVersion, Event lastEvent,
                           boolean visible, Event lastVisibilityEvent) {}
    public record Revision(String hexagramCode, String category, String status, int version, String content,
                           String sourceSectionId, JsonNode source, UUID createdBy, String createdAt) {}

    private static final String COLUMNS = "hexagram_code,version,content,source_section_id,source_snapshot,created_by,created_at";
    private static final String SELECT = "SELECT " + COLUMNS + " FROM cms_hexagram_gloss_draft_revisions WHERE hexagram_code=?";

    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final TransactionTemplate writes;
    private final TransactionTemplate reads;

    AdminHexagramGlossDrafts(JdbcTemplate db, ObjectMapper mapper, Clock clock, PlatformTransactionManager transactions) {
        this.db = db;
        this.mapper = mapper;
        this.clock = clock;
        writes = new TransactionTemplate(transactions);
        writes.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        reads = new TransactionTemplate(transactions);
        reads.setReadOnly(true);
        reads.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }

    public Revision latest(String code) {
        HexagramLookupService.validateCode(code);
        return db.query(SELECT + " ORDER BY version DESC LIMIT 1", this::revision, code)
                .stream().findFirst().orElseThrow(AdminHexagramGlossDrafts::missing);
    }

    public Revision revision(String code, int version) {
        HexagramLookupService.validateCode(code);
        return db.query(SELECT + " AND version=?", this::revision, code, version)
                .stream().findFirst().orElseThrow(AdminHexagramGlossDrafts::missing);
    }

    public Revision create(String code, String content, long section, UUID actor) {
        HexagramLookupService.validateCode(code);
        return writes.execute(tx -> {
            lockHexagram(code);
            if (latestVersion(code) != null) {
                throw new ContractException("GLOSS_DRAFT_EXISTS", "Quẻ đã có bản nháp nghĩa tên.");
            }
            return insert(code, 1, content, section, actor);
        });
    }

    public Revision update(String code, int expectedVersion, String content, long section, UUID actor) {
        HexagramLookupService.validateCode(code);
        return writes.execute(tx -> {
            lockHexagram(code);
            Workflow current = loadWorkflow(code);
            if (current.draftVersion() != expectedVersion) {
                throw new ContractException("VERSION_CONFLICT", "Bản nháp đã thay đổi. Hãy tải phiên bản mới.");
            }
            if (current.status() == Status.PENDING_REVIEW) throw invalidTransition();
            return insert(code, Math.incrementExact(current.draftVersion()), content, section, actor);
        });
    }

    public Workflow workflow(String code) {
        HexagramLookupService.validateCode(code);
        return reads.execute(tx -> loadWorkflow(code));
    }

    public Workflow transition(String code, int expectedVersion, Action action, UUID actor,
                               String reason, String printedLabel, String note) {
        HexagramLookupService.validateCode(code);
        return writes.execute(tx -> {
            lockHexagram(code);
            Workflow current = loadWorkflow(code);
            checkVersion(current, expectedVersion);
            Status required = switch (action) {
                case SUBMIT -> Status.DRAFT;
                case RETURN, PUBLISH -> Status.PENDING_REVIEW;
                case HIDE, SHOW -> throw invalidTransition();
            };
            if (current.status() != required) throw invalidTransition();
            if (action == Action.PUBLISH) {
                if (revision(code, current.draftVersion()).createdBy().equals(actor)) {
                    throw new ContractException("FORBIDDEN", "Người soạn phiên bản này không thể tự công bố.");
                }
                if (!Boolean.TRUE.equals(db.queryForObject("""
                        SELECT EXISTS (SELECT 1 FROM interpretations WHERE hexagram_code=?
                          AND category='NAME_GLOSS' AND verification_status='VERIFIED')
                        """, Boolean.class, code))) {
                    throw new ContractException("INVALID_TRANSITION", "Quẻ cần nghĩa tên E01 đã duyệt để đối chiếu thứ tự.");
                }
            }
            recordEvent(code, current, current.draftVersion(), action, actor, reason, printedLabel, note);
            return loadWorkflow(code);
        });
    }

    public Workflow setVisibility(String code, int expectedVersion, boolean visible, UUID actor) {
        HexagramLookupService.validateCode(code);
        return writes.execute(tx -> {
            lockHexagram(code);
            Workflow current = loadWorkflow(code);
            checkVersion(current, expectedVersion);
            if (current.publishedVersion() == null || current.visible() == visible) throw invalidTransition();
            recordEvent(code, current, current.publishedVersion(), visible ? Action.SHOW : Action.HIDE,
                    actor, null, null, null);
            return loadWorkflow(code);
        });
    }

    private static void checkVersion(Workflow current, int expectedVersion) {
        if (current.version() != expectedVersion) {
            throw new ContractException("VERSION_CONFLICT", "Trạng thái nghĩa tên đã thay đổi. Hãy tải phiên bản mới.");
        }
    }

    private void recordEvent(String code, Workflow current, int revision, Action action, UUID actor,
                             String reason, String printedLabel, String note) {
        int sequence = Math.incrementExact(current.version() - current.draftVersion());
        db.update("""
                INSERT INTO cms_hexagram_gloss_events(hexagram_code,sequence,revision,action,actor_id,occurred_at,
                    reason,printed_source_label,verification_note)
                VALUES (?,?,?,?,?,?,?,?,?)
                """, code, sequence, revision, action.name(), actor, clock.instant().atOffset(ZoneOffset.UTC),
                reason, printedLabel, note);
    }

    private Workflow loadWorkflow(String code) {
        Integer draftVersion = latestVersion(code);
        if (draftVersion == null) throw missing();
        var events = db.query("""
                SELECT DISTINCT ON (action IN ('HIDE', 'SHOW'))
                    sequence,revision,action,actor_id,occurred_at,reason,printed_source_label,verification_note
                FROM cms_hexagram_gloss_events WHERE hexagram_code=?
                ORDER BY (action IN ('HIDE', 'SHOW')), sequence DESC
                """, (row, index) -> new Event(row.getInt(1), row.getInt(2), Action.valueOf(row.getString(3)),
                row.getObject(4, UUID.class), row.getObject(5, OffsetDateTime.class).toInstant().toString(),
                row.getString(6), row.getString(7), row.getString(8)), code);
        // Review events sort first, and a visibility event requires an earlier publication.
        Event event = events.isEmpty() ? null : events.get(0);
        Event visibility = events.size() == 2 ? events.get(1) : null;
        Integer published = db.queryForObject("""
                SELECT max(revision) FROM cms_hexagram_gloss_events WHERE hexagram_code=? AND action='PUBLISH'
                """, Integer.class, code);
        Status status = event == null || event.revision() != draftVersion ? Status.DRAFT : switch (event.action()) {
            case SUBMIT -> Status.PENDING_REVIEW;
            case RETURN -> Status.DRAFT;
            case PUBLISH -> Status.PUBLISHED;
            case HIDE, SHOW -> throw new KnowledgeDataException();
        };
        int sequence = Math.max(event == null ? 0 : event.sequence(), visibility == null ? 0 : visibility.sequence());
        boolean visible = published != null && (visibility == null || visibility.action() == Action.SHOW);
        return new Workflow(Math.addExact(draftVersion, sequence), draftVersion, status, published, event, visible, visibility);
    }

    private static ContractException invalidTransition() {
        return new ContractException("INVALID_TRANSITION", "Trạng thái hiện tại không cho phép thao tác.");
    }

    private void lockHexagram(String code) {
        // Serializes the first draft and concurrent revisions of the same hexagram.
        if (db.queryForList("SELECT code FROM hexagrams WHERE code=? FOR UPDATE", String.class, code).isEmpty()) {
            throw new ContractException("NOT_FOUND", "Không tìm thấy quẻ.");
        }
    }

    private Integer latestVersion(String code) {
        return db.queryForObject("SELECT max(version) FROM cms_hexagram_gloss_draft_revisions WHERE hexagram_code=?",
                Integer.class, code);
    }

    private Revision insert(String code, int version, String content, long section, UUID actor) {
        return db.query("""
                INSERT INTO cms_hexagram_gloss_draft_revisions
                    (hexagram_code,version,content,source_section_id,source_snapshot,created_by,created_at)
                SELECT ?,?,?,s.id,jsonb_build_object(
                    'bookId',b.id::text,'title',b.title,'edition',b.edition,'section',s.section_label,
                    'printedPage',s.printed_page_label,'pdfPage',s.pdf_page,'sha256',b.file_sha256
                ),?,?
                FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
                WHERE s.id=? AND b.file_sha256 ~ '^[a-fA-F0-9]{64}$'
                    AND btrim(b.title) <> '' AND btrim(b.edition) <> '' AND btrim(s.section_label) <> ''
                    AND btrim(s.printed_page_label) <> ''
                    AND (b.pdf_page_count IS NULL OR s.pdf_page <= b.pdf_page_count)
                RETURNING
                """ + COLUMNS, this::revision, code, version, content, actor, clock.instant().atOffset(ZoneOffset.UTC), section)
                .stream().findFirst().orElseThrow(() ->
                        new FieldFailure("INVALID_SOURCE", "Chọn trang nguồn có thông tin ấn bản, trang in, trang PDF và SHA-256.",
                                "sourceSectionId"));
    }

    private Revision revision(ResultSet row, int index) throws SQLException {
        try {
            return new Revision(row.getString("hexagram_code"), "NAME_GLOSS", "DRAFT", row.getInt("version"),
                    row.getString("content"), row.getString("source_section_id"), mapper.readTree(row.getString("source_snapshot")),
                    row.getObject("created_by", UUID.class),
                    row.getObject("created_at", OffsetDateTime.class).toInstant().toString());
        } catch (JsonProcessingException failure) {
            throw new KnowledgeDataException();
        }
    }

    private static ContractException missing() {
        return new ContractException("NOT_FOUND", "Không tìm thấy phiên bản bản nháp.");
    }
}
