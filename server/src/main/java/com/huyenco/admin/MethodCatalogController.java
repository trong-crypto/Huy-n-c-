package com.huyenco.admin;

import static com.huyenco.admin.AdminDirectoryHttp.actor;
import static com.huyenco.admin.AdminDirectoryHttp.body;
import static com.huyenco.admin.AdminDirectoryHttp.number;
import static com.huyenco.admin.AdminDirectoryHttp.option;
import static com.huyenco.admin.AdminDirectoryHttp.query;
import static com.huyenco.admin.AdminDirectoryHttp.respond;
import static com.huyenco.common.validation.CmsInput.expectedVersion;
import static com.huyenco.common.validation.CmsInput.invalid;
import static com.huyenco.common.validation.CmsInput.text;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.admin.AdminDirectoryHttp.Envelope;
import com.huyenco.admin.MethodCatalogService.Group;
import com.huyenco.admin.MethodCatalogService.Input;
import com.huyenco.admin.MethodCatalogService.State;
import com.huyenco.auth.AdminRequestAccess;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db")
@RequestMapping(value = "/api/v1", produces = MediaType.APPLICATION_JSON_VALUE)
final class MethodCatalogController {
    private static final Logger LOG = LoggerFactory.getLogger(MethodCatalogController.class);
    private static final Pattern CODE = Pattern.compile("[A-Z][A-Z0-9_]{1,31}");
    private static final String ADMIN = "/admin/methods";
    private static final String ENTRY = ADMIN + "/{code}";
    private static final Set<String> METADATA = Set.of("group","name","summary","introduction","instructions","requiredInput","listed");
    private final MethodCatalogService service;
    private final Optional<AdminRequestAccess> access;
    private final ObjectReader reader;

    MethodCatalogController(MethodCatalogService service, Optional<AdminRequestAccess> access, ObjectMapper mapper) {
        this.service = service;
        this.access = access;
        reader = AdminDirectoryHttp.reader(mapper);
    }

    @GetMapping(ADMIN)
    ResponseEntity<Envelope> list(HttpServletRequest request) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of("q", "group", "state", "page", "size"));
            String search = request.getParameter("q");
            if (search != null && (search.length() > 100 || search.codePoints().anyMatch(Character::isISOControl))) throw invalid("q");
            return service.list(search == null ? "" : search.strip(), option(Group.class, request.getParameter("group")),
                    option(State.class, request.getParameter("state")), number(request.getParameter("page"), 0, 0, Integer.MAX_VALUE),
                    number(request.getParameter("size"), 20, 1, 50));
        });
    }

    @GetMapping(ENTRY)
    ResponseEntity<Envelope> detail(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            actor(access, request, false);
            query(request, Set.of());
            return service.detail(code(code));
        });
    }

    @PostMapping(ADMIN)
    ResponseEntity<Envelope> create(HttpServletRequest request) {
        return respond(LOG, 201, () -> {
            var admin = actor(access, request, true);
            JsonNode json = payload(request, "code", true);
            return service.create(code(text(json, "code", 32, false, false)), input(json), admin);
        });
    }

    @PutMapping(ENTRY)
    ResponseEntity<Envelope> update(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            var admin = actor(access, request, true);
            JsonNode json = payload(request, "expectedVersion", true);
            return service.update(code(code), expectedVersion(json), input(json), admin);
        });
    }

    @DeleteMapping(ENTRY)
    ResponseEntity<Envelope> delete(HttpServletRequest request, @PathVariable String code) {
        return respond(LOG, 200, () -> {
            var admin = actor(access, request, true);
            JsonNode json = payload(request, "expectedVersion", false);
            service.delete(code(code), expectedVersion(json), admin);
            return Map.of("deleted", true);
        });
    }

    @GetMapping("/methods")
    ResponseEntity<Envelope> published(HttpServletRequest request) {
        return respond(LOG, 200, () -> {
            query(request, Set.of());
            return service.published();
        });
    }

    static boolean validCode(String value) {
        return CODE.matcher(value).matches();
    }

    private static String code(String value) {
        if (!validCode(value)) throw invalid("code");
        return value;
    }

    private JsonNode payload(HttpServletRequest request, String operationField, boolean allowMetadata) {
        query(request, Set.of());
        JsonNode json = body(request, reader, 80 * 1024);
        json.fieldNames().forEachRemaining(field -> {
            if (!field.equals(operationField) && (!allowMetadata || !METADATA.contains(field))) throw invalid(field);
        });
        return json;
    }

    private static Input input(JsonNode json) {
        if (!json.path("listed").isBoolean()) throw invalid("listed");
        return new Input(option(Group.class, text(json, "group", 16, false, false)),
                text(json, "name", 120, false, false), text(json, "summary", 500, false, false),
                optionalText(json, "introduction", 4000, true), optionalText(json, "instructions", 6000, true),
                optionalText(json, "requiredInput", 500, false), json.path("listed").booleanValue());
    }

    private static String optionalText(JsonNode json, String field, int limit, boolean multiline) {
        String value = text(json, field, limit, multiline, true);
        return value == null ? "" : value;
    }
}
