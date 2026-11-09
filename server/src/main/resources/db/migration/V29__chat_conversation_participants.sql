CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY,
    user_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    consultant_account_id UUID NOT NULL REFERENCES consultant_profiles(account_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chat_conversations_distinct_participants CHECK (user_account_id <> consultant_account_id)
);

CREATE INDEX ix_chat_conversations_user_created
    ON chat_conversations (user_account_id, created_at DESC, id DESC);
CREATE INDEX ix_chat_conversations_consultant_created
    ON chat_conversations (consultant_account_id, created_at DESC, id DESC);
