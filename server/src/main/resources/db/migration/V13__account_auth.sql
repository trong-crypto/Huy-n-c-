CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    identifier_normalized VARCHAR(254) COLLATE "C" NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('USER', 'ADMIN', 'CONSULTANT')),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED')),
    created_at TIMESTAMPTZ NOT NULL,
    CHECK (identifier_normalized ~ '^[a-z0-9._+%@-]{3,254}$'),
    CHECK (length(btrim(display_name)) > 0),
    CHECK (password_hash LIKE '$argon2id$%')
);

CREATE TABLE account_sessions (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    realm VARCHAR(16) NOT NULL CHECK (realm IN ('CUSTOMER', 'ADMIN')),
    token_hash CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CHECK (expires_at > created_at),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX ix_account_sessions_account ON account_sessions(account_id);
CREATE INDEX ix_account_sessions_expires ON account_sessions(expires_at);
