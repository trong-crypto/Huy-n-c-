"""D02: reviewed wealth, common love, hour passages and seasonal anchors.

Default is a dry run; --apply imports and --apply --review applies the pinned
same-tool second-pass record. Every write uses one guarded transaction.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path

from import_book_knowledge import ROOT, RULES, HOUR_ANCHORS, HOUR_SOURCE, book_id, quote
from import_hexagram_names import psql
from import_tam_the_year_elements import STEMS, SOURCE_SHA, verify_pdf

MANIFEST_SHA = '40f065df746585f32660a485fd891738d6af5f5a37d21d22ac3bf52023a7e866'
REVIEWER = 'Codex D02 review 2026-10-25 (same-tool second pass)'
EDITOR = 'TV3_AI_D02_SOURCE_2026_10_25'
CODES = ('TT-TAI-LOC', 'TT-TINH-DUYEN', 'TT-36-PHAN', 'TT-GIO-SINH')
BRANCHES = ('DAN','MAO','THIN','TI','NGO','MUI','THAN','DAU','TUAT','HOI','TY','SUU')
PAGES = (25,26,27,28,41,42,63,64,65,66,67)
NOTE_BASE = ('D02 2026-10-25; two visual passes by the same Codex, not independent human review. '
             'Normalized spacing/punctuation; original archaic words retained. '
             'Scope=source table and selected transcription, not empirical validity. docs/29-D02-TAM-THE-DATA.md. ')
RULE_NOTES = {
    CODES[0]: NOTE_BASE + '120 printed incidences, 12 passages; only 60/120 stem-month keys present, two ordered results per matched key. '
              'BAt/BOI and BICH/BINH labels retained, linked by ordinal: DEC-20261025-D02-EDITORIAL. '
              'One partially damaged word in HUONG LOC is rendered [CHU_MO], not reconstructed.',
    CODES[1]: NOTE_BASE + '60 element-month keys and twelve eight-line poems PDF64-67; method intro PDF63. '
              'Scope=COMMON_LOVE_EIGHT_LINES; italic summaries and sex-specific chapters excluded. No partner data required.',
    CODES[2]: NOTE_BASE + '36 literal passages PDF25-28 verified; unusual ages 12/44 and Khac cua preserved. '
              'Source says three parts, not 40 minutes. Equal 40-minute segmentation and corrected So4->So5 reference '
              'are TEAM_DECISION DEC-20261025-D02-HOUR-PARTS; source transcription approval is scoped separately.',
    CODES[3]: NOTE_BASE + '12 anchors and day/night sequences PDF12-15 reviewed. Owner/TV2 month5 DAU->DAN approval retained. '
              'Month11 night first end printed 5:30, adopted 5:39 for continuous two-hour slots; '
              'DEC-20261025-D02-HOUR-PARTS records this editorial correction, not a publisher erratum.',
}
DESCRIPTIONS = {
    CODES[0]: 'D02: invert printed stem/month wealth table PDF41; preserve all matches in column order and explicit missing keys; passages PDF41-42.',
    CODES[1]: 'D02: common love table by year element and lunar month PDF64; twelve eight-line poems PDF64-67, method PDF63.',
    CODES[2]: 'D02: 12 branches x first/middle/last part, 36 source passages PDF25-28; 40-minute convention is a separate project decision.',
    CODES[3]: 'D02: seasonal hour anchors for all 12 lunar months, PDF12-15; original labels retained with documented project corrections.',
}
RULE_LOCATIONS = {CODES[0]: ('D02-TT-P041',41), CODES[1]: ('D02-TT-P063',63),
                  CODES[2]: ('TT-36-PHAN',25), CODES[3]: ('TT-GIO-SINH-5',14)}
LEGACY = {r[1]:r for r in RULES if r[1] in CODES}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def load_records(folder=ROOT/'data'):
    folder = Path(folder)
    manifest_text = (folder/'tam_the_d02_review.json').read_text(encoding='utf-8')
    require(digest(manifest_text)==MANIFEST_SHA, 'D02 pinned review changed')
    manifest=json.loads(manifest_text)
    require(manifest['pdfSha256']==SOURCE_SHA and manifest['reviewer']==REVIEWER, 'D02 wrong source/reviewer')
    for name,sha in manifest['files'].items():
        require(digest((folder/name).read_text(encoding='utf-8'))==sha, 'D02 changed source file: '+name)
    source=json.loads((folder/'tam_the_d02_source.json').read_text(encoding='utf-8'))
    columns=list(csv.DictReader(io.StringIO((folder/'tam_the_d02_columns.csv').read_text(encoding='utf-8'))))
    anchors=list(csv.DictReader(io.StringIO((folder/'tam_the_d02_anchors.csv').read_text(encoding='utf-8'))))
    require(len(columns)==24 and len(anchors)==12, 'D02 missing columns/anchors')
    entries=[]
    for table,expected_keys,prefix in (('wealth',STEMS,'STEM'),('love',('KIM','MOC','THUY','HOA','THO'),'ELEMENT')):
        data=source[table]
        require(tuple(data['rows'])==expected_keys and len(data['passages'])==12, 'D02 missing table rows/passages')
        for col,passage in enumerate(data['passages'],1):
            reviews=[r for r in columns if r['table']==table and int(r['column'])==col]
            require(len(reviews)==1 and int(reviews[0]['pdf_page'])==data['tablePage'], 'D02 duplicate column review')
            require([row[col-1] for row in data['rows'].values()]==[int(n) for n in reviews[0]['months_in_source_row_order'].split(';')], 'D02 row/column mismatch')
            require(passage['text'].strip() and len(set(passage['pages']))==len(passage['pages'])
                    and all(p in PAGES for p in passage['pages']), 'D02 missing passage provenance')
            if table=='love': require(len(passage['text'].splitlines())==8, 'D02 love scope is eight lines')
            for key,months in data['rows'].items():
                require(len(months)==12 and all(type(m) is int and 1<=m<=12 for m in months), 'D02 invalid month')
                entries.append(dict(rule=data['rule'], key=f'{prefix}:{key}|MONTH:{months[col-1]:02d}',
                    code=f'{table.upper()}_C{col:02d}',title=passage['label'],content=passage['text'],
                    table_page=data['tablePage'],content_page=passage['pages'][0],pages=passage['pages'],
                    table_label=passage['label'],heading=passage['heading'],note=RULE_NOTES[data['rule']]))
    portions=source['hourPortions']
    require(len(portions)==36 and {(p['branch'],p['part']) for p in portions}=={(b,i) for b in BRANCHES for i in (1,2,3)}, 'D02 missing hour portions')
    for p in portions:
        require(p['pages'] in ([25],[26],[27],[28]) and p['text'].strip(), 'D02 invalid hour passage')
        entries.append(dict(rule=CODES[2],key=f"BRANCH:{p['branch']}|PART:{p['part']}",code=f"HOUR_{p['branch']}_P{p['part']}",
            title=p['heading'],content=p['text'],table_page=25,content_page=p['pages'][0],pages=p['pages'],
            table_label=p['heading'],heading=p['heading'],note=RULE_NOTES[CODES[2]]))
    require(len(entries)==216 and len({(e['rule'],e['key'],e['code']) for e in entries})==216, 'D02 duplicate/missing entries')
    wealth=[e for e in entries if e['rule']==CODES[0]]
    require(len({e['key'] for e in wealth})==60 and all(sum(e['key']==key for e in wealth)==2 for key in {e['key'] for e in wealth}), 'D02 wealth coverage changed')
    require(len({e['key'] for e in entries if e['rule']==CODES[1]})==60, 'D02 love must cover 60 keys')
    for a,seed in zip(anchors,HOUR_ANCHORS,strict=True):
        month=int(a['month'])
        require((month,a['start'],a['source_branch'],a['adopted_branch'])==seed[:4]
                and (a['primary_label'],int(a['primary_page']))==HOUR_SOURCE[month], 'D02 anchor mismatch')
    return entries,anchors


def classify_hour(lunar_month, hhmm, anchors):
    """D02 decision: minute resolution, half-open 40-minute portions, wrap midnight."""
    require(type(lunar_month) is int and 1<=lunar_month<=12, 'Invalid lunar month')
    def minute(value):
        parts=value.split(':')
        require(len(parts)==2 and all(len(x)==2 and x.isascii() and x.isdigit() for x in parts), 'Invalid HH:mm')
        h,m=map(int,parts)
        require(0<=h<24 and 0<=m<60,'Invalid HH:mm')
        return h*60+m
    start=next(a['start'] for a in anchors if int(a['month'])==lunar_month)
    offset=(minute(hhmm)-minute(start))%1440
    return BRANCHES[offset//120], offset%120//40+1


# Projection used for read-only audits and guarded imports. No database IDs in
# the review identity; all page references include the actual book and labels.
ENTRY_QUERY = """SELECT r.rule_code AS rule,e.lookup_key AS key,e.result_code AS code,
 e.title,e.description AS content,s.pdf_page AS table_page,cs.pdf_page AS content_page,
 e.source_table_label AS table_label,e.source_content_heading AS heading,e.verification_note AS note,
 e.verification_status AS status,e.editor,e.reviewer,e.reviewed_at,
 s.section_label AS table_source,s.printed_page_label AS table_printed,b.file_sha256 AS table_sha,
 cs.section_label AS content_source,cs.printed_page_label AS content_printed,cb.file_sha256 AS content_sha,
 coalesce((SELECT jsonb_agg(jsonb_build_object('order',p.page_order,'page',ps.pdf_page,
 'label',ps.section_label,'printed',ps.printed_page_label,'sha',pb.file_sha256) ORDER BY p.page_order)
 FROM tam_the_lookup_source_pages p JOIN source_sections ps ON ps.id=p.source_section_id
 JOIN source_books pb ON pb.id=ps.source_book_id WHERE p.entry_id=e.id),'[]'::jsonb) AS page_sources
 FROM tam_the_lookup_entries e JOIN calculation_rules r ON r.id=e.rule_id
 JOIN source_sections s ON s.id=e.source_section_id JOIN source_books b ON b.id=s.source_book_id
 LEFT JOIN source_sections cs ON cs.id=e.content_source_section_id LEFT JOIN source_books cb ON cb.id=cs.source_book_id
 WHERE r.module='TAM_THE' AND r.rule_version='1.0' AND r.rule_code IN('TT-TAI-LOC','TT-TINH-DUYEN','TT-36-PHAN')"""


def source_label(page): return f'D02-TT-P{page:03d}'


def page_sources(entry):
    return [dict(order=i,page=p,label=source_label(p),printed=str(p+1),sha=SOURCE_SHA) for i,p in enumerate(entry['pages'],1)]


def anchor_note(a):
    return NOTE_BASE + 'Anchor month='+a['month']+'; complete day/night sequence PDF='+a['pdf_pages']+'; '+RULE_NOTES[CODES[3]]


def build_sql(records, review=False):
    entries,anchors=records
    sql=['BEGIN;', "SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';",
         'LOCK TABLE tam_the_lookup_entries,tam_the_lookup_source_pages,tam_the_hour_anchors,calculation_rules,source_sections,source_books IN SHARE ROW EXCLUSIVE MODE;',
         'CREATE TEMP TABLE d02_import(rule text,key text,code text,title text,content text,table_page int,content_page int,table_label text,heading text,note text,pages jsonb,PRIMARY KEY(rule,key,code)) ON COMMIT DROP;']
    sql.append('INSERT INTO d02_import VALUES '+','.join('('+','.join(quote(e[k]) for k in ('rule','key','code','title','content','table_page','content_page','table_label','heading','note'))+','+quote(json.dumps(e['pages']))+'::jsonb)' for e in entries)+';')
    sql.append(f"""DO $$ BEGIN
IF (SELECT count(*) FROM source_books WHERE id={book_id('TT')} AND file_sha256={quote(SOURCE_SHA)} AND pdf_page_count=360)<>1
 THEN RAISE EXCEPTION 'D02 wrong source edition'; END IF;
END $$;""")
    for page in PAGES:
        label=source_label(page)
        excerpt=f'D02 reviewed page PDF{page}/print{page+1}; scope and editorial decisions in docs/29-D02-TAM-THE-DATA.md.'
        sql.append(f"""DO $$ BEGIN
IF EXISTS(SELECT 1 FROM source_sections WHERE source_book_id={book_id('TT')} AND section_label={quote(label)}
 AND (pdf_page<>{page} OR printed_page_label IS DISTINCT FROM {quote(str(page+1))} OR excerpt IS DISTINCT FROM {quote(excerpt)}))
 THEN RAISE EXCEPTION 'D02 protected source changed'; END IF; END $$;
INSERT INTO source_sections(source_book_id,section_label,printed_page_label,pdf_page,excerpt)
 VALUES({book_id('TT')},{quote(label)},{quote(str(page+1))},{page},{quote(excerpt)})
 ON CONFLICT(source_book_id,section_label,pdf_page) DO NOTHING;""")
    for code in CODES:
        legacy=LEGACY[code]
        old_source='r.source_section_id IS NULL' if legacy[3] is None else f"(s.section_label={quote(legacy[4])} AND s.pdf_page={legacy[5]} AND s.source_book_id={book_id('TT')} AND s.printed_page_label={quote(str(legacy[5]+1))})"
        label,page=RULE_LOCATIONS[code]
        sql.append(f"""DO $$ BEGIN
IF (SELECT count(*) FROM calculation_rules r LEFT JOIN source_sections s ON s.id=r.source_section_id
 WHERE r.module='TAM_THE' AND r.rule_code={quote(code)} AND r.rule_version='1.0' AND r.external_source_id IS NULL AND (
 (r.verification_status={quote(legacy[2])} AND r.description={quote(legacy[-1])} AND {old_source}
 AND r.reviewer IS NULL AND r.reviewed_at IS NULL AND r.verification_note IS NULL) OR
 (r.verification_status='VERIFIED' AND r.description={quote(DESCRIPTIONS[code])} AND r.reviewer={quote(REVIEWER)}
 AND r.reviewed_at IS NOT NULL AND r.verification_note={quote(RULE_NOTES[code])}
 AND s.source_book_id={book_id('TT')} AND s.section_label={quote(label)} AND s.pdf_page={page} AND s.printed_page_label={quote(str(page+1))})))<>1
 THEN RAISE EXCEPTION 'D02 protected rule changed'; END IF; END $$;""")
    sql.append('CREATE TEMP VIEW d02_actual AS '+ENTRY_QUERY+';')
    comparisons=' OR '.join(f'a.{k} IS DISTINCT FROM n.{k}' for k in ('title','content','table_page','content_page','table_label','heading'))
    sql.append(f"""DO $$ BEGIN
IF EXISTS(SELECT 1 FROM d02_actual a LEFT JOIN d02_import n USING(rule,key,code)
 WHERE n.key IS NULL OR {comparisons} OR a.editor IS DISTINCT FROM {quote(EDITOR)}
 OR a.table_sha IS DISTINCT FROM {quote(SOURCE_SHA)} OR a.content_sha IS DISTINCT FROM {quote(SOURCE_SHA)}
 OR a.table_source IS DISTINCT FROM 'D02-TT-P'||lpad(n.table_page::text,3,'0')
 OR a.table_printed IS DISTINCT FROM (n.table_page+1)::text
 OR a.content_source IS DISTINCT FROM 'D02-TT-P'||lpad(n.content_page::text,3,'0')
 OR a.content_printed IS DISTINCT FROM (n.content_page+1)::text
 OR a.page_sources IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('order',x.ordinality,'page',x.value::int,
 'label','D02-TT-P'||lpad(x.value,3,'0'),'printed',(x.value::int+1)::text,'sha',{quote(SOURCE_SHA)}) ORDER BY x.ordinality)
 FROM jsonb_array_elements_text(n.pages) WITH ORDINALITY x)
 OR NOT coalesce(((a.status='SOURCE_LOCATED' AND a.reviewer IS NULL AND a.reviewed_at IS NULL AND a.note IS NULL)
 OR (a.status='VERIFIED' AND a.reviewer={quote(REVIEWER)} AND a.reviewed_at IS NOT NULL AND a.note=n.note)),false))
 THEN RAISE EXCEPTION 'D02 protected entry or page chain changed'; END IF; END $$;""")
    # Anchor values and the original TV2 approval are protected separately.
    for a,seed in zip(anchors,HOUR_ANCHORS,strict=True):
        month=int(a['month'])
        decision,reason=seed[4:]
        state=("a.verification_status='VERIFIED' AND a.reviewer='TV2 (project owner confirmation)' AND a.reviewed_at IS NOT NULL "
               "AND a.verification_note='TV2 confirmation reported by project owner on 2026-10-23; source printed DAU, team adopts DAN only for month 5.'") if month==5 else (
            f"((a.verification_status='SOURCE_LOCATED' AND a.reviewer IS NULL AND a.reviewed_at IS NULL AND a.verification_note IS NULL) OR "
            f"(a.verification_status='VERIFIED' AND a.reviewer={quote(REVIEWER)} AND a.reviewed_at IS NOT NULL AND a.verification_note={quote(anchor_note(a))}))")
        sql.append(f"""DO $$ BEGIN
IF (SELECT count(*) FROM tam_the_hour_anchors a JOIN source_sections s ON s.id=a.source_section_id
 WHERE a.lunar_month={month} AND a.first_hour_start={quote(a['start'])}::time AND a.source_branch={quote(a['source_branch'])}
 AND a.adopted_branch={quote(a['adopted_branch'])} AND a.decision_status={quote(decision)} AND a.decision_reason IS NOT DISTINCT FROM {quote(reason)}
 AND s.section_label={quote(a['primary_label'])} AND s.pdf_page={a['primary_page']} AND s.source_book_id={book_id('TT')}
 AND s.printed_page_label={quote(str(int(a['primary_page'])+1))} AND ({state}))<>1
 THEN RAISE EXCEPTION 'D02 protected anchor changed'; END IF; END $$;""")
    if not review:
        sql.append(f"""INSERT INTO tam_the_lookup_entries(rule_id,lookup_key,result_code,title,description,source_section_id,
 content_source_section_id,source_table_label,source_content_heading,verification_status,editor)
SELECT r.id,n.key,n.code,n.title,n.content,s.id,cs.id,n.table_label,n.heading,'SOURCE_LOCATED',{quote(EDITOR)}
 FROM d02_import n JOIN calculation_rules r ON r.module='TAM_THE' AND r.rule_code=n.rule AND r.rule_version='1.0'
 JOIN source_sections s ON s.source_book_id={book_id('TT')} AND s.section_label='D02-TT-P'||lpad(n.table_page::text,3,'0') AND s.pdf_page=n.table_page
 JOIN source_sections cs ON cs.source_book_id={book_id('TT')} AND cs.section_label='D02-TT-P'||lpad(n.content_page::text,3,'0') AND cs.pdf_page=n.content_page
ON CONFLICT(rule_id,lookup_key,result_code) DO NOTHING;
INSERT INTO tam_the_lookup_source_pages(entry_id,page_order,source_section_id)
SELECT e.id,x.ordinality,s.id FROM d02_import n JOIN calculation_rules r ON r.module='TAM_THE' AND r.rule_code=n.rule AND r.rule_version='1.0'
 JOIN tam_the_lookup_entries e ON e.rule_id=r.id AND e.lookup_key=n.key AND e.result_code=n.code
 CROSS JOIN LATERAL jsonb_array_elements_text(n.pages) WITH ORDINALITY x
 JOIN source_sections s ON s.source_book_id={book_id('TT')} AND s.section_label='D02-TT-P'||lpad(x.value,3,'0') AND s.pdf_page=x.value::int
ON CONFLICT(entry_id,page_order) DO NOTHING;""")
    sql.append("""DO $$ BEGIN
IF (SELECT count(*) FROM d02_actual)<>216 OR (SELECT count(*) FROM d02_actual a JOIN d02_import n USING(rule,key,code))<>216
 THEN RAISE EXCEPTION 'D02 expected exactly 216 entries before review'; END IF; END $$;""")
    if review:
        sql.append(f"""UPDATE tam_the_lookup_entries e SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},reviewed_at=CURRENT_TIMESTAMP,
 verification_note=n.note FROM d02_import n,calculation_rules r WHERE e.rule_id=r.id AND r.module='TAM_THE' AND r.rule_version='1.0'
 AND r.rule_code=n.rule AND e.lookup_key=n.key AND e.result_code=n.code AND e.verification_status='SOURCE_LOCATED';""")
        for code in CODES:
            label,page=RULE_LOCATIONS[code]
            sql.append(f"""UPDATE calculation_rules SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},reviewed_at=CURRENT_TIMESTAMP,
 verification_note={quote(RULE_NOTES[code])},description={quote(DESCRIPTIONS[code])},
 source_section_id=(SELECT id FROM source_sections WHERE source_book_id={book_id('TT')} AND section_label={quote(label)} AND pdf_page={page})
 WHERE module='TAM_THE' AND rule_code={quote(code)} AND rule_version='1.0' AND verification_status<>'VERIFIED';""")
        for a in anchors:
            if int(a['month'])!=5:
                sql.append(f"UPDATE tam_the_hour_anchors SET verification_status='VERIFIED',reviewer={quote(REVIEWER)},reviewed_at=CURRENT_TIMESTAMP,verification_note={quote(anchor_note(a))} WHERE lunar_month={a['month']} AND verification_status='SOURCE_LOCATED';")
    return '\n'.join(sql)+'\nCOMMIT;\n'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--review',action='store_true')
    parser.add_argument('--pdf-dir',type=Path,default=Path.home()/'Downloads')
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=5432)
    parser.add_argument('--user',default='postgres')
    parser.add_argument('--database',default='huyenco')
    parser.add_argument('--psql',default='psql')
    args=parser.parse_args()
    records=load_records();verify_pdf(args.pdf_dir)
    sql=build_sql(records,args.review)
    folder=ROOT/'scripts/generated';folder.mkdir(exist_ok=True)
    (folder/('d02_review.sql' if args.review else 'd02_import.sql')).write_text(sql,encoding='utf-8')
    if not args.apply:
        print('DRY RUN: 120 wealth + 60 love + 36 hour entries, 12 anchors; no DB writes.');return
    backup=psql(args,"SELECT json_build_object('entries',(SELECT coalesce(json_agg(x),'[]'::json) FROM ("+ENTRY_QUERY+") x),'anchors',(SELECT json_agg(a) FROM tam_the_hour_anchors a),'rules',(SELECT json_agg(r) FROM calculation_rules r WHERE rule_code IN('TT-TAI-LOC','TT-TINH-DUYEN','TT-36-PHAN','TT-GIO-SINH')));")
    backups=folder/'db-backups';backups.mkdir(exist_ok=True)
    (backups/('before-d02-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json')).write_text(json.dumps(json.loads(backup),ensure_ascii=False,indent=2),encoding='utf-8')
    psql(args,sql)
    print('COMMITTED: '+('216 entries + 12 anchors + four rules reviewed; month5 TV2 metadata preserved.' if args.review else 'D02 source entries and full content page chains imported.'))


if __name__=='__main__': main()
