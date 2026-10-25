-- E01: reviewable short *name glosses*; does not approve line readings or predictions.
ALTER TABLE interpretations
    ADD COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
        CHECK (verification_status IN ('DRAFT','SOURCE_LOCATED','SOURCE_AMBIGUOUS',
                                      'BLOCKED_SOURCE_CONFLICT','VERIFIED')),
    ADD COLUMN editor VARCHAR(128),
    ADD COLUMN reviewer VARCHAR(128),
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN verification_note TEXT,
    ADD COLUMN source_order SMALLINT CHECK (source_order BETWEEN 1 AND 64),
    ADD COLUMN printed_source_label TEXT,
    ADD CONSTRAINT ck_interpretations_review_provenance CHECK (
        verification_status <> 'VERIFIED' OR
        (reviewer IS NOT NULL AND reviewed_at IS NOT NULL
         AND NULLIF(btrim(verification_note),'') IS NOT NULL)
    ),
    ADD CONSTRAINT ck_interpretations_gloss_scope CHECK (
        category <> 'NAME_GLOSS' OR
        (hexagram_code IS NOT NULL AND rule_id IS NULL AND source_order IS NOT NULL
         AND NULLIF(btrim(printed_source_label),'') IS NOT NULL)
    );

-- No other interpretation category is constrained to be one-per-hexagram.
CREATE UNIQUE INDEX uq_interpretations_name_gloss_code
    ON interpretations (hexagram_code) WHERE category = 'NAME_GLOSS';
