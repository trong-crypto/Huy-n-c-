package com.huyenco.auth;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.huyenco.auth.AccountAuthService.Realm;
import com.huyenco.common.dto.ApiError;
import com.huyenco.common.exception.ContractException;
import static com.huyenco.auth.AccountRequestGuards.header;
import static com.huyenco.auth.AccountRequestGuards.token;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/v1/auth", produces = MediaType.APPLICATION_JSON_VALUE)
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
final class AccountAuthController {
    private static final Logger LOG = LoggerFactory.getLogger(AccountAuthController.class);
    private static final int MAX_BODY = 16 * 1024;
    private static final int REGISTRATION_PASSWORD_MIN_LENGTH = 8;
    private static final Pattern USERNAME = Pattern.compile("[a-zA-Z0-9._-]{3,32}");
    private static final Pattern RECOVERY_CODE = Pattern.compile("[a-zA-Z0-9_-]{43}");
    private static final Pattern EMAIL_LOCAL = Pattern.compile("[a-zA-Z0-9_+%-]+(?:\\.[a-zA-Z0-9_+%-]+)*");
    private static final Pattern DOMAIN_LABEL = Pattern.compile("[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?");
    private final AccountAuthService service;
    private final AuthAttemptLimits limits;
    private final ObjectReader reader;
    private final AccountRequestGuards guards;
    private final ChatSessionAccess chatSessions;
    private final boolean secureCookie;

    AccountAuthController(AccountAuthService service, AuthAttemptLimits limits, ObjectMapper mapper,
                          AccountRequestGuards guards, ChatSessionAccess chatSessions,
                          @Value("${huyenco.auth.secure-cookie}") boolean secureCookie) {
        this.service = service;
        this.limits = limits;
        this.reader = mapper.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .readerFor(JsonNode.class).with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
        this.guards = guards;
        this.chatSessions = chatSessions;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/register")
    ResponseEntity<Envelope> register(HttpServletRequest request) {
        return handle(request, () -> {
            guards.mutation(request);
            JsonNode body = body(request, Set.of("displayName", "identifier", "password"), "phoneNumber");
            String name = text(body, "displayName").strip();
            if (name.isEmpty() || name.codePointCount(0, name.length()) > 80
                    || name.codePoints().anyMatch(Character::isISOControl)) throw AuthFailure.invalid();
            String identifier = identifier(text(body, "identifier"));
            String password = password(body, "password", REGISTRATION_PASSWORD_MIN_LENGTH);
            String phone = body.has("phoneNumber") ? phoneNumber(text(body, "phoneNumber")) : null;
            limits.register(request.getRemoteAddr());
            return success(201, service.register(name, identifier, password, phone), null);
        });
    }

    @PostMapping({"/login", "/{portal:admin}/login"})
    ResponseEntity<Envelope> login(HttpServletRequest request, @PathVariable(name = "portal", required = false) String portal) {
        return handle(request, () -> {
            guards.mutation(request);
            JsonNode body = body(request, Set.of("identifier", "password"));
            String identifier = identifier(text(body, "identifier"));
            String password = password(body, "password", 1);
            limits.login(request.getRemoteAddr(), identifier);
            Realm realm = realm(portal);
            var issued = service.login(realm, identifier, password, token(request, realm));
            return success(200, issued.session(), cookie(realm, issued.token(), realm.lifetime, request));
        });
    }

    @GetMapping({"/session", "/{portal:admin}/session"})
    ResponseEntity<Envelope> session(HttpServletRequest request, @PathVariable(name = "portal", required = false) String portal) {
        return handle(request, () -> {
            guards.optionalOrigin(request);
            Realm realm = realm(portal);
            return success(200, service.requireSession(realm, token(request, realm)), null);
        });
    }

    @PostMapping({"/logout", "/{portal:admin}/logout"})
    ResponseEntity<Envelope> logout(HttpServletRequest request, @PathVariable(name = "portal", required = false) String portal) {
        return handle(request, () -> {
            guards.mutation(request);
            body(request, Set.of());
            Realm realm = realm(portal);
            service.logout(realm, token(request, realm), header(request, "X-CSRF-Token"));
            return ResponseEntity.noContent().cacheControl(CacheControl.noStore())
                    .header(HttpHeaders.SET_COOKIE, cookie(realm, "", Duration.ZERO, request).toString()).build();
        });
    }

    @GetMapping("/chat/session")
    ResponseEntity<Envelope> chatSession(HttpServletRequest request) {
        return handle(request, () -> {
            try {
                return success(200, chatSessions.requireRead(request), null);
            } catch (ContractException failure) {
                int status = "INVALID_SESSION".equals(failure.code()) ? 401 : 403;
                return failure(status, failure.code(), failure.getMessage(), 0);
            }
        });
    }

    @PostMapping({"/password/change", "/{portal:admin}/password/change"})
    ResponseEntity<Envelope> changePassword(HttpServletRequest request,
                                            @PathVariable(name = "portal", required = false) String portal) {
        return submitPassword(request, realm(portal), false);
    }

    @PostMapping("/password/requests")
    ResponseEntity<Envelope> requestPasswordChange(HttpServletRequest request) {
        return submitPassword(request, Realm.CUSTOMER, true);
    }

    private ResponseEntity<Envelope> submitPassword(HttpServletRequest request, Realm realm, boolean reviewRequired) {
        return handle(request, () -> {
            guards.mutation(request);
            var body = body(request, Set.of("currentPassword", "newPassword"));
            String current = password(body, "currentPassword", 1);
            String replacement = password(body, "newPassword", REGISTRATION_PASSWORD_MIN_LENGTH);
            String token = token(request, realm);
            var session = service.requireSession(realm, token);
            service.checkCsrf(session, header(request, "X-CSRF-Token"));
            UUID accountId = session.account().id();
            limits.passwordChange(request.getRemoteAddr(), accountId);
            if (reviewRequired) {
                service.requestPasswordChange(token, accountId, current, replacement);
                return success(202, java.util.Map.of("status", "PENDING"), null);
            }
            service.changePassword(realm, token, accountId, current, replacement);
            return ResponseEntity.noContent().cacheControl(CacheControl.noStore())
                    .header(HttpHeaders.SET_COOKIE, cookie(realm, "", Duration.ZERO, request).toString()).build();
        });
    }

    @PostMapping("/admin/password/requests")
    ResponseEntity<Envelope> decidePasswordChange(HttpServletRequest request) {
        return handle(request, () -> {
            guards.mutation(request);
            var session = service.requireSession(Realm.ADMIN, token(request, Realm.ADMIN));
            service.checkCsrf(session, header(request, "X-CSRF-Token"));
            var body = body(request, Set.of("accountId", "requestId", "decision"));
            try {
                String accountId = text(body, "accountId");
                String requestId = text(body, "requestId");
                UUID account = UUID.fromString(accountId);
                UUID pending = UUID.fromString(requestId);
                if (!account.toString().equals(accountId) || !pending.toString().equals(requestId)) throw AuthFailure.invalid();
                service.decidePasswordChange(account, pending, session.account().id(),
                        AccountAuthService.PasswordDecision.valueOf(text(body, "decision")));
                return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
            } catch (IllegalArgumentException invalid) {
                throw AuthFailure.invalid();
            }
        });
    }

    @PostMapping("/admin/password/recovery")
    ResponseEntity<Envelope> issuePasswordRecovery(HttpServletRequest request) {
        return handle(request, () -> {
            guards.mutation(request);
            var session = service.requireSession(Realm.ADMIN, token(request, Realm.ADMIN));
            service.checkCsrf(session, header(request, "X-CSRF-Token"));
            var body = body(request, Set.of("accountId"));
            try {
                String value = text(body, "accountId");
                UUID accountId = UUID.fromString(value);
                if (!accountId.toString().equals(value)) throw AuthFailure.invalid();
                return success(201, service.issueRecovery(accountId, session.account().id()), null);
            } catch (IllegalArgumentException invalid) {
                throw AuthFailure.invalid();
            }
        });
    }

    @PostMapping("/password/recover")
    ResponseEntity<Envelope> recoverPassword(HttpServletRequest request) {
        return handle(request, () -> {
            guards.mutation(request);
            var body = body(request, Set.of("identifier", "code", "newPassword"));
            String identifier = identifier(text(body, "identifier"));
            String code = text(body, "code");
            if (!RECOVERY_CODE.matcher(code).matches()) throw AuthFailure.invalid();
            String replacement = password(body, "newPassword", REGISTRATION_PASSWORD_MIN_LENGTH);
            limits.passwordRecovery(request.getRemoteAddr(), identifier);
            service.recoverPassword(identifier, code, replacement);
            return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
        });
    }

    private JsonNode body(HttpServletRequest request, Set<String> fields, String... optionalFields) {
        try {
            if (request.getContentType() == null) throw AuthFailure.invalid();
            MediaType type = MediaType.parseMediaType(request.getContentType());
            if (!"application".equalsIgnoreCase(type.getType()) || !"json".equalsIgnoreCase(type.getSubtype())
                    || (type.getCharset() != null && !StandardCharsets.UTF_8.equals(type.getCharset()))) {
                throw AuthFailure.invalid();
            }
            byte[] bytes = request.getInputStream().readNBytes(MAX_BODY + 1);
            if (bytes.length > MAX_BODY || bytes.length == 0) throw AuthFailure.invalid();
            String json = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
            JsonNode value = reader.readValue(json);
            if (value == null || !value.isObject()) throw AuthFailure.invalid();
            int expectedSize = fields.size();
            for (String field : optionalFields) {
                if (value.has(field)) {
                    text(value, field);
                    expectedSize++;
                }
            }
            if (value.size() != expectedSize) throw AuthFailure.invalid();
            for (String field : fields) text(value, field);
            return value;
        } catch (IOException | IllegalArgumentException failure) {
            throw AuthFailure.invalid();
        }
    }

    private static String text(JsonNode value, String field) {
        JsonNode node = value.path(field);
        if (!node.isTextual()) throw AuthFailure.invalid();
        String text = node.textValue();
        if (text.codePoints().anyMatch(c -> c >= Character.MIN_SURROGATE && c <= Character.MAX_SURROGATE)) {
            throw AuthFailure.invalid();
        }
        return text;
    }

    private static String password(JsonNode body, String field, int minimum) {
        String password = text(body, field);
        int length = password.codePointCount(0, password.length());
        if (length < minimum || length > 128) throw AuthFailure.invalid();
        return password;
    }

    private static String phoneNumber(String input) {
        if (input.length() > 32) throw AuthFailure.invalid();
        String normalized = input.strip().replaceAll("[ .-]", "");
        if (!normalized.matches("[+]?[0-9]{7,15}")) throw AuthFailure.invalid();
        return normalized;
    }

    private static String identifier(String input) {
        String value = input.strip();
        if (USERNAME.matcher(value).matches()) return value.toLowerCase(Locale.ROOT);
        int at = value.indexOf('@');
        if (value.length() > 254 || at < 1 || at > 64 || at != value.lastIndexOf('@')
                || !EMAIL_LOCAL.matcher(value.substring(0, at)).matches()) throw AuthFailure.invalid();
        String[] labels = value.substring(at + 1).split("\\.", -1);
        if (labels.length < 2 || Arrays.stream(labels).anyMatch(label -> !DOMAIN_LABEL.matcher(label).matches())) {
            throw AuthFailure.invalid();
        }
        return value.toLowerCase(Locale.ROOT);
    }

    private static Realm realm(String portal) {
        return portal == null ? Realm.CUSTOMER : Realm.ADMIN;
    }

    private ResponseCookie cookie(Realm realm, String token, Duration maxAge, HttpServletRequest request) {
        return ResponseCookie.from(realm.cookie, token).httpOnly(true).sameSite("Lax")
                .secure(secureCookie || request.isSecure()).path("/api/v1").maxAge(maxAge).build();
    }

    private static ResponseEntity<Envelope> success(int status, Object data, ResponseCookie cookie) {
        var response = ResponseEntity.status(status).cacheControl(CacheControl.noStore());
        if (cookie != null) response.header(HttpHeaders.SET_COOKIE, cookie.toString());
        return response.body(new Envelope(UUID.randomUUID().toString(), "COMPLETED", data, null));
    }

    private static ResponseEntity<Envelope> handle(HttpServletRequest request, Supplier<ResponseEntity<Envelope>> action) {
        try {
            if (request.getQueryString() != null && !request.getQueryString().isEmpty()) throw AuthFailure.invalid();
            return action.get();
        } catch (AuthFailure failure) {
            return failure(failure.status, failure.code, failure.getMessage(), failure.retryAfter);
        } catch (DataAccessException | CannotCreateTransactionException failure) {
            return failure(503, "DATABASE_UNAVAILABLE", "Không thể truy cập kho tài khoản hoặc phiên.", 0);
        } catch (RuntimeException failure) {
            return failure(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu xác thực.", 0);
        }
    }

    private static ResponseEntity<Envelope> failure(int status, String code, String message, long retryAfter) {
        String requestId = UUID.randomUUID().toString();
        if (status >= 500) LOG.warn("Account authentication {} requestId={}", code, requestId);
        var response = ResponseEntity.status(status).cacheControl(CacheControl.noStore());
        if (retryAfter > 0) response.header(HttpHeaders.RETRY_AFTER, Long.toString(retryAfter));
        return response.body(new Envelope(requestId, "FAILED", null, new ApiError(code, message, null, null)));
    }

    record Envelope(String requestId, String status, Object data, ApiError error) {}
}
