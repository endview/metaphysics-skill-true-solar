#!/usr/bin/env python3
"""Build reviewed release assets; publish only with the explicit --publish flag."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TAG = 'v1.1'
BASELINE = '456100131d7f0492df9ac1d515d614d37515f9da'
SKILLS = ('metaphysics', 'analyze-bazi', 'analyze-ziwei', 'cast-meihua')


def run(*args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, **kwargs)


def gh_json(*args):
    return json.loads(subprocess.check_output(['gh', *args], cwd=ROOT, text=True))


def checksums(directory, name):
    text = ''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n'
                   for p in sorted(directory.iterdir()) if p.is_file() and p.name != name)
    (directory / name).write_text(text, encoding='utf-8')


def build(output):
    if json.loads((ROOT / 'package.json').read_text())['version'] != '1.1.0':
        raise SystemExit('Update the release target and notes for the new version')
    if output == ROOT or output.is_relative_to(ROOT):
        raise SystemExit('Release output must be outside the source tree')
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise SystemExit('Release output must be empty')
    # Report the unavailable model acceptance explicitly; do not fabricate a pass.
    behavior = subprocess.run(['node', 'tooling/behavior-matrix.mjs'], cwd=ROOT)
    if behavior.returncode != 2:
        raise SystemExit('Unexpected result from unconfigured model matrix')
    run('node', 'tooling/release-gate.mjs', '--local')
    gate = json.loads((ROOT / 'reports/release-gate.json').read_text())
    if not gate['local_implementation_accepted']:
        raise SystemExit('Local validation has not passed')
    # Only attach evidence regenerated for this exact source tree.
    stale = ROOT / 'reports/official-package-check.json'
    if stale.exists():
        stale.unlink()
    run('python', 'tooling/build-delivery.py', '--output', str(output / f'metaphysics-source-{TAG}.zip'))
    receipt = output / f'metaphysics-source-{TAG}.receipt.json'
    receipt.unlink()  # Evidence is already in the source archive; avoid a duplicate attachment.
    notes = ROOT / 'docs/releases' / f'{TAG}.md'
    shutil.copyfile(notes, output / f'RELEASE-NOTES-{TAG}.md')
    for name in SKILLS:
        shutil.copyfile(ROOT / 'dist' / name / 'skill.zip', output / f'{name}-{TAG}.zip')
    with zipfile.ZipFile(output / f'metaphysics-skills-{TAG}.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in SKILLS:
            archive.write(ROOT / 'dist' / name / 'skill.zip', name + '/skill.zip')
        archive.writestr('README.txt', 'v1.1\nExtract this container, then import each <skill-name>/skill.zip separately.\n')
    checksums(output, f'SHA256SUMS-{TAG}.txt')
    for p in output.glob('*.zip'):
        with zipfile.ZipFile(p) as archive:
            if archive.testzip() is not None:
                raise SystemExit('Archive CRC check failed: ' + p.name)
    print(json.dumps({'tag': TAG, 'source_digest': gate['source_digest'],
                      'test_counts': gate['test_counts'], 'assets': sorted(p.name for p in output.iterdir())}, indent=2))


def publish(output):
    repo = os.environ['GH_REPO']
    if repo != 'endview/metaphysics-skill-true-solar':
        raise SystemExit('Release destination differs from the authorized repository')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if gh_json('api', f'repos/{repo}/git/ref/heads/main')['object']['sha'] != commit:
        raise SystemExit('Refusing to publish a commit that is not current main')
    if gh_json('api', f'repos/{repo}/git/ref/tags/v1.0')['object']['sha'] != BASELINE:
        raise SystemExit('The v1.0 tag no longer identifies the expected original source')
    refs = gh_json('api', f'repos/{repo}/git/matching-refs/tags/{TAG}')
    for ref in refs:
        if ref['ref'] == f'refs/tags/{TAG}' and ref['object']['sha'] != commit:
            raise SystemExit('Refusing to reuse a v1.1 tag that points to a different commit')
    releases = gh_json('api', f'repos/{repo}/releases?per_page=100')
    existing = next((r for r in releases if r['tag_name'] == TAG), None)
    if existing:
        tagged = gh_json('api', f'repos/{repo}/git/ref/tags/{TAG}')['object']['sha']
        if tagged != commit:
            raise SystemExit('Refusing to replace v1.1 from a different commit')
        if not existing['draft']:
            print('v1.1 is already published from this commit; keeping its assets intact.')
            return
        raise SystemExit('An existing v1.1 draft requires inspection before continuing')
    baseline = next(r for r in releases if r['tag_name'] == 'v1.0')
    with tempfile.TemporaryDirectory(prefix='v1.0-description-') as temp:
        old = Path(temp)
        run('gh', 'release', 'download', 'v1.0', '--dir', str(old))
        # Verify original code assets before regenerating checksums for the description.
        for asset in baseline['assets']:
            if asset['name'].endswith('.zip'):
                actual = 'sha256:' + hashlib.sha256((old / asset['name']).read_bytes()).hexdigest()
                if actual != asset['digest']:
                    raise SystemExit('Original v1.0 asset digest mismatch')
        notes = old / 'RELEASE-NOTES-v1.0.md'
        shutil.copyfile(ROOT / 'docs/releases/v1.0.md', notes)
        checksums(old, 'SHA256SUMS-v1.0.txt')
        run('gh', 'release', 'edit', 'v1.0', '--title', 'v1.0', '--notes-file', str(notes))
        run('gh', 'release', 'upload', 'v1.0', str(notes), str(old / 'SHA256SUMS-v1.0.txt'), '--clobber')
    # Create a draft first so downloads are complete before becoming visible.
    run('gh', 'release', 'create', TAG, '--target', commit, '--title', TAG,
        '--notes-file', str(output / f'RELEASE-NOTES-{TAG}.md'), '--draft',
        *[str(p) for p in sorted(output.iterdir())])
    result = gh_json('release', 'view', TAG, '--json', 'assets,tagName,isDraft,targetCommitish')
    expected = {p.name for p in output.iterdir()}
    if {a['name'] for a in result['assets']} != expected:
        raise SystemExit('Draft attachment list differs from the prepared assets')
    run('gh', 'release', 'edit', TAG, '--draft=false', '--latest')
    print(json.dumps(gh_json('release', 'view', TAG, '--json', 'url,tagName,name,isDraft,isPrerelease,assets'), indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    build(args.output.resolve())
    if args.publish:
        publish(args.output.resolve())
