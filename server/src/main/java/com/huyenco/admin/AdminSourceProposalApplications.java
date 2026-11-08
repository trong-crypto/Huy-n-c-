package com.huyenco.admin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.admin.AdminSourceCatalog.Kind;
import com.huyenco.admin.AdminSourceProposals.BookField;
import com.huyenco.common.exception.ContractException;
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
public class AdminSourceProposalApplications {
    record Applied(UUID actorId, String occurredAt) {}
    record Preview(int version, int revision, String bookId, String bookTitle, String edition, BookField field,
                   String beforeValue, String afterValue, String currentValue, boolean stale, Applied applied) {}

    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    private final AdminSourceCatalog catalog;
    private final AdminSourceProposals proposals;
    private final Clock clock;

    AdminSourceProposalApplications(JdbcTemplate db, ObjectMapper mapper, AdminSourceCatalog catalog,
                                    AdminSourceProposals proposals, Clock clock) {
        this.db = db;
        this.mapper = mapper;
        this.catalog = catalog;
        this.proposals = proposals;
        this.clock = clock;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Preview preview(Kind kind, String id) {
        return loadPreview(kind, id, null);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Preview apply(Kind kind, String id, int expectedVersion, UUID actor) {
        if (kind != Kind.BOOK_PAGE) throw invalidTransition();
        long section = AdminSourceCatalog.sectionId(id);
        var books = db.queryForList("""
                SELECT b.id FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
                WHERE s.id=? FOR UPDATE OF s,b
                """, Long.class, section);
        if (books.isEmpty()) throw AdminSourceCatalog.missing();

        Preview preview = loadPreview(kind, id, expectedVersion);
        if (preview.applied() != null) {
            throw new ContractException("SOURCE_ALREADY_APPLIED", "Phiên bản đề xuất này đã được áp dụng.");
        }
        if (preview.stale()) {
            throw new ContractException("SOURCE_CHANGED", "Dữ liệu nguồn đã thay đổi. Hãy đối chiếu và gửi duyệt phiên bản mới.");
        }
        long book = books.get(0);
        String update = switch (preview.field()) {
            case AUTHOR -> "UPDATE source_books SET author=? WHERE id=?";
            case PUBLISHER -> "UPDATE source_books SET publisher=? WHERE id=?";
        };
        db.update(update, preview.afterValue(), book);
        OffsetDateTime appliedAt = clock.instant().truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC);
        db.update("""
                INSERT INTO cms_source_proposal_applications(source_section_id,revision,book_id,field,before_value,
                    after_value,applied_by,applied_at) VALUES (?,?,?,?,?,?,?,?)
                """, section, preview.revision(), book, preview.field().name(), preview.beforeValue(),
                preview.afterValue(), actor, appliedAt);
        return new Preview(preview.version(), preview.revision(), preview.bookId(), preview.bookTitle(), preview.edition(),
                preview.field(), preview.beforeValue(), preview.afterValue(), preview.afterValue(), false,
                new Applied(actor, appliedAt.toInstant().toString()));
    }

    private Preview loadPreview(Kind kind, String id, Integer expectedVersion) {
        if (kind != Kind.BOOK_PAGE) throw invalidTransition();
        var workflow = proposals.workflow(kind, id);
        if (expectedVersion != null && workflow.version() != expectedVersion) {
            throw new ContractException("VERSION_CONFLICT", "Trạng thái duyệt đề xuất đã thay đổi. Hãy tải phiên bản mới.");
        }
        if (workflow.status() != AdminSourceProposals.Status.APPROVED) throw invalidTransition();
        var revision = proposals.read(kind, id, workflow.draftVersion());
        var change = revision.bookChange();
        if (change == null) throw invalidTransition();

        var source = catalog.snapshot(kind, id);
        JsonNode current = mapper.valueToTree(source);
        var applied = db.query("""
                SELECT applied_by,applied_at FROM cms_source_proposal_applications WHERE source_section_id=? AND revision=?
                """, (row, index) -> new Applied(row.getObject(1, UUID.class),
                row.getObject(2, OffsetDateTime.class).toInstant().toString()), AdminSourceCatalog.sectionId(id),
                revision.version()).stream().findFirst().orElse(null);
        String field = change.field().snapshotField();
        var reference = source.entry().reference();
        return new Preview(workflow.version(), revision.version(), reference.sourceId(), reference.title(),
                reference.version(), change.field(), revision.sourceSnapshot().path("book").path(field).textValue(),
                change.value(), current.path("book").path(field).textValue(),
                applied == null && !current.equals(revision.sourceSnapshot()), applied);
    }

    private static ContractException invalidTransition() {
        return new ContractException("INVALID_TRANSITION", "Cần phiên bản mới nhất đã phê duyệt và có thay đổi metadata sách.");
    }
}
