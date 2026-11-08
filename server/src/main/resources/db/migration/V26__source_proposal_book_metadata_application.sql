ALTER TABLE cms_source_proposal_revisions
    ADD COLUMN book_field VARCHAR(16),
    ADD COLUMN book_value VARCHAR(300),
    ADD CONSTRAINT ck_cms_source_proposal_book_change CHECK (
        (book_field IS NULL AND book_value IS NULL)
        OR (source_section_id IS NOT NULL AND book_field IS NOT NULL
            AND book_field IN ('AUTHOR', 'PUBLISHER') AND book_value IS NOT NULL AND btrim(book_value) <> '')
    );

CREATE TABLE cms_source_proposal_applications (
    source_section_id BIGINT NOT NULL,
    revision INTEGER NOT NULL,
    book_id BIGINT NOT NULL REFERENCES source_books(id),
    field VARCHAR(16) NOT NULL CHECK (field IN ('AUTHOR', 'PUBLISHER')),
    before_value TEXT,
    after_value VARCHAR(300) NOT NULL CHECK (btrim(after_value) <> ''),
    applied_by UUID NOT NULL REFERENCES accounts(id),
    applied_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (source_section_id, revision),
    FOREIGN KEY (source_section_id, revision) REFERENCES cms_source_proposal_revisions(source_section_id, version),
    CHECK (before_value IS DISTINCT FROM after_value)
);

CREATE TRIGGER cms_source_proposal_applications_append_only
    BEFORE UPDATE OR DELETE ON cms_source_proposal_applications
    FOR EACH ROW EXECUTE FUNCTION cms_reject_guide_history_change();
