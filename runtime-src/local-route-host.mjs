// SPDX-License-Identifier: AGPL-3.0-only
// A host adapter, not an algorithm: each installed Skill runs its own VerifiedRunner.
// Model-context isolation is deliberately unavailable in this local host.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {digest,id,need,clone,canonical} from './common.mjs';
const SKILLS={bazi:'analyze-bazi',ziwei:'analyze-ziwei',meihua:'cast-meihua'};
export class LocalRouteHost {
  #roots;#receipts=new Map();#clock;#sessions=new Map();
  constructor(roots={},clock=()=>new Date()){this.#roots=Object.freeze({...roots});this.#clock=clock;}
  clock(){return this.#clock();}
  methodCapability(method){return this.#roots[method]?{available:true}:{available:false,reason:'No host-registered installation path'};}
  capabilities(){return {schema:'metaphysics.runtime-capabilities.v1',skill_loading:'file_read',process_execution:'available',
    chinese_calendar:'unknown',branch_isolation:'unavailable',tool_observation:'available',observation_level:'local_runner_observed',case_store:'session',
    observation_source:'installed_skill_verified_runner',external_solar_converter:'unavailable'};}
  async #session(method){
    need(Object.hasOwn(SKILLS,method)&&this.#roots[method],'METHOD_UNAVAILABLE');
    if(this.#sessions.has(method))return this.#sessions.get(method);
    const root=path.resolve(this.#roots[method]);need(await fs.realpath(root)===root,'METHOD_ROOT_SYMLINK');
    for(const relative of ['scripts/profile.mjs','scripts/_runtime/session-host.mjs']){
      const file=path.join(root,relative),stat=await fs.lstat(file);
      need(stat.isFile()&&!stat.isSymbolicLink()&&await fs.realpath(file)===file,'METHOD_ENTRYPOINT');
    }
    const {createProfile}=await import(pathToFileURL(path.join(root,'scripts/profile.mjs')).href);
    const {ReviewSession}=await import(pathToFileURL(path.join(root,'scripts/_runtime/session-host.mjs')).href);
    const session=new ReviewSession(await createProfile(),{clock:this.#clock});this.#sessions.set(method,session);return session;
  }
  #observe(task,result,started){
    const receipt={receipt_id:id('receipt'),task_digest:digest(task),result_digest:digest(result),started_at:started,ended_at:new Date().toISOString(),
      level:'local_runner_observed',input_context_keys:Object.keys(task).sort(),sibling_results_in_context:false};
    this.#receipts.set(receipt.receipt_id,digest(receipt));return {result,receipt};
  }
  async dispatch(task){
    need(Buffer.byteLength(canonical(task))<=1048576,'INPUT_TOO_LARGE');
    const started=new Date().toISOString(),session=await this.#session(task.method);
    return this.#observe(task,await session.dispatch(clone(task)),started);
  }
  async finalizeBranch(task,draft){
    const started=new Date().toISOString(),session=await this.#session(task.method);
    const bundle=await session.handle({op:'finalize',case_id:task.case_id,task_id:task.task_id,draft:clone(draft)});
    const inspected=await session.handle({op:'inspect',case_id:task.case_id});
    const execution_record=inspected.records.find(x=>x.run_id===bundle.execution_ref.split(':').at(-1))||inspected.records.findLast(x=>x.exit_code===0);
    need(execution_record,'EXECUTION_RECORD_MISSING');
    return this.#observe(task,{bundle,execution_record},started);
  }
  verifyInvocation(task,reply){return this.#receipts.get(reply.receipt?.receipt_id)===digest(reply.receipt)&&reply.receipt.task_digest===digest(task)&&reply.receipt.result_digest===digest(reply.result);}
  verifyIsolation(){return false;}
}
