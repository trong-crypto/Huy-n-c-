"""Read-only V12 audit against the pinned M01 review, never an importer or approval tool."""
from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import sys

from check_m01_readings import DATA_SHA256, ROOT, load_review, require
from import_book_knowledge import quote
from import_hexagram_names import psql

TABLES = ('reading_source_bundles', 'mai_hoa_reading_templates',
          'tam_the_supplement_results', 'tam_the_supplement_mappings')


def audit(args):
    data = load_review()
    bundle = quote(data['bundleId'])
    fields = ["'database',current_database()",
              "'migrations',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY installed_rank),'[]') FROM flyway_schema_history t)",
              "'books',(SELECT jsonb_agg(to_jsonb(t)) FROM source_books t)",
              "'unvalidatedConstraints',(SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated)"]
    for table in TABLES:
        fields.append(quote(table) + ",(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM "
                      + table + ' t WHERE bundle_id=' + bundle + ')')
    actual = json.loads(psql(args, "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; "
                             "SET LOCAL statement_timeout='15s'; SELECT jsonb_build_object("
                             + ','.join(fields) + '); COMMIT;'))
    require(actual['database'] == args.database, 'Wrong database identity')
    require(all(row['success'] for row in actual['migrations']), 'Failed Flyway migration present')
    require(any(str(row['version']) == '12' and row['success'] for row in actual['migrations']), 'Successful V12 is required')
    require(actual['unvalidatedConstraints'] == 0, 'Unvalidated schema constraint present')
    books = {}
    for code, expected in data['books'].items():
        rows = [row for row in actual['books'] if row['file_sha256'] == expected['sha256']]
        require(len(rows) == 1 and rows[0]['pdf_page_count'] == expected['pages'], 'Book identity differs: ' + code)
        books[code] = rows[0]['id']
    review = data['review']
    expected_bundle = dict(bundle_id=data['bundleId'], document_sha256=DATA_SHA256, reviewed_document=data,
                           editor=review['editor'], reviewer=review['reviewer'], reviewed_at=review['reviewedAt'],
                           review_method=review['method'], verification_status='VERIFIED')
    rows = actual[TABLES[0]]
    require(len(rows) == 1, 'Expected exactly one scoped review bundle')
    require(datetime.fromisoformat(rows[0]['reviewed_at']) == datetime.fromisoformat(expected_bundle['reviewed_at']), 'Review timestamp differs')
    rows[0]['reviewed_at'] = expected_bundle['reviewed_at']
    require(rows == [expected_bundle], 'Review attestation/document differs from the pinned artifact')
    templates = [dict(template_code=r['code'], bundle_id=data['bundleId'], topic=r['topic'], relation=r['relation'],
                      content=r['content'], text_kind=r['textKind'], source_book_id=books['MH'], source_record=r)
                 for r in data['maiHoaTemplates']]
    passages = [dict(result_code=r['code'], bundle_id=data['bundleId'], rule_code=r['ruleCode'], column_number=r['column'],
                     title=r['title'], source_table_label=r['tableLabel'], source_content_heading=r['contentHeading'],
                     content=r['content'], text_kind=r['textKind'], source_book_id=books['TT'], source_record=r)
                for r in data['tamTheResults']]
    mappings = [dict(rule_code=r['ruleCode'], lookup_key=r['lookupKey'], bundle_id=data['bundleId'],
                     result_code=r['resultCode'], table_row=r['tableRow'], table_column=r['tableColumn'])
                for r in data['tamTheMappings']]
    canonical = lambda values: sorted(json.dumps(r, sort_keys=True, ensure_ascii=False) for r in values)
    for table, expected in zip(TABLES[1:], (templates, passages, mappings), strict=True):
        require(canonical(actual[table]) == canonical(expected), 'Content/source/label/mapping mismatch: ' + table)
    return dict(database=args.database, status='PASS', readOnly=True, bundleId=data['bundleId'], documentSha256=DATA_SHA256,
                scopedCounts={table: len(actual[table]) for table in TABLES},
                sangHenKeys=sum(r['rule_code'] == 'TT-SANG-HEN' for r in actual[TABLES[3]]),
                dienSanKeys=sum(r['rule_code'] == 'TT-DIEN-SAN' for r in actual[TABLES[3]]),
                exactContentAndReviewMatch=True, unvalidatedConstraints=0, approvalsChanged=False)


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'): stream.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5432)
    parser.add_argument('--user', default='postgres')
    parser.add_argument('--psql', default='psql')
    parser.add_argument('--output', type=Path, default=ROOT/'scripts/generated/v12_readings_audit.json')
    args = parser.parse_args()
    try:
        report = audit(args)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, indent=2))
        return 0
    except (ValueError, KeyError, TypeError, OSError, RuntimeError) as error:
        print('V12 audit failed: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
