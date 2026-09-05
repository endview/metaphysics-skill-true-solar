import test from 'node:test';import assert from 'node:assert/strict';
import {createProfile as baziProfile,validateBaziNative} from '../../skills/analyze-bazi/scripts/profile.mjs';
import {createProfile as meihuaProfile,validateMeihuaNative} from '../../skills/cast-meihua/scripts/profile.mjs';
import {ReviewSession} from '../../runtime-src/session-host.mjs';
import {bindingFor} from '../../runtime-src/validate.mjs';
import golden from '../fixtures/synthetic/native-golden.json' with {type:'json'};
import {reviewInput} from '../fixtures/synthetic/native-inputs.mjs';
async function setup(method,changes={}) {
  const profile=await (method==='bazi'?baziProfile():meihuaProfile());return {profile,session:new ReviewSession(profile),input:reviewInput(method,changes)};
}
for(const method of ['bazi','meihua']) {
  test(`${method}: actual native process -> standardized single-payload result`,async()=>{
    const {session,input}=await setup(method),r=await session.review(input),b=r.bundle;
    assert.equal(r.execution_record.exit_code,0);assert.equal(r.execution_record.observation.level,'local_runner_observed');
    assert.equal(r.execution_record.source_unchanged_during_run,true);
    assert.equal(b.child_result.schema_version,'metaphysics.standard-child.v1');assert.equal(b.child_result.method_id,method);
    assert.equal(b.child_result.status,'ok');assert.ok(b.child_result.claims.length>0);
    assert.ok(b.child_result.claims.every(c=>c.statement&&!('text' in c)&&c.direction==='neutral'));
    assert.equal(r.release_accepted,false);assert.equal(b.validation.production_accepted,false);
    assert.equal(session.runner.verifyBundle(b),true);
  });
  test(`${method}: same request reuses the real run`,async()=>{
    const {session,input}=await setup(method),a=await session.review(input),b=await session.review(input);
    assert.equal(a.execution_record.run_id,b.execution_record.run_id);assert.equal(b.reused,true);
    assert.equal(session.store.records(a.case_snapshot.case_id).length,1);
  });
  test(`${method}: same request ID cannot carry a changed question`,async()=>{
    const {session,input}=await setup(method);await session.review(input);
    await assert.rejects(session.review({...input,question:'A different outcome question'}),e=>e.code==='REQUEST_ID_REUSED_DIFFERENTLY');
  });
  test(`${method}: fact transcription tampering is blocked, without rerunning native`,async()=>{
    const {session,input}=await setup(method),r=await session.review(input),c=r.case_snapshot,t=c.tasks[0];
    const draft=session.factDraft(c.case_id,t.task_id);draft.claims[0].text='Forged textual value';
    assert.throws(()=>session.runner.finalize(c.case_id,t.task_id,draft),e=>e.code==='FACT_TEXT_MISMATCH');
    assert.equal(session.store.records(c.case_id).length,1);
  });
  test(`${method}: valid-looking foreign subject cannot reuse the result`,async()=>{
    const {session,input}=await setup(method),r=await session.review(input),c=r.case_snapshot,t=c.tasks[0];
    const draft=session.factDraft(c.case_id,t.task_id);draft.binding.subject_ref='another_subject';
    assert.throws(()=>session.runner.finalize(c.case_id,t.task_id,draft),e=>e.code==='BINDING_MISMATCH');
  });
  test(`${method}: successful script cannot masquerade as a completed forecast`,async()=>{
    const {session,input}=await setup(method,{analysis_scope:'outcome_prediction'});
    await assert.rejects(session.review(input),e=>e.code==='INPUT_PREFLIGHT_FAILED');
  });
  test(`${method}: a free-form symbolic conclusion is outside the pilot scope`,async()=>{
    const {session,input}=await setup(method),r=await session.review(input),c=r.case_snapshot,t=c.tasks[0];
    const d=session.factDraft(c.case_id,t.task_id);d.claims[0].nature='traditional_interpretation';d.claims[0].text='Guaranteed synthetic success';
    assert.throws(()=>session.runner.finalize(c.case_id,t.task_id,d),e=>e.code==='INTERPRETATION_NOT_IMPLEMENTED');
  });
}
test('bazi: user-declared source remains P0, not P2/tool_verified',async()=>{
  const {session,input}=await setup('bazi'),r=await session.review(input),e=r.bundle.child_result.method_payload.evidence;
  assert.equal(e.chart_grade,'P0');assert.equal(e.time_basis.verification_status,'user_declared');
  assert.equal(e.independent_charting_performed,false);assert.equal(e.chart_candidates[0].candidate_id,e.time_basis.resolved_candidates[0].candidate_id);
});
test('bazi: unknown source is permitted only for explicit local structure review',async()=>{
  const {session,input}=await setup('bazi');input.method_inputs.source.verification_status='unknown';
  const r=await session.review(input),e=r.bundle.child_result.method_payload.evidence;
  assert.equal(e.time_basis.resolution_status,'unresolved');assert.equal(e.time_basis.verification_status,null);
  assert.deepEqual(e.chart_candidates,[]);assert.deepEqual(e.time_basis.resolved_candidates,[]);
});
test('bazi: self-reported tool_verified does not upgrade provenance',async()=>{
  const {session,input}=await setup('bazi');input.method_inputs.source.verification_status='tool_verified';
  await assert.rejects(session.review(input),e=>e.code==='INPUT_PREFLIGHT_FAILED');
});
test('bazi: conflicting supplied true-solar hour is rejected',async()=>{
  const {session,input}=await setup('bazi');input.method_inputs.source.true_solar_datetime='2000-01-01T01:00:00';
  await assert.rejects(session.review(input),e=>e.code==='INPUT_PREFLIGHT_FAILED');
});
test('bazi: unsupported month/day layers cannot be disguised as a year argument',async()=>{
  const {session,input}=await setup('bazi');input.method_inputs.liuyue=golden.pillars[0];
  await assert.rejects(session.review(input),e=>e.code==='INPUT_PREFLIGHT_FAILED');
});
test('bazi: swapping a candidate ID invalidates the native evidence',async()=>{
  const {session,input,profile}=await setup('bazi'),r=await session.review(input),c=r.case_snapshot;
  const prepared=profile.prepareInput(c.tasks[0].method_inputs,c),payload=structuredClone(r.bundle.child_result.method_payload);
  payload.evidence.time_basis.resolved_candidates[0].candidate_id='foreign';
  assert.deepEqual(validateBaziNative(payload,prepared),['SOURCE_EVIDENCE_CHANGED']);
});
test('meihua: minute precision remains minute; native seconds are normalization only',async()=>{
  const {session,input}=await setup('meihua'),r=await session.review(input);
  assert.equal(r.case_snapshot.time_context.input_precision,'minute');
  assert.equal(r.bundle.child_result.method_payload.case.castTime.civil.localDateTime,'2024-06-01T12:00:00');
});
test('meihua: now is read once and is not re-read on repeated start',async()=>{
  let clocks=0;const profile=await meihuaProfile(),session=new ReviewSession(profile,{clock:()=>{clocks++;return new Date('2024-06-01T04:00:00Z');}});
  const input=reviewInput('meihua',{time_request:{source_kind:'host_clock',source_ref:'synthetic:host',raw_input:'now',timezone:'Asia/Taipei'}});
  const a=await session.review(input),b=await session.review(input);
  assert.equal(clocks,1);assert.equal(a.execution_record.run_id,b.execution_record.run_id);
  assert.equal(a.case_snapshot.time_context.source_kind,'host_clock');
  assert.equal(a.bundle.child_result.method_payload.case.castTime.civil.source,'specified');
});
for(const numbers of [123,[1],[1,2,3,4],[0,2],[1.1,2],[Number.MAX_SAFE_INTEGER,1]])test(`meihua: invalid group ${JSON.stringify(numbers)} blocked`,async()=>{
  const {session,input}=await setup('meihua');input.method_inputs.numbers=numbers;
  await assert.rejects(session.review(input),e=>e.code==='INPUT_PREFLIGHT_FAILED');
});
test('meihua: explicit grouping confirmation is required',async()=>{
  const {session,input}=await setup('meihua');delete input.method_inputs.number_grouping_confirmed;
  await assert.rejects(session.review(input),e=>e.code==='INPUT_PREFLIGHT_FAILED');
});
test('meihua: zero-duration horizon is blocked before native runs',async()=>{
  const {session,input}=await setup('meihua');input.window.end=input.window.start;
  await assert.rejects(session.review(input),e=>e.code==='NONPOSITIVE_WINDOW');
});
test('meihua: derived-line injection is rejected by native structural validation',async()=>{
  const {session,input,profile}=await setup('meihua'),r=await session.review(input),c=r.case_snapshot;
  const p=structuredClone(r.bundle.child_result.method_payload),prepared=profile.prepareInput(c.tasks[0].method_inputs,c);
  p.result.changed.binaryBottomUp='111111';assert.ok(validateMeihuaNative(p,prepared).length>0);
});
test('meihua: a forged hexagram name in the final bundle invalidates the issuance receipt',async()=>{
  const {session,input}=await setup('meihua'),r=await session.review(input);r.bundle.child_result.method_payload.result.primary.name='forged-name';
  assert.equal(session.runner.verifyBundle(r.bundle),false);
});
test('meihua: lunar native profile executes the untouched Chinese-calendar path',async()=>{
  const {session,input}=await setup('meihua');input.method_inputs.native_method='lunar-time-v2';delete input.method_inputs.numbers;delete input.method_inputs.number_grouping_confirmed;
  const r=await session.review(input);assert.equal(r.bundle.child_result.method_payload.protocol.id,'lunar-time-v2');
  assert.equal(r.bundle.child_result.method_payload.calculation.rawValues.calendarCarrier,'2024-06-01T12:00:00.000Z');
});
