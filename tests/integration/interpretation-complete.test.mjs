import test from 'node:test';import assert from 'node:assert/strict';
import {createProfile as bazi} from '../../skills/analyze-bazi/scripts/profile.mjs';import {createProfile as meihua} from '../../skills/cast-meihua/scripts/profile.mjs';import {createProfile as ziwei} from '../../skills/analyze-ziwei/scripts/profile.mjs';
import {ReviewSession} from '../../runtime-src/session-host.mjs';import {reviewInput} from '../fixtures/synthetic/native-inputs.mjs';import {ziweiReview} from '../fixtures/synthetic/ziwei-input.mjs';
const profiles={bazi,meihua,ziwei};
async function sample(method){
 const s=new ReviewSession(await profiles[method]());const input=method==='ziwei'?ziweiReview():reviewInput(method);input.analysis_scope=method==='meihua'?'symbolic_event':'traditional_structure';
 const sub=s.store.registerSubject('Synthetic'),event=s.store.registerEvent(sub,'Synthetic',{reason:'Independent synthetic event'});
 const c=s.open({...input,subject_ref:sub,event_ref:event,proposition_id:'synthetic-proposition'}),task_id=c.tasks[0].task_id;
 await s.handle({op:'compute',case_id:c.case_id,task_id});
 const d=s.factDraft(c.case_id,task_id),knowledge=await s.handle({op:'knowledge',case_id:c.case_id,task_id});
 const card=knowledge.cards[0];assert.ok(card);
 const claim={claim_id:'synthetic-interpretation',nature:'traditional_interpretation',binding:d.binding,
   text:'Under the stated tradition, consider the structural theme conditionally; actual circumstances or other structures may support a different reading.',
   basis_refs:card.fact_requirements,knowledge_card_refs:[card.card_id+'@'+card.version],direction:'mixed'};
 d.claims.push(claim);return {s,c,task_id,d,knowledge};
}
for(const method of Object.keys(profiles)){
 test(`${method}: two-stage interpretation and citations finalize without recomputing`,async()=>{
  const x=await sample(method),b=await x.s.handle({op:'finalize',case_id:x.c.case_id,task_id:x.task_id,draft:x.d});
  assert.equal(b.child_result.status,'ok');assert.equal(b.child_result.findings.length,1);assert.equal(x.s.store.records(x.c.case_id).length,1);
 });
 test(`${method}: nonexistent uploaded card never becomes trusted`,async()=>{
  const x=await sample(method);x.d.claims.at(-1).knowledge_card_refs=['forged-card@1.0.0'];
  await assert.rejects(x.s.handle({op:'finalize',case_id:x.c.case_id,task_id:x.task_id,draft:x.d}),e=>e.code==='KNOWLEDGE_CARD_UNREVIEWED');
 });
 test(`${method}: dangling evidence fails while keeping the original native result`,async()=>{
  const x=await sample(method);x.d.claims.at(-1).basis_refs=['/not-present'];
  await assert.rejects(x.s.handle({op:'finalize',case_id:x.c.case_id,task_id:x.task_id,draft:x.d}));assert.equal(x.s.store.records(x.c.case_id).length,1);
 });
}
for(const text of ['She definitely loves you','Guaranteed success','A 99% probability','exact location is under the bed','diagnosis: cancer'])test('Hidden fact / probability risk rejected: '+text,async()=>{
 const x=await sample('meihua');x.d.claims.at(-1).text=text;
 await assert.rejects(x.s.handle({op:'finalize',case_id:x.c.case_id,task_id:x.task_id,draft:x.d}),e=>e.code==='SEMANTIC_RISK_FLAG');
});
test('Meihua symbolic stages cannot be turned into exact dates',async()=>{
 const x=await sample('meihua');x.d.claims.at(-1).text='A turn on 2024-06-05';x.d.claims.at(-1).timing={profile:'stage-within-horizon-v1',type:'stage',stage:'early'};
 await assert.rejects(x.s.handle({op:'finalize',case_id:x.c.case_id,task_id:x.task_id,draft:x.d}),e=>e.code==='TIMING_PRECISION');
});
test('Bazi traditional scope needs a confirmed true solar source before execution',async()=>{
 const input=reviewInput('bazi');input.analysis_scope='traditional_structure';input.method_inputs.source.verification_status='unknown';
 const s=new ReviewSession(await bazi());await assert.rejects(s.review(input),e=>e.code==='INPUT_PREFLIGHT_FAILED');
});
