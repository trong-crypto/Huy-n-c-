CREATE TABLE cms_hexagram_interpretation_sources (
    id VARCHAR(64) PRIMARY KEY,
    hexagram_code VARCHAR(16) NOT NULL REFERENCES hexagrams(code),
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    author TEXT,
    edition TEXT NOT NULL CHECK (btrim(edition) <> ''),
    locator TEXT NOT NULL CHECK (btrim(locator) <> ''),
    url TEXT NOT NULL CHECK (url LIKE 'https://%'),
    reuse_note TEXT NOT NULL CHECK (btrim(reuse_note) <> ''),
    review_status VARCHAR(24) NOT NULL CHECK (review_status IN ('SOURCE_LOCATED', 'VERIFIED'))
);

CREATE INDEX ix_cms_hexagram_interpretation_sources_code
    ON cms_hexagram_interpretation_sources(hexagram_code);

CREATE TABLE cms_hexagram_interpretation_revisions (
    hexagram_code VARCHAR(16) NOT NULL REFERENCES hexagrams(code),
    version INTEGER NOT NULL CHECK (version > 0),
    content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
    source_snapshot JSONB NOT NULL CHECK (jsonb_typeof(source_snapshot) = 'array' AND jsonb_array_length(source_snapshot) > 0),
    created_by UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (hexagram_code, version)
);

CREATE TABLE cms_hexagram_interpretation_events (
    hexagram_code VARCHAR(16) NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    revision INTEGER NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('SUBMIT', 'RETURN', 'PUBLISH')),
    actor_id UUID NOT NULL REFERENCES accounts(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    review_note TEXT CHECK (review_note IS NULL OR btrim(review_note) <> ''),
    PRIMARY KEY (hexagram_code, sequence),
    FOREIGN KEY (hexagram_code, revision) REFERENCES cms_hexagram_interpretation_revisions(hexagram_code, version),
    CHECK ((action = 'SUBMIT') = (review_note IS NULL))
);

CREATE UNIQUE INDEX uq_cms_hexagram_interpretation_publish
    ON cms_hexagram_interpretation_events(hexagram_code, revision) WHERE action = 'PUBLISH';

CREATE FUNCTION cms_hexagram_interpretation_require_reviewer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM cms_hexagram_interpretation_revisions
        WHERE hexagram_code = NEW.hexagram_code AND version = NEW.revision AND created_by = NEW.actor_id
    ) THEN
        RAISE EXCEPTION 'The author cannot publish their revision' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER cms_hexagram_interpretation_independent_review
    BEFORE INSERT ON cms_hexagram_interpretation_events
    FOR EACH ROW WHEN (NEW.action = 'PUBLISH')
    EXECUTE FUNCTION cms_hexagram_interpretation_require_reviewer();

CREATE TABLE cms_hexagram_interpretation_imports (
    hexagram_code VARCHAR(16) NOT NULL,
    revision INTEGER NOT NULL,
    package_sha256 CHAR(64) NOT NULL CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (hexagram_code, revision),
    FOREIGN KEY (hexagram_code, revision) REFERENCES cms_hexagram_interpretation_revisions(hexagram_code, version)
);

CREATE TRIGGER cms_hexagram_interpretation_revisions_append_only
    BEFORE UPDATE OR DELETE ON cms_hexagram_interpretation_revisions
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();

CREATE TRIGGER cms_hexagram_interpretation_events_append_only
    BEFORE UPDATE OR DELETE ON cms_hexagram_interpretation_events
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();

CREATE TRIGGER cms_hexagram_interpretation_imports_append_only
    BEFORE UPDATE OR DELETE ON cms_hexagram_interpretation_imports
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();
