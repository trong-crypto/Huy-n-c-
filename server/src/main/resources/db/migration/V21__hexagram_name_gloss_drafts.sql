CREATE TABLE cms_hexagram_gloss_draft_revisions (
    hexagram_code VARCHAR(16) NOT NULL REFERENCES hexagrams(code),
    version INTEGER NOT NULL CHECK (version > 0),
    content VARCHAR(500) NOT NULL CHECK (length(btrim(content, E' \t\r\n')) > 0),
    source_section_id BIGINT NOT NULL REFERENCES source_sections(id),
    source_snapshot JSONB NOT NULL CHECK (jsonb_typeof(source_snapshot) = 'object'),
    created_by UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (hexagram_code, version)
);

CREATE TRIGGER cms_hexagram_gloss_drafts_append_only
    BEFORE UPDATE OR DELETE ON cms_hexagram_gloss_draft_revisions
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();
