-- Keep table and passage locations/labels separately; no approvals in migrations.
ALTER TABLE tam_the_lookup_entries
    ADD COLUMN content_source_section_id BIGINT REFERENCES source_sections(id),
    ADD COLUMN source_table_label TEXT,
    ADD COLUMN source_content_heading TEXT,
    ADD CONSTRAINT ck_lookup_content_provenance CHECK (
        (content_source_section_id IS NULL AND source_table_label IS NULL AND source_content_heading IS NULL)
        OR (content_source_section_id IS NOT NULL
            AND source_table_label IS NOT NULL AND length(trim(source_table_label)) > 0
            AND source_content_heading IS NOT NULL AND length(trim(source_content_heading)) > 0
            AND description IS NOT NULL AND length(trim(description)) > 0)
    );
