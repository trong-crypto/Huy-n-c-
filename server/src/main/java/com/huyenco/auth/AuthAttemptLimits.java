package com.huyenco.auth;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
final class AuthAttemptLimits {
    private static final int MAX_BUCKETS = 20_000;
    private static final long WINDOW = 900;
    private final Map<String, Bucket> buckets = new HashMap<>();
    private final Clock clock;
    private final int loginPerIp;
    private final int loginPerIdentifier;
    private final int registerPerIp;
    private long nextPrune;

    AuthAttemptLimits(Clock clock, @Value("${huyenco.auth.login-per-ip}") int loginPerIp,
                      @Value("${huyenco.auth.login-per-identifier}") int loginPerIdentifier,
                      @Value("${huyenco.auth.register-per-ip}") int registerPerIp) {
        if (Math.min(loginPerIp, Math.min(loginPerIdentifier, registerPerIp)) < 1) {
            throw new IllegalArgumentException("Auth attempt limits must be positive");
        }
        this.clock = clock;
        this.loginPerIp = loginPerIp;
        this.loginPerIdentifier = loginPerIdentifier;
        this.registerPerIp = registerPerIp;
    }

    synchronized void login(String ip, String identifier) {
        long now = prune();
        consume("login:" + ip, loginPerIp, now);
        consume("identifier:" + ip + ":" + identifier, loginPerIdentifier, now);
    }

    synchronized void register(String ip) {
        consume("register:" + ip, registerPerIp, prune());
    }

    private long prune() {
        long now = clock.instant().getEpochSecond();
        if (now >= nextPrune) {
            buckets.values().removeIf(bucket -> bucket.expiresAt <= now);
            nextPrune = now + 30;
        }
        return now;
    }

    private void consume(String key, int limit, long now) {
        Bucket bucket = buckets.get(key);
        if (bucket == null || bucket.expiresAt <= now) {
            if (bucket == null && buckets.size() >= MAX_BUCKETS) throw AuthFailure.limited(30);
            bucket = new Bucket(now + WINDOW);
            buckets.put(key, bucket);
        }
        if (bucket.count >= limit) throw AuthFailure.limited(bucket.expiresAt - now);
        bucket.count++;
    }

    private static final class Bucket {
        private final long expiresAt;
        private int count;

        private Bucket(long expiresAt) {
            this.expiresAt = expiresAt;
        }
    }
}
