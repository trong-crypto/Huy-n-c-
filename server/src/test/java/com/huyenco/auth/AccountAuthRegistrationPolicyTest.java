package com.huyenco.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huyenco.auth.AccountAuthService.Account;
import com.huyenco.auth.AccountAuthService.Issued;
import com.huyenco.auth.AccountAuthService.Realm;
import com.huyenco.auth.AccountAuthService.Registration;
import com.huyenco.auth.AccountAuthService.Session;
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

class AccountAuthRegistrationPolicyTest {
    private static final String ORIGIN = "http://127.0.0.1:18118";
    private static final String IDENTIFIER = "policy-fixture";
    private final ObjectMapper json = new ObjectMapper();
    private AccountAuthService auth;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        auth = mock(AccountAuthService.class);
        var limits = new AuthAttemptLimits(Clock.systemUTC(), 50, 50, 50);
        mvc = MockMvcBuilders.standaloneSetup(
                new AccountAuthController(auth, limits, json, new AccountRequestGuards(ORIGIN),
                        mock(ChatSessionAccess.class), false))
                .build();
    }

    @ParameterizedTest
    @ValueSource(ints = {7, 129})
    void rejectsPasswordOutsideRegistrationBounds(int length) throws Exception {
        mvc.perform(register("🔑".repeat(length)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        verifyNoInteractions(auth);
    }

    @ParameterizedTest
    @ValueSource(ints = {8, 128})
    void acceptsBoundaryAndPassesExactPasswordToService(int length) throws Exception {
        String password = " " + "🔑".repeat(length - 2) + " ";
        var account = new Account(UUID.randomUUID(), "Policy fixture", "USER");
        when(auth.register("Policy fixture", IDENTIFIER, password)).thenReturn(new Registration(account));

        mvc.perform(register(password))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.account.id").value(account.id().toString()));
        verify(auth).register("Policy fixture", IDENTIFIER, password);
    }

    @Test
    void preservesLeadingZeroInNumericPassword() throws Exception {
        String password = "01234567";
        var account = new Account(UUID.randomUUID(), "Policy fixture", "USER");
        when(auth.register("Policy fixture", IDENTIFIER, password)).thenReturn(new Registration(account));
        mvc.perform(register(password)).andExpect(status().isCreated());
        verify(auth).register("Policy fixture", IDENTIFIER, password);
    }

    @Test
    void keepsExistingPasswordAndAdminRealmLogin() throws Exception {
        String existingPassword = " existing password ";
        for (var realm : Realm.values()) {
            String role = realm == Realm.ADMIN ? "ADMIN" : "USER";
            var account = new Account(UUID.randomUUID(), "Policy fixture", role);
            var session = new Session(account, "2030-01-01T00:00:00Z", "csrf-fixture");
            when(auth.login(realm, IDENTIFIER, existingPassword, null))
                    .thenReturn(new Issued("t".repeat(43), session));
            String route = realm == Realm.ADMIN ? "/admin/login" : "/login";
            mvc.perform(authPost(route, Map.of("identifier", IDENTIFIER, "password", existingPassword)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.account.role").value(role))
                    .andExpect(cookie().exists(realm.cookie));
        }
    }

    @Test
    void wrongPasswordIsStillAnAuthenticationError() throws Exception {
        when(auth.login(Realm.CUSTOMER, IDENTIFIER, "wrong", null))
                .thenThrow(new AuthFailure(401, "INVALID_CREDENTIALS", "Invalid credentials"));
        mvc.perform(authPost("/login", Map.of("identifier", IDENTIFIER, "password", "wrong")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    private MockHttpServletRequestBuilder register(String password) throws Exception {
        return authPost("/register", Map.of("displayName", "Policy fixture",
                "identifier", IDENTIFIER, "password", password));
    }

    private MockHttpServletRequestBuilder authPost(String route, Map<String, String> payload) throws Exception {
        return post("/api/v1/auth" + route).header("Origin", ORIGIN).header("X-HuyenCo-Request", "1")
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(payload));
    }
}
