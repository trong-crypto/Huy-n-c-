CREATE TABLE cms_method_guides (
    method_code VARCHAR(16) PRIMARY KEY CHECK (method_code IN ('TIME', 'OBJECT_COUNT', 'LINES', 'TAM_THE')),
    version INTEGER NOT NULL CHECK (version > 0),
    working_revision INTEGER,
    working_status VARCHAR(16) CHECK (working_status IN ('DRAFT', 'PENDING_REVIEW')),
    published_revision INTEGER,
    published_at TIMESTAMPTZ,
    visible BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT cms_guides_working_pair CHECK ((working_revision IS NULL) = (working_status IS NULL)),
    CONSTRAINT cms_guides_published_pair CHECK ((published_revision IS NULL) = (published_at IS NULL)),
    CONSTRAINT cms_guides_visible_has_publication CHECK (NOT visible OR published_revision IS NOT NULL),
    CONSTRAINT cms_guides_has_revision CHECK (working_revision IS NOT NULL OR published_revision IS NOT NULL),
    CONSTRAINT cms_guides_distinct_revisions CHECK (working_revision IS DISTINCT FROM published_revision)
);

CREATE TABLE cms_method_guide_revisions (
    method_code VARCHAR(16) NOT NULL REFERENCES cms_method_guides(method_code),
    revision INTEGER NOT NULL CHECK (revision > 0),
    title VARCHAR(120) NOT NULL CHECK (length(btrim(title, E' \t\r\n')) > 0),
    body TEXT NOT NULL CHECK (length(body) <= 6000 AND length(btrim(body, E' \t\r\n')) > 0),
    editor_note VARCHAR(500),
    created_by UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (method_code, revision)
);

-- These references are checked at commit so a guide and its first revision can be created together.
ALTER TABLE cms_method_guides
    ADD CONSTRAINT cms_guides_working_revision_fk FOREIGN KEY (method_code, working_revision)
        REFERENCES cms_method_guide_revisions(method_code, revision) DEFERRABLE INITIALLY DEFERRED,
    ADD CONSTRAINT cms_guides_published_revision_fk FOREIGN KEY (method_code, published_revision)
        REFERENCES cms_method_guide_revisions(method_code, revision) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE cms_method_guide_events (
    method_code VARCHAR(16) NOT NULL REFERENCES cms_method_guides(method_code),
    version INTEGER NOT NULL CHECK (version > 0),
    revision INTEGER NOT NULL,
    action VARCHAR(24) NOT NULL CHECK (action IN ('CREATE', 'SAVE_DRAFT', 'SUBMIT_REVIEW', 'RETURN_TO_DRAFT',
        'PUBLISH', 'SHOW', 'HIDE')),
    actor_id UUID NOT NULL REFERENCES accounts(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(500),
    PRIMARY KEY (method_code, version),
    FOREIGN KEY (method_code, revision) REFERENCES cms_method_guide_revisions(method_code, revision),
    CONSTRAINT cms_guide_event_reason CHECK ((action = 'RETURN_TO_DRAFT') = (reason IS NOT NULL)
        AND (reason IS NULL OR length(btrim(reason, E' \t\r\n')) > 0))
);

CREATE FUNCTION cms_reject_guide_history_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'CMS revision and event rows are append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER cms_guide_revisions_append_only
    BEFORE UPDATE OR DELETE ON cms_method_guide_revisions
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();

CREATE TRIGGER cms_guide_events_append_only
    BEFORE UPDATE OR DELETE ON cms_method_guide_events
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();
