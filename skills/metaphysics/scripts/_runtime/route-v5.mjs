// SPDX-License-Identifier: AGPL-3.0-only
// Router only: no astrology engines, time-to-pillar rules or hexagram tables.
import {id,text,need,clone,digest,plain,pointer} from './common.mjs';
import {normalizeTimeContext,freezeWindow} from './time-context.mjs';
import {bindingFor} from './validate.mjs';
import {validateStandardChild} from './native-utils.mjs';
const METHODS=Object.freeze({bazi:{skill:'analyze-bazi',profile:'bazi-provided-structure-v1-candidate'},
  ziwei:{skill:'analyze-ziwei',profile:'ziwei-verified-v1'},meihua:{skill:'cast-meihua',profile:'meihua-calculation-review-v1-candidate'}});
export function compareV5(a,b) {
  if(a.nature!=='traditional_interpretation'||b.nature!=='traditional_interpretation')return 'not_comparable';
  for(const k of ['subject_ref','event_ref'])if(a.binding[k]!==b.binding[k])return 'not_comparable';
  for(const k of ['proposition_id','criteria','window_digest','analysis_scope'])if(a.binding[k]!==b.binding[k])
    return a.goal_ref&&a.goal_ref===b.goal_ref?'complementary':'not_comparable';
  if(digest(a.conditions)!==digest(b.conditions))return 'not_comparable';
  if(!['supportive','cautionary'].includes(a.direction)||!['supportive','cautionary'].includes(b.direction))return 'not_comparable';
  return a.direction===b.direction?'consistent':'conflict';
}
export class RouterV5 {
  #host;#busy=false;#plans=new Map();#outputs=new Map();#events=new Map();#replies=new Map();#requests=new Map();#failures=new Map();
  constructor(host) {need(host&&typeof host.dispatch==='function'&&typeof host.verifyInvocation==='function','HOST_ADAPTER_REQUIRED');this.#host=host;}
  plan(request) {
    need(plain(request),'ROUTE_REQUEST');
    for(const key of ['request_id','subject_ref','event_ref','proposition_id','question','criteria'])text(request[key],key);
    need(!request.parent_route_id,'RECURSIVE_ROUTE');
    need(Array.isArray(request.methods)&&request.methods.length>0&&new Set(request.methods).size===request.methods.length,'REQUESTED_METHODS');
    const old=this.#plans.get(request.request_id);if(old){need(old.request_digest===digest(request),'ROUTE_REQUEST_CHANGED');return clone(old);}
    const eventKey=request.subject_ref+'/'+request.event_ref;
    need(!this.#events.has(eventKey),'EVENT_ALREADY_PLANNED','Revisions must reuse the frozen plan, not change the request ID.');
    const plan={schema_version:'metaphysics.route-plan.v4',execution_profile:'method-v5',route_id:id('route'),request_id:request.request_id,
      request_digest:digest(request),subject_ref:request.subject_ref,event_ref:request.event_ref,proposition_id:request.proposition_id,
      requested_methods:clone(request.methods),tasks:[],unavailable:[],status:'ready'};
    for(const method of request.methods) {
      if(method==='metaphysics')need(false,'RECURSIVE_ROUTE');
      if(!Object.hasOwn(METHODS,method)){plan.unavailable.push({method,status:'unsupported',reason:'No registered provider'});continue;}
      const input=request.inputs?.[method];
      if(!input){plan.unavailable.push({method,status:'insufficient_input',reason:'Method-specific frozen input is missing'});continue;}
      const cap=this.#host.methodCapability(method);
      if(!cap.available){plan.unavailable.push({method,status:'unavailable',reason:cap.reason});continue;}
      const time_context=input.time_request?normalizeTimeContext(input.time_request,()=>this.#host.clock()):null;
      const task={schema_version:'metaphysics.adapter-task.v4',execution_profile:'method-v5',route_id:plan.route_id,
        case_id:id('case'),revision:1,task_id:id('task'),method,rule_profile:METHODS[method].profile,
        subject_ref:request.subject_ref,event_ref:request.event_ref,proposition_id:request.proposition_id,
        question:request.question,criteria:request.criteria,analysis_scope:input.analysis_scope,
        window:freezeWindow(input.window),time_context,method_inputs:clone(input.method_inputs),
        context_policy:'task-input-only-no-sibling-results'};
      text(task.analysis_scope,'analysis_scope');plan.tasks.push(task);
    }
    if(plan.unavailable.length)plan.status='partial';
    this.#requests.set(plan.route_id,clone(request));this.#plans.set(request.request_id,clone(plan));this.#events.set(eventKey,request.request_id);return plan;
  }
  supplyInput(route_id,method,input) {
    need(!this.#busy,'RECURSIVE_ROUTE');const request=this.#requests.get(route_id);need(request,'UNKNOWN_ROUTE');
    need(request.methods.includes(method)&&Object.hasOwn(METHODS,method),'METHOD_NOT_REQUESTED');
    const plan=this.#plans.get(request.request_id),prior=plan.tasks.find(t=>t.method===method);
    if(prior)need(!this.#replies.has(prior.task_id)&&this.#failures.get(prior.task_id)==='INPUT_PREFLIGHT_FAILED','BRANCH_ALREADY_FROZEN');
    else need(plan.unavailable.some(x=>x.method===method&&x.status==='insufficient_input'),'BRANCH_NOT_AWAITING_INPUT');
    const cap=this.#host.methodCapability(method);need(cap.available,'METHOD_UNAVAILABLE');
    const task={schema_version:'metaphysics.adapter-task.v4',execution_profile:'method-v5',route_id,
      case_id:prior?.case_id||id('case'),revision:(prior?.revision||0)+1,task_id:prior?.task_id||id('task'),method,rule_profile:METHODS[method].profile,
      subject_ref:request.subject_ref,event_ref:request.event_ref,proposition_id:request.proposition_id,question:request.question,criteria:request.criteria,
      analysis_scope:input.analysis_scope,window:freezeWindow(input.window),time_context:input.time_request?normalizeTimeContext(input.time_request,()=>this.#host.clock()):null,
      method_inputs:clone(input.method_inputs),context_policy:'task-input-only-no-sibling-results'};
    text(task.analysis_scope,'analysis_scope');
    if(prior)plan.tasks[plan.tasks.indexOf(prior)]=task;else plan.tasks.push(task);
    plan.unavailable=plan.unavailable.filter(x=>x.method!==method);
    request.inputs={...request.inputs,[method]:clone(input)};plan.request_digest=digest(request);this.#requests.set(route_id,request);
    this.#plans.set(request.request_id,plan);this.#outputs.delete(route_id);return clone(task);
  }
  async resume(route_id){const r=this.#requests.get(route_id);need(r,'UNKNOWN_ROUTE');return this.run(clone(r));}
  branchContext(route_id,method) {
    const request=this.#requests.get(route_id);need(request,'UNKNOWN_ROUTE');
    const task=this.#plans.get(request.request_id).tasks.find(t=>t.method===method);need(task,'UNKNOWN_BRANCH');
    const reply=this.#replies.get(task.task_id);need(reply,'BRANCH_NOT_EXECUTED');
    return {task:clone(task),context:clone(reply.result),receipt:clone(reply.receipt),isolation:'unavailable-unless-host-attested'};
  }
  async finalizeBranch(route_id,method,draft) {
    need(!this.#busy,'RECURSIVE_ROUTE');const request=this.#requests.get(route_id);need(request,'UNKNOWN_ROUTE');
    const task=this.#plans.get(request.request_id).tasks.find(t=>t.method===method);need(task,'UNKNOWN_BRANCH');
    const previous=this.#replies.get(task.task_id);need(previous,'BRANCH_NOT_EXECUTED');
    need(typeof this.#host.finalizeBranch==='function','HOST_FINALIZE_UNAVAILABLE');
    this.#busy=true;
    try {
      const reply=await this.#host.finalizeBranch(clone(task),clone(draft));
      need(await this.#host.verifyInvocation(task,reply),'UNVERIFIED_BRANCH_EXECUTION');
      need(reply.result?.execution_record?.run_id===previous.result?.execution_record?.run_id,'FINALIZE_RECOMPUTED');
      this.#replies.set(task.task_id,reply);this.#outputs.delete(route_id);
    } finally {this.#busy=false;}
    return this.run(clone(request));
  }
  async run(request) {
    need(!this.#busy,'RECURSIVE_ROUTE');this.#busy=true;
    try {
      const plan=this.plan(request);
      if(this.#outputs.has(plan.route_id))return {...clone(this.#outputs.get(plan.route_id)),reused:true};
      const results=[],pending=clone(plan.unavailable),receipts=[];
      // All task inputs are frozen before the first branch output exists.
      for(const task of plan.tasks) {
        try {
          const returned=this.#replies.get(task.task_id)||await this.#host.dispatch(clone(task));
          need(await this.#host.verifyInvocation(task,returned),'UNVERIFIED_BRANCH_EXECUTION');
          this.#replies.set(task.task_id,returned);receipts.push(returned.receipt);
          if(!returned.result?.bundle) {
            pending.push({method:task.method,task_id:task.task_id,status:'insufficient_input',stage:returned.result?.interpretation_required?'interpretation_required':'finalization_required',reason:returned.result?.interpretation_required?'A validated model draft is required; calculation is preserved':'No finalized branch result'});continue;
          }
          const b=returned.result.bundle,child=b.child_result;
          const c={...task},t={...task};
          need(digest(b.binding)===digest(bindingFor(c,t)),'ROUTE_BRANCH_BINDING');
          need(child.method_id===task.method&&validateStandardChild(child,task.method).length===0,'ROUTE_CHILD_CONTRACT');
          need(child.status==='ok','BRANCH_NOT_OK');
          need(b.validation.payload_digest===digest(child.method_payload),'ROUTE_PAYLOAD_DIGEST');
          need(returned.result.execution_record.output_digest===digest(child.method_payload),'ROUTE_EXECUTION_DIGEST');
          need(returned.result.execution_record.frozen_case_digest && returned.result.execution_record.exit_code===0,'ROUTE_EXECUTION_RECORD');
          for(const claim of child.claims) {
            need(claim.subject_ref===task.subject_ref&&claim.proposition_id===task.proposition_id,'ROUTE_CLAIM_BINDING');
            claim.basis_refs.forEach(ref=>pointer(child.method_payload,ref));
          }
          results.push({schema_version:'metaphysics.adapter-result.v4',...Object.fromEntries(Object.entries(child).filter(([k])=>k!=='schema_version')),
            binding:clone(b.binding),execution_ref:b.execution_ref,validation:clone(b.validation),
            claim_provenance:clone(b.claim_provenance),receipt_ref:returned.receipt.receipt_id,fact_block:b.fact_block});
        } catch(e) {this.#failures.set(task.task_id,e.code||'BRANCH_FAILED');pending.push({method:task.method,status:e.code==='INPUT_PREFLIGHT_FAILED'?'insufficient_input':'error',reason:e.code||'BRANCH_FAILED',details:e.details??{}});}
      }
      const isolation=this.#host.capabilities().branch_isolation==='verified' &&
        typeof this.#host.verifyIsolation==='function' && await this.#host.verifyIsolation(plan.tasks,receipts);
      const combined=request.methods.length>1,comparisons=[];
      if(isolation)for(let i=0;i<results.length;i++)for(let j=i+1;j<results.length;j++) {
        for(const a of results[i].claims)for(const b of results[j].claims) {
          const decorate=(r,x)=>({...x,...r.claim_provenance.find(p=>p.claim_id===x.claim_id),binding:r.binding});
          comparisons.push({left:{method:results[i].method_id,claim_id:a.claim_id},right:{method:results[j].method_id,claim_id:b.claim_id},
            relation:compareV5(decorate(results[i],a),decorate(results[j],b))});
        }
      }
      const out={schema_version:'metaphysics.route-output.v5',execution_profile:'method-v5',route_id:plan.route_id,
        requested_methods:clone(request.methods),completed_methods:results.map(r=>r.method_id),uncompleted:pending,
        overall_status:pending.length||(combined&&!isolation)?'partial':'ok',
        combination_status:combined?(isolation?'eligible_for_claim_comparison':'blocked_isolation'):'single_method',
        independent_method_verification:Boolean(combined&&isolation),capabilities:this.#host.capabilities(),
        results,comparisons,receipt_refs:receipts.map(x=>x.receipt_id),reused:false,
        limitations:['A completed execution is not empirical prediction validity.','No comparison is inferred from native payloads or majority voting.']};
      this.#outputs.set(plan.route_id,clone(out));return out;
    } finally {this.#busy=false;}
  }
}
