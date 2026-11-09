package com.huyenco.chat;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.common.exception.ContractException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ChatConsultantControllerTest {
    private static final String DIRECTORY = "/api/v1/chat/consultants";
    private static final UUID PROFILE_ID = UUID.fromString("550e8400-e29b-41d4-a716-446655440001");
    private final ChatSessionAccess sessions = mock(ChatSessionAccess.class);
    private final ChatConsultantProfiles profiles = mock(ChatConsultantProfiles.class);
    private final MockMvc mvc =
            MockMvcBuilders.standaloneSetup(new ChatConsultantController(sessions, profiles)).build();

    @Test
    void successReturnsOnlyPublicFieldsIncludingNullSummary() throws Exception {
        authenticate(ChatSessionAccess.Role.USER);
        var profile = new ChatConsultantProfiles.PublicProfile(PROFILE_ID, "Tư vấn viên", null);
        when(profiles.findEligible(PROFILE_ID)).thenReturn(Optional.of(profile));
        when(profiles.listEligible(0, 20)).thenReturn(new ChatConsultantProfiles.Page(List.of(profile), 0, 20, 1, 1));
        String expectedProfile = """
                {"consultantId":"550e8400-e29b-41d4-a716-446655440001","displayName":"Tư vấn viên","summary":null}
                """;
        mvc.perform(get(DIRECTORY + "/" + PROFILE_ID))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("{\"data\":" + expectedProfile + "}"))
                .andExpect(jsonPath("$.data.length()").value(3));
        mvc.perform(get(DIRECTORY)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].length()").value(3));
    }

    @Test
    void invalidOrRepeatedInputsNeverQueryDirectory() throws Exception {
        authenticate(ChatSessionAccess.Role.USER);
        mvc.perform(get(DIRECTORY).param("size", "20", "21"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        mvc.perform(get(DIRECTORY).param("page", "2147483648")).andExpect(status().isBadRequest());
        mvc.perform(get(DIRECTORY + "/1-1-1-1-1")).andExpect(status().isBadRequest());
        verifyNoInteractions(profiles);
    }

    @Test
    void noSessionOrWrongRoleNeverQueriesDirectory() throws Exception {
        authenticate(ChatSessionAccess.Role.CONSULTANT);
        mvc.perform(get(DIRECTORY + "/" + PROFILE_ID))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        when(sessions.requireRead(any())).thenThrow(new ContractException("INVALID_SESSION", "Invalid session"));
        mvc.perform(get(DIRECTORY))
                .andExpect(status().isUnauthorized()).andExpect(header().string("Cache-Control", "no-store"));
        verifyNoInteractions(profiles);
    }

    @Test
    void absentOrHiddenProfileUsesGenericNotFound() throws Exception {
        authenticate(ChatSessionAccess.Role.USER);
        when(profiles.findEligible(PROFILE_ID)).thenReturn(Optional.empty());
        mvc.perform(get(DIRECTORY + "/" + PROFILE_ID))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    private void authenticate(ChatSessionAccess.Role role) {
        when(sessions.requireRead(any())).thenReturn(actor(role));
    }

    private static ChatSessionAccess.Actor actor(ChatSessionAccess.Role role) {
        return new ChatSessionAccess.Actor(UUID.randomUUID(), role, "2026-11-10T08:00:00Z");
    }
}
