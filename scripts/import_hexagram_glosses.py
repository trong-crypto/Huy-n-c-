#!/usr/bin/env python3
"""E01: validate pinned 64 short name glosses and import them safely.

Dry run is default.  --apply stages SOURCE_LOCATED; --apply --review performs
the recorded SAME-TOOL second-pass verification. No UI or predictive readings.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys

from import_hexagram_names import ROOT, SOURCE_SHA, load_names, verify_pdf, psql
from import_book_knowledge import book_id, quote

REVIEW_FILE = ROOT / 'data/e01_hexagram_gloss_review.csv'
MANIFEST_FILE = ROOT / 'data/e01_hexagram_gloss_manifest.json'
EDITOR = 'TV2_TV3_CODEX_E01_2026_10_25'
REVIEWER = 'Codex E01 2026-10-25 (same-tool source recheck; not independent human)'
CONFLICT = 'PRINTED_ICH_AT_TINH_POSITION; identity normalized to verified Tỉnh (48)'


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest(path: Path) -> str:
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def load_review() -> list[dict[str, str]]:
    manifest = json.loads(MANIFEST_FILE.read_text(encoding='utf-8'))
    require(manifest['task'] == 'E01' and manifest['schemaVersion'] == 1,
            'Wrong E01 manifest')
    require(manifest['pdfSha256'] == SOURCE_SHA and
            manifest['sourceSurveySha256'] == digest(ROOT / 'data/s03_hexagram_source_map.csv') and
            manifest['reviewCsvSha256'] == digest(REVIEW_FILE),
            'E01 manifest/data changed: repeat book review, do not import')
    with REVIEW_FILE.open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.DictReader(stream))
    with (ROOT / 'data/s03_hexagram_source_map.csv').open(encoding='utf-8-sig', newline='') as stream:
        survey = list(csv.DictReader(stream))
    names = load_names()
    require(len(rows) == len(survey) == len(names) == 64,
            'Need exactly 64 survey/review/canonical rows')
    require([int(r['order']) for r in rows] == list(range(1, 65)),
            'Review must keep unambiguous canonical order')
    for row, original, name in zip(rows, survey, names, strict=True):
        require((row['hexagram_code'], row['canonical_name'], row['gloss'],
                 row['pdf_page'], row['printed_page'], row['section'],
                 row['item_in_section']) ==
                (original['hexagram_code'], original['canonical_name'],
                 original['gloss_candidate'], original['pdf_page'],
                 original['printed_page'], original['section'], original['item_in_section']),
                f"E01 content/provenance changed at row {row['order']}")
        require((row['hexagram_code'], row['canonical_name']) == (name['code'], name['name'])
                and int(row['pdf_page']) == name['pdf_page']
                and int(row['printed_page']) == name['printed_page'],
                f"E01 verified name/source mismatch: {row['hexagram_code']}")
        require(row['editor'] == EDITOR and row['reviewer'] == REVIEWER and
                row['review_status'] == 'VERIFIED' and row['gloss'].strip(),
                f"E01 review incomplete: {row['hexagram_code']}")
        is_tinh = int(row['order']) == 48
        require(row['printed_source_label'] == ('Ích' if is_tinh else row['canonical_name']),
                f"Printed source label changed: {row['hexagram_code']}")
        require(row['decision'] == (CONFLICT if is_tinh else 'SOURCE_MATCHES_CANONICAL'),
                f"E01 missing documented editorial decision: {row['hexagram_code']}")
        require(original['source_status'] == ('SOURCE_AMBIGUOUS' if is_tinh else 'SOURCE_LOCATED'),
                'Survey state changed')
    return rows


def note(row: dict[str, str]) -> str:
    base = ('E01 2026-10-25; PDF Mai Hoa 269-271 / printed 276-278; '
            '64 short NAME_GLOSS entries only. Two visual checks with same Codex; '
            'not independently human-reviewed; no prediction or line reading. ')
    return base + (CONFLICT + '; book literally prints Ích: Giếng nước, '
                   'but canonical order 48 between Khốn/Cách and verified S01 identity '
                   'establish Tỉnh; original label preserved in printed_source_label.'
                   if int(row['order']) == 48 else 'Literal gloss transcribed by ordered source item.')


def build_sql(rows: list[dict[str, str]], review: bool) -> str:
    sql = ["BEGIN;", "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '40s';",
           'LOCK TABLE interpretations, hexagrams, source_sections IN SHARE ROW EXCLUSIVE MODE;',
           'CREATE TEMP TABLE e01_import (code text PRIMARY KEY, name text, gloss text NOT NULL, '
           'source_order int UNIQUE, pdf_page int, printed_page text, label text, '
           'printed_source_label text, decision text, note text) ON COMMIT DROP;']
    values = []
    for r in rows:
        page = r['printed_page']
        fields = [r['hexagram_code'], r['canonical_name'], r['gloss'],
                  int(r['order']), int(r['pdf_page']), page,
                  'MH-64-QUE-NAMES-' + page, r['printed_source_label'], r['decision'], note(r)]
        values.append('(' + ','.join(str(v) if type(v) is int else quote(v) for v in fields) + ')')
    sql.append('INSERT INTO e01_import VALUES\n' + ',\n'.join(values) + ';')
    sql.append(f"""DO $$ BEGIN
  IF (SELECT count(*) FROM e01_import) <> 64 THEN RAISE EXCEPTION 'E01: incomplete review'; END IF;
  IF NOT EXISTS (SELECT 1 FROM source_books WHERE id={book_id('MH')}
        AND file_sha256={quote(SOURCE_SHA)} AND pdf_page_count=672)
  THEN RAISE EXCEPTION 'E01: wrong source PDF'; END IF;
  IF (SELECT count(*) FROM e01_import e
      JOIN hexagrams h ON h.code=e.code AND h.name=e.name
          AND h.name_kind='CANONICAL_TITLE' AND h.verification_status='VERIFIED'
          AND h.reviewer IS NOT NULL
      JOIN source_sections s ON s.id=h.source_section_id
         AND s.section_label=e.label AND s.pdf_page=e.pdf_page
         AND s.printed_page_label=e.printed_page
      WHERE h.code=e.code) <> 64
  THEN RAISE EXCEPTION 'E01: 64 S01 verified identities/pages required'; END IF;
  IF (SELECT count(*) FROM e01_import e JOIN source_sections s
      ON s.section_label=e.label AND s.pdf_page=e.pdf_page
         AND s.printed_page_label=e.printed_page
         AND s.source_book_id={book_id('MH')}) <> 64
  THEN RAISE EXCEPTION 'E01: source sections mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM interpretations i WHERE i.category='NAME_GLOSS'
      AND (i.hexagram_code NOT IN (SELECT code FROM e01_import)
           OR i.editor IS DISTINCT FROM {quote(EDITOR)}
           OR i.verification_status NOT IN ('SOURCE_LOCATED','VERIFIED')))
  THEN RAISE EXCEPTION 'E01: protected existing NAME_GLOSS row'; END IF;
  IF EXISTS (SELECT 1 FROM interpretations i JOIN e01_import e
      ON i.hexagram_code=e.code AND i.category='NAME_GLOSS'
      JOIN source_sections s ON s.section_label=e.label AND s.pdf_page=e.pdf_page
           AND s.printed_page_label=e.printed_page AND s.source_book_id={book_id('MH')}
      WHERE i.content IS DISTINCT FROM e.gloss OR i.source_order IS DISTINCT FROM e.source_order
       OR i.source_section_id IS DISTINCT FROM s.id OR i.printed_source_label IS DISTINCT FROM e.printed_source_label
       OR i.verification_note IS DISTINCT FROM e.note OR i.rule_id IS NOT NULL
       OR (i.verification_status='VERIFIED' AND (i.reviewer IS DISTINCT FROM {quote(REVIEWER)}
             OR i.reviewed_at IS NULL))
       OR (i.verification_status='SOURCE_LOCATED' AND (i.reviewer IS NOT NULL OR i.reviewed_at IS NOT NULL)))
  THEN RAISE EXCEPTION 'E01: edited or conflicting gloss row'; END IF;
END $$;""")
    sql.append(f"""INSERT INTO interpretations
   (hexagram_code,rule_id,source_section_id,category,content,verification_status,
    editor,verification_note,source_order,printed_source_label)
 SELECT e.code,NULL,s.id,'NAME_GLOSS',e.gloss,'SOURCE_LOCATED',
        {quote(EDITOR)},e.note,e.source_order,e.printed_source_label
 FROM e01_import e JOIN source_sections s ON s.section_label=e.label
   AND s.pdf_page=e.pdf_page AND s.printed_page_label=e.printed_page
   AND s.source_book_id={book_id('MH')}
 WHERE NOT EXISTS (SELECT 1 FROM interpretations i
                   WHERE i.category='NAME_GLOSS' AND i.hexagram_code=e.code);""")
    if review:
        sql.append(f"""UPDATE interpretations i SET verification_status='VERIFIED',
        reviewer={quote(REVIEWER)}, reviewed_at=now()
        WHERE i.category='NAME_GLOSS' AND i.verification_status='SOURCE_LOCATED'
          AND i.editor={quote(EDITOR)} AND i.hexagram_code IN (SELECT code FROM e01_import);""")
    condition = ("i.verification_status='VERIFIED' AND i.reviewer=" + quote(REVIEWER) +
                 " AND i.reviewed_at IS NOT NULL" if review else
                 "i.verification_status IN ('SOURCE_LOCATED','VERIFIED')")
    sql.append(f"""DO $$ BEGIN
IF (SELECT count(*) FROM interpretations i JOIN e01_import e
  ON i.hexagram_code=e.code AND i.category='NAME_GLOSS'
  WHERE i.content=e.gloss AND i.source_order=e.source_order AND i.printed_source_label=e.printed_source_label
  AND {condition}) <> 64
THEN RAISE EXCEPTION 'E01: final count/review failed'; END IF;
END $$;
COMMIT;""")
    return '\n'.join(sql) + '\n'


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf-dir', type=Path, default=Path.home() / 'Downloads')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--review', action='store_true', help='Promote only pinned E01 transcription to VERIFIED')
    parser.add_argument('--sql-output', type=Path, default=ROOT / 'scripts/generated/e01_hexagram_glosses.sql')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5432)
    parser.add_argument('--database', default='huyenco')
    parser.add_argument('--user', default='postgres')
    parser.add_argument('--psql', default='psql')
    args = parser.parse_args()
    try:
        require(args.apply or not args.review, 'E01 --review requires --apply')
        rows = load_review()
        verify_pdf(args.pdf_dir)
        sql = build_sql(rows, args.review)
        args.sql_output.parent.mkdir(parents=True, exist_ok=True)
        args.sql_output.write_text(sql, encoding='utf-8')
        print('E01 source validated: 64 pinned meanings, PDF hash, canonical S01 identities; '
              'row 48 book label Ích preserved.')
        if not args.apply:
            print(f'DRY RUN: generated {args.sql_output}; database unchanged.')
            return 0
        require(bool(os.getenv('PGPASSWORD')), 'PGPASSWORD missing: use scripts/import_e01.ps1 to enter it hidden')
        backup = psql(args, "BEGIN READ ONLY; SELECT json_build_object('interpretations', "
                      "(SELECT json_agg(i ORDER BY id) FROM interpretations i), "
                      "'source_sections',(SELECT json_agg(s ORDER BY id) FROM source_sections s))::text; COMMIT;")
        backup_dir = ROOT / 'scripts/generated/db-backups'
        backup_dir.mkdir(parents=True, exist_ok=True)
        destination = backup_dir / ('before-e01-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
        destination.write_text(json.dumps(json.loads(backup), ensure_ascii=False, indent=2), encoding='utf-8')
        print('E01 backup: ' + str(destination))
        psql(args, sql)
        print('E01: 64 NAME_GLOSS rows ' + ('VERIFIED' if args.review else 'SOURCE_LOCATED') + '; rerunnable, guarded transaction.')
        return 0
    except (OSError, ValueError, RuntimeError, KeyError) as exc:
        print('E01 not applied: ' + str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
