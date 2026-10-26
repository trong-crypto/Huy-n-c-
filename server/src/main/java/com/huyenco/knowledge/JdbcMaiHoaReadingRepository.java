package com.huyenco.knowledge;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.util.ArrayList;
import javax.sql.DataSource;

public final class JdbcMaiHoaReadingRepository implements MaiHoaReadingRepository {
    private final DataSource source;
    private final ObjectMapper mapper;
    public JdbcMaiHoaReadingRepository(DataSource source, ObjectMapper mapper) { this.source=source; this.mapper=mapper; }

    @Override public Snapshot readingSnapshot() {
        try(var connection=source.getConnection()) {
            connection.setReadOnly(true);
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            try {
                Bundle bundle=null;
                try(var statement=connection.prepareStatement("SELECT * FROM reading_source_bundles WHERE bundle_id=?")) {
                    statement.setQueryTimeout(3);statement.setString(1,ReviewedMaiHoaKnowledge.BUNDLE_ID);
                    try(var rows=statement.executeQuery()) {
                        if(rows.next()) bundle=new Bundle(rows.getString("bundle_id"),rows.getString("document_sha256"),
                                mapper.readTree(rows.getString("reviewed_document")),rows.getString("editor"),rows.getString("reviewer"),
                                rows.getTimestamp("reviewed_at")==null?null:rows.getTimestamp("reviewed_at").toInstant(),
                                rows.getString("review_method"),rows.getString("verification_status"));
                    }
                }
                var templates=new ArrayList<Template>();
                try(var statement=connection.prepareStatement("""
                    SELECT t.*, b.file_sha256, b.pdf_page_count, b.title AS book_title
                    FROM mai_hoa_reading_templates t JOIN source_books b ON b.id=t.source_book_id
                    WHERE t.bundle_id=? ORDER BY t.template_code LIMIT 21
                    """)) {
                    statement.setQueryTimeout(3);statement.setString(1,ReviewedMaiHoaKnowledge.BUNDLE_ID);
                    try(var rows=statement.executeQuery()) {
                        while(rows.next()) templates.add(new Template(rows.getString("template_code"),rows.getString("bundle_id"),
                                rows.getString("topic"),rows.getString("relation"),rows.getString("content"),rows.getString("text_kind"),
                                mapper.readTree(rows.getString("source_record")),rows.getString("file_sha256"),
                                rows.getInt("pdf_page_count"),rows.getString("book_title")));
                    }
                }
                connection.commit();return new Snapshot(bundle,templates);
            } catch(Exception failure) { connection.rollback();throw failure; }
        } catch(SQLException failure) {
            if("42P01".equals(failure.getSQLState()) || "42703".equals(failure.getSQLState())) throw new KnowledgeDataException();
            throw new KnowledgeAccessException();
        } catch(java.io.IOException | IllegalArgumentException | NullPointerException failure) { throw new KnowledgeDataException(); }
    }
}
