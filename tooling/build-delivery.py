#!/usr/bin/env python3
"""Package complete source and current evidence, separate from standalone Skill ZIPs."""
import argparse
import hashlib
import json
import stat
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = (
    'test-report.json', 'test-results.tap', 'schema-check.json',
    'skill-package-checks.json', 'build-report.json', 'zip-smoke.json',
    'release-gate.json', 'behavior-matrix.json', 'official-package-check.json',
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT.parent/'metaphysics-reliability-source.zip')
    args = parser.parse_args()
    subprocess.run(['node', 'tooling/release-gate.mjs', '--local'], cwd=ROOT, check=True, capture_output=True)
    source = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {sourceManifest} from './tooling/source-manifest.mjs';console.log(JSON.stringify(await sourceManifest(process.cwd())));"
    ], cwd=ROOT, text=True))
    gate = json.loads((ROOT/'reports/release-gate.json').read_text())
    if source['digest'] != gate['source_digest'] or not gate['local_implementation_accepted']:
        raise SystemExit('Refusing stale or unaccepted local source')
    files = dict(source['files'])
    for name in REPORTS:
        p = ROOT/'reports'/name
        if p.is_file():
            files[p.relative_to(ROOT).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
    target = args.output.resolve()
    if target.is_relative_to(ROOT):
        raise SystemExit('Keep delivery archives outside the source tree')
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for relative, expected in sorted(files.items()):
            p = ROOT/relative
            if p.is_symlink() or not p.is_file():
                raise SystemExit('Refusing non-file or symlink: '+relative)
            data = p.read_bytes()
            if hashlib.sha256(data).hexdigest() != expected:
                raise SystemExit('Source changed during packaging: '+relative)
            info = zipfile.ZipInfo('metaphysics-reliability/'+relative, date_time=(2026,9,6,0,0,0))
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise SystemExit('Archive CRC check failed')
    receipt = {
        'artifact_kind': 'complete_four_skill_source_and_local_evidence',
        'version': json.loads((ROOT/'package.json').read_text())['version'], 'source_digest': source['digest'],
        'full_pinned_baseline_included': True, 'standalone_skill_zips_included': False,
        'local_implementation_accepted': True, 'production_accepted': gate['production_accepted'],
        'file_count': len(files), 'bytes': target.stat().st_size,
        'archive_sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'crc': 'passed',
    }
    receipt_path = target.with_suffix('.receipt.json')
    receipt_path.write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
