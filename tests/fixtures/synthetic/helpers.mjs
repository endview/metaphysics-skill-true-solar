// All inputs here are synthetic; no real user identity, birth data or questions.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NativeRegistry,VerifiedRunner,sourceSnapshot} from '../../../runtime-src/execution.mjs';
import {SessionCaseStore} from '../../../runtime-src/case.mjs';
import {bindingFor} from '../../../runtime-src/validate.mjs';
import {digest} from '../../../runtime-src/common.mjs';
export const root=path.dirname(fileURLToPath(import.meta.url));
export const window=()=>({kind:'interval',raw_input:'Synthetic fixed observation interval',source_ref:'synthetic:window',
  start:'2024-01-01T00:00Z',end:'2024-01-31T00:00Z',timezone:'UTC',include_start:true,include_end:false,
  calendar_basis:'gregorian',boundary_profile:'fixed_24h'});
export async function profile(overrides={}){
  const snapshot=await sourceSnapshot(overrides.root||root,['echo-native.mjs']);
  return {method_id:'fixture.echo',rule_profile:'synthetic-v1',entrypoint:'echo-native.mjs',root,
    source_files:['echo-native.mjs'],source_digest:snapshot.digest,native_schema:'synthetic.echo.v1',
    child_schema:'synthetic.standard-child.v1',production_ready:false,timeout_ms:1500,max_output_bytes:65536,
    preflight:input=>Number.isSafeInteger(input.value)?[]:['value must be a safe integer'],
    prepareInput:input=>input,
    validateNative:(output,input)=>output.schema==='synthetic.echo.v1'&&output.data?.value===input.value
      &&digest(output.data.input_echo)===digest(input)?[]:['native input echo or schema mismatch'],
    factDefinitions:()=>[{fact_id:'synthetic_value',label:'Synthetic value',pointer:'/data/value'}],
    buildChild:({status,claims,payload,binding})=>({schema:'synthetic.standard-child.v1',status,claims,method_payload:payload,binding}),
    validateChild:child=>child.schema==='synthetic.standard-child.v1'?[]:['not synthetic child'],...overrides};
}
export async function setup({input={value:7},profiles=null,windowValue=null,time_context=null}={}){
  const store=new SessionCaseStore(),subject=store.registerSubject('Synthetic subject A');
  const event=store.registerEvent(subject,'Synthetic event',{reason:'Synthetic independent event, not a real-world consultation'});
  const ps=profiles||[await profile()],registry=new NativeRegistry();ps.forEach(p=>registry.register(p));
  const c=store.create({subject_ref:subject,event_ref:event,proposition_id:'synthetic-proposition',question:'Synthetic contract exercise',
    criteria:'Synthetic exact equality',analysis_scope:'bounded_event',window:windowValue||window(),time_context,
    tasks:ps.map(p=>({method:p.method_id,rule_profile:p.rule_profile,method_inputs:input}))});
  store.freeze(c.case_id);
  return {store,registry,runner:new VerifiedRunner({registry,store}),c:store.get(c.case_id),t:c.tasks[0],subject,event};
}
export function draftFor(c,t,value=7){
  const binding=bindingFor(c,t);
  return {binding,status:'ok',claims:[{claim_id:'synthetic-claim',binding,nature:'calculation_fact',
    text:`Synthetic value: ${value}`,basis_refs:['/data/value'],fact_ids:['synthetic_value']}]};
}
export function syntheticCard(){return {card_id:'synthetic-card',version:'1',review_status:'reviewed',tradition_profile:'synthetic-only',
  sources:[{reference:'synthetic:test-rule',locator:'fixture definition',license:'AGPL-3.0-only'}],meaning:'Synthetic interpretation for validator tests only',
  prerequisites:[{op:'exists',pointer:'/data/value'}],counter_readings:['Synthetic opposite reading'],
  not_inferable:['Any real world fact'],fact_requirements:['/data/value']};}
