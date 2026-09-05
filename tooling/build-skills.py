#!/usr/bin/env python3
"""Build four explicit-allowlist standalone ZIPs. No automatic manifest expansion."""
import argparse,hashlib,json,re,stat,subprocess,sys,zipfile
from pathlib import Path
import yaml
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=root/'dist');args=parser.parse_args()
subprocess.run(['node','tooling/sync-runtime.mjs','--check'],cwd=root,check=True)
subprocess.run(['node','tooling/check-skills.mjs'],cwd=root,check=True)
checks=json.loads((root/'reports/skill-package-checks.json').read_text());output={}
for name,report in checks['packages'].items():
 directory=root/'skills'/name;entry=(directory/'SKILL.md').read_text();meta=yaml.safe_load(entry.split('---',2)[1]);assert meta['name']==name and meta['description']
 for p in directory.rglob('*'):
  if p.suffix in ['.yaml','.yml']:yaml.safe_load(p.read_text())
 target=args.output/name/'skill.zip';target.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
  for relative in report['allowlist']:
   data=(directory/relative).read_bytes();assert hashlib.sha256(data).hexdigest()==report['files'][relative]
   info=zipfile.ZipInfo(name+'/'+relative,date_time=(2026,9,6,0,0,0));info.external_attr=(stat.S_IFREG|0o644)<<16;info.compress_type=zipfile.ZIP_DEFLATED;archive.writestr(info,data)
 with zipfile.ZipFile(target) as archive:assert archive.testzip() is None
 assert target.stat().st_size<=25*1024*1024
 output[name]={'archive':str(target.relative_to(root)) if target.is_relative_to(root) else str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'file_count':len(report['allowlist'])}
(root/'reports/build-report.json').write_text(json.dumps({'source_digest':checks['source_digest'],'packages':output},indent=2)+'\n')
print(json.dumps(output,indent=2))
