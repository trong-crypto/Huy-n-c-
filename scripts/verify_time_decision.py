"""Record the owner's confirmed MOD6 correction as VERIFIED project rule MH-TIME only."""
import argparse
import json
from datetime import datetime, timezone
from import_book_knowledge import ROOT, RULES, quote
from import_hexagram_names import psql, SOURCE_SHA

REVIEWER = 'Project owner confirmation via chat 2026-10-24; recorded by Codex'
NOTE = ('Owner explicitly confirmed TIME movingLine=(Y+M+D+H)%6, remainder0->6, and reaffirmed approval in chat. '
        'VERIFIED scope: adopted project rule/correction MOD6, not a claim that the printed text agrees or publisher issued an erratum. '
        'Original Mai Hoa PDF45/print50 says tru di 8; preserved in source page and decision history. '
        'Execution remains TEAM_DECISION with civil/calendar conventions. docs/28-TIME-OWNER-APPROVAL.md.')
DESCRIPTION = 'Owner-approved TIME rule: upper=(Y+M+D)%8, lower=(Y+M+D+H)%8, moving=(Y+M+D+H)%6; zero->8/8/6. Original print50 text retained.'
LEGACY = next(r[-1] for r in RULES if r[1]=='MH-TIME')

def build_sql():
    return f"""BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
LOCK TABLE calculation_rules,source_sections,source_books IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
IF (SELECT count(*) FROM calculation_rules r JOIN source_sections s ON s.id=r.source_section_id
 JOIN source_books b ON b.id=s.source_book_id
 WHERE r.module='MAI_HOA' AND r.rule_code='MH-TIME' AND r.rule_version='1.0'
 AND r.external_source_id IS NULL AND s.section_label='MH-TIME-CONFLICT' AND s.pdf_page=45 AND s.printed_page_label='50'
 AND b.file_sha256={quote(SOURCE_SHA)} AND b.pdf_page_count=672 AND (
 (r.verification_status='BLOCKED_SOURCE_CONFLICT' AND r.reviewer IS NULL AND r.reviewed_at IS NULL
  AND r.verification_note IS NULL AND r.description={quote(LEGACY)}) OR
 (r.verification_status='VERIFIED' AND r.reviewer={quote(REVIEWER)} AND r.reviewed_at IS NOT NULL
  AND r.verification_note={quote(NOTE)} AND r.description={quote(DESCRIPTION)})))<>1
 THEN RAISE EXCEPTION 'TIME owner approval: source or protected rule changed'; END IF;
END $$;
UPDATE calculation_rules SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},reviewed_at=CURRENT_TIMESTAMP,
 verification_note={quote(NOTE)},description={quote(DESCRIPTION)}
 WHERE module='MAI_HOA' AND rule_code='MH-TIME' AND rule_version='1.0' AND verification_status='BLOCKED_SOURCE_CONFLICT';
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
    sql=build_sql()
    output=ROOT/'scripts/generated';output.mkdir(exist_ok=True)
    (output/'b04_time_owner_approval.sql').write_text(sql,encoding='utf-8')
    if not args.apply:
        print('DRY RUN: only owner-approved MH-TIME correction will change.')
        return
    backup=json.loads(psql(args,"SELECT coalesce(json_agg(r),'[]'::json) FROM calculation_rules r WHERE module='MAI_HOA' AND rule_code='MH-TIME';"))
    folder=output/'db-backups';folder.mkdir(exist_ok=True)
    (folder/('before-time-owner-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json')).write_text(json.dumps(backup,ensure_ascii=False,indent=2),encoding='utf-8')
    psql(args,sql)
    print('COMMITTED: MH-TIME VERIFIED as owner-approved MOD6 project rule; printed text and execution policy retained.')

if __name__=='__main__': main()
