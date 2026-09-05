#!/usr/bin/env python3
"""Save already-observed UTF-8 source only when its Git blob ID matches exactly."""
from pathlib import Path
import hashlib, json, os
root = Path(__file__).resolve().parents[1]
receipt_path = root / 'docs/upstream-observed.json'
receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else {
    'repository': 'endview/metaphysics-skill-true-solar',
    'commit': '456100131d7f0492df9ac1d515d614d37515f9da',
    'full_repository_acquired': False, 'files': {}}
for index, item in enumerate(json.loads(os.environ['SOURCE_META'])):
    rel = Path(item['path'])
    assert not rel.is_absolute() and '..' not in rel.parts
    text = os.environ[f'SOURCE_{index}']
    for candidate in [text, text + '\n']:
        data = candidate.encode('utf-8')
        blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if blob == item['sha']:
            break
    else:
        raise SystemExit(f'Source copy mismatch; refusing {rel}')
    snapshot = root / 'upstream-snapshot' / rel
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    snapshot.write_bytes(data)
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_bytes() != data:
        raise SystemExit(f'Refusing to replace changed working file: {rel}')
    target.write_bytes(data)
    receipt['files'][str(rel)] = {'git_blob_sha': blob, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(f'Exact upstream copy: {rel} ({len(data)} bytes)')
receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
