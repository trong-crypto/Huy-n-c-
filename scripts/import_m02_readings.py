"""M02 data stage: import pinned M01 content without enabling a runtime rule.

Dry run is default. --apply requires --database, original PDFs, Flyway V12,
PGPASSWORD and a successful full pg_dump. Existing conflicting rows are rejected.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys

from check_m01_readings import DATA_SHA256, ROOT, load_review, require
from import_book_knowledge import find_psql, quote
from import_hexagram_names import psql

TABLES = ('reading_source_bundles','mai_hoa_reading_templates',
          'tam_the_supplement_results','tam_the_supplement_mappings')
KEYS = ('bundle_id','template_code','result_code','bundle_id,rule_code,lookup_key')


def json_sql(value):
    return quote(json.dumps(value, ensure_ascii=False, separators=(',',':'))) + '::jsonb'


def build_sql(data: dict) -> str:
    bundle = quote(data['bundleId'])
    review = data['review']
    sql = ["BEGIN;", "SET LOCAL lock_timeout='5s';", "SET LOCAL statement_timeout='45s';",
           'LOCK TABLE source_books IN SHARE MODE;',
           'LOCK TABLE ' + ','.join(TABLES) + ' IN SHARE ROW EXCLUSIVE MODE;',
           "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version='12' AND success) "
           "THEN RAISE EXCEPTION 'M02 requires successful Flyway V12'; END IF; END $$;"]
    for book in data['books'].values():
        sql.append(f"DO $$ BEGIN IF (SELECT count(*) FROM source_books WHERE file_sha256={quote(book['sha256'])} "
                   f"AND pdf_page_count={book['pages']}) <> 1 THEN RAISE EXCEPTION 'M02 source PDF identity mismatch'; END IF; END $$;")
    for table in TABLES:
        sql.append(f'CREATE TEMP TABLE expected_{table} (LIKE {table} INCLUDING DEFAULTS) ON COMMIT DROP;')
    sql.append('INSERT INTO expected_reading_source_bundles VALUES (' + ','.join([
        bundle,quote(DATA_SHA256),json_sql(data),quote(review['editor']),quote(review['reviewer']),
        quote(review['reviewedAt'])+'::timestamptz',quote(review['method']),"'VERIFIED'"]) + ');')
    mh_book = f"(SELECT id FROM source_books WHERE file_sha256={quote(data['books']['MH']['sha256'])})"
    tt_book = f"(SELECT id FROM source_books WHERE file_sha256={quote(data['books']['TT']['sha256'])})"
    for row in data['maiHoaTemplates']:
        values = [quote(row['code']),bundle,quote(row['topic']),quote(row['relation']),
                  quote(row['content']),quote(row['textKind']),mh_book,json_sql(row)]
        sql.append('INSERT INTO expected_mai_hoa_reading_templates VALUES ('+','.join(values)+');')
    for row in data['tamTheResults']:
        values = [quote(row['code']),bundle,quote(row['ruleCode']),str(row['column']),quote(row['title']),
                  quote(row['tableLabel']),quote(row['contentHeading']),quote(row['content']),
                  quote(row['textKind']),tt_book,json_sql(row)]
        sql.append('INSERT INTO expected_tam_the_supplement_results VALUES ('+','.join(values)+');')
    for row in data['tamTheMappings']:
        values = [quote(row['ruleCode']),quote(row['lookupKey']),bundle,quote(row['resultCode']),
                  str(row['tableRow']),str(row['tableColumn'])]
        sql.append('INSERT INTO expected_tam_the_supplement_mappings VALUES ('+','.join(values)+');')
    # Whole-row comparison protects content, source, review time and the editorial decisions.
    # If a bundle is present, partial deletion is corruption; reruns must never silently repair it.
    for table in TABLES:
        sql.append(f"""DO $$ BEGIN
IF EXISTS (SELECT 1 FROM {table} p WHERE p.bundle_id={bundle}
   AND NOT EXISTS (SELECT 1 FROM expected_{table} e WHERE to_jsonb(e)=to_jsonb(p)))
THEN RAISE EXCEPTION 'M02 changed/protected row in {table}'; END IF;
IF EXISTS (SELECT 1 FROM reading_source_bundles WHERE bundle_id={bundle})
   AND EXISTS ((SELECT * FROM expected_{table}) EXCEPT (SELECT * FROM {table} WHERE bundle_id={bundle}))
THEN RAISE EXCEPTION 'M02 incomplete existing bundle in {table}'; END IF;
END $$;""")
    for table,key in zip(TABLES,KEYS,strict=True):
        same_key = ' AND '.join(f'p.{k.strip()}=e.{k.strip()}' for k in key.split(','))
        sql.append(f'INSERT INTO {table} SELECT e.* FROM expected_{table} e '
                   f'WHERE NOT EXISTS (SELECT 1 FROM {table} p WHERE {same_key});')
    for table in TABLES:
        sql.append(f"""DO $$ BEGIN
IF EXISTS ((SELECT * FROM expected_{table}) EXCEPT (SELECT * FROM {table} WHERE bundle_id={bundle}))
 OR EXISTS ((SELECT * FROM {table} WHERE bundle_id={bundle}) EXCEPT (SELECT * FROM expected_{table}))
THEN RAISE EXCEPTION 'M02 final content/source/count mismatch in {table}'; END IF;
END $$;""")
    sql.append('COMMIT;')
    return '\n'.join(sql) + '\n'


def backup_database(args) -> Path:
    executable = Path(find_psql(args.psql)).with_name('pg_dump.exe' if os.name == 'nt' else 'pg_dump')
    folder = ROOT/'scripts/generated/db-backups'
    folder.mkdir(parents=True,exist_ok=True)
    destination = folder/('before-m02-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.dump')
    command = [str(executable),'-w','-h',args.host,'-p',str(args.port),'-U',args.user,
               '-d',args.database,'-Fc','-f',str(destination)]
    completed = subprocess.run(command,capture_output=True,text=True,encoding='utf-8',timeout=180,
                               env=dict(os.environ,PGCONNECT_TIMEOUT='10'))
    require(completed.returncode == 0 and destination.is_file() and destination.stat().st_size > 0,
            'Full backup failed; database unchanged. '+completed.stderr.strip())
    return destination


def main():
    for stream in (sys.stdout,sys.stderr):
        if hasattr(stream,'reconfigure'): stream.reconfigure(encoding='utf-8',errors='replace')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--database',help='Explicit target required when applying; prefer a dedicated TEST DB')
    parser.add_argument('--pdf-dir',type=Path,default=Path.home()/'Downloads')
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=5432)
    parser.add_argument('--user',default='postgres')
    parser.add_argument('--psql',default='psql')
    parser.add_argument('--sql-output',type=Path,default=ROOT/'scripts/generated/m02_readings.sql')
    args=parser.parse_args()
    try:
        data=load_review(pdf_dir=args.pdf_dir)
        sql=build_sql(data)
        args.sql_output.parent.mkdir(parents=True,exist_ok=True)
        args.sql_output.write_text(sql,encoding='utf-8')
        if not args.apply:
            print('M02 DRY RUN: 20 Mai Hoa templates, 19 Tam The passages, 204 mappings; database unchanged.')
            return 0
        require(args.database and args.database not in ('postgres','template0','template1'),
                'An explicit project/TEST database is required')
        require(os.environ.get('PGPASSWORD'),'Set PGPASSWORD in the process environment')
        require(psql(args,'SELECT current_database();') == args.database,'Unexpected database')
        require(psql(args,"SELECT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version='12' AND success);") == 't',
                'Run Flyway V12 before this import')
        print('Full backup: '+str(backup_database(args)))
        psql(args,sql)
        print('M02 imported and compared all scoped records; runtime remains disabled. Reruns preserve review timestamps.')
        return 0
    except (ValueError,KeyError,TypeError,OSError,RuntimeError,subprocess.SubprocessError) as error:
        print(f'M02 failed: {error}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
