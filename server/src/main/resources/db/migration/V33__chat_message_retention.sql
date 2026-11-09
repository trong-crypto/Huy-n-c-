CREATE INDEX ix_chat_messages_retention ON chat_messages (created_at, id);

CREATE TABLE chat_expired_message_keys (
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    client_message_id UUID NOT NULL,
    PRIMARY KEY (conversation_id, sender_account_id, client_message_id)
);
