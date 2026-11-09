ALTER TABLE chat_conversations
    ADD COLUMN create_request_id UUID,
    ADD CONSTRAINT chat_conversations_user_request_unique UNIQUE (user_account_id, create_request_id);
