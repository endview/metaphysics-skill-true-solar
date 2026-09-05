#!/usr/bin/env python3
"""Run each real ZIP in a clean directory, with network APIs denied to the process."""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib,json,os,stat,subprocess,zipfile
root=Path(__file__).resolve().parents[1];node=subprocess.check_output(['node','-p','process.execPath'],text=True).strip()
inputs=json.loads(subprocess.check_output([node,'--input-type=module','-e',"import {reviewInput} from './tests/fixtures/synthetic/native-inputs.mjs';import {ziweiReview} from './tests/fixtures/synthetic/ziwei-input.mjs';console.log(JSON.stringify({bazi:reviewInput('bazi'),meihua:reviewInput('meihua'),ziwei:ziweiReview()}));"],cwd=root,text=True))
checks=json.loads((root/'reports/skill-package-checks.json').read_text());build=json.loads((root/'reports/build-report.json').read_text());report={'scope':'actual four ZIPs, clean directories, synthetic native CLI; not product installation or model evaluation','source_digest':checks['source_digest'],'packages':{}}
for name,entry in build['packages'].items():
 archive=root/entry['archive'];expected=checks['packages'][name]['files'];method={'analyze-bazi':'bazi','analyze-ziwei':'ziwei','cast-meihua':'meihua'}.get(name)
 with TemporaryDirectory(prefix='metaphysics-package-qa-') as temp:
  temp=Path(temp).resolve()
  with zipfile.ZipFile(archive) as z:
   names=z.namelist();assert len(names)==len(set(names)) and sum(e.file_size for e in z.infolist())<=25*1024*1024
   for e in z.infolist():
    p=Path(e.filename);assert not p.is_absolute() and '..' not in p.parts and p.parts[0]==name and not stat.S_ISLNK(e.external_attr>>16)
   assert set(names)=={name+'/'+x for x in expected} and z.testzip() is None
   for relative,digest in expected.items():assert hashlib.sha256(z.read(name+'/'+relative)).hexdigest()==digest
   z.extractall(temp)
  directory=temp/name
  def snapshot():return {p.relative_to(directory).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.rglob('*') if p.is_file()}
  before=snapshot()
  deny=temp/'deny-network.cjs';deny.write_text("const fail=()=>{throw Error('NETWORK_DISABLED_IN_PACKAGE_QA')};for(const n of ['net','http','https','tls','dgram']){const m=require('node:'+n);for(const k of ['connect','createConnection','request','get','createSocket'])if(typeof m[k]==='function')m[k]=fail;}global.fetch=fail;")
  env={'PATH':str(Path(node).parent),'LANG':'C.UTF-8','TZ':'UTC','NODE_OPTIONS':'--require='+str(deny)}
  # Windows needs its system and temporary-directory paths even in a minimal env.
  if os.name=='nt':
   for key in ('SystemRoot','WINDIR','TEMP','TMP'):
    if key in os.environ:env[key]=os.environ[key]
  if method:
   req={'op':'review','input':inputs[method]};run=subprocess.run([node,'scripts/run-verified.mjs'],cwd=directory,input=json.dumps(req)+'\n'+json.dumps(req)+'\n',capture_output=True,text=True,timeout=35,env=env)
   assert run.returncode==0,run.stderr;out=[json.loads(x) for x in run.stdout.splitlines()];assert len(out)==2 and all(x['status']=='ok' for x in out),(run.stdout,run.stderr)
   a,b=[x['result'] for x in out];assert a['execution_record']['exit_code']==0 and a['execution_record']['run_id']==b['execution_record']['run_id'] and b['reused']
   assert a['bundle']['child_result']['method_id']==method and a['bundle']['child_result']['schema_version']=='metaphysics.standard-child.v1'
   bad=json.loads(json.dumps(req));bad['input']['analysis_scope']='outcome_prediction'
   reject=subprocess.run([node,'scripts/run-verified.mjs','--once'],cwd=directory,input=json.dumps(bad)+'\n',capture_output=True,text=True,timeout=35,env=env)
   assert reject.returncode==2 and json.loads(reject.stdout)['code']=='INPUT_PREFLIGHT_FAILED'
   specifics={'native_exit_code':0,'successful_run_reused':True,'unsupported_prediction_scope_rejected':True}
  else:
   req={'op':'run','input':{'request_id':'qa','subject_ref':'s','event_ref':'e','proposition_id':'p','question':'Synthetic review','criteria':'Structural only','methods':['bazi'],'inputs':{'bazi':inputs['bazi']}}}
   run=subprocess.run([node,'scripts/route.mjs'],cwd=directory,input=json.dumps(req)+'\n',capture_output=True,text=True,timeout=15,env=env)
   assert run.returncode==0,run.stderr;out=json.loads(run.stdout);assert out['status']=='ok' and out['result']['uncompleted'][0]['status']=='unavailable' and out['result']['completed_methods']==[]
   specifics={'standalone_capability_check':True,'missing_child_not_simulated':True,'no_sibling_directory_assumption':True}
  assert snapshot()==before
  report['packages'][name]={'zip_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'bytes':archive.stat().st_size,'file_count':len(expected),'all_file_hashes_match':True,'clean_directory_cli':'passed','network_api_denial_in_host':True,'package_unmodified':True,'chatgpt_installation_tested':False,**specifics}
(root/'reports/zip-smoke.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
