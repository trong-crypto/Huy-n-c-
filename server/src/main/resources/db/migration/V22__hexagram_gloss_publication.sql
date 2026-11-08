CREATE TABLE cms_hexagram_gloss_events (
    hexagram_code VARCHAR(16) NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    revision INTEGER NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('SUBMIT', 'RETURN', 'PUBLISH')),
    actor_id UUID NOT NULL REFERENCES accounts(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(500),
    printed_source_label VARCHAR(120),
    verification_note VARCHAR(500),
    PRIMARY KEY (hexagram_code, sequence),
    FOREIGN KEY (hexagram_code, revision) REFERENCES cms_hexagram_gloss_draft_revisions(hexagram_code, version),
    CHECK ((action = 'RETURN') = (reason IS NOT NULL)),
    CHECK ((action = 'PUBLISH') = (printed_source_label IS NOT NULL)),
    CHECK ((action = 'PUBLISH') = (verification_note IS NOT NULL)),
    CHECK (btrim(reason) <> '' AND btrim(printed_source_label) <> '' AND btrim(verification_note) <> '')
);

CREATE UNIQUE INDEX uq_hexagram_gloss_publication_revision
    ON cms_hexagram_gloss_events(hexagram_code, revision) WHERE action = 'PUBLISH';

CREATE TRIGGER cms_hexagram_gloss_events_append_only
    BEFORE UPDATE OR DELETE ON cms_hexagram_gloss_events
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();
