ALTER TABLE chat_conversations
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN started_at TIMESTAMPTZ,
    ADD COLUMN ended_at TIMESTAMPTZ,
    ADD COLUMN end_reason VARCHAR(16),
    ADD COLUMN ended_by_account_id UUID,
    ADD CONSTRAINT chat_conversations_lifecycle_check CHECK (
        (status = 'PENDING' AND started_at IS NULL AND ended_at IS NULL
            AND end_reason IS NULL AND ended_by_account_id IS NULL)
        OR (status = 'ACTIVE' AND started_at IS NOT NULL AND started_at >= created_at
            AND ended_at IS NULL AND end_reason IS NULL AND ended_by_account_id IS NULL)
        OR (status = 'ENDED' AND ended_at IS NOT NULL AND ended_at >= created_at
            AND end_reason IS NOT NULL AND ended_by_account_id IS NOT NULL AND (
                (end_reason = 'DECLINED' AND started_at IS NULL AND ended_by_account_id = consultant_account_id)
                OR (end_reason = 'CANCELLED' AND started_at IS NULL AND ended_by_account_id = user_account_id)
                OR (end_reason = 'COMPLETED' AND started_at IS NOT NULL
                    AND started_at >= created_at AND ended_at >= started_at
                    AND ended_by_account_id IN (user_account_id, consultant_account_id))
            ))
    );
