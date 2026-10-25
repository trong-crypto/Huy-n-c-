-- H01: opaque anonymous session tokens are hashed before storage; snapshots are server-produced.
CREATE TABLE anonymous_sessions (
    owner_id UUID PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CHECK (expires_at > created_at)
);

CREATE TABLE interpretation_history (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES anonymous_sessions(owner_id) ON DELETE CASCADE,
    calculation_request_id UUID NOT NULL,
    calculation_type VARCHAR(16) NOT NULL CHECK (calculation_type IN ('MAI_HOA','TAM_THE')),
    title VARCHAR(100) NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ NOT NULL,
    rule_basis VARCHAR(32) NOT NULL CHECK (rule_basis IN ('SOURCE_VERIFIED','TEAM_DECISION')),
    result_snapshot JSONB NOT NULL CHECK (jsonb_typeof(result_snapshot)='object'),
    UNIQUE (owner_id, calculation_request_id)
);
CREATE INDEX ix_history_owner_created ON interpretation_history(owner_id, created_at DESC, id DESC);
CREATE INDEX ix_sessions_expires ON anonymous_sessions(expires_at);
