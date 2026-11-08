ALTER TABLE cms_source_proposal_revisions
    ADD CONSTRAINT uq_cms_source_proposal_book_version UNIQUE (source_section_id, version),
    ADD CONSTRAINT uq_cms_source_proposal_external_version UNIQUE (external_source_id, version);

DROP INDEX uq_cms_source_proposal_book_revision;
DROP INDEX uq_cms_source_proposal_external_revision;

CREATE TABLE cms_source_proposal_events (
    source_section_id BIGINT,
    external_source_id TEXT,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    revision INTEGER NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('SUBMIT', 'RETURN', 'APPROVE')),
    actor_id UUID NOT NULL REFERENCES accounts(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    note VARCHAR(500),
    CHECK ((source_section_id IS NULL) <> (external_source_id IS NULL)),
    CHECK ((action = 'SUBMIT' AND note IS NULL) OR
           (action IN ('RETURN', 'APPROVE') AND note IS NOT NULL AND length(btrim(note, E' \t\r\n')) > 0)),
    FOREIGN KEY (source_section_id, revision) REFERENCES cms_source_proposal_revisions(source_section_id, version),
    FOREIGN KEY (external_source_id, revision) REFERENCES cms_source_proposal_revisions(external_source_id, version)
);

CREATE UNIQUE INDEX uq_cms_source_proposal_book_event
    ON cms_source_proposal_events(source_section_id, sequence) WHERE source_section_id IS NOT NULL;
CREATE UNIQUE INDEX uq_cms_source_proposal_external_event
    ON cms_source_proposal_events(external_source_id, sequence) WHERE external_source_id IS NOT NULL;

CREATE TRIGGER cms_source_proposal_events_append_only
    BEFORE UPDATE OR DELETE ON cms_source_proposal_events
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();
