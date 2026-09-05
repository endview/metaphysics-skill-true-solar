import test from 'node:test';import assert from 'node:assert/strict';
import {compareClaims,RouteSession,detectCapabilities} from '../../runtime-src/route.mjs';
import {setup,profile,draftFor} from '../fixtures/synthetic/helpers.mjs';
const a=()=>({binding:{subject_ref:'synthetic-subject',event_ref:'synthetic-event',proposition_id:'synthetic-prop',
  criteria:'synthetic-exact',window_digest:'synthetic-window',analysis_scope:'bounded'},direction:'supportive'});
test('same comparable propositions are structurally consistent',()=>assert.equal(compareClaims(a(),a()),'consistent'));
test('opposite direction on same proposition is conflict',()=>assert.equal(compareClaims(a(),{...a(),direction:'adverse'}),'conflict'));
test('different objects are not comparable',()=>{const b=a();b.binding.subject_ref='other';assert.equal(compareClaims(a(),b),'not_comparable');});
test('different propositions cannot be called agreement',()=>{const b=a();b.binding.proposition_id='other';assert.equal(compareClaims(a(),b),'not_comparable');});
test('overlapping but different windows are not equated',()=>{const b=a();b.binding.window_digest='overlapping-not-identical';assert.equal(compareClaims(a(),b),'not_comparable');});
test('different layers may be complementary only with an explicit shared goal',()=>{const x=a(),y=a();x.goal_ref=y.goal_ref='synthetic-shared-goal';y.binding.analysis_scope='other';assert.equal(compareClaims(x,y),'complementary');});
test('unknown direction cannot be cast as agreement',()=>assert.equal(compareClaims(a(),{...a(),direction:'unknown'}),'not_comparable'));
test('capability probe does not claim independent model isolation',()=>{const c=detectCapabilities();assert.equal(c.branch_isolation,'unavailable');assert.equal(c.chinese_calendar,'unknown');assert.equal(c.tool_observation,'unavailable');});
test('unissued imported bundle is rejected',async()=>{const s=await setup();const route=new RouteSession(s.runner);assert.throws(()=>route.compose(s.c.case_id,[{binding:{case_id:s.c.case_id}}]),e=>e.code==='UNVERIFIED_BUNDLE');});
test('route recursion is rejected',async()=>{const s=await setup(),route=new RouteSession(s.runner),exit=route.enter();assert.throws(()=>route.enter(),e=>e.code==='RECURSIVE_ROUTE');exit();const end=route.enter();end();});
test('single synthetic branch can complete its accepted test scope',async()=>{const s=await setup();await s.runner.compute(s.c.case_id,s.t.task_id);
  const b=s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t)),out=new RouteSession(s.runner).compose(s.c.case_id,[b]);
  assert.equal(out.overall_status,'ok');assert.equal(out.profile_active,false);assert.equal(out.independent_method_verification,false);
});
test('missing branch is visible and requested scope is preserved',async()=>{
  const s=await setup({profiles:[await profile(),await profile({method_id:'fixture.echo.second'})]});await s.runner.compute(s.c.case_id,s.t.task_id);
  const b=s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t)),out=new RouteSession(s.runner).compose(s.c.case_id,[b]);
  assert.equal(out.requested_methods.length,2);assert.equal(out.completed_methods.length,1);assert.equal(out.overall_status,'partial');assert.equal(out.uncompleted.length,1);
});
test('two successful scripts do not prove isolated model contexts',async()=>{
  const s=await setup({profiles:[await profile(),await profile({method_id:'fixture.echo.second'})]}),bs=[];
  for(const t of s.c.tasks){await s.runner.compute(s.c.case_id,t.task_id);bs.push(s.runner.finalize(s.c.case_id,t.task_id,draftFor(s.c,t)));}
  const out=new RouteSession(s.runner).compose(s.c.case_id,bs);
  assert.equal(out.completed_methods.length,2);assert.equal(out.overall_status,'partial');assert.equal(out.combination_status,'blocked_isolation');assert.equal(out.comparisons.length,0);
});
