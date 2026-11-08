package com.huyenco.admin;

import com.huyenco.common.dto.SourceReference;
import com.huyenco.common.exception.ContractException;
import com.huyenco.knowledge.SourceStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("db")
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class AdminSourceCatalog {
    enum Kind { BOOK_PAGE, EXTERNAL_ALGORITHM }
    record Entry(Kind kind, String id, SourceReference reference) {}
    record Book(String author, String publisher, Integer publicationYear, Integer pdfPageCount) {}
    record Rule(String code, String module, String version, SourceStatus status) {}
    record InterpretationCount(String category, SourceStatus status, long count) {}
    record SourceSnapshot(Entry entry, Book book) {}
    record Detail(Entry entry, Book book, List<Rule> rules, List<InterpretationCount> interpretations) {}
    record Page(List<Entry> items, int page, int size, long totalElements, long totalPages) {}

    private static final String BOOKS = """
            SELECT 'BOOK_PAGE' AS kind, s.id::text AS id, b.id::text AS source_id, b.title, b.edition AS version,
                s.section_label AS section, s.printed_page_label AS printed_page, s.pdf_page, b.file_sha256 AS sha256,
                NULL::text AS url
            FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
            """;
    private static final String ALGORITHMS = """
            SELECT 'EXTERNAL_ALGORITHM' AS kind, source_id AS id, source_id, title, version,
                section, NULL::text AS printed_page, NULL::integer AS pdf_page, sha256, url
            FROM external_sources
            """;
    private static final String SEARCH = """
            WHERE (?='' OR kind=?) AND strpos(lower(concat_ws(' ',title,version,section,printed_page,pdf_page,id)),lower(?)) > 0
            """;
    private final JdbcTemplate db;

    AdminSourceCatalog(JdbcTemplate db) {
        this.db = db;
    }

    public Page list(Kind kind, String query, int page, int size) {
        String filter = kind == null ? "" : kind.name();
        String from = " FROM (" + BOOKS + " UNION ALL " + ALGORITHMS + ") sources " + SEARCH;
        long total = db.queryForObject("SELECT count(*)" + from, Long.class, filter, filter, query);
        List<Entry> items = db.query("SELECT *" + from + """
                ORDER BY kind, lower(title), version, pdf_page NULLS LAST, id
                LIMIT ? OFFSET ?
                """, (row, index) -> entry(row), filter, filter, query, size, (long) page * size);
        return new Page(items, page, size, total, (total + size - 1) / size);
    }

    public Detail detail(Kind kind, String id) {
        var source = snapshot(kind, id);
        if (kind == Kind.EXTERNAL_ALGORITHM) {
            return new Detail(source.entry(), null, rules("external_source_id", id), List.of());
        }
        long section = sectionId(id);
        List<InterpretationCount> interpretations = db.query("""
                SELECT category,verification_status,count(*) FROM interpretations WHERE source_section_id=?
                GROUP BY category,verification_status ORDER BY category,verification_status
                """, (row, index) -> new InterpretationCount(row.getString(1), SourceStatus.valueOf(row.getString(2)),
                row.getLong(3)), section);
        return new Detail(source.entry(), source.book(), rules("source_section_id", section), interpretations);
    }

    public SourceSnapshot snapshot(Kind kind, String id) {
        if (kind == Kind.EXTERNAL_ALGORITHM) {
            Entry source = db.query(ALGORITHMS + " WHERE source_id=?", (row, index) -> entry(row), id)
                    .stream().findFirst().orElseThrow(AdminSourceCatalog::missing);
            return new SourceSnapshot(source, null);
        }
        return db.query("""
                SELECT sources.*, b.author, b.publisher, b.publication_year, b.pdf_page_count
                FROM (
                """ + BOOKS + """
                    WHERE s.id=?
                ) sources JOIN source_books b ON b.id::text=sources.source_id
                """, (row, index) -> new SourceSnapshot(entry(row), new Book(row.getString("author"), row.getString("publisher"),
                row.getObject("publication_year", Integer.class), row.getObject("pdf_page_count", Integer.class))),
                sectionId(id)).stream().findFirst().orElseThrow(AdminSourceCatalog::missing);
    }

    private List<Rule> rules(String column, Object id) {
        return db.query("""
                SELECT rule_code,module,rule_version,verification_status FROM calculation_rules
                WHERE
                """ + column + "=? ORDER BY module,rule_code,rule_version", (row, index) ->
                new Rule(row.getString(1), row.getString(2), row.getString(3), SourceStatus.valueOf(row.getString(4))), id);
    }

    private static Entry entry(ResultSet row) throws SQLException {
        return new Entry(Kind.valueOf(row.getString("kind")), row.getString("id"),
                new SourceReference(row.getString("source_id"), row.getString("title"), row.getString("version"),
                        row.getString("section"), row.getString("printed_page"), row.getObject("pdf_page", Integer.class),
                        row.getString("sha256"), row.getString("url")));
    }

    static long sectionId(String id) {
        if (!id.matches("[1-9][0-9]{0,18}")) throw AdminDirectoryHttp.invalid();
        try { return Long.parseLong(id); }
        catch (NumberFormatException failure) { throw AdminDirectoryHttp.invalid(); }
    }

    static ContractException missing() {
        return new ContractException("NOT_FOUND", "Không tìm thấy dữ liệu nguồn.");
    }
}
