package com.huyenco.admin;

import static org.mockito.Mockito.*;
import com.huyenco.auth.ChatSessionAccess.Role;
import com.huyenco.websocket.ChatSocketSecurity;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class AdminOnlineBroadcastTest {
    @Test
    void publishesOnlyWhenCountsChange() {
        var sockets = mock(ChatSocketSecurity.class);
        var broker = mock(SimpMessagingTemplate.class);
        var publisher = new AdminOnlineBroadcast(sockets, broker);
        when(sockets.onlineAccounts(Role.USER)).thenReturn(1L);
        when(sockets.onlineAccounts(Role.CONSULTANT)).thenReturn(2L);
        publisher.publishChanges();
        publisher.publishChanges();
        verify(broker, times(1)).convertAndSend(ChatSocketSecurity.ADMIN_QUEUE,
                new AdminOnlineBroadcast.Notice("ONLINE_COUNTS", 1, 2));
        when(sockets.onlineAccounts(Role.USER)).thenReturn(0L);
        publisher.publishChanges();
        verify(broker).convertAndSend(ChatSocketSecurity.ADMIN_QUEUE,
                new AdminOnlineBroadcast.Notice("ONLINE_COUNTS", 0, 2));
    }
}
