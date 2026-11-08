package com.huyenco.auth;

import com.huyenco.common.exception.ContractException;
import com.huyenco.history.HistoryStore;
import com.huyenco.history.SessionService;
import com.huyenco.knowledge.KnowledgeAccessException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public final class AccountHistoryIdentity {
    public record Access(HistoryStore.Owner owner, String csrfToken) {}
    private final AccountAuthService auth;

    AccountHistoryIdentity(AccountAuthService auth) { this.auth = auth; }

    public Access require(HttpServletRequest request, boolean checkCsrf) {
        var realm = AccountAuthService.Realm.CUSTOMER;
        try {
            String token = AccountRequestGuards.token(request, realm);
            var stored = auth.requireStoredSession(realm, token);
            var session = auth.session(stored.account(), stored.expiresAt(), realm, token);
            if (checkCsrf) {
                var headers = Collections.list(request.getHeaders("X-CSRF-Token"));
                auth.checkCsrf(session, headers.size() == 1 ? headers.get(0) : null);
            }
            return new Access(new HistoryStore.Owner(stored.account().id(), stored.expiresAt().toInstant(),
                    stored.sessionId()), session.csrfToken());
        } catch (AuthFailure failure) {
            if (failure.status == 401) throw SessionService.loginRequired();
            throw new ContractException(failure.code, failure.getMessage());
        } catch (DataAccessException failure) {
            throw new KnowledgeAccessException();
        }
    }

    public HistoryStore.Owner optional(HttpServletRequest request) {
        try {
            return require(request, false).owner();
        } catch (ContractException failure) {
            if ("LOGIN_REQUIRED".equals(failure.code())) return null;
            throw failure;
        }
    }
}
