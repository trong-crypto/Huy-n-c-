-- M02: reviewed supplementary knowledge. This migration does not enable a runtime rule.
-- Existing calculation_rules, NAME_GLOSS and Tam The Loc rows remain under their own reviews.
CREATE TABLE reading_source_bundles (
    bundle_id TEXT PRIMARY KEY,
    document_sha256 CHAR(64) NOT NULL CHECK (document_sha256 ~ '^[a-f0-9]{64}$'),
    reviewed_document JSONB NOT NULL CHECK (jsonb_typeof(reviewed_document) = 'object'),
    editor TEXT NOT NULL CHECK (btrim(editor) <> ''),
    reviewer TEXT NOT NULL CHECK (btrim(reviewer) <> ''),
    reviewed_at TIMESTAMPTZ NOT NULL,
    review_method TEXT NOT NULL CHECK (review_method = 'SAME_TOOL_TWO_VISUAL_PASSES'),
    verification_status TEXT NOT NULL CHECK (verification_status = 'VERIFIED'),
    CHECK (reviewed_document->>'bundleId' = bundle_id),
    CHECK (reviewed_document->'runtimeEnabled' = 'false'::jsonb)
);

CREATE TABLE mai_hoa_reading_templates (
    template_code TEXT PRIMARY KEY,
    bundle_id TEXT NOT NULL REFERENCES reading_source_bundles(bundle_id),
    topic TEXT NOT NULL CHECK (topic IN ('GENERAL','CAREER','WEALTH','LOVE')),
    relation TEXT NOT NULL CHECK (relation IN ('SAME_ELEMENT','USE_GENERATES_BODY',
        'BODY_GENERATES_USE','BODY_CONTROLS_USE','USE_CONTROLS_BODY')),
    content TEXT NOT NULL CHECK (btrim(content) <> ''),
    text_kind TEXT NOT NULL CHECK (text_kind = 'EDITORIAL_PARAPHRASE'),
    source_book_id BIGINT NOT NULL REFERENCES source_books(id),
    source_record JSONB NOT NULL CHECK (jsonb_typeof(source_record) = 'object'),
    UNIQUE (bundle_id,topic,relation),
    CHECK (source_record->>'sourceStatus' = 'VERIFIED'),
    CHECK (source_record->>'basis' = 'SOURCE_VERIFIED'),
    CHECK (source_record->>'content' = content)
);

CREATE TABLE tam_the_supplement_results (
    result_code TEXT PRIMARY KEY,
    bundle_id TEXT NOT NULL REFERENCES reading_source_bundles(bundle_id),
    rule_code TEXT NOT NULL CHECK (rule_code IN ('TT-SANG-HEN','TT-DIEN-SAN')),
    column_number SMALLINT NOT NULL CHECK (column_number BETWEEN 1 AND 12),
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    source_table_label TEXT NOT NULL CHECK (btrim(source_table_label) <> ''),
    source_content_heading TEXT NOT NULL CHECK (btrim(source_content_heading) <> ''),
    content TEXT NOT NULL CHECK (btrim(content) <> ''),
    text_kind TEXT NOT NULL CHECK (text_kind = 'EDITORIAL_PARAPHRASE'),
    source_book_id BIGINT NOT NULL REFERENCES source_books(id),
    source_record JSONB NOT NULL CHECK (jsonb_typeof(source_record) = 'object'),
    UNIQUE (bundle_id,rule_code,column_number),
    UNIQUE (result_code,bundle_id,rule_code),
    CHECK (rule_code <> 'TT-DIEN-SAN' OR column_number <= 7),
    CHECK (source_record->>'sourceStatus' = 'VERIFIED'),
    CHECK (source_record->>'basis' = 'SOURCE_VERIFIED'),
    CHECK (source_record->>'content' = content)
);

CREATE TABLE tam_the_supplement_mappings (
    rule_code TEXT NOT NULL,
    lookup_key TEXT NOT NULL CHECK (btrim(lookup_key) <> ''),
    bundle_id TEXT NOT NULL REFERENCES reading_source_bundles(bundle_id),
    result_code TEXT NOT NULL,
    table_row SMALLINT NOT NULL CHECK (table_row BETWEEN 1 AND 12),
    table_column SMALLINT NOT NULL CHECK (table_column BETWEEN 1 AND 12),
    PRIMARY KEY (bundle_id,rule_code,lookup_key),
    FOREIGN KEY (result_code,bundle_id,rule_code)
        REFERENCES tam_the_supplement_results(result_code,bundle_id,rule_code),
    CHECK (rule_code IN ('TT-SANG-HEN','TT-DIEN-SAN')),
    CHECK (rule_code <> 'TT-DIEN-SAN' OR (table_row <= 2 AND table_column <= 7)),
    CHECK ((rule_code = 'TT-SANG-HEN' AND lookup_key ~
        '^BRANCH:(TY|SUU|DAN|MAO|THIN|TI|NGO|MUI|THAN|DAU|TUAT|HOI)\|MONTH:(0[1-9]|1[0-2])$')
        OR (rule_code = 'TT-DIEN-SAN' AND lookup_key ~
        '^ELEMENT:(KIM|MOC|THUY|HOA|THO)\|MONTH:(0[1-9]|1[0-2])$'))
);
