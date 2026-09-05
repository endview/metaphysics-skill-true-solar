import test from 'node:test';import assert from 'node:assert/strict';
import {setup,draftFor,syntheticCard,profile} from '../fixtures/synthetic/helpers.mjs';
const code=(fn,c)=>assert.throws(fn,e=>e.code===c);
async function ready(options){const s=await setup(options);await s.runner.compute(s.c.case_id,s.t.task_id);return s;}
function interpreted(s){const d=draftFor(s.c,s.t);d.claims[0]={...d.claims[0],nature:'traditional_interpretation',text:'A synthetic symbolic reading, not a real-world prediction',knowledge_card_refs:['synthetic-card@1']};delete d.claims[0].fact_ids;return d;}
test('finalize binds the sole native payload and renders facts deterministically',async()=>{
  const s=await ready(),b=s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t));
  assert.equal(b.fact_block,'Synthetic value: 7');assert.equal(b.child_result.method_payload.data.value,7);
  assert.equal(b.validation.semantic_review,'not_performed');assert.equal(b.validation.production_accepted,false);
  assert.equal(s.runner.verifyBundle(b),true);assert.equal(s.store.records(s.c.case_id).length,1);
  assert.equal(Object.keys(b).filter(k=>k==='child_result').length,1);
});
for(const field of ['case_id','task_id','subject_ref','event_ref','proposition_id','window_digest'])
  test(`finalize rejects changed ${field} binding`,async()=>{const s=await ready(),d=draftFor(s.c,s.t);d.binding[field]='synthetic-injected';code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'BINDING_MISMATCH');});
test('nonexistent basis reference rejected',async()=>{const s=await ready(),d=draftFor(s.c,s.t);d.claims[0].basis_refs=['/missing'];code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'MISSING_BASIS');});
test('fact transcription error rejected',async()=>{const s=await ready(),d=draftFor(s.c,s.t);d.claims[0].text='Synthetic value: 8';code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'FACT_TEXT_MISMATCH');});
test('interpretation failure does not rerun native calculation',async()=>{
  const s=await ready(),d=draftFor(s.c,s.t);d.claims[0].text='wrong';assert.throws(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d));
  s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t));assert.equal(s.store.records(s.c.case_id).length,1);
});
test('a failed child status cannot carry conclusions',async()=>{const s=await ready(),d=draftFor(s.c,s.t);d.status='insufficient_input';code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'STATUS_CLAIMS_MISMATCH');});
test('success with no claims rejected',async()=>{const s=await ready(),d=draftFor(s.c,s.t);d.claims=[];code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'STATUS_CLAIMS_MISMATCH');});
test('execution lifecycle states cannot replace child status enum',async()=>{const s=await ready(),d=draftFor(s.c,s.t);d.status='execution_failed';code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'INVALID_CHILD_STATUS');});
test('traditional interpretation requires reviewed knowledge cards',async()=>{const s=await ready(),d=interpreted(s);code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'KNOWLEDGE_CARD_UNREVIEWED');});
test('synthetic reviewed card checks prerequisites and sources',async()=>{
  const s=await ready(),d=interpreted(s);const b=s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]});
  assert.equal(b.child_result.claims[0].nature,'traditional_interpretation');
});
test('knowledge card without a source is rejected',async()=>{const s=await ready(),card=syntheticCard();card.sources=[];
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,interpreted(s),{knowledge_cards:[card]}),'CARD_SOURCES_REQUIRED');});
test('knowledge card prerequisite mismatch is rejected',async()=>{const s=await ready(),card=syntheticCard();card.prerequisites=[{op:'equals',pointer:'/data/value',value:9}];
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,interpreted(s),{knowledge_cards:[card]}),'CARD_PREREQUISITE_FAILED');});
for(const phrase of ['He definitely loves the person.','The exact location is the third drawer.','There is an 88% success probability.'])
  test(`risk lint rejects: ${phrase}`,async()=>{const s=await ready(),d=interpreted(s);d.claims[0].text=phrase;
    code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]}),'SEMANTIC_RISK_FLAG');});
test('stage profile cannot be rewritten as an exact date',async()=>{
  const s=await ready({input:{value:7,timing_profile:{profile:'stage-within-horizon-v1'}}}),d=interpreted(s);
  d.claims[0].timing={profile:'stage-within-horizon-v1',type:'stage',stage:'late'};d.claims[0].text='A turning point on 2024-01-21';
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]}),'TIMING_PRECISION');
});
test('valid relative stage is retained without date conversion',async()=>{
  const s=await ready({input:{value:7,timing_profile:{profile:'stage-within-horizon-v1'}}}),d=interpreted(s);
  d.claims[0].timing={profile:'stage-within-horizon-v1',type:'stage',stage:'late'};
  const b=s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]});assert.equal(b.child_result.claims[0].timing.stage,'late');
});
test('adding a date field to a stage claim is rejected',async()=>{
  const s=await ready({input:{value:7,timing_profile:{profile:'stage-within-horizon-v1'}}}),d=interpreted(s);
  d.claims[0].timing={profile:'stage-within-horizon-v1',type:'stage',stage:'late',date:'2024-01-21'};
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]}),'TIMING_PRECISION');
});
test('timing profile cannot be selected after computation',async()=>{
  const s=await ready(),d=interpreted(s);d.claims[0].timing={profile:'stage-within-horizon-v1',type:'stage',stage:'late'};
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]}),'UNFROZEN_TIMING_PROFILE');
});
test('count rule cannot change its frozen unit',async()=>{
  const s=await ready({input:{value:7,timing_profile:{profile:'moving-line-count-v1',unit:'day',max_count:30,count_basis_ref:'/data/value'}}}),d=interpreted(s);
  d.claims[0].timing={profile:'moving-line-count-v1',type:'count',count:7,unit:'week'};
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]}),'TIMING_UNIT_CHANGED');
});
test('count outside the frozen horizon is rejected',async()=>{
  const s=await ready({input:{value:7,timing_profile:{profile:'moving-line-count-v1',unit:'day',max_count:5,count_basis_ref:'/data/value'}}}),d=interpreted(s);
  d.claims[0].timing={profile:'moving-line-count-v1',type:'count',count:7,unit:'day'};
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]}),'TIMING_OUTSIDE_WINDOW');
});
test('real-world facts require separate observation references',async()=>{const s=await ready(),d=interpreted(s);d.claims[0].nature='real_world_fact';
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'REAL_EVIDENCE_REQUIRED');});
test('new real evidence changes the interpretation, not native payload',async()=>{
  const s=await ready(),before=s.store.result(s.c.case_id,s.t.task_id).output_digest;
  const ref=s.store.addObservation(s.c.case_id,{text:'Synthetic observed response',source_ref:'synthetic:observation'});
  const d=interpreted(s);d.claims[0].nature='action_recommendation';d.claims[0].evidence_refs=[ref];d.claims[0].text='Review the supplied synthetic observation.';
  s.runner.finalize(s.c.case_id,s.t.task_id,d);assert.equal(s.store.result(s.c.case_id,s.t.task_id).output_digest,before);assert.equal(s.store.records(s.c.case_id).length,1);
});
test('bundle tampering invalidates local issuance receipt',async()=>{
  const s=await ready(),b=s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t));b.child_result.method_payload.data.value=9;assert.equal(s.runner.verifyBundle(b),false);
});
test('adapter cannot mutate the native payload while building the child',async()=>{
  const p=await profile({buildChild:({status,claims,payload})=>({schema:'synthetic.standard-child.v1',status,claims,method_payload:{...payload,injected:true}})});
  const s=await ready({profiles:[p]});code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t)),'CHILD_PAYLOAD_CHANGED');
});
test('unknown draft fields cannot hide an unvalidated conclusion',async()=>{
  const s=await ready(),d=draftFor(s.c,s.t);d.hidden_prediction='synthetic';code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'UNKNOWN_DRAFT_FIELD');
});
test('unknown claim fields cannot bypass the precision contract',async()=>{
  const s=await ready(),d=draftFor(s.c,s.t);d.claims[0].forecast_date='2024-01-20';code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d),'UNKNOWN_CLAIM_FIELD');
});
test('count is checked against actual interval, not only a declared maximum',async()=>{
  const s=await ready({input:{value:7,timing_profile:{profile:'moving-line-count-v1',unit:'week',max_count:99,
    count_basis_ref:'/data/value',anchor:'window_start',unit_basis:'fixed_duration'}}}),d=interpreted(s);
  d.claims[0].timing={profile:'moving-line-count-v1',type:'count',count:7,unit:'week'};
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]}),'TIMING_OUTSIDE_WINDOW');
});
test('a valid frozen day count is tied to the native field',async()=>{
  const s=await ready({input:{value:7,timing_profile:{profile:'moving-line-count-v1',unit:'day',max_count:30,
    count_basis_ref:'/data/value',anchor:'window_start',unit_basis:'fixed_duration'}}}),d=interpreted(s);
  d.claims[0].timing={profile:'moving-line-count-v1',type:'count',count:7,unit:'day'};
  const b=s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]});assert.equal(b.child_result.claims[0].timing.count,7);
});
test('forged native count is rejected even inside the window',async()=>{
  const s=await ready({input:{value:7,timing_profile:{profile:'moving-line-count-v1',unit:'day',max_count:30,
    count_basis_ref:'/data/value',anchor:'window_start',unit_basis:'fixed_duration'}}}),d=interpreted(s);
  d.claims[0].timing={profile:'moving-line-count-v1',type:'count',count:8,unit:'day'};
  code(()=>s.runner.finalize(s.c.case_id,s.t.task_id,d,{knowledge_cards:[syntheticCard()]}),'COUNT_BASIS_MISMATCH');
});
