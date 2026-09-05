import test from 'node:test';import assert from 'node:assert/strict';
import {SessionCaseStore,assertTransition,frozenDigest,semanticWindowKey} from '../../runtime-src/case.mjs';
import {normalizeWindow} from '../../runtime-src/time-context.mjs';
import {window,setup} from '../fixtures/synthetic/helpers.mjs';
const code=(fn,c)=>assert.throws(fn,e=>e.code===c);
test('identical labels never establish subject identity',()=>{const s=new SessionCaseStore();assert.notEqual(s.registerSubject('A'),s.registerSubject('A'));});
test('event requires an explicit semantic distinction reason',()=>{const s=new SessionCaseStore(),sub=s.registerSubject('A');assert.throws(()=>s.registerEvent(sub,'event'));});
test('illegal lifecycle transition rejected',()=>code(()=>assertTransition('draft','delivered'),'INVALID_STATE_TRANSITION'));
test('failure states are not successful child states',()=>assertTransition('executing','execution_failed'));
test('frozen input cannot be edited',async()=>{const s=await setup();code(()=>s.store.reviseDraft(s.c.case_id,{question:'replacement'}),'CASE_FROZEN');});
test('returned case copies cannot mutate the frozen input',async()=>{const s=await setup(),c=s.store.get(s.c.case_id);c.tasks[0].method_inputs.value=900;assert.equal(s.store.get(s.c.case_id).tasks[0].method_inputs.value,7);});
test('runtime transitions do not change frozen input digest',async()=>{const s=await setup(),before=frozenDigest(s.store.get(s.c.case_id));s.store.transitionTask(s.c.case_id,s.t.task_id,'executing');assert.equal(frozenDigest(s.store.get(s.c.case_id)),before);});
test('same-window wording changes are not new semantic windows',()=>assert.equal(semanticWindowKey(normalizeWindow(window())),semanticWindowKey(normalizeWindow({...window(),raw_input:'Other wording'}))));
test('calendar boundary profiles remain distinguishable',()=>assert.notEqual(semanticWindowKey(normalizeWindow(window())),semanticWindowKey(normalizeWindow({...window(),boundary_profile:'lunar-new-year'}))));
for(const [kind,expected] of [['explanation','reuse_native_revise_interpretation'],['window','scope_change_pending'],['method','recast_request_pending'],['inputs','recast_request_pending'],['reality','append_observation_only']])
  test(`change ${kind} never automatically recalculates`,async()=>{const s=await setup();assert.deepEqual(s.store.changeRequest(s.c.case_id,kind),{action:expected,automatic_recalculation:false});});
test('new observations do not modify the calculation input',async()=>{const s=await setup(),d=frozenDigest(s.c);const ref=s.store.addObservation(s.c.case_id,{text:'Synthetic later feedback',source_ref:'synthetic:feedback'});assert.equal(frozenDigest(s.store.get(s.c.case_id)),d);assert.equal(s.store.observation(s.c.case_id,ref).source_ref,'synthetic:feedback');});
