"""Validate the pinned M01 review bundle. This check never grants runtime access."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from check_s04_reading_sources import (ROOT, TOPICS, RELATIONS, check as check_survey,
                                       require, unique_object)

DATA = ROOT / 'data/m01_reviewed_readings.json'
MANIFEST = ROOT / 'data/m01_readings_manifest.json'
# Pin UTF-8 text after universal-newline normalization for Windows checkouts.
DATA_SHA256 = 'e3c460cdfe1a96546b243155205d12e8a27c1e45882452344a7dafa778e295b6'
BUNDLE_ID = 'M01-READINGS-20261026-V1'


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique_object)


def validate(data: dict, manifest: dict, survey: dict) -> None:
    require(data['schemaVersion'] == manifest['schemaVersion'] == 1
            and data['task'] == manifest['task'] == 'M01', 'Wrong M01 task/schema')
    require(data['bundleId'] == manifest['bundleId'] == BUNDLE_ID, 'Wrong M01 bundle')
    require(data['runtimeEnabled'] is False and manifest['runtimeEnabled'] is False,
            'Source review must not enable runtime')
    require(data['sourceSurveySha256'] == manifest['sourceSurveySha256'] ==
            '269fc5cbd3e8dca0812e9eb485233d493b89efd68ad00a96b966eeb934431457',
            'Wrong survey dependency')
    require(data['books'] == survey['books'], 'Reviewed PDF identities changed')
    review = data['review']
    require(review == manifest['review'] and review['method'] == 'SAME_TOOL_TWO_VISUAL_PASSES'
            and review['independentHumanReview'] is False
            and review['editor'] and review['reviewer'] and review['reviewedAt'],
            'Missing or misrepresented review provenance')

    def location(ref):
        book = data['books'][ref['book']]
        require(ref['pdfPages'] and len(ref['pdfPages']) == len(ref['printedPages'])
                and all(type(p) is int and 1 <= p <= book['pages'] for p in ref['pdfPages'])
                and all(type(p) is int and p > 0 for p in ref['printedPages']),
                'Invalid PDF/printed page reference')

    decisions = {r['id']: r for r in data['decisions']}
    prefix = 'DEC-20261026-M01-'
    require(len(data['decisions']) == len(decisions) == 7 and set(decisions) ==
            {prefix + s for s in ('BODY','PHASES','SEASON','RELATIONS','SANG-HEN-LABELS',
                                  'DIEN-SAN-LABELS','DIEN-SAN-REFERENCE')}, 'Missing decision')
    for decision in decisions.values():
        location(decision['source'])
        require(decision['detail'] and decision['limitation'], 'Missing decision limitation')
        verified = decision['id'].endswith('-RELATIONS')
        require(decision['basis'] == ('SOURCE_VERIFIED' if verified else 'TEAM_DECISION'),
                'Unverified convention promoted to verified book rule')
        require(decision['purpose'] == 'INTERPRETATION' if verified else
                decision['purpose'] in ('CALCULATION','EDITORIAL_LINK'),
                'Team decision cannot authorize interpretation content')
        require(decision['sourceStatus'] == ('VERIFIED' if verified else
                'SOURCE_LOCATED' if decision['id'].endswith('-SEASON') else 'SOURCE_AMBIGUOUS'),
                'Source ambiguity removed')

    templates = data['maiHoaTemplates']
    require(len(templates) == 20 and {(r['topic'],r['relation']) for r in templates} ==
            {(t,r) for t in TOPICS for r in RELATIONS}, 'Missing/duplicate Mai Hoa template')
    source_pages = {'GENERAL':([132,135],[138,141]), 'CAREER':([156,157],[162,163]),
                    'WEALTH':([158],[164]), 'LOVE':([150,151],[156,157])}
    codes = set()
    for row in templates + data['tamTheResults']:
        require(row['code'] not in codes, 'Duplicate content code')
        codes.add(row['code'])
        require(row['review'] == review and row['sourceStatus'] == 'VERIFIED'
                and row['basis'] == 'SOURCE_VERIFIED' and row['content'].strip()
                and row['textKind'] == 'EDITORIAL_PARAPHRASE', 'Unreviewed or mislabeled content')
    for row in templates:
        require(row['code'] == f"MH-{row['topic']}-{row['relation']}" and row['content'] ==
                survey['maiHoa']['candidateParaphrases'][row['topic']][row['relation']],
                'Mai Hoa content differs from visually reviewed candidate')
        location(row['source'])
        require(row['source'] == {'book':'MH','pdfPages':source_pages[row['topic']][0],
                                  'printedPages':source_pages[row['topic']][1]}, 'Wrong template pages')

    results = data['tamTheResults']
    require(len(results) == 19, 'Need twelve Sang hen and seven Dien san passages')
    by_code = {r['code']: r for r in results}
    sang_labels = ['Nhựt mã','Lục hại','Hoa cái','Kiếp sát','Tai sát','Thiên sát','Địa sát',
                   'Niên sát','Ngoại sát','Vong sát','Tướng linh','Thiên an']
    sang_headings = ['Nhựt Mã','Lục Hại','Hao Cái','Kiếp Sát','Tai Sát','Thiên Sát','Địa Sát',
                     'Niên Sát','Ngoại Sát','Vong Thần','Tướng Tinh','Phiên An']
    dien_labels = ['Không','Bại','Hướng','Kiên','Giải','Phú','Hiệp']
    for rule, labels, headings, tablepage in (
        ('TT-SANG-HEN',sang_labels,sang_headings,43),
        ('TT-DIEN-SAN',dien_labels,dien_labels[:5]+['Phá','Hiệp'],49)):
        for col,(label,heading) in enumerate(zip(labels,headings,strict=True),1):
            row = by_code[f'{rule}-{col:02}']
            require(row['ruleCode'] == rule and row['column'] == col and row['title']
                    and row['tableLabel'] == label and row['contentHeading'] == heading,
                    'Original table/passage labels must be preserved')
            page = tablepage if col <= 2 else tablepage + 1
            require(row['tableSource'] == {'book':'TT','pdfPages':[tablepage],
                                          'printedPages':[tablepage+1]}
                    and row['contentSource'] == {'book':'TT','pdfPages':[page],
                                                'printedPages':[page+1]}, 'Wrong passage location')
            expected = ([prefix+'SANG-HEN-LABELS'] if col in (3,10,11,12) else []) if rule == 'TT-SANG-HEN' else (
                [prefix+'DIEN-SAN-REFERENCE'] + ([prefix+'DIEN-SAN-LABELS'] if col == 6 else []))
            require(row['decisionIds'] == expected, 'Editorial conflict decision omitted')

    # Compare every printed cell with the first visual pass; no cyclic formula creates approvals.
    expected = []
    for index,(branch,months) in enumerate(survey['tamThe']['sangHen']['monthsByBranch'].items(),1):
        for col,month in enumerate(months,1):
            expected.append({'ruleCode':'TT-SANG-HEN','lookupKey':f'BRANCH:{branch}|MONTH:{month:02}',
                             'resultCode':f'TT-SANG-HEN-{col:02}','tableRow':index,'tableColumn':col})
    for element,rows in survey['tamThe']['dienSan']['rowsByElement'].items():
        for index,months in enumerate(rows,1):
            for col,month in enumerate(months,1):
                if month is not None:
                    expected.append({'ruleCode':'TT-DIEN-SAN','lookupKey':f'ELEMENT:{element}|MONTH:{month:02}',
                                     'resultCode':f'TT-DIEN-SAN-{col:02}','tableRow':index,'tableColumn':col})
    require(data['tamTheMappings'] == expected, 'A reviewed table cell/key/location changed')
    require(manifest['counts'] == {'maiHoaTemplates':20,'tamTheResults':19,
                                   'sangHenMappings':144,'dienSanMappings':60}, 'Wrong scope counts')


def load_review(path: Path = DATA, manifest_path: Path = MANIFEST, pdf_dir: Path | None = None) -> dict:
    check_survey(pdf_dir=pdf_dir)
    text = path.read_text(encoding='utf-8')
    actual = hashlib.sha256(text.encode('utf-8')).hexdigest()
    manifest = read_json(manifest_path)
    require(actual == manifest['dataSha256'] == DATA_SHA256,
            'Pinned M01 content changed: repeat source review before updating the pin')
    data = json.loads(text, object_pairs_hook=unique_object)
    validate(data, manifest, read_json(ROOT/'data/s04_reading_source_survey.json'))
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf-dir', type=Path)
    args = parser.parse_args()
    try:
        data = load_review(pdf_dir=args.pdf_dir)
        print(json.dumps({'task':'M01','bundleId':data['bundleId'], 'templates':20,
                          'supplementPassages':19,'sangHenKeys':144,'dienSanKeys':60,
                          'reviewMethod':data['review']['method'], 'runtimeEnabled':False,
                          'originalPdfHashesChecked':args.pdf_dir is not None,'databaseChanged':False}, indent=2))
        return 0
    except (KeyError,TypeError,ValueError,OSError) as error:
        print(f'M01 check failed: {error}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
