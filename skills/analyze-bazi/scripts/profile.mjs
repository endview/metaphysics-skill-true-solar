// SPDX-License-Identifier: AGPL-3.0-only
import tables from './reference-tables.json' with {type:'json'};
import {fileURLToPath} from 'node:url';
import {clone,digest,need,plain,text} from './_runtime/common.mjs';
import {parseLocal} from './_runtime/time-context.mjs';
import {exactKeys,verifyPackageSources,onlyCalculationDraft,projectStandardClaims,buildStandardChild,validateStandardChild} from './_runtime/native-utils.mjs';
const STEMS='\u7532\u4e59\u4e19\u4e01\u620a\u5df1\u5e9a\u8f9b\u58ec\u7678';
const BRANCHES='\u5b50\u4e11\u5bc5\u536f\u8fb0\u5df3\u5348\u672a\u7533\u9149\u620c\u4ea5';
const TG=['\u6bd4\u80a9','\u52ab\u8d22','\u98df\u795e','\u4f24\u5b98','\u504f\u8d22','\u6b63\u8d22','\u4e03\u6740','\u6b63\u5b98','\u504f\u5370','\u6b63\u5370'];
export const RULE_PROFILE='bazi-provided-structure-v1-candidate';
function pillar(x) {
  need(typeof x==='string'&&x.length===2&&STEMS.includes(x[0])&&BRANCHES.includes(x[1])&&
    STEMS.indexOf(x[0])%2===BRANCHES.indexOf(x[1])%2,'INVALID_PILLAR');return x;
}
function prepare(input,c) {
  if(Object.hasOwn(input,'candidate_set')) {
    exactKeys(input,['candidate_set']);need(Array.isArray(input.candidate_set)&&input.candidate_set.length>=2&&input.candidate_set.length<=64,'CANDIDATE_SET_SIZE');
    need(input.candidate_set.every(x=>!Object.hasOwn(x,'candidate_set')),'NESTED_CANDIDATES');
    const candidates=input.candidate_set.map(x=>prepare(x,c));
    need(new Set(candidates.map(x=>x.review_chart_id)).size===candidates.length,'DUPLICATE_CHART_ID');
    need(candidates.every(x=>x.evidence.time_basis.verification_status==='user_declared'),'CANDIDATE_SOURCE_REQUIRED');
    const resolved_candidates=candidates.flatMap(x=>x.evidence.time_basis.resolved_candidates);
    need(new Set(resolved_candidates.map(x=>x.candidate_id)).size===candidates.length,'DUPLICATE_CANDIDATE');
    const evidence=clone(candidates[0].evidence);
    evidence.time_basis.resolution_status='candidate_set';evidence.time_basis.resolved_candidates=resolved_candidates;
    evidence.chart_candidates=candidates.flatMap(x=>x.evidence.chart_candidates);
    evidence.candidate_sources=candidates.map(x=>({chart_id:x.review_chart_id,evidence:clone(x.evidence)}));
    evidence.source_ref='provided-candidate-set';
    return {candidates,evidence};
  }
  exactKeys(input,['pillars','dayun','liunian','source','review_chart_id','candidate_id']);
  need(Array.isArray(input.pillars)&&input.pillars.length===4,'FOUR_PILLARS_REQUIRED');input.pillars.forEach(pillar);
  for(const k of ['dayun','liunian'])if(input[k]!=null)pillar(input[k]);
  need(['structural_review','traditional_structure','annual_cycle','multi_year_stage'].includes(c.analysis_scope),'INTERPRETATION_NOT_IMPLEMENTED');
  text(input.review_chart_id,'review_chart_id');need(/^[a-zA-Z0-9_-]+$/.test(input.review_chart_id),'INVALID_CHART_ID');
  const source=input.source;exactKeys(source,['verification_status','source_ref','true_solar_datetime','raw_calendar',
    'raw_civil_datetime','birth_place','birth_longitude','civil_timezone','historical_timezone_or_dst','calendar_rules']);
  need(['unknown','user_declared'].includes(source.verification_status),'UNREVIEWED_SOLAR_ADAPTER');text(source.source_ref,'source_ref');
  if(source.birth_longitude!=null)need(Number.isFinite(source.birth_longitude)&&Math.abs(source.birth_longitude)<=180,'INVALID_LONGITUDE');
  if(source.true_solar_datetime!=null) {
    need(source.verification_status==='user_declared','SOLAR_SOURCE_CONFLICT');
    const solar=parseLocal(source.true_solar_datetime),branch=Math.floor(((solar.parts[3]+1)%24)/2);
    need(BRANCHES[branch]===input.pillars[3][1],'SOLAR_SHICHEN_CONFLICT');
  }
  if(c.analysis_scope!=='structural_review')need(source.verification_status==='user_declared','INSUFFICIENT_TRUE_SOLAR_INPUT');
  if(c.analysis_scope==='annual_cycle')need(input.liunian&&c.window.kind==='cycle'&&c.window.precision==='year','ANNUAL_LAYER_REQUIRED');
  if(c.analysis_scope==='multi_year_stage')need(input.dayun&&c.window.kind==='cycle'&&c.window.precision==='decade','DECADAL_LAYER_REQUIRED');
  const resolved=source.verification_status==='user_declared';
  if(resolved) {text(input.candidate_id,'candidate_id');need(/^[a-zA-Z0-9_-]+$/.test(input.candidate_id),'INVALID_CANDIDATE_ID');}
  const time_basis={};
  for(const k of ['raw_calendar','raw_civil_datetime','birth_place','birth_longitude','civil_timezone','historical_timezone_or_dst'])time_basis[k]=source[k]??null;
  for(const k of ['conversion_tool','conversion_version','conversion_access_date','equation_of_time_correction','longitude_correction','conversion_parameters'])time_basis[k]=null;
  Object.assign(time_basis,{resolution_status:resolved?'resolved':'unresolved',verification_status:resolved?'user_declared':null,
    resolved_candidates:resolved?[{candidate_id:input.candidate_id,true_solar_datetime:source.true_solar_datetime??null,
      true_solar_shichen:input.pillars[3][1],source_ref:source.source_ref,conversion_parameters:null,boundary_reasons:[],chart_ref:input.review_chart_id}]:[]});
  const chart_candidates=resolved?[{chart_id:input.review_chart_id,candidate_id:input.candidate_id,four_pillars:clone(input.pillars),
    charting_source:source.source_ref,charting_version:null,charting_access_date:null,calendar_rules:source.calendar_rules??null}]:[];
  return {review_chart_id:input.review_chart_id,native_input:{pillars:clone(input.pillars),dayun:input.dayun??null,liunian:input.liunian??null},
    evidence:{source_path:'provided_chart_review',chart_grade:'P0',independent_charting_performed:false,
      source_ref:source.source_ref,time_basis,chart_candidates}};
}
export function validateBaziNative(payload,input) {
  try {
    if(input.candidates) {
      need(digest(payload.evidence)===digest(input.evidence),'CANDIDATE_EVIDENCE_CHANGED');
      need(Object.keys(payload.checks_by_chart).length===input.candidates.length,'CANDIDATE_CHART_COUNT');
      for(const entry of input.candidates) {
        const errors=validateBaziNative({...payload,evidence:entry.evidence,checks_by_chart:{[entry.review_chart_id]:payload.checks_by_chart[entry.review_chart_id]}},entry);
        need(errors.length===0,'CANDIDATE_NATIVE_INVALID');
      }return [];
    }
    exactKeys(payload,['schema_version','evidence','structure_check','checks_by_chart']);need(payload.schema_version==='bazi.provided-review.v1','BAZI_PAYLOAD_SCHEMA');
    need(digest(payload.structure_check)===digest({status:'completed',scope:'fixed_structure_only',grade:'P1'}),'STRUCTURE_GRADE_MISMATCH');
    need(digest(payload.evidence)===digest(input.evidence),'SOURCE_EVIDENCE_CHANGED');
    need(plain(payload.checks_by_chart)&&Object.keys(payload.checks_by_chart).length===1&&
      Object.hasOwn(payload.checks_by_chart,input.review_chart_id),'CHART_BINDING_MISMATCH');
    const native=payload.checks_by_chart[input.review_chart_id],p=input.native_input;
    need(native.schemaVersion==='1.0.0','BAZI_NATIVE_SCHEMA');
    need(digest(native.input)===digest({natal:Object.fromEntries(['year','month','day','hour'].map((k,i)=>[k,p.pillars[i]])),
      dayun:p.dayun,liunian:p.liunian}),'NATIVE_INPUT_ECHO');
    const expected=[...p.pillars,...(p.dayun?[p.dayun]:[]),...(p.liunian?[p.liunian]:[])];
    need(Array.isArray(native.pillars)&&native.pillars.length===expected.length,'BAZI_PILLAR_COUNT');
    need(native.dayMaster.stem===p.pillars[2][0],'BAZI_DAY_MASTER');
    native.pillars.forEach((r,i)=>{
      need(r.pillar===expected[i]&&r.heavenlyStem.symbol===expected[i][0]&&r.earthlyBranch.symbol===expected[i][1],'BAZI_PILLAR_ECHO');
      need(TG.includes(r.heavenlyStem.tenGod),'BAZI_TEN_GOD_ENUM');
      need(r.heavenlyStem.tenGod===tables.ten_gods[p.pillars[2][0]][r.heavenlyStem.symbol],'BAZI_TEN_GOD_MAPPING');
      for(const k of ['element','polarity'])need(r.heavenlyStem[k]===tables.stems[r.heavenlyStem.symbol][k],'BAZI_STEM_META');
      need(digest(r.earthlyBranch.hiddenStems.map(h=>h.symbol))===digest(tables.hidden[r.earthlyBranch.symbol]),'BAZI_HIDDEN_TABLE');
      need(Array.isArray(r.earthlyBranch.hiddenStems)&&r.earthlyBranch.hiddenStems.length>=1&&r.earthlyBranch.hiddenStems.length<=3,'BAZI_HIDDEN_STEMS');
      r.earthlyBranch.hiddenStems.forEach((h,j)=>{need(h.order===j+1&&STEMS.includes(h.symbol)&&TG.includes(h.tenGod),'BAZI_HIDDEN_STEMS');need(h.tenGod===tables.ten_gods[p.pillars[2][0]][h.symbol],'BAZI_HIDDEN_TEN_GOD');for(const k of ['element','polarity'])need(h[k]===tables.stems[h.symbol][k],'BAZI_HIDDEN_META');});
    });
    need(plain(native.relationships)&&Object.values(native.relationships).every(Array.isArray),'BAZI_RELATIONS');
    need(Array.isArray(native.limitations)&&native.limitations.length>0,'NATIVE_LIMITATIONS_MISSING');return [];
  }catch(e){return [e.code||e.message];}
}
export function baziFacts(payload) {
  if(Object.keys(payload.checks_by_chart).length>1) {
    const result=[];
    for(const [chart,native] of Object.entries(payload.checks_by_chart)) {
      for(const fact of baziFacts({...payload,checks_by_chart:{[chart]:native}}))result.push({...fact,fact_id:chart+'_'+fact.fact_id,label:chart+' '+fact.label});
    }return result;
  }
  const id=Object.keys(payload.checks_by_chart)[0],base=`/checks_by_chart/${id}`,native=payload.checks_by_chart[id];
  const facts=[{fact_id:'structure_grade',label:'Verified structural check grade',pointer:'/structure_check/grade'},
    {fact_id:'chart_grade',label:'Imported chart source grade',pointer:'/evidence/chart_grade'},
    {fact_id:'solar_source',label:'True-solar verification',pointer:'/evidence/time_basis/verification_status'},
    {fact_id:'day_master',label:'\u65e5\u4e3b',pointer:base+'/dayMaster/stem'}];
  native.pillars.forEach((r,i)=>{
    facts.push({fact_id:`pillar_${i}`,label:r.location,pointer:base+`/pillars/${i}/pillar`});
    facts.push({fact_id:`stem_god_${i}`,label:r.location+' \u660e\u5e72\u5341\u795e',pointer:base+`/pillars/${i}/heavenlyStem/tenGod`});
    facts.push({fact_id:`hidden_${i}`,label:r.location+' \u85cf\u5e72',pointer:base+`/pillars/${i}/earthlyBranch/hiddenStems`});
  });
  facts.push({fact_id:'relations',label:'\u5173\u7cfb\u5b58\u5728\u6027',pointer:base+'/relationships'});
  facts.push({fact_id:'limits',label:'\u68c0\u67e5\u5668\u8fb9\u754c',pointer:base+'/limitations'});return facts;
}
export async function createProfile(root=new URL('../',import.meta.url)) {
  const source=await verifyPackageSources(root,'scripts/inspect_bazi.mjs','74199ecc8b217335f7a5bf879e2521b514e2290a');
  return {method_id:'bazi',rule_profile:RULE_PROFILE,root:fileURLToPath(root),entrypoint:'scripts/native-bridge.mjs',
    source_files:source.files,source_digest:source.digest,native_schema:'bazi.provided-review.v1 (contains unchanged schemaVersion:1.0.0)',
    child_schema:'metaphysics.standard-child.v1',production_ready:false,timeout_ms:5000,max_output_bytes:8388608,
    preflight:(input,c)=>{try{prepare(input,c);return [];}catch(e){return [e.code||e.message];}},prepareInput:prepare,
    validateNative:validateBaziNative,factDefinitions:baziFacts,validateDraft:({draft,c,t,payload})=>{
      if(['structural_review','calculation_review'].includes(c.analysis_scope)) return onlyCalculationDraft({draft,c});
      if(t.method==='bazi') need(payload.evidence.time_basis.verification_status==='user_declared','UNCONFIRMED_SOLAR_SOURCE');
      need(draft.status!=='ok'||draft.claims.some(x=>x.nature==='traditional_interpretation'),'INTERPRETATION_REQUIRED');
    },projectClaims:projectStandardClaims,
    buildChild:args=>buildStandardChild({...args,uncertainty:['Provided pillars are not independently recalculated from birth data.'],
      limitations:['Structural checking is not calendrical chart verification. Strength, climate, patterns and useful-god readings are conditional, source-tagged interpretations, not verified predictions.']}),
    validateChild:child=>validateStandardChild(child,'bazi')};
}
