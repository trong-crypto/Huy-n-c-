package com.huyenco.auth;

import com.huyenco.chat.ChatConsultantProfiles;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public class ChatSessionAccess {
    public enum Role { USER, CONSULTANT }
    public record Actor(UUID accountId, Role role, String expiresAt) {}
    public record SocketIdentity(UUID sessionId, UUID accountId, Role role) {}

    public static final class SocketHandshake {
        private final SocketIdentity identity;
        private final String csrf;

        private SocketHandshake(SocketIdentity identity, String csrf) {
            this.identity = identity;
            this.csrf = csrf;
        }
    }

    private final AccountAuthService accounts;
    private final AccountRequestGuards guards;
    private final ChatConsultantProfiles profiles;

    ChatSessionAccess(AccountAuthService accounts, AccountRequestGuards guards, ChatConsultantProfiles profiles) {
        this.accounts = accounts;
        this.guards = guards;
        this.profiles = profiles;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Actor requireRead(HttpServletRequest request) {
        try {
            guards.optionalOrigin(request);
            var realm = AccountAuthService.Realm.CUSTOMER;
            var session = accounts.requireStoredSession(realm, AccountRequestGuards.token(request, realm));
            return actor(session.account(), session.expiresAt().toInstant().toString());
        } catch (AuthFailure failure) {
            throw new ContractException(failure.code, failure.getMessage());
        }
    }

    public Actor requireWrite(HttpServletRequest request) {
        try {
            guards.mutation(request);
            var realm = AccountAuthService.Realm.CUSTOMER;
            var session = accounts.requireSession(realm, AccountRequestGuards.token(request, realm));
            accounts.checkCsrf(session, AccountRequestGuards.header(request, "X-CSRF-Token"));
            return actor(session.account(), session.expiresAt());
        } catch (AuthFailure failure) {
            throw new ContractException(failure.code, failure.getMessage());
        }
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public SocketHandshake handshake(HttpServletRequest request) {
        try {
            guards.origin(request);
            var realm = AccountAuthService.Realm.CUSTOMER;
            String token = AccountRequestGuards.token(request, realm);
            var stored = accounts.requireStoredSession(realm, token);
            Actor actor = actor(stored.account(), stored.expiresAt().toInstant().toString());
            String csrf = accounts.session(stored.account(), stored.expiresAt(), realm, token).csrfToken();
            return new SocketHandshake(new SocketIdentity(stored.sessionId(), actor.accountId(), actor.role()), csrf);
        } catch (AuthFailure failure) {
            throw new ContractException(failure.code, failure.getMessage());
        }
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public SocketIdentity connect(SocketHandshake handshake, String csrf) {
        try {
            AccountAuthService.checkCsrfToken(handshake.csrf, csrf);
            requireSocket(handshake.identity);
            return handshake.identity;
        } catch (AuthFailure failure) {
            throw new ContractException(failure.code, failure.getMessage());
        }
    }

    public Actor requireSocket(SocketIdentity identity) {
        try {
            var stored = accounts.requireStoredSessionById(AccountAuthService.Realm.CUSTOMER, identity.sessionId());
            if (!stored.account().id().equals(identity.accountId()) || !stored.account().role().equals(identity.role().name())) {
                throw AuthFailure.session();
            }
            return actor(stored.account(), stored.expiresAt().toInstant().toString());
        } catch (AuthFailure failure) {
            throw new ContractException(failure.code, failure.getMessage());
        }
    }

    private Actor actor(AccountAuthService.Account account, String expiresAt) {
        Role role = Role.valueOf(account.role());
        UUID id = account.id();
        if (role == Role.CONSULTANT && profiles.findEligible(id).isEmpty()) {
            throw new ContractException("FORBIDDEN", "Hồ sơ tư vấn viên chưa đủ điều kiện tham gia tư vấn.");
        }
        return new Actor(id, role, expiresAt);
    }
}
