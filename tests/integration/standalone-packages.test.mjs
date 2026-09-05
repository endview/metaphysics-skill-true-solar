import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {reviewInput} from '../fixtures/synthetic/native-inputs.mjs';
const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
async function isolated(skill,fn) {
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'native-skill-isolated-'));
  try {const target=path.join(temp,'standalone skill');await fs.cp(path.join(root,'skills',skill),target,{recursive:true});await fn(target);}
  finally {await fs.rm(temp,{recursive:true,force:true});}
}
function run(dir,requests,once=true) {
  const p=spawnSync(process.execPath,['scripts/run-verified.mjs',...(once?['--once']:[])],{
    cwd:dir,input:requests.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')+'\n',
    encoding:'utf8',timeout:15000,maxBuffer:4194304,
    env:{PATH:path.dirname(process.execPath),LANG:'C.UTF-8',TZ:'UTC'}});
  const outputs=p.stdout.trim()?p.stdout.trim().split('\n').map(x=>JSON.parse(x)):[];return {...p,outputs};
}
for(const [skill,method] of [['analyze-bazi','bazi'],['cast-meihua','meihua']]) {
  test(`${method}: isolated directory with spaces runs without sibling files`,()=>isolated(skill,async(dir)=>{
    const r=run(dir,[{op:'review',input:reviewInput(method)}]);assert.equal(r.status,0,r.stderr);
    assert.equal(r.outputs.length,1);const result=r.outputs[0].result;
    assert.equal(result.bundle.child_result.method_id,method);assert.equal(result.execution_record.exit_code,0);
    assert.equal(result.dedup_scope,'current_process_only');assert.equal(result.independent_model_branches,false);
  }));
  test(`${method}: NDJSON persistent process reuses native output`,()=>isolated(skill,async(dir)=>{
    const request={op:'review',input:reviewInput(method)},r=run(dir,[request,request],false);
    assert.equal(r.status,0,r.stderr);assert.equal(r.outputs.length,2);
    assert.equal(r.outputs[0].result.execution_record.run_id,r.outputs[1].result.execution_record.run_id);
    assert.equal(r.outputs[1].result.reused,true);
  }));
  test(`${method}: duplicate JSON keys never reach the calculation`,()=>isolated(skill,async(dir)=>{
    const r=run(dir,['{"op":"capabilities","op":"review"}']);assert.equal(r.status,2);
    assert.equal(r.outputs[0].code,'DUPLICATE_KEY');
  }));
  test(`${method}: changed registered source blocks startup`,()=>isolated(skill,async(dir)=>{
    await fs.appendFile(path.join(dir,'scripts/native-bridge.mjs'),'\n// synthetic tamper\n');
    const r=run(dir,[{op:'capabilities'}]);assert.equal(r.status,2);assert.match(r.stderr,/SOURCE_LOCK_MISMATCH/);
    assert.equal(r.outputs.length,0);
  }));
  test(`${method}: unsupported forecast scope is an explicit failure`,()=>isolated(skill,async(dir)=>{
    const r=run(dir,[{op:'review',input:reviewInput(method,{analysis_scope:'outcome_prediction'})}]);
    assert.equal(r.status,2);assert.equal(r.outputs[0].code,'INPUT_PREFLIGHT_FAILED');
  }));
  test(`${method}: unknown source fields are rejected rather than silently ignored`,()=>isolated(skill,async(dir)=>{
    const input=reviewInput(method);input.method_inputs.extra_hidden_instruction='Synthetic unsupported field';
    const r=run(dir,[{op:'review',input}]);assert.equal(r.status,2);assert.equal(r.outputs[0].code,'INPUT_PREFLIGHT_FAILED');
  }));
  test(`${method}: no user state is written back inside the Skill directory`,()=>isolated(skill,async(dir)=>{
    async function files(p,prefix=''){let out=[];for(const e of await fs.readdir(p,{withFileTypes:true})){
      const r=prefix+e.name;if(e.isDirectory())out.push(...await files(path.join(p,e.name),r+'/'));else out.push(r);}return out.sort();}
    const before=await files(dir);const r=run(dir,[{op:'review',input:reviewInput(method)}]);assert.equal(r.status,0);
    assert.deepEqual(await files(dir),before);
  }));
}
test('meihua: supplied solar context retains source and performedByScript=false through CLI',()=>isolated('cast-meihua',async(dir)=>{
  const input=reviewInput('meihua');input.method_inputs.time_basis='true_solar';
  input.method_inputs.solar={verification_status:'user_declared',local_datetime:'2024-06-01T11:45:00',
    source_ref:'synthetic declared conversion; not a verified service',location:'Synthetic location',longitude:120};
  const r=run(dir,[{op:'review',input}]);assert.equal(r.status,0,r.stderr);
  const result=r.outputs[0].result,p=result.bundle.child_result.method_payload;
  assert.equal(p.case.castTime.conversion.performedByScript,false);assert.equal(p.case.castTime.conversion.wallClockShiftSeconds,-900);
  assert.equal(result.case_snapshot.tasks[0].method_inputs.solar.verification_status,'user_declared');
}));
test('bazi: output separates imported P0 from the actually completed P1 structure check',()=>isolated('analyze-bazi',async(dir)=>{
  const r=run(dir,[{op:'review',input:reviewInput('bazi')}]);assert.equal(r.status,0,r.stderr);
  const p=r.outputs[0].result.bundle.child_result.method_payload;
  assert.equal(p.evidence.chart_grade,'P0');assert.equal(p.structure_check.grade,'P1');assert.equal(p.evidence.independent_charting_performed,false);
}));
