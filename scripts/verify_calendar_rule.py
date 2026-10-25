"""C01: apply the pinned calendar review to an exact source/rule; never approve modified data."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from import_book_knowledge import ROOT, RULES, quote
from import_hexagram_names import psql

MANIFEST = ROOT / 'data/c01_calendar_source.json'
MANIFEST_SHA = 'd2618736fb91e0999b41b03c41897245eed295f67dc289219a6d350494fd4436'
NOTE = 'C01: fixed UTC+7 civil calendar 1900-01-01..2099-12-31; Time4J 5.9.4 astronomy generated table, pinned hash. Tet changes lunar year; midnight changes civil day; leap month retains month Can Chi. Independent HKO/almanac controls and exhaustive consistency recorded in docs/26-C01-CALENDAR-HANDOFF.md. Not a historical Vietnamese calendar or Bazi solar-term pillars.'
DESCRIPTION = 'C01 fixed UTC+7 solar/lunar conversion and civil Can Chi; pinned generated calendar table, 1900..2099.'
LEGACY = next(r[-1] for r in RULES if r[1] == 'LUNAR-CONVERSION')

def digest(path):
    return hashlib.sha256(Path(path).read_text(encoding='utf-8').replace('\r\n','\n').encode()).hexdigest()

def load_review():
    if digest(MANIFEST) != MANIFEST_SHA:
        raise ValueError('C01 manifest changed; source and validation review required')
    m = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if digest(ROOT / m['resource']) != m['resourceSha256'] or digest(ROOT / m['hndReference']['resource']) != m['hndReference']['sha256']:
        raise ValueError('C01 calendar source/reference changed')
    if digest(ROOT / m['generator']) != m['generatorSha256'] or digest(ROOT / m['controlDates']) != m['controlDatesSha256']:
        raise ValueError('C01 generator or independent controls changed')
    return m

def build_sql(m):
    fields = ('sourceId','title','version','section','url','resourceSha256')
    values = ','.join(quote(m[k]) for k in fields)
    exact = ' AND '.join(f'x.{col} IS NOT DISTINCT FROM {quote(m[k])}' for col,k in zip(
        ('source_id','title','version','section','url','sha256'),fields))
    return f"""BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
LOCK TABLE calculation_rules,external_sources IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
IF EXISTS(SELECT 1 FROM external_sources x WHERE x.source_id={quote(m['sourceId'])} AND NOT ({exact}))
 THEN RAISE EXCEPTION 'C01 protected external source changed'; END IF;
IF (SELECT count(*) FROM calculation_rules r WHERE module='CALENDAR' AND rule_code='LUNAR-CONVERSION' AND rule_version='1.0'
 AND source_section_id IS NULL AND ((verification_status='DRAFT' AND external_source_id IS NULL
 AND reviewer IS NULL AND reviewed_at IS NULL AND verification_note IS NULL AND description={quote(LEGACY)})
 OR (verification_status='VERIFIED' AND external_source_id={quote(m['sourceId'])}
 AND reviewer={quote(m['reviewer'])} AND reviewed_at IS NOT NULL AND verification_note={quote(NOTE)} AND description={quote(DESCRIPTION)})))<>1
 THEN RAISE EXCEPTION 'C01 changed/protected calendar rule'; END IF;
IF EXISTS(SELECT 1 FROM calculation_rules WHERE module='CALENDAR' AND rule_code='LUNAR-CONVERSION' AND rule_version='1.0'
 AND verification_status='VERIFIED') AND NOT EXISTS(SELECT 1 FROM external_sources x WHERE {exact})
 THEN RAISE EXCEPTION 'C01 approved source missing'; END IF;
END $$;
INSERT INTO external_sources(source_id,title,version,section,url,sha256) VALUES({values}) ON CONFLICT(source_id) DO NOTHING;
UPDATE calculation_rules SET external_source_id={quote(m['sourceId'])},verification_status='VERIFIED',
 reviewer={quote(m['reviewer'])},reviewed_at=CURRENT_TIMESTAMP,verification_note={quote(NOTE)},description={quote(DESCRIPTION)}
 WHERE module='CALENDAR' AND rule_code='LUNAR-CONVERSION' AND rule_version='1.0' AND verification_status='DRAFT';
COMMIT;
"""

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=5432)
    parser.add_argument('--database',default='huyenco')
    parser.add_argument('--user',default='postgres')
    parser.add_argument('--psql',default='psql')
    args=parser.parse_args()
    m=load_review()
    sql=build_sql(m)
    output=ROOT/'scripts/generated'; output.mkdir(exist_ok=True)
    (output/'c01_review.sql').write_text(sql,encoding='utf-8')
    if not args.apply:
        print('DRY RUN: C01 pinned calendar/review intact; no DB writes.')
        return
    backup=json.loads(psql(args,"SELECT json_build_object('rules',(SELECT json_agg(r) FROM calculation_rules r WHERE rule_code='LUNAR-CONVERSION'),'sources',(SELECT json_agg(x) FROM external_sources x));"))
    folder=output/'db-backups';folder.mkdir(exist_ok=True)
    (folder/('before-c01-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json')).write_text(json.dumps(backup,ensure_ascii=False,indent=2),encoding='utf-8')
    psql(args,sql)
    print('COMMITTED: LUNAR-CONVERSION VERIFIED for pinned fixed UTC+7 calendar/Can Chi; existing review preserved.')

if __name__=='__main__':
    main()
