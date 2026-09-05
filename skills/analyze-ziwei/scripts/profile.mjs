// SPDX-License-Identifier: AGPL-3.0-only
import {fileURLToPath} from 'node:url';
import {clone,digest,need,plain,pointer} from './_runtime/common.mjs';
import {normalizeTimeContext} from './_runtime/time-context.mjs';
import {exactKeys,verifyPackageSources,projectStandardClaims,buildStandardChild,validateStandardChild} from './_runtime/native-utils.mjs';
import {preflightZiwei} from './engine/run.mjs';
import {sha256Canonical} from './engine/canonical-json.mjs';
export const RULE_PROFILE='ziwei-verified-v1';
export function prepareZiwei(input,c) {
  exactKeys(input,['native_input']);
  need(['structural_review','traditional_structure','annual_cycle','multi_year_stage'].includes(c.analysis_scope),'UNSUPPORTED_ZIWEI_LAYER');
  const pre=preflightZiwei(input.native_input);
  need(pre.ready,'INSUFFICIENT_TRUE_SOLAR_INPUT');
  // An uploaded string claiming tool_verified is not an executed reviewed converter.
  for(const part of ['birth','target']) need(pre.normalized[part].true_solar.verification_status==='user_declared','UNREVIEWED_SOLAR_ADAPTER');
  const civil=input.native_input.birth.civil;
  if(civil.utc_offset) normalizeTimeContext({source_kind:'user_specified',source_ref:'birth.civil',
    raw_input:`${civil.date}T${civil.local_time}${civil.utc_offset}`,timezone:civil.timezone});
  if(c.analysis_scope==='annual_cycle') need(c.window.kind==='cycle' && c.window.boundary_profile==='lunar-new-year','YEAR_BOUNDARY_PROFILE_REQUIRED');
  return clone(input.native_input);
}
export function validateZiweiNative(p,input) {
  try {
    need(plain(p)&&p.schema_version==='ziwei.facts.v2'&&p.status==='ok'&&p.facts_available===true,'ZIWEI_NATIVE_SCHEMA');
    const {result_hash,...body}=p;
    need(result_hash===`sha256:${sha256Canonical(body)}`,'ZIWEI_RESULT_HASH');
    const pre=preflightZiwei(input);
    need(digest(p.input)===digest(pre.normalized),'ZIWEI_INPUT_ECHO');
    need(p.source.chart_grade==='P1'&&p.source.time_basis==='true_solar','ZIWEI_SOURCE_GRADE');
    need(p.source.calendar_assumptions.civil_fallback===false,'ZIWEI_CIVIL_FALLBACK');
    need(p.engine.name==='iztro'&&p.engine.version==='2.5.8'&&p.engine.artifact_sha256==='4b8eca323e5d4291471567c62255a2166471c55c77ebe8f0d2d38240e69d12b1','ZIWEI_ENGINE_IDENTITY');
    for(const part of ['birth','target']) {
      const prov=p.source.time_provenance[part],src=pre.normalized[part];
      need(prov.verification_status===src.true_solar.verification_status&&digest(prov.civil_record)===digest(src.civil),'ZIWEI_PROVENANCE');
    }
    const cs=p.candidates;
    need(cs.requested_count===pre.requested.length && cs.accepted_count===pre.requested.length && cs.items.length===pre.requested.length,'ZIWEI_CANDIDATE_COUNT');
    need(cs.groups.length===cs.unique_chart_count && cs.groups.length>0,'ZIWEI_GROUP_COUNT');
    const expected=new Map(pre.requested.map(x=>[`sha256:${sha256Canonical(x)}`,x])),seen=new Set(),groups=new Map();
    for(const g of cs.groups) {
      need(g.group_id===`sha256:${sha256Canonical(g.facts)}`&&g.chart_hash===g.group_id&&!groups.has(g.group_id),'ZIWEI_GROUP_HASH');
      groups.set(g.group_id,g);
      need(g.facts.origin.palaces.length===12,'ZIWEI_PALACE_COUNT');
      need(new Set(g.facts.origin.palaces.map(x=>x.index)).size===12,'ZIWEI_PALACE_UNIQUENESS');
      need(plain(g.facts.decadal)&&plain(g.facts.yearly),'ZIWEI_LAYER_MISSING');
      for(const palace of g.facts.origin.palaces) {
        need(Number.isInteger(palace.index)&&palace.index>=0&&palace.index<12,'ZIWEI_PALACE_INDEX');
      }
    }
    for(const item of cs.items) {
      need(expected.has(item.candidate_id)&&!seen.has(item.candidate_id),'ZIWEI_CANDIDATE_ID');seen.add(item.candidate_id);
      need(digest(item.dimensions)===digest(expected.get(item.candidate_id)),'ZIWEI_SELECTOR_BINDING');
      need(groups.has(item.chart_hash)&&groups.get(item.chart_hash).candidate_ids.includes(item.candidate_id),'ZIWEI_CANDIDATE_GROUP');
    }
    const members=cs.groups.flatMap(g=>g.candidate_ids);
    need(members.length===seen.size&&new Set(members).size===seen.size&&members.every(x=>seen.has(x)),'ZIWEI_GROUP_MEMBERS');
    return [];
  } catch(e) {return [e.code||e.message];}
}
export function ziweiFacts(p) {
  const facts=[['profile','Profile','/profile/id'],['source','Source and time basis','/source'],['candidates','Candidate dimensions','/candidates/items'],['stability','Candidate sensitivity','/candidates/comparison']]
    .map(([fact_id,label,pointer])=>({fact_id,label,pointer}));
  p.candidates.groups.forEach((g,i)=>{
    for(const layer of ['origin','decadal','yearly']) facts.push({fact_id:`group_${i}_${layer}`,label:`Candidate ${g.group_id} ${layer}`,pointer:`/candidates/groups/${i}/facts/${layer}`});
  });return facts;
}
export async function createProfile() {
  const root=new URL('../',import.meta.url);
  const source=await verifyPackageSources(root,'scripts/ziwei-cli.mjs','d2bae5f0d5075f466ffa602360fca8d4c5116bfd',{defer_source_check:true});
  return {method_id:'ziwei',rule_profile:RULE_PROFILE,root:fileURLToPath(root),entrypoint:'scripts/native-bridge.mjs',
    source_files:source.files,source_digest:source.digest,native_schema:'ziwei.facts.v2',child_schema:'metaphysics.standard-child.v1',
    timeout_ms:20000,max_output_bytes:8388608,production_ready:false,
    preflight(input,c){try{prepareZiwei(input,c);return [];}catch(e){return [e.code||e.message];}},prepareInput:prepareZiwei,
    validateNative:validateZiweiNative,factDefinitions:ziweiFacts,projectClaims:projectStandardClaims,
    validateDraft({draft,c}) {
      if(c.analysis_scope==='structural_review') need(draft.claims.every(x=>x.nature==='calculation_fact'),'INTERPRETATION_NOT_IMPLEMENTED');
      else need(draft.status!=='ok'||draft.claims.some(x=>x.nature==='traditional_interpretation'),'INTERPRETATION_REQUIRED');
    },
    buildChild({status,claims,payload,c,t}) {return buildStandardChild({status,claims,payload,c,t,
      uncertainty:['Single engine yields P1, not P2. True-solar selections are user-declared, not independently converted.','Retain every candidate; do not select by life events.'],
      limitations:['Origin, decadal, and yearly layers only; target day is a positioning coordinate, not a daily forecast.','Traditional interpretation is not evidence of hidden facts or an empirical probability.']});},
    validateChild:child=>validateStandardChild(child,'ziwei')};
}
