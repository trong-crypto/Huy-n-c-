package com.huyenco.knowledge;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.util.ArrayList;
import java.util.Set;
import javax.sql.DataSource;

public final class JdbcTamTheExtendedRepository implements TamTheExtendedRepository {
    private final DataSource source;
    private final ObjectMapper mapper;
    private final JdbcKnowledgeRepository base;

    public JdbcTamTheExtendedRepository(DataSource source, RuleCatalog catalog, ObjectMapper mapper) {
        this.source=source; this.mapper=mapper; this.base=new JdbcKnowledgeRepository(source,catalog);
    }

    @Override public Snapshot extended(Set<String> baseRules) {
        try(var connection=source.getConnection()) {
            connection.setReadOnly(true);
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            try {
                MaiHoaReadingRepository.Bundle bundle=null;
                try(var statement=prepare(connection,"SELECT * FROM reading_source_bundles WHERE bundle_id=?")) {
                    statement.setString(1,ReviewedMaiHoaKnowledge.BUNDLE_ID);
                    try(var rows=statement.executeQuery()) {
                        if(rows.next()) bundle=new MaiHoaReadingRepository.Bundle(rows.getString("bundle_id"),rows.getString("document_sha256"),
                                mapper.readTree(rows.getString("reviewed_document")),rows.getString("editor"),rows.getString("reviewer"),
                                rows.getTimestamp("reviewed_at")==null?null:rows.getTimestamp("reviewed_at").toInstant(),
                                rows.getString("review_method"),rows.getString("verification_status"));
                    }
                }
                var results=new ArrayList<Result>();
                try(var statement=prepare(connection,"""
                        SELECT r.*,b.file_sha256,b.pdf_page_count,b.title AS book_title
                        FROM tam_the_supplement_results r JOIN source_books b ON b.id=r.source_book_id
                        WHERE r.bundle_id=? ORDER BY r.result_code LIMIT 20
                        """)) {
                    statement.setString(1,ReviewedMaiHoaKnowledge.BUNDLE_ID);
                    try(var rows=statement.executeQuery()) {
                        while(rows.next()) results.add(new Result(rows.getString("result_code"),rows.getString("bundle_id"),
                                rows.getString("rule_code"),rows.getInt("column_number"),rows.getString("title"),
                                rows.getString("source_table_label"),rows.getString("source_content_heading"),rows.getString("content"),
                                rows.getString("text_kind"),mapper.readTree(rows.getString("source_record")),rows.getString("file_sha256"),
                                rows.getInt("pdf_page_count"),rows.getString("book_title")));
                    }
                }
                var mappings=new ArrayList<Mapping>();
                try(var statement=prepare(connection,"""
                        SELECT * FROM tam_the_supplement_mappings WHERE bundle_id=?
                        ORDER BY rule_code,lookup_key LIMIT 205
                        """)) {
                    statement.setString(1,ReviewedMaiHoaKnowledge.BUNDLE_ID);
                    try(var rows=statement.executeQuery()) {
                        while(rows.next()) mappings.add(new Mapping(rows.getString("rule_code"),rows.getString("lookup_key"),
                                rows.getString("bundle_id"),rows.getString("result_code"),rows.getInt("table_row"),rows.getInt("table_column")));
                    }
                }
                var original=base.tamThe(connection,baseRules);
                connection.commit();
                return new Snapshot(original,bundle,results,mappings);
            } catch(Exception failure) { connection.rollback(); throw failure; }
        } catch(SQLException failure) {
            if("42P01".equals(failure.getSQLState()) || "42703".equals(failure.getSQLState())) throw new KnowledgeDataException();
            throw new KnowledgeAccessException();
        } catch(java.io.IOException | IllegalArgumentException | NullPointerException failure) {
            throw new KnowledgeDataException();
        }
    }

    private static PreparedStatement prepare(Connection connection,String sql) throws SQLException {
        var statement=connection.prepareStatement(sql); statement.setQueryTimeout(3); return statement;
    }
}
