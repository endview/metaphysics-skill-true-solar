// SPDX-License-Identifier: AGPL-3.0-only
import { id, need, text, clone, deepFreeze, digest } from './common.mjs';
import { freezeWindow, formatZonedInstant } from './time-context.mjs';

const transitions = {
  draft:['awaiting_input','frozen','superseded'], awaiting_input:['draft','frozen','superseded'],
  frozen:['executing','superseded'], executing:['calculated','execution_failed','validation_failed'],
  calculated:['validated','validation_failed'], validated:['interpreted','invalidated'],
  interpreted:['delivered','invalidated'], delivered:['observed','closed','invalidated'],
  observed:['observed','closed','invalidated'], execution_failed:['executing','invalidated'],
  validation_failed:['invalidated'], superseded:[], invalidated:[], closed:[]
};
export function assertTransition(from,to) { need(transitions[from]?.includes(to),'INVALID_STATE_TRANSITION',`${from} -> ${to}`); }
export function semanticWindowKey(window) {
  const copy=clone(window); delete copy.raw_input; delete copy.source_ref; return digest(copy);
}
export function frozenDigest(c) {
  const {state,history,...frozen}=c; return digest(frozen);
}
export function validateStoredWindow(window) {
  if(window.kind==='cycle')return freezeWindow(window);
  need(window.kind==='interval'&&/Z$/.test(window.start)&&/Z$/.test(window.end),'STORED_WINDOW_FORMAT');
  const normalized=freezeWindow({...window,start:formatZonedInstant(window.start,window.timezone),end:formatZonedInstant(window.end,window.timezone)});
  need(digest(normalized)===digest(window),'STORED_WINDOW_CHANGED');return normalized;
}
export class SessionCaseStore {
  #eventLocks=new Set(); #taskStates=new Map(); #subjects=new Map(); #events=new Map(); #cases=new Map(); #ledger=new Map(); #locks=new Set();
  #attempts=new Map(); #records=new Map(); #results=new Map(); #observations=new Map();#interpretations=new Map();
  registerSubject(label) {
    text(label,'subject label'); const ref=id('subject'); this.#subjects.set(ref,{label}); return ref;
  }
  registerEvent(subject_ref,label,{relationship='independent',reason,related_event_ref=null}={}) {
    need(this.#subjects.has(subject_ref),'UNKNOWN_SUBJECT'); text(label,'event label'); text(reason,'event distinction reason');
    need(['independent','new_cycle','correction_context'].includes(relationship),'EVENT_RELATION_REQUIRED');
    if (related_event_ref) need(this.#events.get(related_event_ref)?.subject_ref===subject_ref,'EVENT_SUBJECT_MISMATCH');
    const ref=id('event'); this.#events.set(ref,{subject_ref,label,relationship,reason,related_event_ref}); return ref;
  }
  create(input) {
    need(this.#subjects.has(input.subject_ref),'UNKNOWN_SUBJECT');
    need(this.#events.get(input.event_ref)?.subject_ref===input.subject_ref,'EVENT_SUBJECT_MISMATCH');
    for (const k of ['proposition_id','question','criteria','analysis_scope']) text(input[k],k);
    need(Array.isArray(input.tasks)&&input.tasks.length>0,'TASKS_REQUIRED');
    const methods=new Set();
    const tasks=input.tasks.map(t=>{
      text(t.method,'method'); need(!methods.has(t.method),'DUPLICATE_METHOD'); methods.add(t.method);
      text(t.rule_profile,'rule_profile'); need(t.method_inputs && typeof t.method_inputs==='object','METHOD_INPUTS_REQUIRED');
      return {task_id:id('task'),method:t.method,rule_profile:t.rule_profile,method_inputs:clone(t.method_inputs)};
    });
    const c={schema:'metaphysics.case.v1',case_id:id('case'),revision:1,state:'draft',
      subject_ref:input.subject_ref,event_ref:input.event_ref,proposition_id:input.proposition_id,
      question:input.question,criteria:input.criteria,analysis_scope:input.analysis_scope,
      window:freezeWindow(input.window),time_context:clone(input.time_context??null),
      candidates:clone(input.candidates??[]),tasks,history:[]};
    if (c.time_context) {
      need(c.time_context.schema==='metaphysics.time-context.v1' && c.time_context.resolution_status==='resolved', 'UNRESOLVED_TIME');
      need(typeof c.time_context.instant==='string' && /Z$/.test(c.time_context.instant) && Number.isFinite(Date.parse(c.time_context.instant)), 'UNRESOLVED_TIME');
      text(c.time_context.source_ref,'time source');
    }
    digest(c); this.#cases.set(c.case_id,c); return clone(c);
  }
  get(case_id) { need(this.#cases.has(case_id),'UNKNOWN_CASE'); return clone(this.#cases.get(case_id)); }
  #key(c) { return `${c.subject_ref}/${c.event_ref}`; }
  freeze(case_id) {
    const c=this.#cases.get(case_id); need(c,'UNKNOWN_CASE');
    const prior=this.#ledger.get(this.#key(c));
    need(!prior || prior.case_id===case_id,'EVENT_ALREADY_CALCULATED','A new ID does not authorize recasting');
    this.transition(case_id,'frozen');
    for (const t of c.tasks) this.#taskStates.set(t.task_id,'frozen');
    return this.get(case_id);
  }
  reviseDraft(case_id,changes) {
    const c=this.#cases.get(case_id); need(c,'UNKNOWN_CASE'); need(['draft','awaiting_input'].includes(c.state),'CASE_FROZEN');
    const allowed=new Set(['question','criteria','analysis_scope','window','time_context','candidates']);
    need(Object.keys(changes).every(k=>allowed.has(k)),'IMMUTABLE_IDENTITY');
    const next={...c,...clone(changes),revision:c.revision+1};
    for(const k of ['question','criteria','analysis_scope']) text(next[k],k);
    if (changes.window) next.window=freezeWindow(changes.window);
    digest(next); this.#cases.set(case_id,next); return clone(next);
  }
  transition(case_id,next) {
    const c=this.#cases.get(case_id); need(c,'UNKNOWN_CASE'); assertTransition(c.state,next);
    c.history.push({from:c.state,to:next}); c.state=next;
  }
  task(case_id,task_id) {
    const c=this.get(case_id),t=c.tasks.find(t=>t.task_id===task_id); need(t,'UNKNOWN_TASK');
    return {c,t};
  }
  taskState(case_id,task_id) { this.task(case_id,task_id); return this.#taskStates.get(task_id); }
  transitionTask(case_id,task_id,next) {
    const c=this.#cases.get(case_id); this.task(case_id,task_id);
    need(!['invalidated','superseded','closed'].includes(c.state),'CASE_NOT_ACTIVE');
    const from=this.#taskStates.get(task_id); assertTransition(from,next);
    this.#taskStates.set(task_id,next); c.history.push({task_id,from,to:next});
    const states=c.tasks.map(t=>this.#taskStates.get(t.task_id));
    if (states.includes('executing')) c.state='executing';
    else if (states.includes('validation_failed')) c.state='validation_failed';
    else if (states.includes('execution_failed')) c.state='execution_failed';
    else if (states.every(s=>s==='delivered')) c.state='delivered';
    else if (states.every(s=>['interpreted','delivered'].includes(s))) c.state='interpreted';
    else if (states.every(s=>['validated','interpreted','delivered'].includes(s))) c.state='validated';
    else if (states.every(s=>['calculated','validated','interpreted','delivered'].includes(s))) c.state='calculated';
    else if (states.every(s=>s==='frozen')) c.state='frozen';
    else c.state='executing';
  }
  lock(case_id,task_id) {
    const {c}=this.task(case_id,task_id), key=`${case_id}/${c.revision}/${task_id}`;
    const eventKey=this.#key(c), prior=this.#ledger.get(eventKey);
    need(!this.#locks.has(key) && !this.#eventLocks.has(eventKey),'EXECUTION_BUSY');
    need(!prior || prior.case_id===case_id,'EVENT_ALREADY_CALCULATED');
    this.#ledger.set(eventKey,{case_id,revision:c.revision});
    this.#locks.add(key); this.#eventLocks.add(eventKey);
    return ()=>{this.#locks.delete(key);this.#eventLocks.delete(eventKey);};
  }
  attempts(case_id,task_id) { return this.#attempts.get(`${case_id}/${task_id}`)||0; }
  nextAttempt(case_id,task_id) {
    const key=`${case_id}/${task_id}`, n=this.attempts(case_id,task_id)+1; this.#attempts.set(key,n); return n;
  }
  record(value) {
    need(!this.#records.has(value.run_id),'DUPLICATE_RUN');
    this.#records.set(value.run_id,deepFreeze(clone(value)));
  }
  records(case_id) { return [...this.#records.values()].filter(r=>r.case_id===case_id).map(clone); }
  markCalculated(case_id) {
    const c=this.get(case_id); this.#ledger.set(this.#key(c),{case_id,revision:c.revision});
  }
  storeResult(case_id,task_id,result) {
    const key=`${case_id}/${task_id}`; need(!this.#results.has(key),'RESULT_ALREADY_EXISTS');
    this.#results.set(key,deepFreeze(clone(result)));
  }
  result(case_id,task_id) { const r=this.#results.get(`${case_id}/${task_id}`); return r ? clone(r) : null; }
  resultIsCurrent(case_id,task_id,digestValue) {
    const c=this.get(case_id),r=this.result(case_id,task_id);
    return !!r && !['invalidated','superseded'].includes(c.state) && r.output_digest===digestValue;
  }
  addObservation(case_id,{text:description,source_ref}) {
    this.get(case_id); text(description,'observation'); text(source_ref,'observation source');
    const ref=id('observation'); this.#observations.set(ref,{case_id,text:description,source_ref}); return ref;
  }
  observation(case_id,ref) { const v=this.#observations.get(ref); need(v?.case_id===case_id,'OBSERVATION_BINDING'); return clone(v); }
  rememberInterpretation(case_id,task_id,draft,bundle) {
    this.task(case_id,task_id);const key=case_id+'/'+task_id,history=this.#interpretations.get(key)||[];
    const hash=digest(draft);if(history.at(-1)?.draft_digest===hash)return history.at(-1).version;
    const {method_payload,...child_summary}=bundle.child_result;
    const entry={version:history.length+1,draft_digest:hash,draft:clone(draft),execution_ref:bundle.execution_ref,
      payload_digest:bundle.validation.payload_digest,validation:clone(bundle.validation),child_summary:clone(child_summary)};
    history.push(deepFreeze(entry));this.#interpretations.set(key,history);return entry.version;
  }
  interpretationHistory(case_id,task_id){this.task(case_id,task_id);return clone(this.#interpretations.get(case_id+'/'+task_id)||[]);}
  changeRequest(case_id,kind) {
    this.get(case_id);
    const actions={explanation:'reuse_native_revise_interpretation',window:'scope_change_pending',
      method:'recast_request_pending',inputs:'recast_request_pending',reality:'append_observation_only'};
    need(actions[kind],'UNKNOWN_CHANGE'); return {action:actions[kind],automatic_recalculation:false};
  }
  // Corrections never erase records, nor silently create a replacement calculation.
  invalidate(case_id,{reason,evidence_ref}) {
    text(reason,'correction reason'); text(evidence_ref,'correction evidence');
    const c=this.#cases.get(case_id); need(c,'UNKNOWN_CASE');
    need(!['draft','awaiting_input','closed','superseded','invalidated'].includes(c.state) && !c.tasks.some(t=>this.#taskStates.get(t.task_id)==='executing'),'INVALID_CORRECTION_STATE');
    c.history.push({from:c.state,to:'invalidated',reason,evidence_ref}); c.state='invalidated';
    return this.get(case_id);
  }
  adoptDispatch(task) {
    need(task.schema_version==='metaphysics.adapter-task.v4','TASK_SCHEMA');
    for(const k of ['case_id','task_id','subject_ref','event_ref','proposition_id','question','criteria','analysis_scope','method','rule_profile'])text(task[k],k);
    need(Number.isSafeInteger(task.revision)&&task.revision>0,'TASK_REVISION');
    const c={schema:'metaphysics.case.v1',case_id:task.case_id,revision:task.revision,state:'draft',
      subject_ref:task.subject_ref,event_ref:task.event_ref,proposition_id:task.proposition_id,
      question:task.question,criteria:task.criteria,analysis_scope:task.analysis_scope,window:validateStoredWindow(task.window),
      time_context:clone(task.time_context??null),candidates:clone(task.candidates??[]),
      tasks:[{task_id:task.task_id,method:task.method,rule_profile:task.rule_profile,method_inputs:clone(task.method_inputs)}],history:[]};
    if(this.#cases.has(c.case_id)) {need(frozenDigest(c)===frozenDigest(this.get(c.case_id)),'DISPATCH_CHANGED');return this.get(c.case_id);}
    this.#subjects.set(c.subject_ref,{label:'Dispatched subject'});
    const event=this.#events.get(c.event_ref);need(!event||event.subject_ref===c.subject_ref,'EVENT_SUBJECT_MISMATCH');
    this.#events.set(c.event_ref,{subject_ref:c.subject_ref,label:'Dispatched event',relationship:'independent',reason:'Frozen host dispatch'});
    this.#cases.set(c.case_id,c);return this.freeze(c.case_id);
  }
  exportState() {
    need(this.#locks.size===0 && this.#eventLocks.size===0,'EXECUTION_BUSY');
    return {schema:'metaphysics.local-session.v1',
      taskStates:[...this.#taskStates.entries()].map(clone),
      subjects:[...this.#subjects.entries()].map(clone),
      events:[...this.#events.entries()].map(clone),
      cases:[...this.#cases.entries()].map(clone),
      ledger:[...this.#ledger.entries()].map(clone),
      attempts:[...this.#attempts.entries()].map(clone),
      records:[...this.#records.entries()].map(clone),
      results:[...this.#results.entries()].map(clone),
      observations:[...this.#observations.entries()].map(clone),interpretations:[...this.#interpretations.entries()].map(clone)
    };
  }
  static restoreTrustedState(state) {
    need(state.schema==='metaphysics.local-session.v1','STORE_SCHEMA');
    const store=new SessionCaseStore();store.#interpretations=new Map(clone(state.interpretations??[]));
    need(Array.isArray(state.taskStates),'STORE_SCHEMA'); store.#taskStates=new Map(clone(state.taskStates));
    need(Array.isArray(state.subjects),'STORE_SCHEMA'); store.#subjects=new Map(clone(state.subjects));
    need(Array.isArray(state.events),'STORE_SCHEMA'); store.#events=new Map(clone(state.events));
    need(Array.isArray(state.cases),'STORE_SCHEMA'); store.#cases=new Map(clone(state.cases));
    need(Array.isArray(state.ledger),'STORE_SCHEMA'); store.#ledger=new Map(clone(state.ledger));
    need(Array.isArray(state.attempts),'STORE_SCHEMA'); store.#attempts=new Map(clone(state.attempts));
    need(Array.isArray(state.records),'STORE_SCHEMA'); store.#records=new Map(clone(state.records));
    need(Array.isArray(state.results),'STORE_SCHEMA'); store.#results=new Map(clone(state.results));
    need(Array.isArray(state.observations),'STORE_SCHEMA'); store.#observations=new Map(clone(state.observations));
    for(const [key,c] of store.#cases) {
      need(key===c.case_id,'STORE_CASE_BINDING'); frozenDigest(c); validateStoredWindow(c.window);
      for(const t of c.tasks) {
        const result=store.result(key,t.task_id);
        if(result) {
          const record=store.#records.get(result.run_id);
          need(record && record.case_id===key && record.task_id===t.task_id,'STORE_RUN_BINDING');
          need(record.output_digest===digest(result.native_payload),'STORE_OUTPUT_DIGEST');
          need(record.frozen_case_digest===frozenDigest(c),'STORE_INPUT_DIGEST');
        }
      }
      // Crash recovery never clears the event ledger; a same-input retry requires an explicit reason.
      for(const t of c.tasks) if(store.#taskStates.get(t.task_id)==='executing') {
        store.#taskStates.set(t.task_id,'execution_failed'); c.state='execution_failed';
      }
    }
    return store;
  }
  relatedCase(case_id,{relationship,reason,evidence_ref,clock_instant}) {
    const c=this.get(case_id); text(reason,'reason');
    if(relationship==='new_cycle') {
      need(c.window.kind==='interval' && Number.isFinite(Date.parse(clock_instant)) && Date.parse(clock_instant)>=Date.parse(c.window.end),'CYCLE_NOT_ENDED');
      need(this.#observations.size>0 && [...this.#observations.values()].some(x=>x.case_id===case_id),'REVIEW_REQUIRED');
    } else {
      need(relationship==='correction_context','EVENT_RELATION_REQUIRED');
      this.invalidate(case_id,{reason,evidence_ref});
    }
    const event_ref=this.registerEvent(c.subject_ref,'Related case',{relationship,reason,related_event_ref:c.event_ref});
    return {subject_ref:c.subject_ref,event_ref,previous_case_id:case_id,reason};
  }

}
