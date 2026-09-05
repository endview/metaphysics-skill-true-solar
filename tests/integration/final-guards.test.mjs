import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createProfile as bazi} from '../../skills/analyze-bazi/scripts/profile.mjs';import {createProfile as meihua} from '../../skills/cast-meihua/scripts/profile.mjs';
import {ReviewSession} from '../../runtime-src/session-host.mjs';import {reviewInput} from '../fixtures/synthetic/native-inputs.mjs';
import {ziweiReview} from '../fixtures/synthetic/ziwei-input.mjs';import {RouterV5} from '../../runtime-src/route-v5.mjs';import {LocalRouteHost} from '../../runtime-src/local-route-host.mjs';
import {SolarAdapterRegistry} from '../../runtime-src/time-adapter.mjs';
async function computed(method){const profile=await ({bazi,meihua}[method])(),s=new ReviewSession(profile),input=reviewInput(method),sub=s.store.registerSubject('Synthetic');const event=s.store.registerEvent(sub,'Synthetic',{reason:'Independent test'});const c=s.open({...input,subject_ref:sub,event_ref:event,proposition_id:'test'}),t=c.tasks[0],result=await s.handle({op:'compute',case_id:c.case_id,task_id:t.task_id});return {profile,s,c,t,payload:result.native_payload,prepared:profile.prepareInput(t.method_inputs,c)};}
for(const [label,mutate] of [
 ['valid but incorrect ten-god',p=>{Object.values(p.checks_by_chart)[0].pillars[0].heavenlyStem.tenGod='\u6bd4\u80a9';}],
 ['hidden stem dropped',p=>{Object.values(p.checks_by_chart)[0].pillars[3].earthlyBranch.hiddenStems.pop();}],
 ['wrong stem element',p=>{Object.values(p.checks_by_chart)[0].pillars[1].heavenlyStem.element='\u91d1';}]
])test('Bazi fault rejected: '+label,async()=>{const x=await computed('bazi');mutate(x.payload);assert.notDeepEqual(x.profile.validateNative(x.payload,x.prepared),[]);});
for(const [label,mutate] of [
 ['plausible wrong name',p=>{p.result.primary.name='\u5929\u6c34\u8bbc';}],
 ['false remainder',p=>{p.calculation.remainderMapping.upper.sourceValue+=1;}],
 ['wrong divisor',p=>{p.calculation.remainderMapping.upper.divisor=7;}],
 ['reversed generation',p=>{p.result.bodyUse.fiveElementRelation.code='not-a-relation';}],
 ['changed polarity',p=>{p.result.movingLine.changedValue=p.result.movingLine.originalValue;}]
])test('Meihua fault rejected: '+label,async()=>{const x=await computed('meihua');mutate(x.payload);assert.notDeepEqual(x.profile.validateNative(x.payload,x.prepared),[]);});
const roots=Object.fromEntries([['bazi','analyze-bazi'],['ziwei','analyze-ziwei'],['meihua','cast-meihua']].map(([m,s])=>[m,fileURLToPath(new URL('../../skills/'+s+'/',import.meta.url))]));
for(const method of ['bazi','ziwei','meihua'])test('Router completes model-draft continuation without recomputing '+method,async()=>{
 const input=method==='ziwei'?ziweiReview():reviewInput(method);input.analysis_scope=method==='meihua'?'symbolic_event':'traditional_structure';
 const router=new RouterV5(new LocalRouteHost(roots)),request={request_id:'synthetic',subject_ref:'s',event_ref:'e',proposition_id:'p',question:'Traditional structural reflection',criteria:'Conditional interpretation only',methods:[method],inputs:{[method]:input}};
 const first=await router.run(request);assert.equal(first.completed_methods.length,0);assert.equal(first.uncompleted[0].stage,'interpretation_required');
 const {context}=router.branchContext(first.route_id,method),draft=context.facts,card=context.knowledge.cards[0];
 draft.claims.push({claim_id:'traditional',nature:'traditional_interpretation',binding:draft.binding,text:'Under this tradition this is a conditional reflective theme, not a known outcome.',direction:'mixed',basis_refs:card.fact_requirements,knowledge_card_refs:[card.card_id+'@'+card.version],conditions:['An alternative candidate can differ'],counter_reading:'Actual circumstances may contradict this symbolic reading.'});
 const final=await router.finalizeBranch(first.route_id,method,draft);assert.equal(final.overall_status,'ok',JSON.stringify(final.uncompleted));assert.equal(final.completed_methods[0],method);
 const resumed=router.branchContext(first.route_id,method);assert.equal(resumed.context.execution_record.run_id,context.execution_record.run_id);assert.equal((await router.run(request)).reused,true);
 assert.ok(final.results[0].claims.at(-1).conditions.includes('An alternative candidate can differ'));
});
test('No converter installed means unresolved, not a fabricated correction',async()=>{const r=new SolarAdapterRegistry();const out=await r.convert({provider_id:'not-installed'});assert.equal(out.resolution_status,'unresolved');assert.equal(r.verify(out),false);});
const request=()=>({provider_id:'synthetic',authorized:true,civil_datetime:'2024-06-01T12:00:00+08:00',timezone:'Asia/Taipei',longitude:121,longitude_source:'synthetic'});
const answer=()=>({candidates:[{candidate_id:'s',local_datetime:'2024-06-01T11:50:00',source_ref:'synthetic'}],parameters:{synthetic_only:true}});
const registry=convert=>new SolarAdapterRegistry().register({id:'synthetic',version:'test',reviewed:true,license:'synthetic-test-data',review_ref:'synthetic-contract-only',convert});
test('Converter cannot overwrite input hash or verification fields',async()=>{for(const key of ['schema','input_digest','verification_status','provider','resolution_status'])await assert.rejects(registry(()=>({...answer(),[key]:'forged'})).convert(request()),e=>e.code==='CONVERTER_OUTPUT_KEYS');});
test('Converter request authorization and local receipt are required',async()=>{const r=registry(()=>answer());await assert.rejects(r.convert({...request(),authorized:false}));const out=await r.convert(request());assert.equal(r.verify(out),true);out.parameters.forged=true;assert.equal(r.verify(out),false);});
test('Converter duplicate candidates are rejected',async()=>{await assert.rejects(registry(()=>({...answer(),candidates:[answer().candidates[0],answer().candidates[0]]})).convert(request()),e=>e.code==='DUPLICATE_CANDIDATE');});
test('Bazi candidate set preserves both charts and unique knowledge bindings',async()=>{
 const profile=await bazi(),s=new ReviewSession(profile),input=reviewInput('bazi'),a=input.method_inputs,b=structuredClone(a);b.review_chart_id='alternative';b.candidate_id='alternative-time';b.pillars[3]='\u58ec\u620c';
 input.method_inputs={candidate_set:[a,b]};const sub=s.store.registerSubject('synthetic'),event=s.store.registerEvent(sub,'synthetic',{reason:'Candidate-boundary test'});input.analysis_scope='traditional_structure';
 const c=s.open({...input,subject_ref:sub,event_ref:event,proposition_id:'p'}),tid=c.tasks[0].task_id;
 const result=await s.handle({op:'compute',case_id:c.case_id,task_id:tid});assert.equal(Object.keys(result.native_payload.checks_by_chart).length,2);assert.equal(result.native_payload.evidence.time_basis.resolution_status,'candidate_set');
 const cards=await s.handle({op:'knowledge',case_id:c.case_id,task_id:tid});assert.equal(new Set(cards.cards.map(x=>x.card_id)).size,cards.cards.length);
 assert.ok(s.factDraft(c.case_id,tid).claims.some(x=>x.basis_refs.some(p=>p.includes('/alternative/'))));
});
test('Interpretation versions are retained without duplicate native payloads',async()=>{
 const x=await computed('meihua'),d=x.s.factDraft(x.c.case_id,x.t.task_id);await x.s.handle({op:'finalize',case_id:x.c.case_id,task_id:x.t.task_id,draft:d});
 const history=await x.s.handle({op:'interpretation_history',case_id:x.c.case_id,task_id:x.t.task_id});assert.equal(history.length,1);assert.equal(Object.hasOwn(history[0].child_summary,'method_payload'),false);
 const snapshot=x.s.exportState();const restored=new ReviewSession(x.profile,{trustedState:snapshot});assert.deepEqual(await restored.handle({op:'interpretation_history',case_id:x.c.case_id,task_id:x.t.task_id}),history);
});
test('Input completion does not freeze an invalid single-method draft',async()=>{
 const profile=await bazi(),session=new ReviewSession(profile),i=reviewInput('bazi'),sub=session.store.registerSubject('synthetic'),event=session.store.registerEvent(sub,'synthetic',{reason:'Incomplete input scenario'});
 const input={...i,subject_ref:sub,event_ref:event,proposition_id:'p'};const bad=structuredClone(input);bad.method_inputs.pillars=['invalid'];
 assert.throws(()=>session.open(bad),e=>e.code==='INPUT_PREFLIGHT_FAILED');const fixed=session.open(input);assert.equal(fixed.state,'frozen');
});
test('Router can fill only a never-executed missing branch, preserving completed runs',async()=>{
 const router=new RouterV5(new LocalRouteHost(roots)),req={request_id:'fill-input',subject_ref:'s',event_ref:'e',proposition_id:'p',question:'Review structures',criteria:'Structural only',methods:['bazi','ziwei'],inputs:{bazi:reviewInput('bazi')}};
 const a=await router.run(req);assert.deepEqual(a.completed_methods,['bazi']);const run=router.branchContext(a.route_id,'bazi').context.execution_record.run_id;
 router.supplyInput(a.route_id,'ziwei',ziweiReview());const b=await router.resume(a.route_id);assert.equal(b.completed_methods.length,2);assert.equal(router.branchContext(a.route_id,'bazi').context.execution_record.run_id,run);
 assert.throws(()=>router.supplyInput(a.route_id,'bazi',reviewInput('bazi')),e=>e.code==='BRANCH_ALREADY_FROZEN');
});
test('Rejected Ziwei preflight can be corrected before any native run',async()=>{
 const input=ziweiReview();delete input.method_inputs.native_input.birth.true_solar;
 const r=new RouterV5(new LocalRouteHost(roots)),req={request_id:'fix-preflight',subject_ref:'s',event_ref:'e',proposition_id:'p',question:'Review structure',criteria:'Structural only',methods:['ziwei'],inputs:{ziwei:input}};
 const a=await r.run(req);assert.equal(a.uncompleted[0].status,'insufficient_input');r.supplyInput(a.route_id,'ziwei',ziweiReview());const b=await r.resume(a.route_id);assert.deepEqual(b.completed_methods,['ziwei']);
});
