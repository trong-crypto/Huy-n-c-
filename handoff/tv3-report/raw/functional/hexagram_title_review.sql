BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE hexagrams, source_sections, source_books IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE title_review(code text PRIMARY KEY,name text,upper_code text,lower_code text,
 lines boolean[],pdf integer) ON COMMIT DROP;
INSERT INTO title_review VALUES
('H_CAN_CAN','Càn','CAN','CAN',ARRAY[true,true,true,true,true,true]::boolean[],269),
('H_CAN_TON','Cấu','CAN','TON',ARRAY[false,true,true,true,true,true]::boolean[],271),
('H_DOAI_TON','Đại quá','DOAI','TON',ARRAY[false,true,true,true,true,false]::boolean[],270),
('H_LY_TON','Đỉnh','LY','TON',ARRAY[false,true,true,true,false,true]::boolean[],271),
('H_CHAN_TON','Hằng','CHAN','TON',ARRAY[false,true,true,true,false,false]::boolean[],270),
('H_TON_TON','Tốn','TON','TON',ARRAY[false,true,true,false,true,true]::boolean[],271),
('H_KHAM_TON','Tỉnh','KHAM','TON',ARRAY[false,true,true,false,true,false]::boolean[],271),
('H_CAN2_TON','Cổ','CAN2','TON',ARRAY[false,true,true,false,false,true]::boolean[],270),
('H_KHON_TON','Thăng','KHON','TON',ARRAY[false,true,true,false,false,false]::boolean[],271),
('H_CAN_KHAM','Tụng','CAN','KHAM',ARRAY[false,true,false,true,true,true]::boolean[],270),
('H_DOAI_KHAM','Khốn','DOAI','KHAM',ARRAY[false,true,false,true,true,false]::boolean[],271),
('H_LY_KHAM','Vị tế','LY','KHAM',ARRAY[false,true,false,true,false,true]::boolean[],271),
('H_CHAN_KHAM','Giải','CHAN','KHAM',ARRAY[false,true,false,true,false,false]::boolean[],270),
('H_TON_KHAM','Hoán','TON','KHAM',ARRAY[false,true,false,false,true,true]::boolean[],271),
('H_KHAM_KHAM','Khảm','KHAM','KHAM',ARRAY[false,true,false,false,true,false]::boolean[],270),
('H_CAN2_KHAM','Mông','CAN2','KHAM',ARRAY[false,true,false,false,false,true]::boolean[],270),
('H_KHON_KHAM','Sư','KHON','KHAM',ARRAY[false,true,false,false,false,false]::boolean[],270),
('H_CAN_CAN2','Độn','CAN','CAN2',ARRAY[false,false,true,true,true,true]::boolean[],270),
('H_DOAI_CAN2','Hàm','DOAI','CAN2',ARRAY[false,false,true,true,true,false]::boolean[],270),
('H_LY_CAN2','Lữ','LY','CAN2',ARRAY[false,false,true,true,false,true]::boolean[],271),
('H_CHAN_CAN2','Tiểu quá','CHAN','CAN2',ARRAY[false,false,true,true,false,false]::boolean[],271),
('H_TON_CAN2','Tiệm','TON','CAN2',ARRAY[false,false,true,false,true,true]::boolean[],271),
('H_KHAM_CAN2','Kiển','KHAM','CAN2',ARRAY[false,false,true,false,true,false]::boolean[],270),
('H_CAN2_CAN2','Cấn','CAN2','CAN2',ARRAY[false,false,true,false,false,true]::boolean[],271),
('H_KHON_CAN2','Khiêm','KHON','CAN2',ARRAY[false,false,true,false,false,false]::boolean[],270),
('H_CAN_KHON','Bĩ','CAN','KHON',ARRAY[false,false,false,true,true,true]::boolean[],270),
('H_DOAI_KHON','Tụy','DOAI','KHON',ARRAY[false,false,false,true,true,false]::boolean[],271),
('H_LY_KHON','Tấn','LY','KHON',ARRAY[false,false,false,true,false,true]::boolean[],270),
('H_CHAN_KHON','Dự','CHAN','KHON',ARRAY[false,false,false,true,false,false]::boolean[],270),
('H_TON_KHON','Quan','TON','KHON',ARRAY[false,false,false,false,true,true]::boolean[],270),
('H_KHAM_KHON','Tỷ','KHAM','KHON',ARRAY[false,false,false,false,true,false]::boolean[],270),
('H_CAN2_KHON','Bác','CAN2','KHON',ARRAY[false,false,false,false,false,true]::boolean[],270),
('H_KHON_KHON','Khôn','KHON','KHON',ARRAY[false,false,false,false,false,false]::boolean[],269),
('H_KHON_CHAN','Phục','KHON','CHAN',ARRAY[true,false,false,false,false,false]::boolean[],270),
('H_CAN2_CHAN','Di','CAN2','CHAN',ARRAY[true,false,false,false,false,true]::boolean[],270),
('H_KHAM_CHAN','Truân','KHAM','CHAN',ARRAY[true,false,false,false,true,false]::boolean[],269),
('H_TON_CHAN','Ích','TON','CHAN',ARRAY[true,false,false,false,true,true]::boolean[],271),
('H_CHAN_CHAN','Chấn','CHAN','CHAN',ARRAY[true,false,false,true,false,false]::boolean[],271),
('H_LY_CHAN','Phệ hạp','LY','CHAN',ARRAY[true,false,false,true,false,true]::boolean[],270),
('H_DOAI_CHAN','Tùy','DOAI','CHAN',ARRAY[true,false,false,true,true,false]::boolean[],270),
('H_CAN_CHAN','Vô vọng','CAN','CHAN',ARRAY[true,false,false,true,true,true]::boolean[],270),
('H_KHON_LY','Minh di','KHON','LY',ARRAY[true,false,true,false,false,false]::boolean[],270),
('H_CAN2_LY','Bí','CAN2','LY',ARRAY[true,false,true,false,false,true]::boolean[],270),
('H_KHAM_LY','Ký tế','KHAM','LY',ARRAY[true,false,true,false,true,false]::boolean[],271),
('H_TON_LY','Gia nhân','TON','LY',ARRAY[true,false,true,false,true,true]::boolean[],270),
('H_CHAN_LY','Phong','CHAN','LY',ARRAY[true,false,true,true,false,false]::boolean[],271),
('H_LY_LY','Ly','LY','LY',ARRAY[true,false,true,true,false,true]::boolean[],270),
('H_DOAI_LY','Cách','DOAI','LY',ARRAY[true,false,true,true,true,false]::boolean[],271),
('H_CAN_LY','Đồng nhân','CAN','LY',ARRAY[true,false,true,true,true,true]::boolean[],270),
('H_KHON_DOAI','Lâm','KHON','DOAI',ARRAY[true,true,false,false,false,false]::boolean[],270),
('H_CAN2_DOAI','Tổn','CAN2','DOAI',ARRAY[true,true,false,false,false,true]::boolean[],271),
('H_KHAM_DOAI','Tiết','KHAM','DOAI',ARRAY[true,true,false,false,true,false]::boolean[],271),
('H_TON_DOAI','Trung phu','TON','DOAI',ARRAY[true,true,false,false,true,true]::boolean[],271),
('H_CHAN_DOAI','Quy muội','CHAN','DOAI',ARRAY[true,true,false,true,false,false]::boolean[],271),
('H_LY_DOAI','Khuê','LY','DOAI',ARRAY[true,true,false,true,false,true]::boolean[],270),
('H_DOAI_DOAI','Đoài','DOAI','DOAI',ARRAY[true,true,false,true,true,false]::boolean[],271),
('H_CAN_DOAI','Lý','CAN','DOAI',ARRAY[true,true,false,true,true,true]::boolean[],270),
('H_KHON_CAN','Thái','KHON','CAN',ARRAY[true,true,true,false,false,false]::boolean[],270),
('H_CAN2_CAN','Đại súc','CAN2','CAN',ARRAY[true,true,true,false,false,true]::boolean[],270),
('H_KHAM_CAN','Nhu','KHAM','CAN',ARRAY[true,true,true,false,true,false]::boolean[],270),
('H_TON_CAN','Tiểu súc','TON','CAN',ARRAY[true,true,true,false,true,true]::boolean[],270),
('H_CHAN_CAN','Đại tráng','CHAN','CAN',ARRAY[true,true,true,true,false,false]::boolean[],270),
('H_LY_CAN','Đại hữu','LY','CAN',ARRAY[true,true,true,true,false,true]::boolean[],270),
('H_DOAI_CAN','Quải','DOAI','CAN',ARRAY[true,true,true,true,true,false]::boolean[],271);
DO $$ BEGIN
IF (SELECT count(*) FROM title_review n JOIN hexagrams h USING(code)
 JOIN source_sections s ON s.id=h.source_section_id
 JOIN source_books b ON b.id=s.source_book_id
 WHERE h.name=n.name AND h.name_kind='CANONICAL_TITLE'
 AND h.upper_trigram_code=n.upper_code AND h.lower_trigram_code=n.lower_code
 AND h.lines_bottom_up=n.lines AND b.id=(SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in')
 AND b.file_sha256='225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de' AND b.pdf_page_count=672
 AND s.pdf_page=n.pdf AND s.printed_page_label=(n.pdf+7)::text
 AND s.section_label='MH-64-QUE-NAMES-' || (n.pdf+7)::text
 AND ((h.verification_status='SOURCE_LOCATED' AND h.reviewer IS NULL
       AND h.editor='TV3_AI_ASSISTED_SOURCE_TRANSCRIPTION_2026_10_23')
   OR (h.verification_status='VERIFIED' AND h.reviewer='Codex source review 2026-10-24 (same-tool second pass)'
       AND h.reviewed_at IS NOT NULL AND h.verification_note='Second-pass visual title/line review of provided Mai Hoa PDF SHA256=225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de; titles PDF269-271, diagram PDF274, supporting list PDF500-501. Same AI tool as transcription, not an independent human TV2 confirmation. Review date 2026-10-24; reviewed_at records database approval application time. Ly/Ly-with-acute normalized using PDF500; Hoan retained from primary list. Edition identity/authorship of handwritten diagram labels remain unverified. See docs/19-S01-HEXAGRAM-NAME-REVIEW.md and data/hexagram_name_review.csv.'))) <> 64 THEN
 RAISE EXCEPTION 'Missing/changed/protected title or source: review before approval'; END IF;
IF (SELECT count(*) FROM source_sections s JOIN source_books b ON b.id=s.source_book_id
 WHERE b.file_sha256='225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de' AND s.section_label='MH-64-QUE-DIAGRAM'
 AND s.pdf_page=274 AND s.printed_page_label='281') <> 1 THEN
 RAISE EXCEPTION 'Diagram source missing or changed'; END IF;
END $$;
UPDATE hexagrams h SET verification_status='VERIFIED',reviewer='Codex source review 2026-10-24 (same-tool second pass)',
 reviewed_at=CURRENT_TIMESTAMP,verification_note='Second-pass visual title/line review of provided Mai Hoa PDF SHA256=225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de; titles PDF269-271, diagram PDF274, supporting list PDF500-501. Same AI tool as transcription, not an independent human TV2 confirmation. Review date 2026-10-24; reviewed_at records database approval application time. Ly/Ly-with-acute normalized using PDF500; Hoan retained from primary list. Edition identity/authorship of handwritten diagram labels remain unverified. See docs/19-S01-HEXAGRAM-NAME-REVIEW.md and data/hexagram_name_review.csv.'
FROM title_review n WHERE h.code=n.code AND h.verification_status='SOURCE_LOCATED';
COMMIT;
