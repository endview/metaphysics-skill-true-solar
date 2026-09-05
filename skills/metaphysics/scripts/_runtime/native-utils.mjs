// SPDX-License-Identifier: AGPL-3.0-only
// Candidate native adapters. This module does not implement a divination algorithm.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {canonical,clone,digest,need,parseStrictJson,plain,pointer,text} from './common.mjs';
import {sourceSnapshot} from './execution.mjs';

export async function readStdin(maxBytes=1048576) {
  const chunks=[];let size=0;
  for await (const chunk of process.stdin) {
    size+=chunk.length;need(size<=maxBytes,'INPUT_TOO_LARGE');chunks.push(chunk);
  }
  return parseStrictJson(Buffer.concat(chunks).toString('utf8'),{maxBytes});
}
export async function verifyPackageSources(root,nativePath,expectedGitBlob,{defer_source_check=false}={}) {
  const lock=parseStrictJson(await fs.readFile(new URL('scripts/source-lock.json',root),'utf8'));
  need(lock.schema==='metaphysics.package-source-lock.v1' && plain(lock.files),'SOURCE_LOCK_SCHEMA');
  const files=Object.keys(lock.files),snapshot=defer_source_check?{digest:digest(lock.files)}:await sourceSnapshot(fileURLToPath(new URL('.',root)),files);
  need(snapshot.digest===digest(lock.files),'SOURCE_LOCK_MISMATCH');
  const b=await fs.readFile(new URL(nativePath,root));
  need(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex')===expectedGitBlob,'ORIGINAL_ALGORITHM_CHANGED');
  return {files,digest:snapshot.digest};
}
export function exactKeys(obj,keys,code='UNKNOWN_FIELD') {
  need(plain(obj)&&Object.keys(obj).every(k=>keys.includes(k)),code);
}
export function strings(value,name,{empty=true}={}) {
  need(Array.isArray(value)&&(empty||value.length>0)&&value.every(x=>typeof x==='string'&&x.length>0),'INVALID_STRING_ARRAY',name);
}
const standardKeys=['schema_version','method_id','skill_name','status','question_answered','applicable_time_scale',
  'findings','basis','claims','assumptions_and_uncertainty','limitations','follow_up_needed','method_payload'];
const claimKeys=['claim_id','proposition_id','subject_ref','statement','direction','conditions','applicable_time_scale','basis_refs'];
export function methodScale(method, scope = 'structural_review') {
  if (method === 'meihua') return 'bounded_event';
  if (['annual_cycle','yearly'].includes(scope)) return 'annual_cycle';
  if (['multi_year_stage','decadal'].includes(scope)) return 'multi_year_stage';
  return 'structural';
}
export const skillFor = method => ({bazi:'$analyze-bazi',ziwei:'$analyze-ziwei',meihua:'$cast-meihua'}[method]);
export function projectStandardClaims(claims,{c,t}) {
  return claims.map(x=>({claim_id:x.claim_id,proposition_id:c.proposition_id,subject_ref:c.subject_ref,
    statement:x.text,direction:x.nature==='calculation_fact'?'neutral':(x.direction||'unknown'),
    conditions:[c.criteria,...(x.conditions??[])],applicable_time_scale:methodScale(t.method,c.analysis_scope),basis_refs:clone(x.basis_refs)}));
}
export function buildStandardChild({status,claims,payload,c,t,uncertainty=[],limitations=[]}) {
  return {schema_version:'metaphysics.standard-child.v1',method_id:t.method,
    skill_name:skillFor(t.method),status,
    question_answered:c.question,applicable_time_scale:methodScale(t.method,c.analysis_scope),
    findings:claims.filter(x=>x.nature==='traditional_interpretation').map(x=>x.text),basis:[...new Set(claims.flatMap(x=>x.basis_refs))],
    claims:projectStandardClaims(claims,{c,t}),assumptions_and_uncertainty:[...uncertainty,...claims.filter(x=>x.counter_reading).map(x=>x.counter_reading)],
    limitations,follow_up_needed:[],method_payload:payload};
}
export function validateStandardChild(child,method) {
  try {
    exactKeys(child,standardKeys);need(standardKeys.every(k=>Object.hasOwn(child,k)),'MISSING_STANDARD_FIELD');
    need(child.schema_version==='metaphysics.standard-child.v1'&&child.method_id===method,'STANDARD_IDENTITY');
    need(child.skill_name===skillFor(method),'STANDARD_IDENTITY');
    need(['ok','insufficient_input','error'].includes(child.status),'STANDARD_STATUS');
    text(child.question_answered,'question_answered');
    const scale=child.applicable_time_scale;need((method==='meihua'?['bounded_event']:['structural','multi_year_stage','annual_cycle']).includes(scale),'STANDARD_SCALE');
    for(const name of ['findings','basis','assumptions_and_uncertainty','limitations','follow_up_needed'])strings(child[name],name);
    need(Array.isArray(child.claims)&&(child.status==='ok'?child.claims.length>0:child.claims.length===0),'STANDARD_CLAIMS');
    const ids=new Set();
    for(const x of child.claims) {
      exactKeys(x,claimKeys);need(claimKeys.every(k=>Object.hasOwn(x,k)),'MISSING_STANDARD_CLAIM_FIELD');
      for(const k of ['claim_id','proposition_id','subject_ref','statement'])text(x[k],k,16384);
      need(!ids.has(x.claim_id),'DUPLICATE_CLAIM');ids.add(x.claim_id);
      need(['supportive','cautionary','mixed','neutral','unknown'].includes(x.direction),'STANDARD_DIRECTION');
      need(x.applicable_time_scale===scale,'STANDARD_SCALE');strings(x.conditions,'conditions');strings(x.basis_refs,'basis_refs',{empty:false});
      for(const ref of x.basis_refs)pointer(child.method_payload,ref);
    }
    canonical(child);return [];
  } catch(e) {return [e.code||e.message];}
}
export function onlyCalculationDraft({draft,c}) {
  need(['structural_review','calculation_review'].includes(c.analysis_scope),'INTERPRETATION_NOT_IMPLEMENTED',
    'This candidate can finalize calculation-review tasks only, not a predictive question.');
  need(draft.claims.every(x=>x.nature==='calculation_fact' && !x.timing && !x.goal_ref &&
    (!x.direction||x.direction==='neutral')),'INTERPRETATION_NOT_IMPLEMENTED');
}
