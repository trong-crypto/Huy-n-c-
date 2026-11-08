CREATE TABLE cms_website_sections (
    section_code VARCHAR(24) PRIMARY KEY CHECK (section_code IN ('INTRODUCTION', 'USAGE_GUIDE')),
    version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    working_revision INTEGER,
    working_status VARCHAR(16) CHECK (working_status IN ('DRAFT', 'PENDING_REVIEW')),
    published_revision INTEGER,
    published_at TIMESTAMPTZ,
    CHECK ((working_revision IS NULL) = (working_status IS NULL)),
    CHECK ((published_revision IS NULL) = (published_at IS NULL)),
    CHECK ((version = 0) = (working_revision IS NULL AND published_revision IS NULL)),
    CHECK (working_revision IS NULL OR working_revision <= version),
    CHECK (published_revision IS NULL OR published_revision <= version),
    CHECK (working_revision IS NULL OR published_revision IS NULL OR working_revision > published_revision)
);

CREATE TABLE cms_website_revisions (
    section_code VARCHAR(24) NOT NULL REFERENCES cms_website_sections(section_code),
    revision INTEGER NOT NULL CHECK (revision > 0),
    title VARCHAR(120) NOT NULL CHECK (btrim(title) <> ''),
    body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 6000 AND btrim(body) <> ''),
    editor_note VARCHAR(500),
    created_by UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (section_code, revision)
);

ALTER TABLE cms_website_sections
    ADD FOREIGN KEY (section_code, working_revision) REFERENCES cms_website_revisions(section_code, revision),
    ADD FOREIGN KEY (section_code, published_revision) REFERENCES cms_website_revisions(section_code, revision);

CREATE TABLE cms_website_events (
    section_code VARCHAR(24) NOT NULL,
    version INTEGER NOT NULL CHECK (version >= revision),
    revision INTEGER NOT NULL,
    action VARCHAR(24) NOT NULL CHECK (action IN ('SAVE_DRAFT', 'SUBMIT_REVIEW', 'RETURN_TO_DRAFT', 'PUBLISH')),
    actor_id UUID NOT NULL REFERENCES accounts(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(500),
    CHECK ((action = 'RETURN_TO_DRAFT') = (reason IS NOT NULL)),
    PRIMARY KEY (section_code, version),
    FOREIGN KEY (section_code, revision) REFERENCES cms_website_revisions(section_code, revision)
);

CREATE TRIGGER cms_website_revisions_append_only
    BEFORE UPDATE OR DELETE ON cms_website_revisions
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();

CREATE TRIGGER cms_website_events_append_only
    BEFORE UPDATE OR DELETE ON cms_website_events
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();

INSERT INTO cms_website_sections(section_code) VALUES ('INTRODUCTION'), ('USAGE_GUIDE');
