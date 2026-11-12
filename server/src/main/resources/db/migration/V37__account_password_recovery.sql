CREATE TABLE account_password_recovery (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    issued_by UUID NOT NULL REFERENCES accounts(id),
    token_hash CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CHECK (expires_at > issued_at),
    CHECK (used_at IS NULL OR used_at >= issued_at),
    CHECK (revoked_at IS NULL OR revoked_at >= issued_at)
);

CREATE INDEX ix_account_password_recovery_account ON account_password_recovery(account_id);
