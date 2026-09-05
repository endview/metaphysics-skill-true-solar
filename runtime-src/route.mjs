// SPDX-License-Identifier: AGPL-3.0-only
import { need, clone } from './common.mjs';

export function detectCapabilities() {
  let present=false;
  try {present=new Intl.DateTimeFormat('en-u-ca-chinese').resolvedOptions().calendar==='chinese';}catch{}
  return {schema:'metaphysics.runtime-capabilities.v1',skill_loading:'file_read',process_execution:'available',
    chinese_calendar:'unknown',calendar_api_present:present,branch_isolation:'unavailable',
    tool_observation:'unavailable',case_store:'session',source:'local-runtime-probe',
    limitations:['API presence is not calendar correctness verification.',
      'No host-authenticated observation or isolated model-context adapter is implemented.']};
}
// Pure structural comparison, NOT proof that the statements are true or independent.
export function compareClaims(a,b) {
  const x=a.binding,y=b.binding;
  if(!x||!y||x.subject_ref!==y.subject_ref||x.event_ref!==y.event_ref)return 'not_comparable';
  const same=['proposition_id','criteria','window_digest','analysis_scope'].every(k=>x[k]===y[k]);
  if(!same)return a.goal_ref && a.goal_ref===b.goal_ref?'complementary':'not_comparable';
  if(!['supportive','adverse'].includes(a.direction)||!['supportive','adverse'].includes(b.direction))return 'not_comparable';
  return a.direction===b.direction?'consistent':'conflict';
}
export class RouteSession {
  #active=false; #runner;
  constructor(runner){need(typeof runner?.verifyBundle==='function','RUNNER_REQUIRED');this.#runner=runner;}
  enter(){need(!this.#active,'RECURSIVE_ROUTE');this.#active=true;return ()=>{this.#active=false;};}
  compose(case_id,bundles,{missing={}}={}){
    const release=this.enter();
    try {
      const c=this.#runner.store.get(case_id),requested_methods=c.tasks.map(t=>t.method),seen=new Set();
      for(const b of bundles){
        need(this.#runner.verifyBundle(b),'UNVERIFIED_BUNDLE');need(b.binding.case_id===case_id,'ROUTE_CASE_MISMATCH');
        need(requested_methods.includes(b.binding.method),'UNREQUESTED_METHOD');
        need(!seen.has(b.binding.method),'DUPLICATE_BRANCH');seen.add(b.binding.method);
      }
      const completed_methods=bundles.filter(b=>b.child_result.status==='ok').map(b=>b.binding.method);
      const incomplete=requested_methods.filter(m=>!completed_methods.includes(m)).map(method=>({method,
        reason:missing[method]||'No completed verified child result'}));
      const combined=requested_methods.length>1;
      // Until a reviewed host adapter exists, multi-method independence is never asserted.
      return {schema:'metaphysics.route-output.v5-candidate',execution_profile:'method-v5-candidate',
        profile_active:false,requested_methods,completed_methods,uncompleted:incomplete,
        overall_status:incomplete.length||combined?'partial':'ok',
        combination_status:combined?'blocked_isolation':'single_method',
        branch_isolation:'unavailable',comparisons:[],
        independent_method_verification:false,
        branch_claims:bundles.map(b=>({method:b.binding.method,claims:clone(b.child_result.claims)})),
        limitations:combined?['Independent model contexts have not been verified; no combined confirmation is produced.']:[]};
    } finally {release();}
  }
}
