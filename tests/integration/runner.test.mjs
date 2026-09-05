import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {setup,profile,root,window,draftFor} from '../fixtures/synthetic/helpers.mjs';
import {NativeRegistry,sourceSnapshot,VerifiedRunner} from '../../runtime-src/execution.mjs';
const rejects=(p,c)=>assert.rejects(p,e=>e.code===c);
test('synthetic calculator is actually executed and recorded',async()=>{
  const s=await setup(),r=await s.runner.compute(s.c.case_id,s.t.task_id),records=s.store.records(s.c.case_id);
  assert.equal(r.native_payload.data.value,7);assert.equal(records.length,1);assert.equal(records[0].exit_code,0);
  assert.equal(records[0].observation.level,'local_runner_observed');assert.equal(records[0].validation.status,'validated');
  assert.equal(records[0].output_digest,r.output_digest);assert.equal(s.store.get(s.c.case_id).state,'validated');
});
test('read-only source inspection cannot produce an execution record',async()=>{
  const s=await setup();await sourceSnapshot(root,['echo-native.mjs']);assert.equal(s.store.records(s.c.case_id).length,0);
  assert.throws(()=>s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t)),e=>e.code==='NOT_EXECUTED');
});
test('production methods are unregistered rather than simulated',()=>assert.throws(()=>new NativeRegistry().get('analyze-ziwei'),e=>e.code==='NATIVE_NOT_REGISTERED'));
test('repeated start reuses the same successful run',async()=>{
  const s=await setup(),a=await s.runner.compute(s.c.case_id,s.t.task_id),b=await s.runner.compute(s.c.case_id,s.t.task_id);
  assert.equal(a.run_id,b.run_id);assert.equal(b.reused,true);assert.equal(s.store.records(s.c.case_id).length,1);
});
test('concurrent starts are serialized by an active lock',async()=>{
  const s=await setup({input:{value:7,delay_ms:150}}),a=s.runner.compute(s.c.case_id,s.t.task_id);
  await rejects(s.runner.compute(s.c.case_id,s.t.task_id),'EXECUTION_BUSY');await a;
});
for(const [mode,code] of [['broken','NATIVE_VALIDATION_FAILED'],['duplicate','NATIVE_VALIDATION_FAILED'],['fail','EXECUTION_FAILED'],['large','EXECUTION_FAILED']])
  test(`native ${mode} is rejected with a retained record`,async()=>{
    const s=await setup({input:{value:7,mode}});await rejects(s.runner.compute(s.c.case_id,s.t.task_id),code);
    assert.equal(s.store.records(s.c.case_id).length,1);assert.equal(s.store.result(s.c.case_id,s.t.task_id),null);
  });
test('timeout covers the child process lifetime',async()=>{
  const p=await profile({timeout_ms:100}),s=await setup({profiles:[p],input:{value:7,mode:'sleep'}});
  await rejects(s.runner.compute(s.c.case_id,s.t.task_id),'EXECUTION_FAILED');assert.equal(s.store.records(s.c.case_id)[0].timed_out,true);
});
test('technical retry requires a reason and identical input digest',async()=>{
  const s=await setup({input:{value:7,mode:'fail'}});await rejects(s.runner.compute(s.c.case_id,s.t.task_id),'EXECUTION_FAILED');
  await assert.rejects(s.runner.compute(s.c.case_id,s.t.task_id));
  await rejects(s.runner.compute(s.c.case_id,s.t.task_id,{retry_reason:'Synthetic same-input transport retry'}),'EXECUTION_FAILED');
  const rs=s.store.records(s.c.case_id);assert.equal(rs.length,2);assert.equal(rs[0].input_digest,rs[1].input_digest);assert.notEqual(rs[0].run_id,rs[1].run_id);
});
test('changed adapter input on retry is rejected',async()=>{
  let n=0;const p=await profile({prepareInput:x=>({...x,counter:++n})});const s=await setup({profiles:[p],input:{value:7,mode:'fail'}});
  await rejects(s.runner.compute(s.c.case_id,s.t.task_id),'EXECUTION_FAILED');
  await rejects(s.runner.compute(s.c.case_id,s.t.task_id,{retry_reason:'Synthetic retry'}),'RETRY_INPUT_CHANGED');
});
test('output cannot upgrade its own observation grade',async()=>{
  const s=await setup({input:{value:7,forge_grade:'host_observed'}});await s.runner.compute(s.c.case_id,s.t.task_id);
  const r=s.store.records(s.c.case_id)[0];assert.equal(r.observation.level,'local_runner_observed');assert.equal(r.observation.host_tool_ref,null);
});
test('parent secrets are not inherited by native child',async()=>{
  process.env.METAPHYSICS_TEST_SECRET='SYNTHETIC_NOT_A_REAL_SECRET';
  try{const s=await setup(),r=await s.runner.compute(s.c.case_id,s.t.task_id);assert.equal(r.native_payload.data.env_secret,null);}
  finally{delete process.env.METAPHYSICS_TEST_SECRET;}
});
test('source mutation invalidates the registered digest',async()=>{
  const temp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'synthetic-source-')));
  try{
    await fs.copyFile(path.join(root,'echo-native.mjs'),path.join(temp,'echo-native.mjs'));
    const p=await profile({root:temp}),s=await setup({profiles:[p]});await fs.appendFile(path.join(temp,'echo-native.mjs'),'\n// injected change\n');
    await rejects(s.runner.compute(s.c.case_id,s.t.task_id),'SOURCE_DIGEST_MISMATCH');assert.equal(s.store.records(s.c.case_id).length,0);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('source symlinks are rejected',async()=>{
  const temp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'synthetic-link-')));
  try{await fs.symlink(path.join(root,'echo-native.mjs'),path.join(temp,'echo-native.mjs'));await rejects(sourceSnapshot(temp,['echo-native.mjs']),'SYMLINK_SOURCE');}
  finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('same frozen event cannot execute under a new case ID',async()=>{
  const s=await setup();
  const second=s.store.create({subject_ref:s.subject,event_ref:s.event,proposition_id:s.c.proposition_id,
    question:'Synthetic alternative wording',criteria:s.c.criteria,analysis_scope:s.c.analysis_scope,window:window(),
    tasks:[{method:'fixture.echo',rule_profile:'synthetic-v1',method_inputs:{value:8}}]});
  s.store.freeze(second.case_id);await s.runner.compute(s.c.case_id,s.t.task_id);
  await rejects(s.runner.compute(second.case_id,second.tasks[0].task_id),'EVENT_ALREADY_CALCULATED');
});
test('two pre-frozen cases cannot race the same event ledger',async()=>{
  const s=await setup({input:{value:7,delay_ms:100}});
  const c=s.store.create({subject_ref:s.subject,event_ref:s.event,proposition_id:s.c.proposition_id,
    question:'Synthetic same event second draft',criteria:s.c.criteria,analysis_scope:s.c.analysis_scope,window:window(),
    tasks:[{method:'fixture.echo',rule_profile:'synthetic-v1',method_inputs:{value:9}}]});s.store.freeze(c.case_id);
  const a=s.runner.compute(s.c.case_id,s.t.task_id);await rejects(s.runner.compute(c.case_id,c.tasks[0].task_id),'EXECUTION_BUSY');await a;
});
test('multiple predeclared methods retain separate records and states',async()=>{
  const a=await profile(),b=await profile({method_id:'fixture.echo.second'}),s=await setup({profiles:[a,b]});
  for(const t of s.c.tasks)await s.runner.compute(s.c.case_id,t.task_id);
  assert.equal(s.store.records(s.c.case_id).length,2);assert.equal(s.store.get(s.c.case_id).state,'validated');
});
test('invalidated results cannot be reused or finalized',async()=>{
  const s=await setup();await s.runner.compute(s.c.case_id,s.t.task_id);
  s.store.invalidate(s.c.case_id,{reason:'Synthetic confirmed input error',evidence_ref:'synthetic:error'});
  await rejects(s.runner.compute(s.c.case_id,s.t.task_id),'CASE_NOT_ACTIVE');
  assert.throws(()=>s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t)),e=>e.code==='STALE_RESULT');
  assert.equal(s.store.records(s.c.case_id).length,1);
});
test('a raw shell-looking input is data and cannot create a file',async()=>{
  const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'synthetic-injection-'))),target=path.join(dir,'should-not-exist');
  try {const s=await setup({input:{value:7,note:`$(touch ${target}); echo synthetic`}});const r=await s.runner.compute(s.c.case_id,s.t.task_id);
    assert.equal(r.native_payload.data.input_echo.note,`$(touch ${target}); echo synthetic`);await assert.rejects(fs.access(target));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
