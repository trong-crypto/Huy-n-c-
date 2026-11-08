package com.huyenco.auth;

import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Resolves the actor from the Admin cookie for protected application APIs. */
@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public final class AdminRequestAccess {
    private final AccountAuthService auth;
    private final AccountRequestGuards requests;

    AdminRequestAccess(AccountAuthService auth, AccountRequestGuards requests) {
        this.auth = auth;
        this.requests = requests;
    }

    public UUID require(HttpServletRequest request, boolean write) {
        try {
            var realm = AccountAuthService.Realm.ADMIN;
            var session = auth.requireSession(realm, AccountRequestGuards.token(request, realm));
            if (write) {
                requests.mutation(request);
                auth.checkCsrf(session, AccountRequestGuards.header(request, "X-CSRF-Token"));
            } else {
                requests.optionalOrigin(request);
            }
            return session.account().id();
        } catch (AuthFailure failure) {
            throw new ContractException(failure.code, failure.getMessage());
        }
    }
}
