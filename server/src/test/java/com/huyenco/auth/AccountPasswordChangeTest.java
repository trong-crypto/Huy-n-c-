package com.huyenco.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.auth.AccountAuthService.Account;
import com.huyenco.auth.AccountAuthService.Realm;
import com.huyenco.auth.AccountAuthService.Session;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AccountPasswordChangeTest {
    private static final String ORIGIN = "http://127.0.0.1:18118";
    private static final String TOKEN = "t".repeat(43);
    private static final String CURRENT = " old ";
    private static final String NEW = " 🔑🔑🔑🔑🔑🔑 ";
    private final ObjectMapper json = new ObjectMapper();
    private final AccountAuthService auth = mock(AccountAuthService.class);
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new AccountAuthController(auth,
                new AuthAttemptLimits(Clock.systemUTC(), 5, 1, 5), json, new AccountRequestGuards(ORIGIN),
                mock(ChatSessionAccess.class), false)).build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"USER", "CONSULTANT", "ADMIN"})
    void checksRealmAndCsrfAndClearsOnlyItsCookie(String role) throws Exception {
        Realm realm = "ADMIN".equals(role) ? Realm.ADMIN : Realm.CUSTOMER;
        Session session = session(realm, role);
        mvc.perform(request(realm, NEW))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge(realm.cookie, 0))
                .andExpect(cookie().httpOnly(realm.cookie, true))
                .andExpect(cookie().doesNotExist(realm == Realm.ADMIN ? Realm.CUSTOMER.cookie : Realm.ADMIN.cookie));
        var order = inOrder(auth);
        order.verify(auth).requireSession(realm, TOKEN);
        order.verify(auth).checkCsrf(session, "valid-csrf");
        order.verify(auth).changePassword(realm, TOKEN, session.account().id(), CURRENT, NEW);
    }

    @ParameterizedTest
    @ValueSource(ints = {7, 129})
    void rejectsOutOfRangeUnicodeBeforeCallingAuth(int length) throws Exception {
        mvc.perform(request(Realm.CUSTOMER, "🔑".repeat(length)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        verifyNoInteractions(auth);
    }

    @Test
    void rejectsWrongRealmAndWrongCsrfWithoutUpdatingPassword() throws Exception {
        when(auth.requireSession(Realm.ADMIN, null)).thenThrow(AuthFailure.session());
        mvc.perform(post("/api/v1/auth/admin/password/change").cookie(new Cookie(Realm.CUSTOMER.cookie, TOKEN))
                        .header("Origin", ORIGIN).header("X-HuyenCo-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON).content(body(NEW)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("INVALID_SESSION"));
        Session session = session(Realm.CUSTOMER, "USER");
        doThrow(AuthFailure.csrf()).when(auth).checkCsrf(session, "valid-csrf");
        mvc.perform(request(Realm.CUSTOMER, NEW))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("CSRF_REJECTED"));
        verify(auth, never()).changePassword(any(), any(), any(), any(), any());
    }

    @Test
    void rateLimitsRepeatedVerificationForTheSameAccount() throws Exception {
        Session session = session(Realm.CUSTOMER, "USER");
        doThrow(new AuthFailure(401, "INVALID_CREDENTIALS", "Invalid credentials"))
                .when(auth).changePassword(Realm.CUSTOMER, TOKEN, session.account().id(), CURRENT, NEW);
        mvc.perform(request(Realm.CUSTOMER, NEW))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"))
                .andExpect(header().doesNotExist("Set-Cookie"));
        mvc.perform(request(Realm.CUSTOMER, NEW)).andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
        verify(auth).changePassword(Realm.CUSTOMER, TOKEN, session.account().id(), CURRENT, NEW);
    }

    private Session session(Realm realm, String role) {
        var result = new Session(new Account(UUID.randomUUID(), "Fixture", role), "2030-01-01T00:00:00Z", "valid-csrf");
        when(auth.requireSession(realm, TOKEN)).thenReturn(result);
        return result;
    }

    private MockHttpServletRequestBuilder request(Realm realm, String password) throws Exception {
        return post("/api/v1/auth" + (realm == Realm.ADMIN ? "/admin" : "") + "/password/change")
                .header("Origin", ORIGIN).header("X-HuyenCo-Request", "1").header("X-CSRF-Token", "valid-csrf")
                .cookie(new Cookie(realm.cookie, TOKEN)).contentType(MediaType.APPLICATION_JSON).content(body(password));
    }

    private byte[] body(String password) throws Exception {
        return json.writeValueAsBytes(Map.of("currentPassword", CURRENT, "newPassword", password));
    }
}
