-- 23/10/2026: the project owner reports TV2 has independently confirmed
-- MH-MUTUAL, MH-CHANGE, and the month-5 hour correction.
-- This records that report and its provenance; it is not a TV2 signature.
-- Do not promote the entire TT-GIO-SINH rule: the other months still require review.

ALTER TABLE calculation_rules
    ADD COLUMN reviewer VARCHAR(128),
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN verification_note TEXT,
    ADD CONSTRAINT ck_calculation_rules_reviewer
        CHECK (verification_status <> 'VERIFIED' OR reviewer IS NOT NULL);

ALTER TABLE tam_the_hour_anchors
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN verification_note TEXT;

DO $$
BEGIN
    IF (
        SELECT COUNT(*) FROM calculation_rules r
        JOIN source_sections s ON s.id = r.source_section_id
        JOIN source_books b ON b.id = s.source_book_id
        WHERE r.module = 'MAI_HOA' AND r.rule_version = '1.0'
          AND ((r.rule_code = 'MH-MUTUAL' AND s.pdf_page = 42 AND s.section_label = 'MH-QUE-HO-BIEN')
            OR (r.rule_code = 'MH-CHANGE' AND s.pdf_page = 41 AND s.section_label = 'MH-HAO-6'))
          AND b.title = 'Mai Hoa Dịch Số'
          AND r.verification_status IN ('SOURCE_LOCATED', 'VERIFIED')
    ) <> 2 THEN
        RAISE EXCEPTION 'Two Mai Hoa rules are missing, conflicted, or reference unexpected pages';
    END IF;

    IF (
        SELECT COUNT(*) FROM tam_the_hour_anchors a
        JOIN source_sections s ON s.id = a.source_section_id
        JOIN source_books b ON b.id = s.source_book_id
        WHERE a.lunar_month = 5
          AND a.first_hour_start = '05:20'::time
          AND a.source_branch = 'DAU' AND a.adopted_branch = 'DAN'
          AND a.decision_status = 'TEAM_CORRECTION'
          AND s.section_label = 'TT-GIO-SINH-5' AND s.pdf_page = 14
          AND b.title = 'Diễn Cầm Tam Thế Diễn Nghĩa'
          AND a.verification_status IN ('BLOCKED_SOURCE_CONFLICT', 'VERIFIED')
    ) <> 1 THEN
        RAISE EXCEPTION 'Month-5 hour anchor is missing or the original printed text was modified';
    END IF;
END $$;

UPDATE calculation_rules
SET verification_status = 'VERIFIED',
    reviewer = 'TV2 (project owner confirmation)',
    reviewed_at = CURRENT_TIMESTAMP,
    verification_note = 'Project owner reported TV2 independently confirmed these two source rules on 2026-10-23; see docs/07-DECISION-LOG.md.'
WHERE module = 'MAI_HOA' AND rule_version = '1.0'
  AND rule_code IN ('MH-MUTUAL', 'MH-CHANGE');

UPDATE tam_the_hour_anchors
SET verification_status = 'VERIFIED',
    reviewer = 'TV2 (project owner confirmation)',
    reviewed_at = CURRENT_TIMESTAMP,
    verification_note = 'TV2 confirmation reported by project owner on 2026-10-23; source printed DAU, team adopts DAN only for month 5.'
WHERE lunar_month = 5;
