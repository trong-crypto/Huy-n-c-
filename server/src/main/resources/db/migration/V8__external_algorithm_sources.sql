-- Versioned external algorithms are not PDF book pages; keep their URLs/hashes separately.
CREATE TABLE external_sources (
    source_id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    version TEXT NOT NULL CHECK (length(trim(version)) > 0),
    section TEXT NOT NULL CHECK (length(trim(section)) > 0),
    url TEXT NOT NULL CHECK (url LIKE 'https://%'),
    sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$')
);
ALTER TABLE calculation_rules
    ADD COLUMN external_source_id TEXT REFERENCES external_sources(source_id),
    DROP CONSTRAINT calculation_rules_check,
    ADD CONSTRAINT calculation_rules_verified_source CHECK (
        verification_status <> 'VERIFIED' OR source_section_id IS NOT NULL OR external_source_id IS NOT NULL),
    ADD CONSTRAINT calculation_rules_one_source_kind CHECK (
        source_section_id IS NULL OR external_source_id IS NULL);
