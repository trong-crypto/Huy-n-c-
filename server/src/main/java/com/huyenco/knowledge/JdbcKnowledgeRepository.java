package com.huyenco.knowledge;

import com.huyenco.common.dto.SourceReference;
import com.huyenco.common.exception.RuleNotAvailableException;
import java.sql.*;
import java.util.*;
import javax.sql.DataSource;

/** Read-only JDBC access. All user values are bound parameters; every query has a timeout. */
public final class JdbcKnowledgeRepository implements RuleStateProvider, HexagramRepository, TrigramRepository, TamTheRepository, HexagramLookupRepository {
    private static final String SOURCE_COLUMNS = """
        b.id AS book_id, b.title, b.edition, b.file_sha256,
        s.section_label, s.printed_page_label, s.pdf_page
        """;
    private static final String SOURCE_JOIN = """
         LEFT JOIN source_sections s ON s.id = r.source_section_id
         LEFT JOIN source_books b ON b.id = s.source_book_id
        """;
    private static final String RULE_COLUMNS = """
        r.rule_code, r.module, r.rule_version, r.verification_status, r.reviewer, r.reviewed_at,
        x.source_id AS external_id, x.title AS external_title, x.version AS external_version,
        x.section AS external_section, x.url AS external_url, x.sha256 AS external_sha,
        """ + SOURCE_COLUMNS;
    private static final String RULE_SOURCE_JOIN = SOURCE_JOIN
            + " LEFT JOIN external_sources x ON x.source_id=r.external_source_id ";
    private final DataSource dataSource;
    private final RuleCatalog catalog;

    public JdbcKnowledgeRepository(DataSource dataSource, RuleCatalog catalog) {
        this.dataSource = dataSource;
        this.catalog = catalog;
    }

    @Override
    public Optional<RuleState> find(String ruleCode) {
        var definition = catalog.find(ruleCode);
        if (definition.isEmpty()) return Optional.empty();
        RuleDefinition rule = definition.get();
        return read(connection -> {
            try (var statement = prepare(connection, "SELECT " + RULE_COLUMNS
                    + " FROM calculation_rules r " + RULE_SOURCE_JOIN
                    + " WHERE r.rule_code = ? AND r.module = ? AND r.rule_version = ?")) {
                statement.setString(1, ruleCode);
                statement.setString(2, rule.module().name());
                statement.setString(3, rule.ruleVersion());
                try (var rows = statement.executeQuery()) {
                    return rows.next() ? Optional.of(ruleState(rows)) : Optional.empty();
                }
            }
        });
    }

    public Optional<SourceReference> findSource(long sectionId) {
        return read(connection -> {
            try (var statement = prepare(connection, "SELECT " + SOURCE_COLUMNS
                    + " FROM source_sections s JOIN source_books b ON b.id=s.source_book_id WHERE s.id=?")) {
                statement.setLong(1, sectionId);
                try (var rows = statement.executeQuery()) {
                    return rows.next() ? Optional.ofNullable(source(rows)) : Optional.empty();
                }
            }
        });
    }

    public List<TrigramRecord> trigrams() { return read(JdbcKnowledgeRepository::trigrams); }
    public List<HexagramRecord> hexagrams() { return read(JdbcKnowledgeRepository::hexagrams); }

    @Override
    public HexagramLookupSnapshot lookupSnapshot() {
        return read(connection -> {
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            try {
                // At most 64 expected records; detect overfull data without unbounded reads.
                var hexagrams = new ArrayList<HexagramRecord>();
                try (var statement = prepare(connection, hexagramSelect() + " ORDER BY r.code LIMIT 65");
                     var rows = statement.executeQuery()) {
                    while (rows.next()) hexagrams.add(hexagram(rows));
                }
                var glosses = new ArrayList<HexagramLookupSnapshot.Gloss>();
                try (var statement = prepare(connection, "SELECT i.*, " + SOURCE_COLUMNS + """
                         FROM interpretations i
                         LEFT JOIN source_sections s ON s.id=i.source_section_id
                         LEFT JOIN source_books b ON b.id=s.source_book_id
                         WHERE i.category='NAME_GLOSS' AND i.verification_status='VERIFIED'
                         ORDER BY i.hexagram_code LIMIT 65
                        """); var rows = statement.executeQuery()) {
                    while (rows.next()) {
                        var reviewed = rows.getTimestamp("reviewed_at");
                        glosses.add(new HexagramLookupSnapshot.Gloss(rows.getString("hexagram_code"),
                                rows.getString("content"), SourceStatus.valueOf(rows.getString("verification_status")),
                                rows.getString("reviewer"), reviewed == null ? null : reviewed.toInstant(),
                                rows.getString("verification_note"), rows.getInt("source_order"),
                                rows.getString("printed_source_label"), source(rows)));
                    }
                }
                connection.commit();
                return new HexagramLookupSnapshot(hexagrams, glosses);
            } catch (SQLException | RuntimeException failure) {
                connection.rollback();
                throw failure;
            }
        });
    }

    @Override
    public TamTheSnapshot tamThe(Set<String> ruleCodes) {
        validateTamTheScope(ruleCodes);
        return read(connection -> {
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            try {
                var snapshot=tamThe(connection,ruleCodes);
                connection.commit(); return snapshot;
            } catch(SQLException | RuntimeException failure) {
                connection.rollback(); throw failure;
            }
        });
    }

    private static void validateTamTheScope(Set<String> ruleCodes) {
        if (ruleCodes == null || ruleCodes.isEmpty() || !Set.of("TT-NGU-HANH", "TT-CONG-DANH-11",
                "TT-CONG-DANH-13", "TT-TAI-LOC", "TT-TINH-DUYEN").containsAll(ruleCodes))
            throw new IllegalArgumentException("Unsupported Tam The snapshot scope");
    }

    /** Reads on the caller's transaction; D04 uses this to keep base and supplement coherent. */
    TamTheSnapshot tamThe(Connection connection,Set<String> ruleCodes) throws SQLException {
        validateTamTheScope(ruleCodes);
        var codes = ruleCodes.stream().sorted().toList();
        // The identifiers are constants; only code/version values become parameters.
        String scope = "r.module='TAM_THE' AND (" + String.join(" OR ", codes.stream()
                .map(code -> "(r.rule_code=? AND r.rule_version=?)").toList()) + ")";
        Map<String, RuleState> states = new LinkedHashMap<>();
        try (var statement = scoped(connection, "SELECT " + RULE_COLUMNS + " FROM calculation_rules r "
                + RULE_SOURCE_JOIN + " WHERE " + scope, codes); var rows = statement.executeQuery()) {
            while (rows.next()) {
                var state = ruleState(rows); states.put(state.ruleCode(), state);
            }
        }
        Map<Long, SourceReference> sources = new HashMap<>();
        try (var statement = prepare(connection, "SELECT s.id, " + SOURCE_COLUMNS
                + " FROM source_sections s JOIN source_books b ON b.id=s.source_book_id");
             var rows = statement.executeQuery()) {
            while (rows.next()) sources.put(rows.getLong("id"), source(rows));
        }
        Map<Long, List<TamTheSnapshot.Page>> pages = new HashMap<>();
        try (var statement = scoped(connection, """
                SELECT p.entry_id,p.page_order,p.source_section_id FROM tam_the_lookup_source_pages p
                JOIN tam_the_lookup_entries e ON e.id=p.entry_id JOIN calculation_rules r ON r.id=e.rule_id
                WHERE
                """ + scope + " ORDER BY p.entry_id,p.page_order", codes); var rows = statement.executeQuery()) {
            while (rows.next()) pages.computeIfAbsent(rows.getLong(1), ignored -> new ArrayList<>())
                    .add(new TamTheSnapshot.Page(rows.getInt(2), sources.get(rows.getLong(3))));
        }
        var entries = new ArrayList<TamTheSnapshot.Entry>();
        try (var statement = scoped(connection, "SELECT e.*,r.rule_code,r.rule_version FROM tam_the_lookup_entries e "
                + "JOIN calculation_rules r ON r.id=e.rule_id WHERE " + scope + " ORDER BY r.rule_code,e.lookup_key,e.result_code", codes);
             var rows = statement.executeQuery()) {
            while (rows.next()) {
                var reviewed = rows.getTimestamp("reviewed_at");
                entries.add(new TamTheSnapshot.Entry(rows.getString("rule_code"),rows.getString("rule_version"),
                        rows.getString("lookup_key"),rows.getString("result_code"),rows.getString("title"),rows.getString("description"),
                        SourceStatus.valueOf(rows.getString("verification_status")),rows.getString("reviewer"),
                        reviewed == null ? null : reviewed.toInstant(),rows.getString("verification_note"),
                        sources.get(rows.getLong("source_section_id")),sources.get(rows.getLong("content_source_section_id")),
                        rows.getString("source_table_label"),rows.getString("source_content_heading"),
                        pages.getOrDefault(rows.getLong("id"), List.of())));
            }
        }
        return new TamTheSnapshot(states, entries);
    }

    private PreparedStatement scoped(Connection connection, String sql, List<String> codes) throws SQLException {
        var statement = prepare(connection, sql);
        for (int i=0; i<codes.size(); i++) {
            statement.setString(i*2+1,codes.get(i));
            statement.setString(i*2+2,catalog.find(codes.get(i)).orElseThrow().ruleVersion());
        }
        return statement;
    }

    public Optional<HexagramRecord> findHexagram(String upperCode, String lowerCode) {
        return read(connection -> {
            try (var statement = prepare(connection, hexagramSelect()
                    + " WHERE r.upper_trigram_code=? AND r.lower_trigram_code=?")) {
                statement.setString(1, upperCode);
                statement.setString(2, lowerCode);
                try (var rows = statement.executeQuery()) {
                    return rows.next() ? Optional.of(hexagram(rows)) : Optional.empty();
                }
            }
        });
    }

    public KnowledgeReadiness readiness() {
        boolean connected = false;
        try (Connection connection = dataSource.getConnection()) {
            connection.setReadOnly(true);
            try (var statement = prepare(connection, "SELECT 1"); var rows = statement.executeQuery()) {
                connected = rows.next() && rows.getInt(1) == 1;
            }
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            try {
                var report = inspect(connection);
                connection.commit();
                return report;
            } catch (SQLException | RuntimeException failure) {
                connection.rollback();
                throw failure;
            }
        } catch (SQLException failure) {
            boolean schemaError = failure.getSQLState() != null && failure.getSQLState().startsWith("42");
            return KnowledgeReadiness.unavailable(connected && schemaError ? "UP" : "UNAVAILABLE",
                    connected && schemaError ? "NOT_READY" : "NOT_CHECKED");
        } catch (RuntimeException failure) {
            return KnowledgeReadiness.unavailable(connected ? "UP" : "UNAVAILABLE", "INVALID_DATA");
        }
    }

    private KnowledgeReadiness inspect(Connection connection) throws SQLException {
        Map<String, Long> counts = new LinkedHashMap<>();
        // Identifiers are constant application code, never request input.
        for (String table : List.of("source_books", "source_sections", "calculation_rules", "trigrams",
                "hexagrams", "hexagram_lines", "interpretations", "tam_the_hour_anchors", "tam_the_lookup_entries")) {
            try (var statement = prepare(connection, "SELECT count(*) FROM " + table);
                 var rows = statement.executeQuery()) {
                rows.next(); counts.put(table, rows.getLong(1));
            }
        }
        boolean migrated;
        try (var statement = prepare(connection, """
                SELECT count(*)=4 AND bool_and(success) FROM flyway_schema_history WHERE version IN ('1','2','3','4')
                """); var rows = statement.executeQuery()) {
            rows.next(); migrated = rows.getBoolean(1);
        }
        List<TrigramRecord> trigrams = trigrams(connection);
        List<HexagramRecord> hexagrams = hexagrams(connection);
        boolean structure = validStructure(connection, trigrams, hexagrams);
        Map<String, RuleState> states = new HashMap<>();
        try (var statement = prepare(connection, "SELECT " + RULE_COLUMNS + " FROM calculation_rules r " + RULE_SOURCE_JOIN);
             var rows = statement.executeQuery()) {
            while (rows.next()) {
                var state = ruleState(rows);
                var definition = catalog.find(state.ruleCode());
                if (definition.isPresent() && definition.get().module() == state.module()
                        && definition.get().ruleVersion().equals(state.ruleVersion())) states.put(state.ruleCode(), state);
            }
        }
        RuleRegistry registry = new RuleRegistry(catalog, code -> Optional.ofNullable(states.get(code)));
        List<KnowledgeReadiness.RuleReadiness> rules = new ArrayList<>();
        for (var definition : catalog.all()) {
            var state = states.get(definition.ruleCode());
            String reason = null;
            try { registry.authorize(definition.ruleCode(), RulePurpose.CALCULATION); }
            catch (RuleNotAvailableException failure) { reason = failure.reason().name(); }
            rules.add(new KnowledgeReadiness.RuleReadiness(definition.ruleCode(), definition.executionPolicy().name(),
                    state == null ? "MISSING" : state.sourceStatus().name(), reason == null, reason));
        }
        boolean sourceLinks = states.values().stream().allMatch(state -> state.sourceStatus() == SourceStatus.DRAFT
                || (!state.sourceReferences().isEmpty()
                && state.sourceReferences().stream().allMatch(SourceReference::hasTraceableLocation)));
        boolean seeded = structure && counts.get("source_books") >= 2 && states.size() == catalog.all().size()
                && sourceLinks && counts.get("tam_the_hour_anchors") == 12 && counts.get("tam_the_lookup_entries") >= 51;
        long verifiedNames = hexagrams.stream().filter(h -> h.toCalculationView().name() != null).count();
        counts.put("verified_hexagram_names", verifiedNames);
        counts.put("verified_rules", states.values().stream().filter(s -> s.sourceStatus() == SourceStatus.VERIFIED).count());
        List<String> pending = new ArrayList<>(List.of("BUSINESS_IMPLEMENTATION_PENDING"));
        if (verifiedNames < 64) pending.add("HEXAGRAM_NAMES_UNVERIFIED");
        if (counts.get("interpretations") == 0) pending.add("INTERPRETATIONS_MISSING");
        if (rules.stream().anyMatch(r -> !r.calculationAuthorized())) pending.add("RULES_NOT_AUTHORIZED");
        return new KnowledgeReadiness(migrated && seeded ? "READY" : "NOT_READY", "KNOWLEDGE_STORAGE", "UP",
                migrated ? "READY" : "NOT_READY", seeded ? "READY" : "NOT_READY", false,
                Collections.unmodifiableMap(counts), List.copyOf(rules), List.copyOf(pending));
    }

    private static boolean validStructure(Connection connection, List<TrigramRecord> trigrams,
                                           List<HexagramRecord> hexagrams) throws SQLException {
        if (trigrams.size() != 8 || hexagrams.size() != 64) return false;
        Map<String, TrigramRecord> byCode = new HashMap<>();
        Set<Integer> numbers = new HashSet<>();
        Set<List<Boolean>> patterns = new HashSet<>();
        for (var trigram : trigrams) {
            if (trigram.linesBottomUp().size() != 3 || trigram.heavenNumber() < 1 || trigram.heavenNumber() > 8
                    || !numbers.add(trigram.heavenNumber()) || !patterns.add(trigram.linesBottomUp())) return false;
            byCode.put(trigram.code(), trigram);
        }
        Map<String, List<Boolean>> linesByCode = new HashMap<>();
        Set<String> pairs = new HashSet<>();
        for (var hexagram : hexagrams) {
            var lower = byCode.get(hexagram.lowerTrigramCode());
            var upper = byCode.get(hexagram.upperTrigramCode());
            if (lower == null || upper == null || !pairs.add(upper.code() + ":" + lower.code())) return false;
            var expected = new ArrayList<>(lower.linesBottomUp());
            expected.addAll(upper.linesBottomUp());
            if (!expected.equals(hexagram.linesBottomUp())) return false;
            linesByCode.put(hexagram.code(), expected);
        }
        int lineCount = 0;
        try (var statement = prepare(connection, "SELECT hexagram_code,line_number,is_yang FROM hexagram_lines");
             var rows = statement.executeQuery()) {
            while (rows.next()) {
                var expected = linesByCode.get(rows.getString(1));
                int position = rows.getInt(2);
                if (expected == null || position < 1 || position > 6 || expected.get(position - 1) != rows.getBoolean(3)) return false;
                lineCount++;
            }
        }
        return lineCount == 384;
    }

    private static List<TrigramRecord> trigrams(Connection connection) throws SQLException {
        List<TrigramRecord> result = new ArrayList<>();
        try (var statement = prepare(connection, "SELECT code,name,heaven_number,element,lines_bottom_up FROM trigrams ORDER BY heaven_number");
             var rows = statement.executeQuery()) {
            while (rows.next()) result.add(new TrigramRecord(rows.getString("code"), rows.getString("name"),
                    rows.getInt("heaven_number"), rows.getString("element"), lines(rows)));
        }
        return List.copyOf(result);
    }

    private static String hexagramSelect() {
        return "SELECT r.*, " + SOURCE_COLUMNS + " FROM hexagrams r " + SOURCE_JOIN;
    }

    private static List<HexagramRecord> hexagrams(Connection connection) throws SQLException {
        List<HexagramRecord> result = new ArrayList<>();
        try (var statement = prepare(connection, hexagramSelect() + " ORDER BY r.code"); var rows = statement.executeQuery()) {
            while (rows.next()) result.add(hexagram(rows));
        }
        return List.copyOf(result);
    }

    private static HexagramRecord hexagram(ResultSet rows) throws SQLException {
        return new HexagramRecord(rows.getString("code"), rows.getString("name"), rows.getString("upper_trigram_code"),
                rows.getString("lower_trigram_code"), lines(rows), rows.getString("name_kind"),
                SourceStatus.valueOf(rows.getString("verification_status")), rows.getString("reviewer"), source(rows));
    }

    private static List<Boolean> lines(ResultSet rows) throws SQLException {
        var array = rows.getArray("lines_bottom_up");
        try { return List.copyOf(Arrays.asList((Boolean[]) array.getArray())); }
        finally { array.free(); }
    }

    private static RuleState ruleState(ResultSet rows) throws SQLException {
        var reference = source(rows);
        if (reference == null && rows.getString("external_id") != null) {
            reference = new SourceReference(rows.getString("external_id"), rows.getString("external_title"),
                    rows.getString("external_version"), rows.getString("external_section"), null, null,
                    rows.getString("external_sha"), rows.getString("external_url"));
        }
        var reviewedAt = rows.getTimestamp("reviewed_at");
        return new RuleState(rows.getString("rule_code"), RuleModule.valueOf(rows.getString("module")),
                rows.getString("rule_version"), SourceStatus.valueOf(rows.getString("verification_status")),
                reference == null ? List.of() : List.of(reference), rows.getString("reviewer"),
                reviewedAt == null ? null : reviewedAt.toInstant());
    }

    private static SourceReference source(ResultSet rows) throws SQLException {
        String bookId = rows.getString("book_id");
        if (bookId == null) return null;
        String title = rows.getString("title");
        String sha = rows.getString("file_sha256");
        String sourceId = sha == null ? "BOOK-" + bookId : switch (sha.trim()) {
            case "225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de" -> "MH";
            case "7976f690145cc0bbdf6cb1bf2a0276b843512d231dca9a9f83b6f99820816c7d" -> "TT";
            default -> "BOOK-" + bookId;
        };
        return new SourceReference(sourceId, title, rows.getString("edition"), rows.getString("section_label"),
                rows.getString("printed_page_label"), rows.getObject("pdf_page", Integer.class),
                rows.getString("file_sha256"), null);
    }

    private static PreparedStatement prepare(Connection connection, String sql) throws SQLException {
        var statement = connection.prepareStatement(sql);
        statement.setQueryTimeout(3);
        return statement;
    }

    private <T> T read(Query<T> query) {
        try (var connection = dataSource.getConnection()) {
            connection.setReadOnly(true);
            return query.run(connection);
        } catch (SQLException | IllegalArgumentException | NullPointerException failure) {
            throw new KnowledgeAccessException();
        }
    }

    @FunctionalInterface
    private interface Query<T> { T run(Connection connection) throws SQLException; }
}
