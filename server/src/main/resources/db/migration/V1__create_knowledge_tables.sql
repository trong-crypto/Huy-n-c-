CREATE TABLE source_books (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    edition TEXT NOT NULL,
    publisher TEXT,
    publication_year INTEGER,
    pdf_page_count INTEGER CHECK (pdf_page_count > 0),
    file_sha256 CHAR(64) UNIQUE,
    UNIQUE (title, edition)
);

CREATE TABLE source_sections (
    id BIGSERIAL PRIMARY KEY,
    source_book_id BIGINT NOT NULL REFERENCES source_books(id),
    section_label TEXT NOT NULL,
    printed_page_label VARCHAR(32),
    pdf_page INTEGER NOT NULL CHECK (pdf_page > 0),
    excerpt TEXT,
    UNIQUE (source_book_id, section_label, pdf_page)
);

CREATE TABLE trigrams (
    code VARCHAR(16) PRIMARY KEY,
    name TEXT NOT NULL,
    heaven_number SMALLINT NOT NULL UNIQUE CHECK (heaven_number BETWEEN 1 AND 8),
    element VARCHAR(8) NOT NULL CHECK (element IN ('KIM', 'MOC', 'THUY', 'HOA', 'THO')),
    lines_bottom_up BOOLEAN[] NOT NULL,
    CHECK (array_length(lines_bottom_up, 1) = 3)
);

CREATE TABLE hexagrams (
    code VARCHAR(16) PRIMARY KEY,
    name TEXT NOT NULL,
    upper_trigram_code VARCHAR(16) NOT NULL REFERENCES trigrams(code),
    lower_trigram_code VARCHAR(16) NOT NULL REFERENCES trigrams(code),
    lines_bottom_up BOOLEAN[] NOT NULL,
    UNIQUE (upper_trigram_code, lower_trigram_code),
    CHECK (array_length(lines_bottom_up, 1) = 6)
);

CREATE TABLE hexagram_lines (
    hexagram_code VARCHAR(16) NOT NULL REFERENCES hexagrams(code),
    line_number SMALLINT NOT NULL CHECK (line_number BETWEEN 1 AND 6),
    is_yang BOOLEAN NOT NULL,
    PRIMARY KEY (hexagram_code, line_number)
);

CREATE TABLE calculation_rules (
    id BIGSERIAL PRIMARY KEY,
    module VARCHAR(16) NOT NULL CHECK (module IN ('MAI_HOA', 'TAM_THE', 'CALENDAR')),
    rule_code VARCHAR(64) NOT NULL,
    rule_version VARCHAR(32) NOT NULL,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
        CHECK (verification_status IN (
            'DRAFT', 'SOURCE_LOCATED', 'SOURCE_AMBIGUOUS',
            'BLOCKED_SOURCE_CONFLICT', 'VERIFIED'
        )),
    source_section_id BIGINT REFERENCES source_sections(id),
    description TEXT NOT NULL,
    UNIQUE (module, rule_code, rule_version),
    CHECK (verification_status <> 'VERIFIED' OR source_section_id IS NOT NULL)
);

CREATE TABLE interpretations (
    id BIGSERIAL PRIMARY KEY,
    hexagram_code VARCHAR(16) REFERENCES hexagrams(code),
    rule_id BIGINT REFERENCES calculation_rules(id),
    source_section_id BIGINT NOT NULL REFERENCES source_sections(id),
    category VARCHAR(64) NOT NULL,
    content TEXT NOT NULL
);

CREATE TABLE tam_the_lookup_entries (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES calculation_rules(id),
    lookup_key VARCHAR(128) NOT NULL,
    result_code VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source_section_id BIGINT NOT NULL REFERENCES source_sections(id),
    verification_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'
        CHECK (verification_status IN (
            'DRAFT', 'SOURCE_LOCATED', 'SOURCE_AMBIGUOUS',
            'BLOCKED_SOURCE_CONFLICT', 'VERIFIED'
        )),
    editor VARCHAR(128),
    reviewer VARCHAR(128),
    CHECK (verification_status <> 'VERIFIED' OR reviewer IS NOT NULL),
    UNIQUE (rule_id, lookup_key, result_code)
);

CREATE INDEX idx_interpretations_hexagram ON interpretations(hexagram_code);
CREATE INDEX idx_tam_the_lookup_key ON tam_the_lookup_entries(lookup_key);
