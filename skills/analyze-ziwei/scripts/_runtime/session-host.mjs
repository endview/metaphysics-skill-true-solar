// SPDX-License-Identifier: AGPL-3.0-only
import {id,clone,digest,need,parseStrictJson,text} from './common.mjs';
import {SessionCaseStore} from './case.mjs';
import {NativeRegistry,VerifiedRunner} from './execution.mjs';
import {normalizeTimeContext,freezeWindow} from './time-context.mjs';
import {bindingFor,renderFacts} from './validate.mjs';
import {selectKnowledge} from './knowledge.mjs';
import {AuthorizedStore} from './persistent-store.mjs';

export class ReviewSession {
  #profile;#store;#runner;#clock;#opened=new Map();#reviews=new Map();
  constructor(profile,{clock=()=>new Date(),trustedState=null}={}) {
    this.#profile=profile;this.#store=trustedState?SessionCaseStore.restoreTrustedState(trustedState.store):new SessionCaseStore();this.#clock=clock;
    if(trustedState){need(trustedState.method_id===profile.method_id,'STORE_METHOD');this.#opened=new Map(trustedState.opened);this.#reviews=new Map(trustedState.reviews);}
    this.#runner=new VerifiedRunner({registry:new NativeRegistry().register(profile),store:this.#store});
  }
  exportState(){return {schema:'metaphysics.review-session.v1',method_id:this.#profile.method_id,store:this.#store.exportState(),opened:[...this.#opened],reviews:[...this.#reviews]};}
  get runner(){return this.#runner;}
  get store(){return this.#store;}
  open(input) {
    const key=[input.subject_ref,input.event_ref,input.proposition_id].join('/'),hash=digest(input);
    if(this.#opened.has(key)) {
      const old=this.#opened.get(key);need(old.hash===hash,'CASE_CHANGE_REQUIRES_REVIEW');return this.#store.get(old.case_id);
    }
    // Only this host reads now, once, before freezing. Native calculators never receive --now.
    const time=input.time_request?normalizeTimeContext(input.time_request,this.#clock):null;
    const preflight=this.#profile.preflight(clone(input.method_inputs),{...clone(input),time_context:time,window:freezeWindow(input.window)});
    need(Array.isArray(preflight)&&preflight.length===0,'INPUT_PREFLIGHT_FAILED','Input is incomplete or invalid; no case has been frozen',{errors:preflight});
    const c=this.#store.create({subject_ref:input.subject_ref,event_ref:input.event_ref,
      proposition_id:input.proposition_id,question:input.question,criteria:input.criteria,
      analysis_scope:input.analysis_scope,window:input.window,time_context:time,
      tasks:[{method:this.#profile.method_id,rule_profile:this.#profile.rule_profile,method_inputs:input.method_inputs}]});
    this.#store.freeze(c.case_id);this.#opened.set(key,{hash,case_id:c.case_id});return this.#store.get(c.case_id);
  }
  factDraft(case_id,task_id) {
    const {c,t}=this.#store.task(case_id,task_id),r=this.#store.result(case_id,task_id);need(r,'NOT_EXECUTED');
    const facts=renderFacts(r.native_payload,this.#profile.factDefinitions(r.native_payload)),binding=bindingFor(c,t);
    return {binding,status:'ok',claims:facts.map(f=>({claim_id:`fact_${f.fact_id}`,binding,
      nature:'calculation_fact',text:f.rendered,basis_refs:[f.pointer],fact_ids:[f.fact_id]}))};
  }
  async review(input) {
    text(input.request_id,'request_id');const hash=digest(input),old=this.#reviews.get(input.request_id);
    if(old) {need(old.hash===hash,'REQUEST_ID_REUSED_DIFFERENTLY');
      return this.#deliver(old.case_id,old.task_id);}
    need(input.new_event===true,'EXPLICIT_NEW_EVENT_REQUIRED');text(input.event_reason,'new event reason');
    const subject=this.#store.registerSubject(input.subject_label||'Local subject');
    const event=this.#store.registerEvent(subject,input.event_label||'Local review event',{reason:input.event_reason});
    const c=this.open({...input,subject_ref:subject,event_ref:event,proposition_id:input.proposition_id||id('proposition')});
    this.#reviews.set(input.request_id,{hash,case_id:c.case_id,task_id:c.tasks[0].task_id});
    return this.#deliver(c.case_id,c.tasks[0].task_id);
  }
  async #deliver(case_id,task_id) {
    const computed=await this.#runner.compute(case_id,task_id);
    const bundle=this.#runner.finalize(case_id,task_id,this.factDraft(case_id,task_id));
    return {bundle,execution_record:this.#store.records(case_id).find(r=>r.run_id===computed.run_id),
      case_snapshot:this.#store.get(case_id),reused:computed.reused,
      accepted_scope:'calculation_facts_only',release_accepted:false,dedup_scope:'current_process_only',
      independent_charting_performed:this.#profile.method_id==='ziwei',independent_model_branches:false};
  }
  async dispatch(task) {
    need(task.method===this.#profile.method_id&&task.rule_profile===this.#profile.rule_profile,'DISPATCH_METHOD');
    const preflight=this.#profile.preflight(clone(task.method_inputs),clone(task));need(Array.isArray(preflight)&&preflight.length===0,'INPUT_PREFLIGHT_FAILED','No native execution or case freeze',{errors:preflight});
    const c=this.#store.adoptDispatch(task),tid=c.tasks[0].task_id;
    if(['structural_review','calculation_review'].includes(c.analysis_scope))return this.#deliver(c.case_id,tid);
    const result=await this.#runner.compute(c.case_id,tid);
    const facts=this.factDraft(c.case_id,tid),knowledge=await selectKnowledge(this.#profile,result.native_payload,c);
    return {status:'calculated',case_id:c.case_id,task_id:tid,execution_ref:result.execution_ref,
      native_result:result.native_payload,facts,knowledge,interpretation_required:true,
      execution_record:this.#store.records(c.case_id).find(x=>x.run_id===result.run_id)};
  }
  async handle(request) {
    switch(request.op) {
      case 'dispatch':return this.dispatch(request.task);
      case 'capabilities':return {node:process.versions.node,icu:process.versions.icu??null,tz:process.versions.tz??null,
        case_store:'session',branch_isolation:'unavailable',external_solar_converter:'unavailable',
        interpretation:'source_locked_cards_and_model_draft',release_accepted:false};
      case 'subject':return {subject_ref:this.#store.registerSubject(request.label)};
      case 'event':return {event_ref:this.#store.registerEvent(request.subject_ref,request.label,request.relationship)};
      case 'open':return this.open(request.input);
      case 'compute':return this.#runner.compute(request.case_id,request.task_id,{retry_reason:request.retry_reason??null});
      case 'facts_draft':return this.factDraft(request.case_id,request.task_id);
      case 'knowledge': {
        const {c}=this.#store.task(request.case_id,request.task_id),result=this.#store.result(request.case_id,request.task_id);need(result,'NOT_EXECUTED');
        return selectKnowledge(this.#profile,result.native_payload,c,request.selection||{});
      }
      case 'finalize': {
        const {c}=this.#store.task(request.case_id,request.task_id),result=this.#store.result(request.case_id,request.task_id);need(result,'NOT_EXECUTED');
        const knowledge=await selectKnowledge(this.#profile,result.native_payload,c);
        return this.#runner.finalize(request.case_id,request.task_id,request.draft,{knowledge_cards:knowledge.cards});
      }
      case 'related_case':return this.#store.relatedCase(request.case_id,{...request.relation,clock_instant:this.#clock().toISOString()});
      case 'invalidate':return this.#store.invalidate(request.case_id,request.correction);
      case 'deliver':{this.#store.transitionTask(request.case_id,request.task_id,'delivered');return {delivered:true};}
      case 'interpretation_history':return this.#store.interpretationHistory(request.case_id,request.task_id);
      case 'inspect':return {case:this.#store.get(request.case_id),records:this.#store.records(request.case_id)};
      case 'observe':return {observation_ref:this.#store.addObservation(request.case_id,request.observation)};
      case 'change_request':return this.#store.changeRequest(request.case_id,request.kind);
      case 'review':return this.review(request.input);
      default:need(false,'UNKNOWN_OPERATION');
    }
  }
}
export function cliOptions(argv) {
  const opts={once:false};for(let i=0;i<argv.length;i++) {
    if(argv[i]==='--once')opts.once=true;
    else if(argv[i]==='--authorize-storage')opts.authorize_storage=true;
    else if(argv[i]==='--state-dir'){need(argv[i+1]&&!argv[i+1].startsWith('--'),'STORE_PATH_REQUIRED');opts.state_dir=argv[++i];}
    else need(false,'UNKNOWN_CLI_OPTION');
  }return opts;
}
export async function serve(profile,{once=false,state_dir=null,authorize_storage=false}={}) {
  const persistent=state_dir?await AuthorizedStore.open(state_dir,{authorized:authorize_storage,skill_root:profile.root}):null;
  let session=new ReviewSession(profile);const max=1048576;let buffer=Buffer.alloc(0),count=0;
  async function line(bytes) {
    if(!bytes.toString('utf8').trim())return;
    count++;need(!once||count===1,'ONCE_REQUIRES_ONE_REQUEST');
    try {
      const request=parseStrictJson(bytes.toString('utf8'),{maxBytes:max});
      let result;
      if(persistent) result=await persistent.transaction(async trustedState=>{
        session=new ReviewSession(profile,{trustedState});
        // Preserve frozen inputs and failed attempts even when finalization fails.
        try {const value=await session.handle(request);return {value,snapshot:session.exportState()};}
        catch(error){await persistent.write(session.exportState());throw error;}
      });else result=await session.handle(request);
      if(persistent&&result&&typeof result==='object') {
        if(Object.hasOwn(result,'dedup_scope'))result.dedup_scope='authorized_local_store';
        if(request.op==='capabilities')result.case_store='authorized_persistent';
      }
      process.stdout.write(JSON.stringify({schema:'metaphysics.session-response.v1',status:'ok',result})+'\n');
    }catch(e){process.stdout.write(JSON.stringify({schema:'metaphysics.session-response.v1',status:'error',
      code:e.code||'REQUEST_FAILED',details:e.details||{}})+'\n');if(once)process.exitCode=2;}
  }
  try {
    for await(const chunk of process.stdin) {
      buffer=Buffer.concat([buffer,chunk]);let index;
      while((index=buffer.indexOf(10))!==-1) {
        need(index<=max,'INPUT_TOO_LARGE');const next=buffer.subarray(0,index);buffer=buffer.subarray(index+1);await line(next);
      }
      need(buffer.length<=max,'INPUT_TOO_LARGE');
    }
    if(buffer.length)await line(buffer);
    if(once)need(count===1,'REQUEST_REQUIRED');
  }catch(e){process.stderr.write(`session: ${e.code||'STREAM_FAILED'}\n`);process.exitCode=2;}
}
