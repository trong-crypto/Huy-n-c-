package com.huyenco.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.huyenco.common.exception.ContractException;
import com.huyenco.knowledge.KnowledgeDataException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@Profile("db")
@ConditionalOnProperty(name = "huyenco.hexagram.interpretation.enabled", havingValue = "true")
public final class HexagramInterpretations {
    enum Action { SUBMIT, RETURN, PUBLISH }
    enum Status { DRAFT, PENDING_REVIEW, PUBLISHED }

    record Content(String overview, String image, String original, String paraphrase, List<String> lines, String application) {}
    record Source(String id, String title, String author, String edition, String locator, String url, String reuseNote,
                  String reviewStatus) {}
    record Revision(int version, JsonNode content, JsonNode sources, UUID createdBy, OffsetDateTime createdAt) {}
    public record Publication(Status status, int version, JsonNode content, JsonNode sources, OffsetDateTime publishedAt) {}
    public record PublicReading(String code, Publication publication) {}
    record State(String code, int version, Status status, Revision latest, List<Integer> revisions,
                 Integer publishedVersion, List<Source> sources, String reviewNote) {}

    private record Event(int sequence, int revision, Action action, String note) {}
    private static final String REVISIONS = "cms_hexagram_interpretation_revisions";
    private static final String EVENTS = "cms_hexagram_interpretation_events";
    private static final String REVISION_COLUMNS = "version, content, source_snapshot, created_by, created_at";
    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    private final TransactionTemplate read;
    private final TransactionTemplate write;

    HexagramInterpretations(JdbcTemplate db, ObjectMapper mapper, PlatformTransactionManager tx) {
        this.db = db;
        this.mapper = mapper;
        read = new TransactionTemplate(tx);
        read.setReadOnly(true);
        read.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
        write = new TransactionTemplate(tx);
        write.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    public PublicReading published(String code) {
        return read.execute(tx -> {
            requireHexagram(code, false);
            var publication = db.query("""
                    SELECT r.version, r.content, r.source_snapshot, e.occurred_at
                    FROM cms_hexagram_interpretation_events e
                    JOIN cms_hexagram_interpretation_revisions r
                      ON r.hexagram_code=e.hexagram_code AND r.version=e.revision
                    WHERE e.hexagram_code=? AND e.action='PUBLISH'
                    ORDER BY e.sequence DESC LIMIT 1
                    """, (row, index) -> new Publication(Status.PUBLISHED, row.getInt("version"), json(row, "content"),
                    json(row, "source_snapshot"), row.getObject("occurred_at", OffsetDateTime.class)), code)
                    .stream().findFirst().orElse(null);
            return new PublicReading(code, publication);
        });
    }

    State state(String code) {
        return read.execute(tx -> {
            requireHexagram(code, false);
            return load(code);
        });
    }

    Revision revision(String code, int version) {
        requireHexagram(code, false);
        return db.query("SELECT " + REVISION_COLUMNS + " FROM " + REVISIONS + " WHERE hexagram_code=? AND version=?",
                this::revision, code, version).stream().findFirst().orElseThrow(HexagramInterpretations::missing);
    }

    State save(String code, int expected, Content content, JsonNode poem, Set<String> sourceIds, UUID author) {
        return write.execute(tx -> {
            requireHexagram(code, true);
            var state = load(code);
            checkVersion(state, expected);
            if (state.status() == Status.PENDING_REVIEW) throw invalidTransition();
            var selected = state.sources().stream().filter(s -> sourceIds.contains(s.id())).toList();
            if (selected.size() != sourceIds.size()) throw new ContractException("INVALID_SOURCE", "Chọn nguồn đã đăng ký cho quẻ.");
            int next = state.latest() == null ? 1 : Math.incrementExact(state.latest().version());
            // Legacy editors can save the other fields without clearing a poem.
            JsonNode storedPoem = poem.isMissingNode() && state.latest() != null ? state.latest().content().path("poem") : poem;
            ObjectNode document = mapper.valueToTree(content);
            if (storedPoem.isObject()) document.set("poem", storedPoem);
            db.update("INSERT INTO " + REVISIONS + " (hexagram_code, version, content, source_snapshot, created_by) VALUES (?,?,?::jsonb,?::jsonb,?)",
                    code, next, serialize(document), serialize(selected), author);
            return load(code);
        });
    }

    State transition(String code, int expected, Action action, String note, UUID actor) {
        return write.execute(tx -> {
            requireHexagram(code, true);
            var state = load(code);
            checkVersion(state, expected);
            var revision = state.latest();
            if (revision == null || state.status() != (action == Action.SUBMIT ? Status.DRAFT : Status.PENDING_REVIEW))
                throw invalidTransition();
            if (action == Action.PUBLISH) {
                if (revision.createdBy().equals(actor)) throw new ContractException("FORBIDDEN", "Người soạn không thể công bố phiên bản này.");
                for (JsonNode snapshot : revision.sources()) {
                    var registered = state.sources().stream().filter(s -> s.id().equals(snapshot.path("id").asText()))
                            .findFirst().orElseThrow(HexagramInterpretations::invalidTransition);
                    if (!"VERIFIED".equals(registered.reviewStatus()) || !mapper.valueToTree(registered).equals(snapshot))
                        throw new ContractException("INVALID_TRANSITION", "Nguồn đã đổi hoặc chưa xác minh. Trả về và lưu nháp mới.");
                }
            }
            int nextEvent = Math.incrementExact(state.version() - revision.version());
            db.update("INSERT INTO " + EVENTS + " (hexagram_code, sequence, revision, action, actor_id, review_note) VALUES (?,?,?,?,?,?)",
                    code, nextEvent, revision.version(), action.name(), actor, note);
            return load(code);
        });
    }

    private State load(String code) {
        var versions = db.queryForList("SELECT version FROM " + REVISIONS + " WHERE hexagram_code=? ORDER BY version DESC", Integer.class, code);
        var latest = versions.isEmpty() ? null : revision(code, versions.get(0));
        var event = db.query("SELECT sequence, revision, action, review_note FROM " + EVENTS
                + " WHERE hexagram_code=? ORDER BY sequence DESC LIMIT 1",
                (row, index) -> new Event(row.getInt("sequence"), row.getInt("revision"),
                        Action.valueOf(row.getString("action")), row.getString("review_note")), code).stream().findFirst().orElse(null);
        var published = db.queryForList("SELECT revision FROM " + EVENTS
                + " WHERE hexagram_code=? AND action='PUBLISH' ORDER BY sequence DESC LIMIT 1", Integer.class, code);
        var sources = db.query("""
                SELECT id,title,author,edition,locator,url,reuse_note,review_status
                FROM cms_hexagram_interpretation_sources WHERE hexagram_code=? ORDER BY id
                """, (row, index) -> new Source(row.getString("id"), row.getString("title"), row.getString("author"),
                row.getString("edition"), row.getString("locator"), row.getString("url"), row.getString("reuse_note"),
                row.getString("review_status")), code);
        int revisionVersion = latest == null ? 0 : latest.version();
        Status status = event == null || event.revision() != revisionVersion ? Status.DRAFT : switch (event.action()) {
            case SUBMIT -> Status.PENDING_REVIEW;
            case RETURN -> Status.DRAFT;
            case PUBLISH -> Status.PUBLISHED;
        };
        return new State(code, Math.addExact(revisionVersion, event == null ? 0 : event.sequence()), status, latest,
                versions, published.isEmpty() ? null : published.get(0), sources,
                event != null && event.revision() == revisionVersion ? event.note() : null);
    }

    private void requireHexagram(String code, boolean lock) {
        if (!code.matches("H_[A-Z0-9]{2,4}_[A-Z0-9]{2,4}")) throw AdminDirectoryHttp.invalid();
        String query = "SELECT code FROM hexagrams WHERE code=?" + (lock ? " FOR UPDATE" : "");
        if (db.queryForList(query, String.class, code).isEmpty()) throw missing();
    }

    private Revision revision(ResultSet row, int index) throws SQLException {
        return new Revision(row.getInt("version"), json(row, "content"), json(row, "source_snapshot"),
                row.getObject("created_by", UUID.class), row.getObject("created_at", OffsetDateTime.class));
    }

    private JsonNode json(ResultSet row, String field) throws SQLException {
        try {
            return mapper.readTree(row.getString(field));
        } catch (JsonProcessingException error) {
            throw new KnowledgeDataException();
        }
    }

    private String serialize(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Cannot encode interpretation", error);
        }
    }

    private static void checkVersion(State state, int version) {
        if (state.version() != version) throw new ContractException("VERSION_CONFLICT", "Dữ liệu đã thay đổi. Hãy tải lại.");
    }

    private static ContractException missing() {
        return new ContractException("NOT_FOUND", "Không tìm thấy quẻ hoặc phiên bản luận giải.");
    }

    private static ContractException invalidTransition() {
        return new ContractException("INVALID_TRANSITION", "Trạng thái hiện tại chưa cho phép thao tác này.");
    }
}
