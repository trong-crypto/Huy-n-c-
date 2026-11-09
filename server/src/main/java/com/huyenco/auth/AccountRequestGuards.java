package com.huyenco.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
final class AccountRequestGuards {
    private static final Pattern SESSION_TOKEN = Pattern.compile("[a-zA-Z0-9_-]{43}");
    private final Set<String> origins;

    AccountRequestGuards(@Value("${huyenco.allowed-origins}") String origins) {
        this.origins = Set.copyOf(Arrays.asList(origins.split("\\s*,\\s*")));
    }

    void mutation(HttpServletRequest request) {
        origin(request);
        if (!"1".equals(header(request, "X-HuyenCo-Request"))) throw AuthFailure.csrf();
    }

    void optionalOrigin(HttpServletRequest request) {
        if (request.getHeaders("Origin").hasMoreElements()) origin(request);
    }

    void origin(HttpServletRequest request) {
        String origin = header(request, "Origin");
        if (origin == null || "null".equals(origin) || !origins.contains(origin)) throw AuthFailure.csrf();
    }

    static String header(HttpServletRequest request, String name) {
        var values = Collections.list(request.getHeaders(name));
        return values.size() == 1 ? values.get(0) : null;
    }

    static String token(HttpServletRequest request, AccountAuthService.Realm realm) {
        if (request.getCookies() == null) return null;
        String token = null;
        for (Cookie cookie : request.getCookies()) {
            if (!realm.cookie.equals(cookie.getName())) continue;
            if (token != null || !SESSION_TOKEN.matcher(cookie.getValue()).matches()) throw AuthFailure.session();
            token = cookie.getValue();
        }
        return token;
    }
}
