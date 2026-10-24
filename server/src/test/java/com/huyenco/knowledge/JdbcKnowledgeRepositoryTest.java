package com.huyenco.knowledge;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.common.exception.RuleNotAvailableException;
import com.huyenco.config.KnowledgeDatabaseConfig;
import com.huyenco.config.RuleRegistryConfig;
import java.io.PrintWriter;
import java.sql.*;
import java.util.logging.Logger;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

class JdbcKnowledgeRepositoryTest {
    static class Connections implements DataSource {
        private final boolean failing;
        Connections(boolean failing) { this.failing = failing; }
        public Connection getConnection() throws SQLException {
            if (failing) throw new SQLException("sensitive JDBC diagnostics must not escape", "08001");
            String url = System.getenv("HUYENCO_TEST_DB_URL");
            if (url == null || !url.matches("jdbc:postgresql://[^/]+/huyenco_a02_[a-f0-9]{12}"))
                throw new SQLException("Only generated integration databases are allowed");
            return DriverManager.getConnection(url, System.getenv("HUYENCO_TEST_DB_USER"), System.getenv("PGPASSWORD"));
        }
        public Connection getConnection(String user, String password) throws SQLException { return getConnection(); }
        public PrintWriter getLogWriter() { return null; }
        public void setLogWriter(PrintWriter value) { }
        public int getLoginTimeout() { return 3; }
        public void setLoginTimeout(int value) { }
        public Logger getParentLogger() { return Logger.getGlobal(); }
        public <T> T unwrap(Class<T> type) throws SQLException { throw new SQLException("Not supported"); }
        public boolean isWrapperFor(Class<?> type) { return false; }
    }
    static RuleCatalog catalog() throws Exception { return RuleCatalog.load(new ObjectMapper()); }

    @Test
    void outageDoesNotExposeSqlOrCredentials() throws Exception {
        var repository = new JdbcKnowledgeRepository(new Connections(true), catalog());
        assertEquals("UNAVAILABLE", repository.readiness().database());
        assertEquals("NOT_READY", repository.readiness().status());
        var error = assertThrows(KnowledgeAccessException.class, () -> repository.find("MH-MUTUAL"));
        assertNull(error.getCause());
        assertFalse(error.getMessage().contains("sensitive"));
    }

    @Test
    @EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL", matches=".+")
    void dbProfileHasOneProviderAndPreservesSourceStatusAndReviews() throws Exception {
        try (var context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("db");
            context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
            context.registerBean(DataSource.class, () -> new Connections(false));
            context.register(RuleRegistryConfig.class, KnowledgeDatabaseConfig.class);
            context.refresh();
            assertEquals(1, context.getBeansOfType(RuleStateProvider.class).size());
            var repository = context.getBean(JdbcKnowledgeRepository.class);
            var state = repository.find("MH-MUTUAL").orElseThrow();
            assertEquals(SourceStatus.VERIFIED, state.sourceStatus());
            assertNotNull(state.reviewedAt());
            assertTrue(state.reviewer().startsWith("TV2"));
            assertEquals(42, state.sourceReferences().get(0).pdfPage());
            assertEquals("MH", state.sourceReferences().get(0).sourceId());
            assertTrue(state.sourceReferences().get(0).hasTraceableLocation());
            var registry = context.getBean(RuleRegistry.class);
            assertEquals(RuleBasis.SOURCE_VERIFIED, registry.authorize("MH-CHANGE", RulePurpose.CALCULATION).ruleBasis());
            assertEquals(SourceStatus.SOURCE_AMBIGUOUS, registry.authorize("MH-OBJECT-COUNT", RulePurpose.CALCULATION).sourceStatus());
            assertEquals(SourceStatus.BLOCKED_SOURCE_CONFLICT, registry.authorize("MH-TIME", RulePurpose.CALCULATION).sourceStatus());
            assertEquals(RuleBasis.SOURCE_VERIFIED, registry.authorize("MH-TRIGRAM", RulePurpose.CALCULATION).ruleBasis());
            assertEquals(39, repository.find("MH-TRIGRAM").orElseThrow().sourceReferences().get(0).pdfPage());
            assertEquals(RuleBasis.SOURCE_VERIFIED, registry.authorize("TT-NGU-HANH", RulePurpose.CALCULATION).ruleBasis());
            assertEquals(11, repository.find("TT-NGU-HANH").orElseThrow().sourceReferences().get(0).pdfPage());
            assertTrue(repository.find("unknown' OR 1=1 --").isEmpty());
        }
    }

    @Test
    @EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL", matches=".+")
    void readsAllPatternsAndReviewedTitles() throws Exception {
        var repository = new JdbcKnowledgeRepository(new Connections(false), catalog());
        assertEquals(8, repository.trigrams().size());
        assertEquals(64, repository.hexagrams().size());
        assertTrue(repository.hexagrams().stream().allMatch(h -> h.toCalculationView().name() != null
                && h.nameStatus() == SourceStatus.VERIFIED));
        var hexagram = repository.findHexagram("CAN", "KHON").orElseThrow();
        assertEquals(java.util.List.of(false,false,false,true,true,true), hexagram.linesBottomUp());
        assertNotNull(hexagram.source());
        assertTrue(repository.findHexagram("' OR 1=1 --", "KHON").isEmpty());
        try (var connection = new Connections(false).getConnection(); var statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT source_section_id FROM calculation_rules WHERE rule_code='MH-MUTUAL' AND rule_version='1.0'")) {
            assertTrue(rows.next());
            assertEquals(42, repository.findSource(rows.getLong(1)).orElseThrow().pdfPage());
        }
        assertTrue(repository.findSource(-1).isEmpty());
    }

    @Test
    @EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL", matches=".+")
    void selectsCatalogVersionEvenWhenAnotherVersionExists() throws Exception {
        var repository = new JdbcKnowledgeRepository(new Connections(false), catalog());
        try (var connection = new Connections(false).getConnection(); var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO calculation_rules(module,rule_code,rule_version,verification_status,description) VALUES ('MAI_HOA','MH-MUTUAL','9.9','DRAFT','Integration-only version')");
            try {
                assertEquals("1.0", repository.find("MH-MUTUAL").orElseThrow().ruleVersion());
            } finally {
                statement.executeUpdate("DELETE FROM calculation_rules WHERE rule_code='MH-MUTUAL' AND rule_version='9.9'");
            }
        }
    }

    @Test
    @EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL", matches=".+")
    void storageReadyIsNotBusinessReadinessAndCorruptionIsDetected() throws Exception {
        var repository = new JdbcKnowledgeRepository(new Connections(false), catalog());
        var report = repository.readiness();
        assertEquals("READY", report.status(), report.toString());
        assertFalse(report.businessFeaturesReady());
        assertEquals(4L, report.counts().get("verified_rules"));
        assertEquals(64L, report.counts().get("verified_hexagram_names"));
        assertEquals(14, report.rules().size());
        assertTrue(report.pending().contains("INTERPRETATIONS_MISSING"));
        try (var connection = new Connections(false).getConnection(); var statement = connection.createStatement()) {
            String toggle = "UPDATE hexagram_lines SET is_yang=NOT is_yang WHERE hexagram_code='H_CAN_CAN' AND line_number=1";
            assertEquals(1, statement.executeUpdate(toggle));
            try {
                assertEquals("NOT_READY", repository.readiness().seed());
                assertEquals("UP", repository.readiness().database());
            } finally { statement.executeUpdate(toggle); }
        }
        assertEquals("READY", repository.readiness().status());
    }

    @Test
    @EnabledIfEnvironmentVariable(named="HUYENCO_TEST_DB_URL", matches=".+")
    void sixtyYearElementMappingsAreCompleteReviewedAndExcludeDescriptors() throws Exception {
        var values = new java.util.HashMap<String, String>();
        try (var connection = new Connections(false).getConnection(); var statement = connection.createStatement();
             var rows = statement.executeQuery("""
                SELECT e.*,s.pdf_page,s.printed_page_label,b.file_sha256 FROM tam_the_lookup_entries e
                JOIN calculation_rules r ON r.id=e.rule_id JOIN source_sections s ON s.id=e.source_section_id
                JOIN source_books b ON b.id=s.source_book_id
                WHERE r.module='TAM_THE' AND r.rule_code='TT-NGU-HANH' AND r.rule_version='1.0'
                """)) {
            while (rows.next()) {
                assertNull(values.put(rows.getString("lookup_key"), rows.getString("result_code")));
                assertEquals("VERIFIED", rows.getString("verification_status"));
                assertTrue(rows.getString("reviewer").contains("same-tool second pass"));
                assertNotNull(rows.getTimestamp("reviewed_at"));
                assertTrue(rows.getString("verification_note").contains("scope=STEM_BRANCH_ELEMENT"));
                assertNull(rows.getString("description"));
                assertEquals(11, rows.getInt("pdf_page"));
                assertEquals("12", rows.getString("printed_page_label"));
                assertEquals("7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d", rows.getString("file_sha256"));
            }
        }
        assertEquals(60, values.size());
        var stems = java.util.List.of("GIAP", "AT", "BINH", "DINH", "MAU", "KY", "CANH", "TAN", "NHAM", "QUY");
        var branches = java.util.List.of("TY", "SUU", "DAN", "MAO", "THIN", "TI", "NGO", "MUI", "THAN", "DAU", "TUAT", "HOI");
        for (int i = 0; i < 60; i++) assertTrue(values.containsKey("STEM:" + stems.get(i % 10) + "|BRANCH:" + branches.get(i % 12)));
        assertEquals("KIM", values.get("STEM:GIAP|BRANCH:TY"));
        assertEquals("THO", values.get("STEM:KY|BRANCH:DAU"));
        assertEquals("HOA", values.get("STEM:MAU|BRANCH:NGO"));
        assertEquals("MOC", values.get("STEM:CANH|BRANCH:THAN"));
        assertFalse(values.containsKey("STEM:GIAP|BRANCH:SUU"));
        for (String element : java.util.List.of("KIM", "MOC", "THUY", "HOA", "THO"))
            assertEquals(12, values.values().stream().filter(element::equals).count());
    }
}
