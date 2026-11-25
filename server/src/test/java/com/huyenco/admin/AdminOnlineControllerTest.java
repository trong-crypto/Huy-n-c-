package com.huyenco.admin;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.huyenco.auth.AdminRequestAccess;
import com.huyenco.auth.ChatSessionAccess.Role;
import com.huyenco.common.exception.ContractException;
import com.huyenco.websocket.ChatSocketSecurity;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AdminOnlineControllerTest {
    @Test
    void returnsTheCompleteEnvelopeExpectedByTheClient() throws Exception {
        var access = mock(AdminRequestAccess.class);
        var sockets = mock(ChatSocketSecurity.class);
        when(sockets.onlineAccounts(Role.USER)).thenReturn(3L);
        when(sockets.onlineAccounts(Role.CONSULTANT)).thenReturn(1L);
        var mvc = MockMvcBuilders.standaloneSetup(new AdminOnlineController(access, sockets)).build();
        mvc.perform(get("/api/v1/admin/metrics/online")).andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"COMPLETED\",\"data\":{\"users\":3,\"consultants\":1},\"error\":null}"));
    }

    @Test
    void refusesUnauthenticatedRequestsWithAValidErrorEnvelope() throws Exception {
        var access = mock(AdminRequestAccess.class);
        when(access.require(any(), eq(false))).thenThrow(new ContractException("INVALID_SESSION", "Session required"));
        var sockets = mock(ChatSocketSecurity.class);
        var mvc = MockMvcBuilders.standaloneSetup(new AdminOnlineController(access, sockets)).build();
        mvc.perform(get("/api/v1/admin/metrics/online")).andExpect(status().isUnauthorized())
                .andExpect(content().json("{\"status\":\"FAILED\",\"data\":null,\"error\":{\"code\":\"INVALID_SESSION\",\"ruleCode\":null,\"reason\":null}}"));
        verifyNoInteractions(sockets);
    }
}
