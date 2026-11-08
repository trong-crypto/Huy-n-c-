ALTER TABLE accounts ADD COLUMN status_version INTEGER NOT NULL DEFAULT 1 CHECK (status_version > 0);

CREATE TABLE admin_account_status_events (
    account_id UUID NOT NULL REFERENCES accounts(id),
    version INTEGER NOT NULL CHECK (version > 1),
    actor_id UUID NOT NULL REFERENCES accounts(id),
    previous_status VARCHAR(16) NOT NULL CHECK (previous_status IN ('ACTIVE', 'LOCKED')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'LOCKED')),
    revoked_sessions INTEGER NOT NULL CHECK (revoked_sessions >= 0),
    occurred_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (account_id, version),
    CHECK (previous_status <> status)
);
