#!/usr/bin/env python3
"""Validate real local execution outputs against bundled JSON Schemas."""
from pathlib import Path
import json,subprocess
from jsonschema import Draft202012Validator
root=Path(__file__).resolve().parents[1]
script="""
import {ReviewSession} from './runtime-src/session-host.mjs';
import {reviewInput} from './tests/fixtures/synthetic/native-inputs.mjs';import {ziweiReview} from './tests/fixtures/synthetic/ziwei-input.mjs';
import {RouterV5} from './runtime-src/route-v5.mjs';import {LocalRouteHost} from './runtime-src/local-route-host.mjs';
const samples=[];
for(const [method,name] of [['bazi','analyze-bazi'],['ziwei','analyze-ziwei'],['meihua','cast-meihua']]){
 const {createProfile}=await import('./skills/'+name+'/scripts/profile.mjs');const session=new ReviewSession(await createProfile());
 const result=await session.review(method==='ziwei'?ziweiReview():reviewInput(method));
 samples.push(['metaphysics.case.v1',result.case_snapshot],['metaphysics.execution-record.v1',result.execution_record],['metaphysics.execution-bundle.v1',result.bundle],['metaphysics.standard-child.v1',result.bundle.child_result]);
}
const host=new LocalRouteHost({bazi:process.cwd()+'/skills/analyze-bazi'}),router=new RouterV5(host),r={request_id:'schema-test',subject_ref:'s',event_ref:'e',proposition_id:'p',question:'Synthetic review',criteria:'Structural only',methods:['bazi'],inputs:{bazi:reviewInput('bazi')}};
const plan=router.plan(r),out=await router.run(r);samples.push(['metaphysics.route-plan.v4',plan],['metaphysics.adapter-task.v4',plan.tasks[0]],['metaphysics.route-output.v5',out],['metaphysics.adapter-result.v4',out.results[0]]);
console.log(JSON.stringify(samples));
"""
samples=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=root,text=True))
schemas={p.stem:json.loads(p.read_text()) for p in (root/'runtime-src/schema').glob('*.json')}
for s in schemas.values():Draft202012Validator.check_schema(s)
errors=[]
for name,value in samples:
 for e in Draft202012Validator(schemas[name]).iter_errors(value):errors.append({'schema':name,'path':'/'.join(map(str,e.path)),'message':e.message})
manifest=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {sourceManifest} from './tooling/source-manifest.mjs';console.log(JSON.stringify(await sourceManifest(process.cwd())));"],cwd=root,text=True))
report={'source_digest':manifest['digest'],'sample_count':len(samples),'schema_count':len(schemas),'errors':errors,'status':'passed' if not errors else 'failed'}
(root/'reports/schema-check.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));raise SystemExit(bool(errors))
