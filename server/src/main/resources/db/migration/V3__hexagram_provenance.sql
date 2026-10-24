-- V1/V2 already applied: do not change old migrations.
-- Hexagram structure is derived from 8 trigrams; canonical titles require manual verification.
ALTER TABLE hexagrams
    ADD COLUMN name_kind VARCHAR(32) NOT NULL DEFAULT 'STRUCTURAL_LABEL'
        CHECK (name_kind IN ('STRUCTURAL_LABEL', 'CANONICAL_TITLE')),
    ADD COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
        CHECK (verification_status IN ('DRAFT', 'SOURCE_LOCATED', 'SOURCE_AMBIGUOUS',
                                       'BLOCKED_SOURCE_CONFLICT', 'VERIFIED')),
    ADD COLUMN source_section_id BIGINT REFERENCES source_sections(id),
    ADD COLUMN editor VARCHAR(128),
    ADD COLUMN reviewer VARCHAR(128),
    ADD CONSTRAINT ck_hexagram_verified_source
        CHECK (verification_status <> 'VERIFIED' OR
               (name_kind = 'CANONICAL_TITLE' AND source_section_id IS NOT NULL
                AND reviewer IS NOT NULL));
