BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
LOCK TABLE calculation_rules,source_sections,source_books IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
IF (SELECT count(*) FROM calculation_rules r JOIN source_sections s ON s.id=r.source_section_id
 JOIN source_books b ON b.id=s.source_book_id
 WHERE r.module='MAI_HOA' AND r.rule_code='MH-TIME' AND r.rule_version='1.0'
 AND r.external_source_id IS NULL AND s.section_label='MH-TIME-CONFLICT' AND s.pdf_page=45 AND s.printed_page_label='50'
 AND b.file_sha256='225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de' AND b.pdf_page_count=672 AND (
 (r.verification_status='BLOCKED_SOURCE_CONFLICT' AND r.reviewer IS NULL AND r.reviewed_at IS NULL
  AND r.verification_note IS NULL AND r.description='Nhóm chọn chia 6; trang 50 in trừ 8, chưa duyệt VERIFIED.') OR
 (r.verification_status='VERIFIED' AND r.reviewer='Project owner confirmation via chat 2026-10-24; recorded by Codex' AND r.reviewed_at IS NOT NULL
  AND r.verification_note='Owner explicitly confirmed TIME movingLine=(Y+M+D+H)%6, remainder0->6, and reaffirmed approval in chat. VERIFIED scope: adopted project rule/correction MOD6, not a claim that the printed text agrees or publisher issued an erratum. Original Mai Hoa PDF45/print50 says tru di 8; preserved in source page and decision history. Execution remains TEAM_DECISION with civil/calendar conventions. docs/28-TIME-OWNER-APPROVAL.md.' AND r.description='Owner-approved TIME rule: upper=(Y+M+D)%8, lower=(Y+M+D+H)%8, moving=(Y+M+D+H)%6; zero->8/8/6. Original print50 text retained.')))<>1
 THEN RAISE EXCEPTION 'TIME owner approval: source or protected rule changed'; END IF;
END $$;
UPDATE calculation_rules SET verification_status='VERIFIED',reviewer='Project owner confirmation via chat 2026-10-24; recorded by Codex',reviewed_at=CURRENT_TIMESTAMP,
 verification_note='Owner explicitly confirmed TIME movingLine=(Y+M+D+H)%6, remainder0->6, and reaffirmed approval in chat. VERIFIED scope: adopted project rule/correction MOD6, not a claim that the printed text agrees or publisher issued an erratum. Original Mai Hoa PDF45/print50 says tru di 8; preserved in source page and decision history. Execution remains TEAM_DECISION with civil/calendar conventions. docs/28-TIME-OWNER-APPROVAL.md.',description='Owner-approved TIME rule: upper=(Y+M+D)%8, lower=(Y+M+D+H)%8, moving=(Y+M+D+H)%6; zero->8/8/6. Original print50 text retained.'
 WHERE module='MAI_HOA' AND rule_code='MH-TIME' AND rule_version='1.0' AND verification_status='BLOCKED_SOURCE_CONFLICT';
COMMIT;
