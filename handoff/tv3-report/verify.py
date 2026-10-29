"""Verify the collected evidence after cloning. Python 3.10+, stdlib only."""
from hashlib import sha256
import json
from pathlib import Path
import sys


def main():
    root = Path(__file__).resolve().parent
    manifest = json.loads((root/'MANIFEST.json').read_text(encoding='utf-8'))
    missing, changed = [], []
    expected = {**manifest['files'], **manifest.get('generatedFiles', {})}
    for relative, metadata in expected.items():
        path = (root/relative).resolve()
        if not path.is_relative_to(root):
            raise ValueError('Unsafe manifest path')
        if not path.is_file():
            missing.append(relative)
        elif path.stat().st_size != metadata['bytes'] or sha256(path.read_bytes()).hexdigest() != metadata['sha256']:
            changed.append(relative)
    result = {'status':'PASS' if not missing and not changed else 'FAIL',
              'filesChecked':len(expected),'missing':len(missing),'changed':len(changed),
              'missingFiles':missing,'changedFiles':changed,
              'officialMatrixRuns':manifest['matrix']['officialRuns'],
              'strictSendWindowSatisfied':manifest['matrix']['strictSendWindowSatisfied']}
    print(json.dumps(result, ensure_ascii=True, indent=2))
    return 0 if result['status']=='PASS' else 1


if __name__ == '__main__':
    sys.exit(main())
