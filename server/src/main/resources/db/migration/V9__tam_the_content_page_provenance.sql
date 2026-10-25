-- A passage can continue onto another PDF page. The existing content source
-- remains its first page; this relation records every page in reading order.
CREATE TABLE tam_the_lookup_source_pages (
    entry_id BIGINT NOT NULL REFERENCES tam_the_lookup_entries(id),
    page_order SMALLINT NOT NULL CHECK (page_order > 0),
    source_section_id BIGINT NOT NULL REFERENCES source_sections(id),
    PRIMARY KEY (entry_id, page_order),
    UNIQUE (entry_id, source_section_id)
);
CREATE INDEX idx_tam_the_lookup_source_pages_source
    ON tam_the_lookup_source_pages(source_section_id);
