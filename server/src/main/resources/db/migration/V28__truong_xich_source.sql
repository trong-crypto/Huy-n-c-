INSERT INTO source_sections(source_book_id, section_label, printed_page_label, pdf_page, excerpt)
SELECT id, 'MH-TRUONG-XICH', '61', 56, 'Xem bằng trượng thước'
FROM source_books
WHERE file_sha256 = '225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de'
ON CONFLICT (source_book_id, section_label, pdf_page) DO NOTHING;

INSERT INTO calculation_rules(module, rule_code, rule_version, verification_status, source_section_id, description)
SELECT 'MAI_HOA', 'MH-TRUONG-XICH', '1.0', 'SOURCE_LOCATED', s.id,
       'Số trượng lấy thượng quái, số thước lấy hạ quái. Tổng hai số dùng để lấy hào.'
FROM source_sections s
JOIN source_books b ON b.id = s.source_book_id
WHERE b.file_sha256 = '225e9506f4f7481e56618e3f46738467a64cf6231148c959664a23469faf22de'
  AND s.section_label = 'MH-TRUONG-XICH' AND s.pdf_page = 56
ON CONFLICT (module, rule_code, rule_version) DO NOTHING;

ALTER TABLE admin_calculation_daily_counts
    DROP CONSTRAINT admin_calculation_daily_counts_method_check,
    ADD CONSTRAINT admin_calculation_daily_counts_method_check
        CHECK (method IN ('TIME', 'OBJECT_COUNT', 'LINES', 'TAM_THE', 'TRUONG_XICH'));
