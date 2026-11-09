package com.huyenco.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@Profile("db")
@ConditionalOnProperty(name = "huyenco.auth.enabled", havingValue = "true")
public class ChatMessageRetention {
    static final String CUTOFF = "statement_timestamp() - INTERVAL '720 hours'";
    private static final int BATCH_SIZE = 1000;
    private static final Logger LOG = LoggerFactory.getLogger(ChatMessageRetention.class);
    private final JdbcTemplate db;

    ChatMessageRetention(JdbcTemplate db) {
        this.db = db;
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 60_000)
    void purgeScheduled() {
        try {
            purgeExpired();
        } catch (DataAccessException failure) {
            LOG.warn("Chat retention cleanup failed; the next scheduled run will retry.");
        }
    }

    public int purgeExpired() {
        return db.update("""
                WITH candidates AS (
                    SELECT id FROM chat_messages WHERE created_at <= %s
                    ORDER BY created_at, id LIMIT ? FOR UPDATE SKIP LOCKED
                ), removed AS (
                    DELETE FROM chat_messages m USING candidates c WHERE m.id = c.id
                    RETURNING m.conversation_id, m.sender_account_id, m.client_message_id
                )
                INSERT INTO chat_expired_message_keys (conversation_id, sender_account_id, client_message_id)
                SELECT conversation_id, sender_account_id, client_message_id FROM removed
                ON CONFLICT DO NOTHING
                """.formatted(CUTOFF), BATCH_SIZE);
    }
}
