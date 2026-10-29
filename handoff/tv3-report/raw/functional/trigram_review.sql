BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE calculation_rules, trigrams, source_sections, source_books IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE trigram_review(code text PRIMARY KEY,name text,number integer,element text,lines boolean[])
 ON COMMIT DROP;
INSERT INTO trigram_review VALUES
('CAN','Càn',1,'KIM',ARRAY[true,true,true]::boolean[]),
('DOAI','Đoài',2,'KIM',ARRAY[true,true,false]::boolean[]),
('LY','Ly',3,'HOA',ARRAY[true,false,true]::boolean[]),
('CHAN','Chấn',4,'MOC',ARRAY[true,false,false]::boolean[]),
('TON','Tốn',5,'MOC',ARRAY[false,true,true]::boolean[]),
('KHAM','Khảm',6,'THUY',ARRAY[false,true,false]::boolean[]),
('CAN2','Cấn',7,'THO',ARRAY[false,false,true]::boolean[]),
('KHON','Khôn',8,'THO',ARRAY[false,false,false]::boolean[]);
DO $$ BEGIN
IF (SELECT count(*) FROM trigrams) <> 8 OR
 (SELECT count(*) FROM trigram_review n JOIN trigrams t USING(code)
  WHERE t.name=n.name AND t.heaven_number=n.number AND t.element=n.element AND t.lines_bottom_up=n.lines) <> 8
 THEN RAISE EXCEPTION 'Eight trigram records changed: review before approval'; END IF;
IF (SELECT count(*) FROM calculation_rules r JOIN source_sections s ON s.id=r.source_section_id
 JOIN source_books b ON b.id=s.source_book_id
 WHERE r.module='MAI_HOA' AND r.rule_code='MH-TRIGRAM' AND r.rule_version='1.0'
 AND b.id=(SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in') AND b.file_sha256='225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de' AND b.pdf_page_count=672
 AND s.section_label='MH-QUAI-SO' AND s.pdf_page=39 AND s.printed_page_label='44'
 AND ((r.verification_status='SOURCE_LOCATED' AND r.reviewer IS NULL AND r.reviewed_at IS NULL)
  OR (r.verification_status='VERIFIED' AND r.reviewer='Codex source review 2026-10-24 (same-tool second pass)'
      AND r.reviewed_at IS NOT NULL AND r.verification_note='Visual source review of eight trigram numbers/names PDF39-40 (print44-45), elements PDF23-24/35 (print28-29/40), line forms reconstructed from lower/middle/upper line descriptions PDF35 and cross-checked with the reviewed hexagram diagram PDF274. Provided Mai Hoa PDF SHA256=225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de. Same AI tool as transcription, not an independent human TV2 confirmation. Review date 2026-10-24; reviewed_at records database application time. Only MH-TRIGRAM 1.0 reviewed; OBJECT_COUNT remains SOURCE_AMBIGUOUS/TEAM_DECISION. Printed edition identity remains unverified. See docs/21-B03-OBJECT-COUNT-HANDOFF.md and data/trigram_source_review.csv.'))) <> 1
 THEN RAISE EXCEPTION 'Missing/changed/protected trigram rule source or reviewer'; END IF;
IF (SELECT count(*) FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
 WHERE b.file_sha256='225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de' AND s.section_label='MH-NGU-HANH'
 AND s.pdf_page=35 AND s.printed_page_label='40') <> 1
 THEN RAISE EXCEPTION 'Supporting element/form source missing or changed'; END IF;
END $$;
UPDATE calculation_rules SET verification_status='VERIFIED',reviewer='Codex source review 2026-10-24 (same-tool second pass)',
 reviewed_at=CURRENT_TIMESTAMP,verification_note='Visual source review of eight trigram numbers/names PDF39-40 (print44-45), elements PDF23-24/35 (print28-29/40), line forms reconstructed from lower/middle/upper line descriptions PDF35 and cross-checked with the reviewed hexagram diagram PDF274. Provided Mai Hoa PDF SHA256=225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de. Same AI tool as transcription, not an independent human TV2 confirmation. Review date 2026-10-24; reviewed_at records database application time. Only MH-TRIGRAM 1.0 reviewed; OBJECT_COUNT remains SOURCE_AMBIGUOUS/TEAM_DECISION. Printed edition identity remains unverified. See docs/21-B03-OBJECT-COUNT-HANDOFF.md and data/trigram_source_review.csv.'
WHERE module='MAI_HOA' AND rule_code='MH-TRIGRAM' AND rule_version='1.0'
 AND verification_status='SOURCE_LOCATED';
COMMIT;
