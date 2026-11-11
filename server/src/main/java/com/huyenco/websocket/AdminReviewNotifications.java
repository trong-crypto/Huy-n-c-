package com.huyenco.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class AdminReviewNotifications {
    private static final Logger LOG = LoggerFactory.getLogger(AdminReviewNotifications.class);
    private final SimpMessagingTemplate broker;

    public enum Area { WEBSITE, METHOD_GUIDE, SOURCE, NAME_GLOSS, INTERPRETATION }

    public AdminReviewNotifications(SimpMessagingTemplate broker) {
        this.broker = broker;
    }

    public void submitted(Area area) {
        try {
            broker.convertAndSend(ChatSocketSecurity.ADMIN_QUEUE, new Notice("REVIEW_PENDING", area));
        } catch (MessagingException failure) {
            LOG.warn("Admin review notification could not be delivered for {}", area);
        }
    }

    record Notice(String type, Area area) {}
}
