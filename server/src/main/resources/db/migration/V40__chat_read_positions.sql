CREATE TABLE chat_read_positions (
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    last_read_sequence bigint NOT NULL DEFAULT 0 CHECK (last_read_sequence >= 0),
    PRIMARY KEY (conversation_id, account_id)
);
