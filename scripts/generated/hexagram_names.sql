BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE hexagrams, source_sections IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE name_import (code text PRIMARY KEY, name text, upper_code text, lower_code text, lines boolean[], pdf integer, label text) ON COMMIT DROP;
INSERT INTO name_import VALUES
('H_CAN_CAN','Càn','CAN','CAN',ARRAY[true,true,true,true,true,true]::boolean[],269,'MH-64-QUE-NAMES-276'),
('H_KHON_KHON','Khôn','KHON','KHON',ARRAY[false,false,false,false,false,false]::boolean[],269,'MH-64-QUE-NAMES-276'),
('H_KHAM_CHAN','Truân','KHAM','CHAN',ARRAY[true,false,false,false,true,false]::boolean[],269,'MH-64-QUE-NAMES-276'),
('H_CAN2_KHAM','Mông','CAN2','KHAM',ARRAY[false,true,false,false,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHAM_CAN','Nhu','KHAM','CAN',ARRAY[true,true,true,false,true,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN_KHAM','Tụng','CAN','KHAM',ARRAY[false,true,false,true,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHON_KHAM','Sư','KHON','KHAM',ARRAY[false,true,false,false,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHAM_KHON','Tỷ','KHAM','KHON',ARRAY[false,false,false,false,true,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_TON_CAN','Tiểu súc','TON','CAN',ARRAY[true,true,true,false,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN_DOAI','Lý','CAN','DOAI',ARRAY[true,true,false,true,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHON_CAN','Thái','KHON','CAN',ARRAY[true,true,true,false,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN_KHON','Bĩ','CAN','KHON',ARRAY[false,false,false,true,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN_LY','Đồng nhân','CAN','LY',ARRAY[true,false,true,true,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_LY_CAN','Đại hữu','LY','CAN',ARRAY[true,true,true,true,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHON_CAN2','Khiêm','KHON','CAN2',ARRAY[false,false,true,false,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CHAN_KHON','Dự','CHAN','KHON',ARRAY[false,false,false,true,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_DOAI_CHAN','Tùy','DOAI','CHAN',ARRAY[true,false,false,true,true,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN2_TON','Cổ','CAN2','TON',ARRAY[false,true,true,false,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHON_DOAI','Lâm','KHON','DOAI',ARRAY[true,true,false,false,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_TON_KHON','Quan','TON','KHON',ARRAY[false,false,false,false,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_LY_CHAN','Phệ hạp','LY','CHAN',ARRAY[true,false,false,true,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN2_LY','Bí','CAN2','LY',ARRAY[true,false,true,false,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN2_KHON','Bác','CAN2','KHON',ARRAY[false,false,false,false,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHON_CHAN','Phục','KHON','CHAN',ARRAY[true,false,false,false,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN_CHAN','Vô vọng','CAN','CHAN',ARRAY[true,false,false,true,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN2_CAN','Đại súc','CAN2','CAN',ARRAY[true,true,true,false,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN2_CHAN','Di','CAN2','CHAN',ARRAY[true,false,false,false,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_DOAI_TON','Đại quá','DOAI','TON',ARRAY[false,true,true,true,true,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHAM_KHAM','Khảm','KHAM','KHAM',ARRAY[false,true,false,false,true,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_LY_LY','Ly','LY','LY',ARRAY[true,false,true,true,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_DOAI_CAN2','Hàm','DOAI','CAN2',ARRAY[false,false,true,true,true,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CHAN_TON','Hằng','CHAN','TON',ARRAY[false,true,true,true,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN_CAN2','Độn','CAN','CAN2',ARRAY[false,false,true,true,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CHAN_CAN','Đại tráng','CHAN','CAN',ARRAY[true,true,true,true,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_LY_KHON','Tấn','LY','KHON',ARRAY[false,false,false,true,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHON_LY','Minh di','KHON','LY',ARRAY[true,false,true,false,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_TON_LY','Gia nhân','TON','LY',ARRAY[true,false,true,false,true,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_LY_DOAI','Khuê','LY','DOAI',ARRAY[true,true,false,true,false,true]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_KHAM_CAN2','Kiển','KHAM','CAN2',ARRAY[false,false,true,false,true,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CHAN_KHAM','Giải','CHAN','KHAM',ARRAY[false,true,false,true,false,false]::boolean[],270,'MH-64-QUE-NAMES-277'),
('H_CAN2_DOAI','Tổn','CAN2','DOAI',ARRAY[true,true,false,false,false,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_TON_CHAN','Ích','TON','CHAN',ARRAY[true,false,false,false,true,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_DOAI_CAN','Quải','DOAI','CAN',ARRAY[true,true,true,true,true,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_CAN_TON','Cấu','CAN','TON',ARRAY[false,true,true,true,true,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_DOAI_KHON','Tụy','DOAI','KHON',ARRAY[false,false,false,true,true,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_KHON_TON','Thăng','KHON','TON',ARRAY[false,true,true,false,false,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_DOAI_KHAM','Khốn','DOAI','KHAM',ARRAY[false,true,false,true,true,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_KHAM_TON','Tỉnh','KHAM','TON',ARRAY[false,true,true,false,true,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_DOAI_LY','Cách','DOAI','LY',ARRAY[true,false,true,true,true,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_LY_TON','Đỉnh','LY','TON',ARRAY[false,true,true,true,false,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_CHAN_CHAN','Chấn','CHAN','CHAN',ARRAY[true,false,false,true,false,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_CAN2_CAN2','Cấn','CAN2','CAN2',ARRAY[false,false,true,false,false,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_TON_CAN2','Tiệm','TON','CAN2',ARRAY[false,false,true,false,true,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_CHAN_DOAI','Quy muội','CHAN','DOAI',ARRAY[true,true,false,true,false,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_CHAN_LY','Phong','CHAN','LY',ARRAY[true,false,true,true,false,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_LY_CAN2','Lữ','LY','CAN2',ARRAY[false,false,true,true,false,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_TON_TON','Tốn','TON','TON',ARRAY[false,true,true,false,true,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_DOAI_DOAI','Đoài','DOAI','DOAI',ARRAY[true,true,false,true,true,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_TON_KHAM','Hoán','TON','KHAM',ARRAY[false,true,false,false,true,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_KHAM_DOAI','Tiết','KHAM','DOAI',ARRAY[true,true,false,false,true,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_TON_DOAI','Trung phu','TON','DOAI',ARRAY[true,true,false,false,true,true]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_CHAN_CAN2','Tiểu quá','CHAN','CAN2',ARRAY[false,false,true,true,false,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_KHAM_LY','Ký tế','KHAM','LY',ARRAY[true,false,true,false,true,false]::boolean[],271,'MH-64-QUE-NAMES-278'),
('H_LY_KHAM','Vị tế','LY','KHAM',ARRAY[false,true,false,true,false,true]::boolean[],271,'MH-64-QUE-NAMES-278');
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM source_books WHERE id=(SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in')
 AND file_sha256='225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de' AND pdf_page_count=672) THEN
 RAISE EXCEPTION 'Source PDF edition/hash mismatch'; END IF;
IF (SELECT count(*) FROM name_import n JOIN hexagrams h USING(code)
 WHERE h.upper_trigram_code=n.upper_code AND h.lower_trigram_code=n.lower_code
 AND h.lines_bottom_up=n.lines) <> 64 THEN
 RAISE EXCEPTION 'Expected all 64 existing structures with matching lines'; END IF;
END $$;
INSERT INTO source_sections (source_book_id,section_label,printed_page_label,pdf_page,excerpt) VALUES ((SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in'),'MH-64-QUE-NAMES-276','276',269,'Danh sách tên 64 quẻ: trang in 276, PDF 269. Tên viết hoa đầu từ; giữ dấu phân biệt Bĩ/Bí, Càn/Cấn, Ly/Lý. Cặp thượng/hạ đối chiếu sơ đồ PDF 274, trang in 281. Nguồn kiểm bổ sung: danh sách PDF 500-501, trang in 509-510. Chưa có xác nhận độc lập TV2 cho bộ tên.') ON CONFLICT (source_book_id,section_label,pdf_page) DO NOTHING;
INSERT INTO source_sections (source_book_id,section_label,printed_page_label,pdf_page,excerpt) VALUES ((SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in'),'MH-64-QUE-NAMES-277','277',270,'Danh sách tên 64 quẻ: trang in 277, PDF 270. Tên viết hoa đầu từ; giữ dấu phân biệt Bĩ/Bí, Càn/Cấn, Ly/Lý. Cặp thượng/hạ đối chiếu sơ đồ PDF 274, trang in 281. Nguồn kiểm bổ sung: danh sách PDF 500-501, trang in 509-510. Chưa có xác nhận độc lập TV2 cho bộ tên.') ON CONFLICT (source_book_id,section_label,pdf_page) DO NOTHING;
INSERT INTO source_sections (source_book_id,section_label,printed_page_label,pdf_page,excerpt) VALUES ((SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in'),'MH-64-QUE-NAMES-278','278',271,'Danh sách tên 64 quẻ: trang in 278, PDF 271. Tên viết hoa đầu từ; giữ dấu phân biệt Bĩ/Bí, Càn/Cấn, Ly/Lý. Cặp thượng/hạ đối chiếu sơ đồ PDF 274, trang in 281. Nguồn kiểm bổ sung: danh sách PDF 500-501, trang in 509-510. Chưa có xác nhận độc lập TV2 cho bộ tên.') ON CONFLICT (source_book_id,section_label,pdf_page) DO NOTHING;
INSERT INTO source_sections (source_book_id,section_label,printed_page_label,pdf_page,excerpt) VALUES ((SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in'),'MH-64-QUE-DIAGRAM','281',274,'Sơ đồ 64 quẻ hình tròn và hình vuông: đối chiếu tên với hình sáu hào; cần TV2 review độc lập.') ON CONFLICT (source_book_id,section_label,pdf_page) DO NOTHING;
DO $$ BEGIN
IF (SELECT count(*) FROM source_sections WHERE source_book_id=(SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in')
 AND ((section_label='MH-64-QUE-NAMES-276' AND pdf_page=269 AND printed_page_label='276')
   OR (section_label='MH-64-QUE-NAMES-277' AND pdf_page=270 AND printed_page_label='277')
   OR (section_label='MH-64-QUE-NAMES-278' AND pdf_page=271 AND printed_page_label='278')
   OR (section_label='MH-64-QUE-DIAGRAM' AND pdf_page=274 AND printed_page_label='281'))) <> 4 THEN
 RAISE EXCEPTION 'Existing source page metadata differs from reviewed manifest'; END IF;
IF EXISTS (
 SELECT 1 FROM hexagrams h JOIN name_import n USING(code)
 WHERE (
  (h.name_kind='STRUCTURAL_LABEL' AND h.verification_status='DRAFT'
   AND h.source_section_id IS NULL AND h.reviewer IS NULL AND h.editor='TV3_STRUCTURE_SEED'
   AND h.name=(SELECT '[CẤU TRÚC] ' || u.name || ' trên ' || l.name
    FROM trigrams u JOIN trigrams l ON l.code=h.lower_trigram_code
    WHERE u.code=h.upper_trigram_code))
  OR (h.name_kind='CANONICAL_TITLE' AND h.name=n.name AND h.source_section_id IN (
   SELECT s.id FROM source_sections s WHERE s.source_book_id=(SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in')
    AND s.section_label=n.label AND s.pdf_page=n.pdf)
   AND (h.verification_status='VERIFIED' AND h.reviewer IS NOT NULL
     OR h.verification_status='SOURCE_LOCATED' AND h.reviewer IS NULL AND h.editor='TV3_AI_ASSISTED_SOURCE_TRANSCRIPTION_2026_10_23'))
 ) IS NOT TRUE) THEN RAISE EXCEPTION 'Protected or manually changed names: review before overwriting'; END IF;
END $$;
UPDATE hexagrams h SET name=n.name, name_kind='CANONICAL_TITLE',
 source_section_id=s.id, verification_status='SOURCE_LOCATED', editor='TV3_AI_ASSISTED_SOURCE_TRANSCRIPTION_2026_10_23'
FROM name_import n JOIN source_sections s ON s.source_book_id=(SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in')
 AND s.section_label=n.label AND s.pdf_page=n.pdf
WHERE h.code=n.code AND h.name_kind='STRUCTURAL_LABEL' AND h.verification_status='DRAFT'
 AND h.reviewer IS NULL AND h.editor='TV3_STRUCTURE_SEED';
DO $$ BEGIN
IF (SELECT count(*) FROM name_import n JOIN hexagrams h USING(code)
 JOIN source_sections s ON s.id=h.source_section_id
 WHERE h.name=n.name AND h.name_kind='CANONICAL_TITLE' AND s.pdf_page=n.pdf
 AND s.section_label=n.label AND s.source_book_id=(SELECT id FROM source_books WHERE title='Mai Hoa Dịch Số' AND edition='Bản PDF scan người dùng cung cấp; chưa xác minh ấn bản in')
 AND h.verification_status IN ('SOURCE_LOCATED','VERIFIED')) <> 64 THEN
 RAISE EXCEPTION 'Final name/source validation failed'; END IF;
END $$;
COMMIT;
