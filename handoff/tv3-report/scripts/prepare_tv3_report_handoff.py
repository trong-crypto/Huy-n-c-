"""Collect the available test evidence into one Git-friendly handoff folder.

Source artifacts are copied byte-for-byte, never moved or rewritten. The
destination is deliberately new; an existing handoff is not overwritten.
No database, network, Git index or product source mutation is performed.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT/'handoff/tv3-report'
VN = timezone(timedelta(hours=7))
TEXT = {'.json', '.jsonl', '.csv', '.log', '.md', '.txt', '.xml', '.dumpstream', '.sql', '.py', '.ps1', '.mjs', '.ts', '.tsx', '.mts', '.yml', '.yaml'}
SENSITIVE = re.compile(r'(?:^|[._-])(?:password|secret|access_token|refresh_token|csrfToken|cookieHeader|authorization)$', re.I)


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def inside(path):
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(ROOT):
        raise ValueError('Project evidence source must stay inside the workspace')
    return resolved


def check_json(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if SENSITIVE.search(key) and isinstance(item, str) and item and not item.startswith('${'):
                raise ValueError('Populated credential field: '+key)
            check_json(item)
    elif isinstance(value, list):
        for item in value:
            check_json(item)


def scan(path):
    if path.suffix in TEXT:
        content = path.read_bytes()
        # Numeric literal matching is deliberately conservative: a password-like
        # assignment is rejected without printing its value.
        if re.search(rb'(?i)(?:PGPASSWORD|DB_PASSWORD|(?:datasource[._-])?password)[\s\"\x27]*[:=][\s\"\x27]*[0-9]{6,}(?:[\s\"\x27,;}]|$)', content):
            raise ValueError('Possible plaintext credential assignment in '+path.name)
        urls = list(re.finditer(rb'(?i)\b(?:postgres(?:ql)?|https?)://[^\s:/]+:[^\s@]+@', content))
        for match in urls:
            hostname = re.match(rb'[a-zA-Z0-9.-]+',content[match.end():])
            synthetic_test = bool(re.search(r'\.(?:test|spec)\.[cm]?[jt]sx?$',path.name))
            if not (synthetic_test and hostname and hostname.group().lower() in {b'example.org',b'example.com',b'example.net',b'example.test'}):
                raise ValueError('Credential-bearing URL in '+path.name)
        if path.suffix == '.json':
            check_json(json.loads(content.decode('utf-8-sig')))
        if path.suffix == '.xml':
            for node in ET.fromstring(content).iter('property'):
                if SENSITIVE.search(node.get('name', '')) and node.get('value', ''):
                    raise ValueError('Populated credential XML property')


def main():
    if DEST.exists():
        raise ValueError('Handoff already exists; preserve it and choose a new destination deliberately')
    matrix = json.loads((ROOT/'scripts/generated/x01_matrix_completed.json').read_text())
    reliability = json.loads((ROOT/'scripts/generated/x01_reliability_completed.json').read_text())
    analysis = json.loads((ROOT/'scripts/generated/x01_analysis_completed.json').read_text())
    report = json.loads((ROOT/'scripts/generated/x01_report_completed.json').read_text())
    publication = json.loads((ROOT/'docs/assets/x01/publication-manifest.json').read_text())
    assert report['status'] == 'COMPLETE' and report['pageCount'] == 19
    assert digest(ROOT/report['report']) == report['reportSha256']
    assert digest(ROOT/'docs/53-X01-BENCHMARK-ANALYSIS.md') == publication['reportSha256']
    for name, expected in publication['files'].items():
        assert digest(ROOT/'docs/assets/x01'/name) == expected
    original = json.loads((ROOT/analysis['analysisDirectory']/'input_checksums.json').read_text())
    for group, checkpoint in [('matrix', matrix), ('reliability', reliability)]:
        for relative, expected in original[group].items():
            assert digest(ROOT/checkpoint['evidenceDirectory']/relative) == expected

    selection = {}
    excluded = []

    def select(source, relative, category):
        checked = inside(source)
        destination = DEST/relative
        if not destination.resolve().is_relative_to(DEST.resolve()):
            raise ValueError('Destination escapes handoff')
        key = Path(relative).as_posix()
        if key in selection:
            raise ValueError('Duplicate handoff destination: '+key)
        selection[key] = (checked, category)

    def tree(source, relative, category, predicate=None):
        source = inside(source)
        for path in sorted(source.rglob('*')):
            if not path.is_file() or '__pycache__' in path.parts:
                continue
            if predicate and not predicate(path):
                excluded.append({'source':path.relative_to(ROOT).as_posix(), 'reason':'not needed for report writing'})
                continue
            select(path, Path(relative)/path.relative_to(source), category)

    tree(ROOT/'docs', 'docs', 'project_docs_and_fixtures')
    tree(ROOT/'data', 'data', 'reviewed_knowledge_inputs')
    tree(ROOT/'report', 'report', 'existing_report_and_x01_archive')
    tree(ROOT/'client/scripts', 'client/scripts', 'client_test_and_runner_sources')
    tree(ROOT/'scripts/tests', 'scripts/tests', 'python_test_sources', lambda p:p.suffix=='.py')
    for path in sorted((ROOT/'scripts').iterdir()):
        if path.is_file() and path.suffix in {'.py','.ps1','.sql'}:
            select(path, Path('scripts')/path.name, 'test_and_import_tool_sources')
    tree(ROOT/'server/src/test', 'tests/backend/source', 'backend_test_sources')
    tree(ROOT/'server/target/surefire-reports', 'tests/backend/surefire-reports', 'maven_report_snapshot')
    for path in sorted((ROOT/'client/src').rglob('*')):
        if path.is_file() and re.search(r'\.(?:test|spec)\.[cm]?[jt]sx?$', path.name):
            select(path, Path('tests/frontend/source')/path.relative_to(ROOT/'client/src'), 'frontend_test_sources')

    generated = ROOT/'scripts/generated'
    for path in sorted(generated.iterdir()):
        if path.is_file():
            if path.suffix in {'.pid','.dump','.jar','.pdf','.png','.docx'}:
                excluded.append({'source':path.relative_to(ROOT).as_posix(), 'reason':'runtime/binary or report rendering'})
                continue
            group = 'raw/checkpoints' if path.name.startswith('x01_') else 'raw/functional'
            select(path, Path(group)/path.name, 'x01_checkpoints' if path.name.startswith('x01_') else 'functional_acceptance_artifacts')
        elif path.is_dir() and path.name.startswith('x01_'):
            if path.name == Path(matrix['evidenceDirectory']).name:
                destination, category = 'raw/benchmark', 'official_18_runs'
            elif path.name == Path(reliability['evidenceDirectory']).name:
                destination, category = 'raw/reliability', 'overload_and_idempotency'
            elif path.name == Path(analysis['analysisDirectory']).name:
                destination, category = 'raw/analysis-final', 'reviewed_analysis'
            elif path.name.startswith('x01_analysis_'):
                destination, category = 'raw/analysis-drafts/'+path.name.removeprefix('x01_'), 'historical_analysis_drafts'
            elif path.name.startswith('x01_pilot_'):
                destination, category = 'raw/pilot', 'pilot_not_official_matrix'
            elif path.name.startswith('x01_preflight_'):
                destination, category = 'raw/preflight/'+path.name.removeprefix('x01_'), 'preflight_and_smoke'
            elif path.name.startswith('x01_preparation_'):
                destination, category = 'raw/preparation/'+path.name.removeprefix('x01_'), 'database_preparation'
            elif path.name.startswith('x01_backend_'):
                destination, category = 'raw/backend-build', 'backend_build_metadata'
            elif path.name.startswith('x01_report_qa_'):
                destination, category = 'raw/report-qa', 'report_review_metadata'
            else:
                raise ValueError('Unclassified X01 artifact folder')
            tree(path, destination, category, lambda p:p.suffix not in {'.jar','.dump','.pdf','.docx','.png','.pid'} or category in {'reviewed_analysis','historical_analysis_drafts'})
    for name in ['Instruction.md','README.md','Submission.md','Topics.md']:
        path = Path(r'C:\Users\abc\OneDrive\Desktop\final-project')/name
        if path.is_file():
            selection['course/'+name] = (path.resolve(strict=True), 'course_reference_provided_by_user')

    # Complete validation precedes creation. No credential-bearing file is
    # silently copied or redacted; a failure leaves the source untouched.
    for source, category in selection.values():
        scan(source)
        if source.stat().st_size >= 50_000_000:
            raise ValueError('Unexpected large file for report handoff')
    DEST.mkdir(parents=True)
    files = {}
    categories = Counter()
    for relative, (source, category) in selection.items():
        destination = DEST/relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        sourcehash = digest(source)
        assert digest(destination) == sourcehash
        source_label = source.relative_to(ROOT).as_posix() if source.is_relative_to(ROOT) else 'user-provided-course/'+source.name
        files[relative] = {'sha256':sourcehash, 'bytes':source.stat().st_size, 'source':source_label,
                           'sourceModifiedAt':datetime.fromtimestamp(source.stat().st_mtime, VN).isoformat(), 'category':category}
        categories[category] += 1
    manifest = {
        'task':'TV3_REPORT_HANDOFF', 'createdAt':datetime.now(VN).isoformat(), 'groupNumber':12,
        'scope':'Available functional test evidence, complete X01 artifacts, reviewed figures, report and source context',
        'sourceOriginalsPreserved':True, 'copiedFiles':len(files), 'copiedBytes':sum(v['bytes'] for v in files.values()),
        'categories':dict(categories), 'files':files, 'excludedFiles':excluded,
        'separateExcludedDirectories':['scripts/generated/db-backups','scripts/generated/source-review'],
        'matrix':{'officialRuns':18,'cohortRequests':46027,'outOfWindowSends':1,'strictSendWindowSatisfied':False},
        'reliabilityCasesPassed':7, 'databaseAccessed':False, 'gitCommittedOrPushed':False,
        'credentialScan':'JSON/XML credential fields, numeric password assignments and credential URLs checked; no actual credentials found. Synthetic security-test URLs on example domains retained.',
        'note':'Maven and source snapshots reflect files available at collection; do not sum overlapping test totals into one execution'
    }
    (DEST/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (DEST/'.gitignore').write_text('# Reviewed test evidence intentionally includes original logs.\n!**/*.log\n!**/*.dumpstream\n',encoding='utf-8')
    print(json.dumps({'destination':DEST.relative_to(ROOT).as_posix(),'copiedFiles':len(files),'copiedBytes':manifest['copiedBytes'],
                      'categories':dict(categories),'originalsPreserved':True,'databaseAccessed':False,'gitCommittedOrPushed':False},ensure_ascii=True))


if __name__ == '__main__':
    main()
