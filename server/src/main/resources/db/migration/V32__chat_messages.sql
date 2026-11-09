ALTER TABLE chat_conversations
    ADD COLUMN last_message_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_message_sequence >= 0);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE RESTRICT,
    sender_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    client_message_id UUID NOT NULL,
    sequence BIGINT NOT NULL CHECK (sequence > 0),
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT chat_messages_room_sequence_unique UNIQUE (conversation_id, sequence),
    CONSTRAINT chat_messages_sender_client_id_unique UNIQUE (conversation_id, sender_account_id, client_message_id)
);
