import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {RouterV5,compareV5} from '../../runtime-src/route-v5.mjs';import {LocalRouteHost} from '../../runtime-src/local-route-host.mjs';import {reviewInput} from '../fixtures/synthetic/native-inputs.mjs';import {ziweiReview} from '../fixtures/synthetic/ziwei-input.mjs';
const roots=Object.fromEntries([['bazi','analyze-bazi'],['meihua','cast-meihua'],['ziwei','analyze-ziwei']].map(([k,v])=>[k,fileURLToPath(new URL('../../skills/'+v+'/',import.meta.url))]));
function request(methods){return {request_id:'synthetic-route',subject_ref:'synthetic-subject',event_ref:'synthetic-event',proposition_id:'synthetic-proposition',question:'Review method structures only',criteria:'Structural correspondence',methods,
 inputs:Object.fromEntries(methods.filter(m=>roots[m]).map(m=>{const i=m==='ziwei'?ziweiReview():reviewInput(m);return [m,{analysis_scope:i.analysis_scope,window:i.window,method_inputs:i.method_inputs,...(i.time_request?{time_request:i.time_request}:{})}];}))};}
for(const method of ['bazi','ziwei','meihua'])test('Router real process branch '+method,async()=>{
 const r=new RouterV5(new LocalRouteHost(roots)),out=await r.run(request([method]));
 assert.equal(out.overall_status,'ok',JSON.stringify(out.uncompleted));assert.deepEqual(out.completed_methods,[method]);assert.equal(out.results[0].schema_version,'metaphysics.adapter-result.v4');
 assert.equal(out.results[0].claims[0].subject_ref,'synthetic-subject');assert.equal((await r.run(request([method]))).reused,true);
});
test('Router explicitly reports three real branches but not independent model verification',async()=>{
 const out=await new RouterV5(new LocalRouteHost(roots)).run(request(['bazi','ziwei','meihua']));
 assert.equal(out.completed_methods.length,3,JSON.stringify(out.uncompleted));assert.equal(out.overall_status,'partial');assert.equal(out.combination_status,'blocked_isolation');assert.deepEqual(out.comparisons,[]);
});
test('Missing installation does not erase a requested method',async()=>{
 const out=await new RouterV5(new LocalRouteHost({bazi:roots.bazi})).run(request(['bazi','ziwei']));
 assert.deepEqual(out.requested_methods,['bazi','ziwei']);assert.deepEqual(out.completed_methods,['bazi']);assert.equal(out.uncompleted[0].status,'unavailable');
});
test('Unsupported capability is not substituted with a registered method',async()=>{
 const out=await new RouterV5(new LocalRouteHost(roots)).run(request(['liuyao']));assert.equal(out.uncompleted[0].status,'unsupported');assert.equal(out.completed_methods.length,0);
});
test('New request id on same event is not permission to cast again',()=>{
 const r=new RouterV5(new LocalRouteHost(roots)),i=request(['meihua']);r.plan(i);assert.throws(()=>r.plan({...i,request_id:'another'}),e=>e.code==='EVENT_ALREADY_PLANNED');
});
test('Router rejects recursion',()=>{const r=new RouterV5(new LocalRouteHost(roots));assert.throws(()=>r.plan({...request(['bazi']),parent_route_id:'nested'}),e=>e.code==='RECURSIVE_ROUTE');});
const claim=()=>({nature:'traditional_interpretation',binding:{subject_ref:'s',event_ref:'e',proposition_id:'p',criteria:'same',window_digest:'window',analysis_scope:'annual_cycle'},conditions:['frozen condition'],direction:'supportive'});
test('Compatible supportive versus cautionary is conflict, not a vote',()=>{assert.equal(compareV5(claim(),{...claim(),direction:'cautionary'}),'conflict');});
test('Overlapping windows are still not identical',()=>{const b=claim();b.binding.window_digest='overlap';assert.equal(compareV5(claim(),b),'not_comparable');});
test('Fixed calculation facts cannot manufacture interpretive consensus',()=>assert.equal(compareV5({...claim(),nature:'calculation_fact'},claim()),'not_comparable'));
test('Non-identical criteria or candidate conditions are not comparable',()=>assert.equal(compareV5(claim(),{...claim(),conditions:['other']}),'not_comparable'));
test('Imported self-reported receipt is not an observed child invocation',()=>{
 const host=new LocalRouteHost(roots);assert.equal(host.verifyInvocation({task_id:'fake'},{result:{},receipt:{receipt_id:'fake'}}),false);
});
