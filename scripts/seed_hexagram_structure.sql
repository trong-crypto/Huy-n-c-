-- Seed by composition only; these are NOT verified book names or interpretations.
-- Requires Flyway V3 and eight known trigrams. Safe to run again, never updates reviewed rows.
BEGIN;

DO $$ BEGIN
    IF (SELECT COUNT(*) FROM trigrams) <> 8 THEN
        RAISE EXCEPTION 'Expected exactly eight trigrams before 64-hexagram seed';
    END IF;
END $$;

INSERT INTO hexagrams (
    code, name, upper_trigram_code, lower_trigram_code,
    lines_bottom_up, name_kind, verification_status, editor
)
SELECT 'H_' || u.code || '_' || l.code,
       '[CẤU TRÚC] ' || u.name || ' trên ' || l.name,
       u.code, l.code,
       l.lines_bottom_up || u.lines_bottom_up,
       'STRUCTURAL_LABEL', 'DRAFT', 'TV3_STRUCTURE_SEED'
FROM trigrams AS u CROSS JOIN trigrams AS l
ON CONFLICT (code) DO NOTHING;

INSERT INTO hexagram_lines (hexagram_code, line_number, is_yang)
SELECT h.code, gs.n, h.lines_bottom_up[gs.n]
FROM hexagrams AS h CROSS JOIN generate_series(1, 6) AS gs(n)
ON CONFLICT (hexagram_code, line_number) DO NOTHING;

DO $$ BEGIN
    IF (SELECT COUNT(*) FROM hexagrams) <> 64 OR
       (SELECT COUNT(*) FROM hexagram_lines) <> 384 THEN
        RAISE EXCEPTION 'Hexagram seed incomplete (expected 64 hexagrams / 384 lines)';
    END IF;
    IF EXISTS (
        SELECT 1 FROM hexagrams AS h
        JOIN trigrams AS l ON l.code = h.lower_trigram_code
        JOIN trigrams AS u ON u.code = h.upper_trigram_code
        WHERE h.lines_bottom_up IS DISTINCT FROM
              (l.lines_bottom_up || u.lines_bottom_up)
    ) THEN
        RAISE EXCEPTION 'Hexagram lines disagree with lower + upper trigrams';
    END IF;
    IF EXISTS (
        SELECT 1 FROM hexagram_lines AS line
        JOIN hexagrams AS h ON h.code = line.hexagram_code
        WHERE line.is_yang IS DISTINCT FROM h.lines_bottom_up[line.line_number]
    ) THEN
        RAISE EXCEPTION 'One or more line rows disagree with hexagram structure';
    END IF;
END $$;
COMMIT;
