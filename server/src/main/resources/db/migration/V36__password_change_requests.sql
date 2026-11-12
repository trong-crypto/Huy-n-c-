CREATE TABLE password_change_requests (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    expected_hash_fingerprint CHAR(64),
    replacement_hash TEXT,
    decided_by UUID REFERENCES accounts(id),
    decided_at TIMESTAMPTZ,
    CHECK ((status = 'PENDING' AND expected_hash_fingerprint IS NOT NULL
        AND replacement_hash IS NOT NULL AND replacement_hash LIKE '$argon2id$%'
        AND decided_by IS NULL AND decided_at IS NULL)
        OR (status <> 'PENDING' AND expected_hash_fingerprint IS NULL
        AND replacement_hash IS NULL AND decided_at IS NOT NULL
        AND ((status = 'CANCELLED') = (decided_by IS NULL))))
);

CREATE UNIQUE INDEX ix_password_change_pending_account ON password_change_requests(account_id)
    WHERE status = 'PENDING';
