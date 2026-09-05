// External-model acceptance harness. No model credentials or synthetic evaluator are bundled.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {sourceManifest} from './source-manifest.mjs';import {need,digest} from '../runtime-src/common.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),args=process.argv.slice(2),set=JSON.parse(await fs.readFile(path.join(root,'tests/behavior/scenarios.json'),'utf8'));
const report={schema:'metaphysics.behavior-matrix.v1',started_at:new Date().toISOString(),source_digest:(await sourceManifest(root)).digest,scenario_digest:digest(set),data_kind:'synthetic_only',status:'not_run',rows:[],critical_violations:null,production_accepted:false};
if(args.length){
 need(args.length===2&&args[0]==='--adapter','USAGE_ADAPTER');const adapter=await import(pathToFileURL(path.resolve(args[1])).href);
 need(typeof adapter.runScenario==='function'&&typeof adapter.reviewScenario==='function'&&typeof adapter.verifyEvidence==='function','BEHAVIOR_ADAPTER_CONTRACT');
 report.status='executed';
 for(const scenario of set.scenarios){
  try{
   const observed=await adapter.runScenario(structuredClone(scenario));
   need(await adapter.verifyEvidence(observed),'UNOBSERVED_MODEL_EXECUTION');
   need(observed.model_id&&observed.host_id&&observed.parameters&&observed.started_at&&observed.ended_at&&Array.isArray(observed.tool_calls)&&Array.isArray(observed.turns),'MODEL_METADATA_REQUIRED');
   const review=await adapter.reviewScenario(structuredClone(scenario),observed);
   need(review.independent===true&&review.reviewer_ref&&['pass','fail','disputed'].includes(review.verdict),'INDEPENDENT_REVIEW_REQUIRED');
   report.rows.push({scenario_id:scenario.id,severity:scenario.severity,observed,review});
  }catch(error){report.rows.push({scenario_id:scenario.id,severity:scenario.severity,error:error.code||'EVALUATION_ERROR',review:{verdict:'fail'}});}
 }
 report.critical_violations=report.rows.filter(x=>x.severity==='critical'&&x.review.verdict!=='pass').length;
 report.production_accepted=report.rows.length===set.scenarios.length&&report.rows.every(x=>x.review.verdict==='pass');
}else report.reason='A real model/host adapter and independent review are not configured. Deterministic tests do not substitute for this matrix.';
report.ended_at=new Date().toISOString();await fs.mkdir(path.join(root,'reports/behavior'),{recursive:true});
await fs.writeFile(path.join(root,'reports/behavior',report.started_at.replaceAll(':','-')+'.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(root,'reports/behavior-matrix.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,scenarios:set.scenarios.length,rows:report.rows.length,critical_violations:report.critical_violations,production_accepted:report.production_accepted}));
process.exitCode=report.production_accepted?0:2;
