CREATE TABLE consultant_profiles (
    account_id UUID PRIMARY KEY REFERENCES accounts(id),
    review_status VARCHAR(16) NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK (review_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES accounts(id),
    reviewed_at TIMESTAMPTZ,
    CONSTRAINT consultant_profile_review_metadata CHECK (
        (review_status = 'PENDING_REVIEW' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR (review_status IN ('APPROVED', 'REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CHECK (reviewed_by <> account_id)
);

CREATE TABLE admin_account_role_events (
    account_id UUID NOT NULL REFERENCES accounts(id),
    version INTEGER NOT NULL CHECK (version > 1),
    actor_id UUID NOT NULL REFERENCES accounts(id),
    previous_role VARCHAR(16) NOT NULL CHECK (previous_role IN ('USER', 'CONSULTANT')),
    role VARCHAR(16) NOT NULL CHECK (role IN ('USER', 'CONSULTANT')),
    revoked_sessions INTEGER NOT NULL CHECK (revoked_sessions >= 0),
    occurred_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (account_id, version),
    CHECK (previous_role <> role),
    CHECK (actor_id <> account_id)
);
