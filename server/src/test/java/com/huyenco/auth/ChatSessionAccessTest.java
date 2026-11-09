package com.huyenco.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.huyenco.chat.ChatConsultantProfiles;
import com.huyenco.common.exception.ContractException;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ChatSessionAccessTest {
    private static final String TOKEN = "a".repeat(43);
    private static final String CLIENT_ORIGIN = "http://127.0.0.1:18118";
    private final AccountAuthService accounts = mock(AccountAuthService.class);
    private final ChatConsultantProfiles profiles = mock(ChatConsultantProfiles.class);
    private final ChatSessionAccess access = new ChatSessionAccess(accounts, new AccountRequestGuards(CLIENT_ORIGIN), profiles);

    @Test
    void wrongOriginIsRejectedBeforeReadingSessionData() {
        var request = customerRequest();
        request.removeHeader("Origin");
        request.addHeader("Origin", "https://invalid.example");
        assertEquals("CSRF_REJECTED", assertThrows(ContractException.class, () -> access.requireRead(request)).code());
        verifyNoInteractions(accounts, profiles);
    }

    @Test
    void consultantApprovalIsRecheckedForTheSameCustomerSession() {
        UUID accountId = UUID.randomUUID();
        var consultant = new AccountAuthService.Account(accountId, "Consultant", "CONSULTANT");
        var expiry = OffsetDateTime.parse("2026-11-09T08:00:00Z");
        when(accounts.requireStoredSession(AccountAuthService.Realm.CUSTOMER, TOKEN)).thenReturn(
                new AccountAuthService.StoredSession(consultant, expiry, UUID.randomUUID()));
        when(profiles.findEligible(accountId))
                .thenReturn(Optional.of(new ChatConsultantProfiles.PublicProfile(accountId, "Consultant", null)))
                .thenReturn(Optional.empty());

        assertEquals(new ChatSessionAccess.Actor(accountId, ChatSessionAccess.Role.CONSULTANT, expiry.toInstant().toString()),
                access.requireRead(customerRequest()));
        assertEquals("FORBIDDEN", assertThrows(ContractException.class, () -> access.requireRead(customerRequest())).code());
    }

    private static MockHttpServletRequest customerRequest() {
        var request = new MockHttpServletRequest();
        request.addHeader("Origin", CLIENT_ORIGIN);
        request.setCookies(new Cookie(AccountAuthService.Realm.CUSTOMER.cookie, TOKEN));
        return request;
    }
}
