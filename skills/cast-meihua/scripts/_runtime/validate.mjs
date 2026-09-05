// SPDX-License-Identifier: AGPL-3.0-only
import { need, text, clone, digest, pointer, canonical, plain } from './common.mjs';
import { semanticWindowKey } from './case.mjs';

export const childStatuses = ['ok','insufficient_input','error'];
const natures = ['calculation_fact','traditional_interpretation','real_world_fact','action_recommendation'];
const stages = ['start','early','early_middle','late_middle','late','closure'];
const riskPatterns = [
  /\b(?:definitely|certainly)\s+(?:thinks?|loves?|cheats?|will\s+pass|has\s+cancer)\b/i,
  /\b(?:diagnosis|exact\s+location|guaranteed\s+success)\b/i,
  /\b\d+(?:\.\d+)?\s*%/,
  /\u4ed6\u4e00\u5b9a\u7231|\u5979\u4e00\u5b9a\u7231|\u5fc5\u7136\u901a\u8fc7|\u786e\u8bca|\u767e\u5206\u4e4b/
];
export function bindingFor(c,t) {
  return {case_id:c.case_id,revision:c.revision,task_id:t.task_id,method:t.method,
    subject_ref:c.subject_ref,event_ref:c.event_ref,proposition_id:c.proposition_id,
    criteria:c.criteria,window_digest:semanticWindowKey(c.window),analysis_scope:c.analysis_scope};
}
export function renderFacts(payload,definitions) {
  need(Array.isArray(definitions),'FACT_DEFINITIONS_REQUIRED');const seen=new Set();
  return definitions.map(d=>{
    text(d.fact_id,'fact_id');text(d.label,'fact label');need(!seen.has(d.fact_id),'DUPLICATE_FACT');seen.add(d.fact_id);
    const value=pointer(payload,d.pointer);
    return {fact_id:d.fact_id,pointer:d.pointer,value:clone(value),rendered:`${d.label}: ${typeof value==='string'?value:canonical(value)}`};
  });
}
function reviewCard(card,payload) {
  need(card && card.review_status==='reviewed','KNOWLEDGE_CARD_UNREVIEWED');
  for(const k of ['card_id','version','tradition_profile','meaning'])text(card[k],`card.${k}`);
  need(Array.isArray(card.sources)&&card.sources.length>0,'CARD_SOURCES_REQUIRED');
  for(const source of card.sources)for(const k of ['reference','locator','license'])text(source[k],`card.source.${k}`);
  for(const k of ['counter_readings','not_inferable','fact_requirements'])need(Array.isArray(card[k])&&card[k].length>0,`CARD_${k.toUpperCase()}_REQUIRED`);
  for(const ref of card.fact_requirements)pointer(payload,ref);
  need(Array.isArray(card.prerequisites),'CARD_PREREQUISITES_REQUIRED');
  for(const rule of card.prerequisites){
    need(['exists','equals'].includes(rule.op),'UNKNOWN_PREREQUISITE');
    const v=pointer(payload,rule.pointer);if(rule.op==='equals')need(digest(v)===digest(rule.value),'CARD_PREREQUISITE_FAILED');
  }
}
function validateTiming(claim,c,t) {
  if(!claim.timing)return;
  const frozen=t.method_inputs.timing_profile;
  need(frozen && claim.timing.profile===frozen.profile,'UNFROZEN_TIMING_PROFILE');
  if(frozen.profile==='stage-within-horizon-v1') {
    need(claim.timing.type==='stage'&&stages.includes(claim.timing.stage),'TIMING_PRECISION');
    need(Object.keys(claim.timing).every(k=>['profile','type','stage'].includes(k)),'TIMING_PRECISION');
    need(!/\d{4}-\d{2}-\d{2}|\bday\s*\d|\b\d+\s*days?\b|\d+\u6708\d+\u65e5|\u7b2c\d+\u5929/i.test(claim.text),'TIMING_PRECISION');
  } else if(frozen.profile==='moving-line-count-v1') {
    need(claim.timing.type==='count'&&claim.timing.unit===frozen.unit,'TIMING_UNIT_CHANGED');
    need(Number.isSafeInteger(claim.timing.count)&&claim.timing.count>0,'TIMING_COUNT');
    // Counting must be defined before computation; never infer a unit after seeing output.
    need(Number.isSafeInteger(frozen.max_count)&&frozen.max_count>0 && claim.timing.count<=frozen.max_count,'TIMING_OUTSIDE_WINDOW');
    need(typeof frozen.count_basis_ref==='string','COUNT_BASIS_REQUIRED');
    need(frozen.anchor==='window_start' && frozen.unit_basis==='fixed_duration','COUNT_ANCHOR_REQUIRED');
    const unitMs={minute:60000,minutes:60000,hour:3600000,hours:3600000,day:86400000,days:86400000,week:604800000,weeks:604800000}[frozen.unit];
    need(unitMs && c.window.kind==='interval','UNSUPPORTED_COUNT_WINDOW');
    const projected=Date.parse(c.window.start)+claim.timing.count*unitMs, end=Date.parse(c.window.end);
    need(projected<end || (projected===end && c.window.include_end),'TIMING_OUTSIDE_WINDOW');
  } else need(false,'UNKNOWN_TIMING_PROFILE');
}
export function finalizeResult({c,t,result,record,profile,draft,knowledge_cards,store}) {
  const binding=bindingFor(c,t);need(plain(draft),'INVALID_DRAFT');
  need(Object.keys(draft).every(k=>['binding','status','claims'].includes(k)),'UNKNOWN_DRAFT_FIELD');
  need(digest(draft.binding)===digest(binding),'BINDING_MISMATCH');
  need(childStatuses.includes(draft.status),'INVALID_CHILD_STATUS');
  need(Array.isArray(draft.claims),'CLAIMS_REQUIRED');
  need(draft.status==='ok'?draft.claims.length>0:draft.claims.length===0,'STATUS_CLAIMS_MISMATCH');
  need(record.validation.status==='validated' && record.output_digest===digest(result.native_payload),'UNVALIDATED_NATIVE');
  if (profile.validateDraft) profile.validateDraft({draft,c,t,payload:result.native_payload,knowledge_cards});
  const facts=renderFacts(result.native_payload,profile.factDefinitions(result.native_payload));
  const factMap=new Map(facts.map(f=>[f.fact_id,f])),ids=new Set();
  const claims=clone(draft.claims);
  need(claims.length<=1024,'CLAIM_LIMIT');
  for(const claim of claims){
    need(plain(claim),'INVALID_CLAIM');
    need(Object.keys(claim).every(k=>['claim_id','nature','text','binding','basis_refs','fact_ids','knowledge_card_refs','evidence_refs','timing','risk_flags','direction','goal_ref','conditions','counter_reading'].includes(k)),'UNKNOWN_CLAIM_FIELD');
    if(claim.conditions!==undefined)need(Array.isArray(claim.conditions)&&claim.conditions.every(x=>typeof x==='string'&&x.trim()),'CLAIM_CONDITIONS');
    if(claim.counter_reading!==undefined)text(claim.counter_reading,'counter_reading',16384);
    text(claim.claim_id,'claim_id');need(!ids.has(claim.claim_id),'DUPLICATE_CLAIM');ids.add(claim.claim_id);
    need(natures.includes(claim.nature),'CLAIM_NATURE_REQUIRED');text(claim.text,'claim text',16384);
    need(digest(claim.binding)===digest(binding),'CLAIM_BINDING_MISMATCH');
    need(Array.isArray(claim.basis_refs),'BASIS_REFS_REQUIRED');
    for(const ref of claim.basis_refs)pointer(result.native_payload,ref);
    if(['calculation_fact','traditional_interpretation'].includes(claim.nature))need(claim.basis_refs.length>0,'BASIS_REFS_REQUIRED');
    if(claim.nature==='calculation_fact'){
      need(Array.isArray(claim.fact_ids)&&claim.fact_ids.length>0,'FACT_IDS_REQUIRED');
      const selected=claim.fact_ids.map(id=>{need(factMap.has(id),'UNKNOWN_FACT');return factMap.get(id);});
      need(selected.every(f=>claim.basis_refs.includes(f.pointer)),'FACT_BASIS_MISMATCH');
      need(claim.text===selected.map(f=>f.rendered).join('\n'),'FACT_TEXT_MISMATCH');
    } else {
      need(!riskPatterns.some(re=>re.test(claim.text)),'SEMANTIC_RISK_FLAG');
      need(!claim.risk_flags?.length,'SEMANTIC_RISK_FLAG');
    }
    if(claim.nature==='traditional_interpretation'){
      need(Array.isArray(claim.knowledge_card_refs)&&claim.knowledge_card_refs.length>0,'KNOWLEDGE_CARD_REQUIRED');
      for(const ref of claim.knowledge_card_refs){
        const card=knowledge_cards.find(k=>`${k.card_id}@${k.version}`===ref);reviewCard(card,result.native_payload);
        need(card.fact_requirements.every(ref=>claim.basis_refs.includes(ref)),'KNOWLEDGE_BASIS_MISMATCH');
      }
    }
    if(['real_world_fact','action_recommendation'].includes(claim.nature)){
      need(Array.isArray(claim.evidence_refs)&&claim.evidence_refs.length>0,'REAL_EVIDENCE_REQUIRED');
      for(const ref of claim.evidence_refs)store.observation(c.case_id,ref);
    }
    if(t.method==='meihua' && claim.nature==='traditional_interpretation') {
      if(t.method_inputs.timing_profile.profile==='stage-within-horizon-v1') {
        need(!/\d{4}-\d{2}-\d{2}|\bday\s*\d|\b\d+\s*days?\b|\d+\u6708\d+\u65e5|\u7b2c\d+\u5929/i.test(claim.text),'TIMING_PRECISION');
      }
      if(claim.timing?.type==='stage') need(claim.timing.stage===stages[pointer(result.native_payload,'/result/movingLine/position')-1],'STAGE_BASIS_MISMATCH');
    }
    validateTiming(claim,c,t);
    if(claim.timing?.type==='count')need(pointer(result.native_payload,t.method_inputs.timing_profile.count_basis_ref)===claim.timing.count,'COUNT_BASIS_MISMATCH');
  }
  const child=profile.buildChild({status:draft.status,claims,payload:clone(result.native_payload),binding,facts,c:clone(c),t:clone(t)});
  const errors=profile.validateChild(child);need(Array.isArray(errors)&&errors.length===0,'CHILD_CONTRACT_INVALID');
  need(digest(child.method_payload)===record.output_digest,'CHILD_PAYLOAD_CHANGED');
  const expectedClaims=profile.projectClaims?profile.projectClaims(claims,{c,t}):claims;
  need(digest(child.claims)===digest(expectedClaims)&&child.status===draft.status,'CHILD_CLAIMS_CHANGED');
  const bundle={schema:'metaphysics.execution-bundle.v1',implementation_status:'implemented_candidate',binding,
    execution_ref:result.execution_ref,validation:{payload_digest:record.output_digest,
      native_schema:profile.native_schema,child_schema:profile.child_schema,
      structural_checks:['G1','G2','G3','G4','G5-structural','G6-facts'],
      semantic_review:'not_performed',production_accepted:false},
    claim_provenance:claims.map(x=>({claim_id:x.claim_id,nature:x.nature,knowledge_card_refs:clone(x.knowledge_card_refs??[]),evidence_refs:clone(x.evidence_refs??[]),timing:clone(x.timing??null),goal_ref:x.goal_ref??null,counter_reading:x.counter_reading??null})),
    child_result:child,fact_block:facts.map(f=>f.rendered).join('\n')};
  return bundle;
}
