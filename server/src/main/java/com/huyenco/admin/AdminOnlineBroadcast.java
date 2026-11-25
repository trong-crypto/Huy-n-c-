package com.huyenco.admin;

import com.huyenco.auth.ChatSessionAccess.Role;
import com.huyenco.websocket.ChatSocketSecurity;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
class AdminOnlineBroadcast {
    private final ChatSocketSecurity sockets;
    private final SimpMessagingTemplate broker;
    private long previousUsers = -1;
    private long previousConsultants = -1;

    AdminOnlineBroadcast(ChatSocketSecurity sockets, SimpMessagingTemplate broker) {
        this.sockets = sockets;
        this.broker = broker;
    }

    @Scheduled(fixedDelay = 1000)
    void publishChanges() {
        long users = sockets.onlineAccounts(Role.USER);
        long consultants = sockets.onlineAccounts(Role.CONSULTANT);
        if (users == previousUsers && consultants == previousConsultants) return;
        try {
            broker.convertAndSend(ChatSocketSecurity.ADMIN_QUEUE, new Notice("ONLINE_COUNTS", users, consultants));
            previousUsers = users;
            previousConsultants = consultants;
        } catch (MessagingException ignored) {
            // Retry the current counts at the next scheduled check.
        }
    }

    record Notice(String type, long users, long consultants) {}
}
