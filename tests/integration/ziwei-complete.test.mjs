import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {ziweiInput,ziweiReview} from '../fixtures/synthetic/ziwei-input.mjs';
import {runZiwei,preflightZiwei} from '../../skills/analyze-ziwei/scripts/engine/run.mjs';
import {runZiwei as baselineRun} from '../../upstream/pinned-baseline/skills/analyze-ziwei/scripts/engine/run.mjs';
import {createProfile,validateZiweiNative} from '../../skills/analyze-ziwei/scripts/profile.mjs';
import {ReviewSession} from '../../runtime-src/session-host.mjs';
import {sha256Canonical,canonicalStringify} from '../../skills/analyze-ziwei/scripts/engine/canonical-json.mjs';
for(const time_index of [0,1,5,6,11,12])for(const late_zi_policy of ['current','forward'])test(`Ziwei exact baseline parity time=${time_index}, policy=${late_zi_policy}`,()=>{
  const input=ziweiInput();input.birth.true_solar.resolved_candidates[0]={selector_id:'s',date:'2000-01-01',time_index};input.birth.late_zi_policy=late_zi_policy;
  assert.equal(canonicalStringify(runZiwei(input)),canonicalStringify(baselineRun(input)));
});
test('Ziwei wrapper executes, checks candidates and emits standard child',async()=>{
  const s=new ReviewSession(await createProfile()),r=await s.review(ziweiReview());
  assert.equal(r.bundle.child_result.method_id,'ziwei');assert.equal(r.bundle.child_result.method_payload.source.chart_grade,'P1');
  assert.equal(r.execution_record.exit_code,0);assert.equal(r.independent_charting_performed,true);
  assert.equal((await s.review(ziweiReview())).execution_record.run_id,r.execution_record.run_id);
});
test('Ziwei insufficient input never reads vendor chunks or initializes engine',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ziwei-lazy-'));
  try {const root=new URL('../../skills/analyze-ziwei/',import.meta.url);await fs.cp(root,temp,{recursive:true});
    for(const name of await fs.readdir(path.join(temp,'scripts/vendor/iztro')))if(name.endsWith('.txt'))await fs.rm(path.join(temp,'scripts/vendor/iztro',name));
    const input=ziweiInput();delete input.birth.true_solar;
    const result=spawnSync(process.execPath,[path.join(temp,'scripts/ziwei-cli.mjs')],{input:JSON.stringify(input),encoding:'utf8',timeout:10000});
    assert.equal(result.status,0,result.stderr);const output=JSON.parse(result.stdout);assert.equal(output.status,'insufficient_input');assert.equal(output.engine,null);
    const valid=spawnSync(process.execPath,[path.join(temp,'scripts/ziwei-cli.mjs')],{input:JSON.stringify(ziweiInput()),encoding:'utf8',timeout:10000});assert.notEqual(valid.status,0);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('Ziwei corrupted vendor fails with no hand-assembled chart',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'ziwei-corrupt-'));try{
    await fs.cp(new URL('../../skills/analyze-ziwei/',import.meta.url),temp,{recursive:true});
    const p=path.join(temp,'scripts/vendor/iztro/iztro.min.js.gz.b64.part-00.txt');const b=await fs.readFile(p);b[2]=b[2]===65?66:65;await fs.writeFile(p,b);
    const run=spawnSync(process.execPath,[path.join(temp,'scripts/ziwei-cli.mjs')],{input:JSON.stringify(ziweiInput()),encoding:'utf8',timeout:10000});
    assert.notEqual(run.status,0);assert.equal(run.stdout,'');assert.match(run.stderr,/integrity/);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('Ziwei candidate links preserve alternatives rather than choose a preferred chart',()=>{
  const input=ziweiInput();input.birth.true_solar.status='candidate_set';input.birth.true_solar.resolved_candidates.push({selector_id:'alternative',date:'2000-01-01',local_time:'13:10'});
  const output=runZiwei(input);assert.equal(output.candidates.accepted_count,2);assert.deepEqual(validateZiweiNative(output,input),[]);
});
test('Ziwei candidate cap is checked before loading the engine',()=>{
  const input=ziweiInput();input.birth.true_solar.status='candidate_set';input.birth.true_solar.resolved_candidates=Array.from({length:65},(_,i)=>({selector_id:'c'+i,date:'2000-01-01',time_index:6}));
  assert.throws(()=>preflightZiwei(input),/maximum is 64/);
});
test('Ziwei target before birth fails preflight',()=>{const i=ziweiInput();i.target.true_solar.resolved_candidates[0].date='1999-01-01';assert.throws(()=>preflightZiwei(i),/earlier/);});
test('Ziwei imported tool_verified declaration cannot self-promote through wrapper',async()=>{
  const input=ziweiReview();input.method_inputs.native_input.birth.true_solar.verification_status='tool_verified';
  const s=new ReviewSession(await createProfile());await assert.rejects(s.review(input),e=>e.code==='INPUT_PREFLIGHT_FAILED');
});
for(const mutation of ['grade','palace','candidate','hash'])test('Ziwei semantic corruption '+mutation,()=>{
  const input=ziweiInput(),p=runZiwei(input);
  if(mutation==='grade')p.source.chart_grade='P2';
  if(mutation==='palace')p.candidates.groups[0].facts.origin.palaces[0].index=20;
  if(mutation==='candidate')p.candidates.items[0].dimensions.birth_true_solar_selector_id='foreign';
  if(mutation==='hash')p.result_hash='forged';else {const {result_hash,...body}=p;p.result_hash=`sha256:${sha256Canonical(body)}`;}
  assert.notEqual(validateZiweiNative(p,input).length,0);
});
