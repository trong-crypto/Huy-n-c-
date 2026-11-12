package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.*;
import static com.huyenco.common.validation.CmsInput.text;

import com.huyenco.websocket.AdminReviewNotifications;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.huyenco.common.validation.CmsInput;
import com.huyenco.auth.AdminRequestAccess;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("db")
@ConditionalOnProperty(name = "huyenco.hexagram.interpretation.enabled", havingValue = "true")
final class HexagramInterpretationController {
    private static final String ADMIN = "/api/v1/admin/hexagrams/{code}/interpretation";
    private static final Logger LOG = LoggerFactory.getLogger(HexagramInterpretationController.class);
    private final HexagramInterpretations interpretations;
    private final Optional<AdminRequestAccess> access;
    private final AdminReviewNotifications notifications;
    private final ObjectReader reader;

    HexagramInterpretationController(HexagramInterpretations interpretations, Optional<AdminRequestAccess> access, ObjectMapper mapper, AdminReviewNotifications notifications) {
        this.notifications = notifications;
        this.interpretations = interpretations;
        this.access = access;
        this.reader = reader(mapper);
    }

    @GetMapping("/api/v1/hexagrams/{code}/interpretation")
    ResponseEntity<Envelope> published(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            query(request, Set.of());
            return interpretations.published(code);
        });
    }

    @GetMapping(ADMIN)
    ResponseEntity<Envelope> admin(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return interpretations.state(code);
        });
    }

    @GetMapping(ADMIN + "/revisions/{version}")
    ResponseEntity<Envelope> revision(HttpServletRequest request, @PathVariable String code, @PathVariable String version) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return interpretations.revision(code, number(version, 0, 1, Integer.MAX_VALUE));
        });
    }

    @PutMapping(ADMIN)
    ResponseEntity<Envelope> save(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            var author = actor(access, request, true);
            JsonNode body = input(request, Set.of("expectedVersion", "content", "sourceIds"), 192_000);
            JsonNode content = body.path("content");
            fields(content, Set.of("overview", "image", "original", "paraphrase", "lines", "application", "poem"));
            var lines = content.path("lines");
            var sources = body.path("sourceIds");
            if (!lines.isArray() || lines.size() != 6 || !sources.isArray() || sources.isEmpty() || sources.size() > 8) throw invalid();
            var lineTexts = new ArrayList<String>();
            for (int i = 0; i < 6; i++) {
                if (!lines.get(i).isTextual()) throw invalid();
                lineTexts.add(plain(lines.get(i).textValue(), 2000));
            }
            var ids = new LinkedHashSet<String>();
            for (JsonNode source : sources) {
                if (!source.isTextual() || !source.textValue().matches("[A-Z0-9_-]{1,64}") || !ids.add(source.textValue())) throw invalid();
            }
            String overview = field(content, "overview", 6000);
            if (overview.isEmpty()) throw invalid();
            var document = new HexagramInterpretations.Content(overview, field(content, "image", 2000),
                    field(content, "original", 2000), field(content, "paraphrase", 4000),
                    lineTexts, field(content, "application", 4000));
            var version = body.path("expectedVersion");
            if (!version.isIntegralNumber() || !version.canConvertToInt() || version.intValue() < 0) throw invalid();
            return interpretations.save(code, version.intValue(), document, poem(content.path("poem")), ids, author);
        });
    }

    @PostMapping(ADMIN + "/workflow")
    ResponseEntity<Envelope> workflow(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            var reviewer = actor(access, request, true);
            var body = input(request, Set.of("expectedVersion", "action", "reviewNote"), 96_000);
            var action = option(HexagramInterpretations.Action.class, text(body, "action", 16, false, false));
            String note = action == HexagramInterpretations.Action.SUBMIT ? null : text(body, "reviewNote", 500, false, false);
            if (action == HexagramInterpretations.Action.SUBMIT && body.has("reviewNote")) throw invalid();
            var updated = interpretations.transition(code, expectedVersion(body), action, note, reviewer);
            if (action == HexagramInterpretations.Action.SUBMIT) notifications.submitted(AdminReviewNotifications.Area.INTERPRETATION);
            return updated;
        });
    }

    private JsonNode input(HttpServletRequest request, Set<String> allowed, int maxBody) {
        query(request, Set.of());
        JsonNode value = body(request, reader, maxBody);
        fields(value, allowed);
        return value;
    }

    private static JsonNode poem(JsonNode value) {
        if (value.isMissingNode() || value.isNull()) return value;
        fields(value, Set.of("title", "body", "author", "source"));
        String title = text(value, "title", 120, false, false);
        text(value, "body", 8000, true, false);
        String body = value.path("body").textValue();
        if (body.codePointCount(0, body.length()) > 8000) throw CmsInput.invalid("body");
        String author = text(value, "author", 160, false, false);
        String source = text(value, "source", 500, false, true);
        var poem = JsonNodeFactory.instance.objectNode().put("title", title).put("body", body).put("author", author);
        if (source != null) poem.put("source", source);
        return poem;
    }

    private static void fields(JsonNode value, Set<String> allowed) {
        if (!value.isObject()) throw invalid();
        value.fieldNames().forEachRemaining(key -> { if (!allowed.contains(key)) throw invalid(); });
    }

    private static String field(JsonNode node, String field, int max) {
        var value = node.path(field);
        if (!value.isTextual()) throw invalid();
        return plain(value.textValue(), max);
    }

    private static String plain(String value, int max) {
        String result = value.strip();
        if (result.codePointCount(0, result.length()) > max || result.codePoints().anyMatch(c ->
                c >= Character.MIN_SURROGATE && c <= Character.MAX_SURROGATE
                        || Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) throw invalid();
        return result;
    }
}
