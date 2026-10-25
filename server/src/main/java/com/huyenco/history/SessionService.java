package com.huyenco.history;

import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class SessionService {
    public static final String COOKIE="huyenco_session";
    public static final String WS_OWNER="huyenco.history.owner";
    public static final Duration LIFETIME=Duration.ofDays(30);
    private final HistoryStore store;
    private final Clock clock;
    private final SecureRandom random=new SecureRandom();
    public record Session(HistoryStore.Owner owner, String token, String csrfToken, boolean created) { }
    public SessionService(HistoryStore store, Clock clock) { this.store=store; this.clock=clock; }

    public Session bootstrap(HttpServletRequest request) {
        String token=token(request);
        if (token != null) return new Session(requireToken(token),token,csrf(token),false);
        byte[] secret=new byte[32]; random.nextBytes(secret);
        token=Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        var now=clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        var owner=store.create(hash(token),now,now.plus(LIFETIME));
        return new Session(owner,token,csrf(token),true);
    }
    public HistoryStore.Owner require(HttpServletRequest request) { return requireToken(token(request)); }
    public HistoryStore.Owner optional(HttpServletRequest request) {
        String value=token(request); return value == null ? null : requireToken(value);
    }
    public void checkCsrf(HttpServletRequest request) {
        String token=token(request), supplied=request.getHeader("X-CSRF-Token");
        if (token == null || supplied == null || Collections.list(request.getHeaders("X-CSRF-Token")).size()!=1 ||
                !MessageDigest.isEqual(csrf(token).getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8)))
            throw new ContractException("CSRF_REJECTED","Thiếu hoặc sai mã CSRF.");
    }
    public static String token(HttpServletRequest request) {
        String value=null;
        if (request.getCookies() != null) for (Cookie cookie:request.getCookies()) if (COOKIE.equals(cookie.getName())) {
            if (value != null) throw invalidSession();
            value=cookie.getValue();
            if (value == null || !value.matches("[A-Za-z0-9_-]{43}")) throw invalidSession();
        }
        return value;
    }
    private HistoryStore.Owner requireToken(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalidSession();
        return store.owner(hash(token),clock.instant()).orElseThrow(SessionService::invalidSession);
    }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private static String csrf(String token) { return hash("huyenco-csrf-v1:"+token); }
    public static ContractException invalidSession() { return new ContractException("INVALID_SESSION","Phiên không hợp lệ hoặc đã hết hạn."); }
    public static ContractException invalid(String message) { return new ContractException("INVALID_INPUT",message); }
    public static ContractException missing() { return new ContractException("NOT_FOUND","Không tìm thấy dữ liệu trong phiên của bạn."); }
}
