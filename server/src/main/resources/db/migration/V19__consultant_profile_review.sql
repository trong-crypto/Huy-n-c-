ALTER TABLE consultant_profiles
    ADD COLUMN review_version INTEGER NOT NULL DEFAULT 1 CHECK (review_version > 0),
    ADD COLUMN summary VARCHAR(500) CHECK (length(btrim(summary, E' \t\r\n')) > 0),
    ADD COLUMN submitted_by UUID REFERENCES accounts(id),
    ADD COLUMN submitted_at TIMESTAMPTZ,
    ADD COLUMN rejection_reason VARCHAR(500) CHECK (length(btrim(rejection_reason, E' \t\r\n')) > 0),
    ADD CONSTRAINT consultant_profile_submission_metadata CHECK (
        (summary IS NULL AND submitted_by IS NULL AND submitted_at IS NULL)
        OR (summary IS NOT NULL AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL)
    ),
    ADD CHECK (submitted_by <> account_id);

-- Preserve any previously rejected V18 profile that predates reason capture.
ALTER TABLE consultant_profiles ADD CONSTRAINT consultant_profile_rejection_reason
    CHECK ((review_status = 'REJECTED') = (rejection_reason IS NOT NULL)) NOT VALID;
