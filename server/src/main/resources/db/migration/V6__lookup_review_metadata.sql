-- Per-entry review provenance; no source approvals are performed by this migration.
ALTER TABLE tam_the_lookup_entries
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN verification_note TEXT,
    ADD CONSTRAINT ck_tam_the_lookup_review_metadata
        CHECK (verification_status <> 'VERIFIED' OR (
            reviewer IS NOT NULL AND length(trim(reviewer)) > 0
            AND reviewed_at IS NOT NULL
            AND verification_note IS NOT NULL AND length(trim(verification_note)) > 0
        ));
