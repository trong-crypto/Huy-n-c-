"""Package the reviewed X01 evidence without altering original artifacts.

This archive preserves evidence, not a complete runnable distribution. It
contains no JAR, book PDF, database dump, dotenv file or database credentials.
Run after the final DOCX and all its rendered pages have been reviewed.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
VN = timezone(timedelta(hours=7))
ALLOWED = {'.json', '.jsonl', '.csv', '.log', '.py', '.ps1', '.mjs', '.ts', '.md', '.png', '.svg'}


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def inside(path):
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(ROOT):
        raise ValueError('Evidence must remain inside the workspace')
    return resolved


def check_json_secrets(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if re.fullmatch(r'(?:password|DB_PASSWORD|PGPASSWORD|access_token|refresh_token|csrfToken)', key, re.I):
                if item not in (None, '', False, 'REDACTED', '<redacted>'):
                    raise ValueError('Refusing to package a populated credential field')
            check_json_secrets(item)
    elif isinstance(value, list):
        for item in value:
            check_json_secrets(item)


def main():
    index = read(ROOT/'report/evidence-index.json')
    if index['status'] != 'COMPLETE_RENDERED_REVIEWED':
        raise ValueError('Finish the actual Word/page review before packaging')
    docx = inside(ROOT/index['report'])
    if sha256(docx.read_bytes()).hexdigest() != index['reportSha256']:
        raise ValueError('Report changed after the final review')
    matrix = read(ROOT/'scripts/generated/x01_matrix_completed.json')
    reliability = read(ROOT/'scripts/generated/x01_reliability_completed.json')
    analysis = read(ROOT/'scripts/generated/x01_analysis_completed.json')
    folders = [ROOT/matrix['evidenceDirectory'], ROOT/reliability['evidenceDirectory'],
               ROOT/analysis['analysisDirectory'], ROOT/'docs/assets/x01', ROOT/'report/figures']
    files = set()
    for folder in folders:
        for path in inside(folder).rglob('*'):
            if not path.is_file():
                continue
            checked = inside(path)
            if checked.suffix not in ALLOWED or checked.name.startswith('.env'):
                raise ValueError('Unexpected file type in the evidence selection')
            files.add(checked)
    for name in ('x01_matrix_completed.json', 'x01_reliability_completed.json', 'x01_analysis_completed.json'):
        files.add(inside(ROOT/'scripts/generated'/name))
    files.add(inside(ROOT/analysis['databaseCheckPath']))
    for number in range(47, 55):
        matches = list((ROOT/'docs').glob(f'{number}-*.md'))
        if len(matches) != 1:
            raise ValueError('Ambiguous evidence document')
        files.add(inside(matches[0]))
    for pattern in ('*x01*.py', '*x01*.ps1'):
        files.update(inside(p) for p in (ROOT/'scripts').glob(pattern))
    files.update(inside(p) for p in (ROOT/'scripts/tests').glob('test_x01*.py'))
    files.update(inside(p) for p in (ROOT/'client/scripts').glob('*x01*.mjs'))
    for name in ('client/scripts/benchmark-stomp.mjs', 'client/scripts/lib/x01-benchmark.mjs',
                 'report/evidence-index.json', 'report/authors.json', 'report/HuyenCo_Report.md', 'report/README.md'):
        files.add(inside(ROOT/name))
    payload = {}
    for path in sorted(files):
        content = path.read_bytes()
        if path.suffix == '.json':
            check_json_secrets(json.loads(content.decode('utf-8-sig')))
        payload[path.relative_to(ROOT).as_posix()] = content
    manifest = {
        'task': 'X01.7', 'createdAt': datetime.now(VN).isoformat(),
        'report': index['report'], 'reportSha256': index['reportSha256'],
        'matrixAuditStatus': index['matrixAuditStatus'], 'strictSendWindowSatisfied': False,
        'cohortRequests': 46027, 'outOfWindowSends': 1,
        'scope': 'Original evidence bytes; not a complete runnable distribution',
        'files': {name: {'sha256': sha256(data).hexdigest(), 'bytes': len(data)} for name, data in payload.items()}
    }
    instructions = (
        'X01 evidence for group 12, Huyen Co, 2026-10-29.\n'
        'Entries retain their paths relative to the project root.\n'
        'MANIFEST.json hashes every payload entry; original artifact bytes were not edited.\n'
        'There are 46027 eligible measurement requests and one SEND 0.022 ms outside the window.\n'
        'The original matrix is not a strict-window PASS.\n'
        'See report/README.md and docs/54-X01-REPORT-HANDOFF.md.\n'
        'Check package integrity with SHA-256 and MANIFEST.json after extraction.\n'
        'No JAR, database dump or book PDF is bundled. Original absolute paths refer to the measurement machine.\n'
        'Running the original auditors again requires their pinned JAR/source and the prepared TEST environment.\n'
        'This archive does not submit a report or assert a Compilatio result.\n'
    )
    out = ROOT/'report/evidence'
    out.mkdir(exist_ok=True)
    target = out/'X01-Evidence.zip'
    temporary = out/'X01-Evidence.building.zip'
    with ZipFile(temporary, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in payload.items():
            archive.writestr(name, content)
        archive.writestr('MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
        archive.writestr('README.txt', instructions)
    with ZipFile(temporary) as archive:
        if archive.testzip() is not None:
            raise ValueError('Archive CRC failed')
        embedded = json.loads(archive.read('MANIFEST.json'))
        for name, metadata in embedded['files'].items():
            if sha256(archive.read(name)).hexdigest() != metadata['sha256']:
                raise ValueError('Archive hash mismatch')
            if sha256((ROOT/name).read_bytes()).hexdigest() != metadata['sha256']:
                raise ValueError('Source changed while packaging')
    os.replace(temporary, target)
    publication = {'task': 'X01.7', 'status': 'PACKAGED_AND_HASH_VERIFIED',
                   'archive': target.relative_to(ROOT).as_posix(),
                   'sha256': sha256(target.read_bytes()).hexdigest(), 'bytes': target.stat().st_size,
                   'payloadFiles': len(payload), 'embeddedManifest': 'MANIFEST.json',
                   'reportSha256': index['reportSha256'], 'strictSendWindowSatisfied': False,
                   'createdAt': manifest['createdAt']}
    (out/'package-manifest.json').write_text(json.dumps(publication, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(publication, ensure_ascii=True))


if __name__ == '__main__':
    main()
