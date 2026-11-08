CREATE TABLE cms_source_proposal_revisions (
    source_section_id BIGINT REFERENCES source_sections(id),
    external_source_id TEXT REFERENCES external_sources(source_id),
    version INTEGER NOT NULL CHECK (version > 0),
    proposal VARCHAR(2000) NOT NULL CHECK (length(btrim(proposal, E' \t\r\n')) > 0),
    reason VARCHAR(500) NOT NULL CHECK (length(btrim(reason, E' \t\r\n')) > 0),
    source_snapshot JSONB NOT NULL CHECK (jsonb_typeof(source_snapshot) = 'object'),
    created_by UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMPTZ NOT NULL,
    CHECK ((source_section_id IS NULL) <> (external_source_id IS NULL))
);

CREATE UNIQUE INDEX uq_cms_source_proposal_book_revision
    ON cms_source_proposal_revisions (source_section_id, version) WHERE source_section_id IS NOT NULL;
CREATE UNIQUE INDEX uq_cms_source_proposal_external_revision
    ON cms_source_proposal_revisions (external_source_id, version) WHERE external_source_id IS NOT NULL;

CREATE TRIGGER cms_source_proposal_revisions_append_only
    BEFORE UPDATE OR DELETE ON cms_source_proposal_revisions
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();
