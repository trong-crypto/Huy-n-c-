package com.huyenco.chat;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

import com.huyenco.auth.ChatSessionAccess;
import com.huyenco.auth.ChatSessionAccess.SocketIdentity;
import com.huyenco.common.exception.ContractException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class ChatReadPositionsTest {
    @Test
    void rejectsReadReceiptFromSomeoneOutsideTheRoom() {
        var db = mock(JdbcTemplate.class);
        var sessions = mock(ChatSessionAccess.class);
        var rooms = mock(ChatRoomAccess.class);
        var identity = mock(SocketIdentity.class);
        UUID roomId = UUID.randomUUID();
        when(rooms.requireSocketParticipant(identity, roomId))
                .thenThrow(new ContractException("NOT_FOUND", "Room not found"));
        var positions = new ChatReadPositions(db, sessions, rooms);
        assertThrows(ContractException.class, () -> positions.markRead(identity, roomId, 10));
        verifyNoInteractions(db);
    }

    @Test
    void rejectsUnreadSnapshotAfterSessionRevocation() {
        var db = mock(JdbcTemplate.class);
        var sessions = mock(ChatSessionAccess.class);
        var identity = mock(SocketIdentity.class);
        when(sessions.requireSocket(identity))
                .thenThrow(new ContractException("INVALID_SESSION", "Session expired"));
        var positions = new ChatReadPositions(db, sessions, mock(ChatRoomAccess.class));
        assertThrows(ContractException.class, () -> positions.unread(identity));
        verifyNoInteractions(db);
    }
}
