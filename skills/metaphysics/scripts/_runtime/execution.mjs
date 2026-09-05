// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';import syncFs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { id, need, text, clone, digest, sha256, canonical, parseStrictJson, ProtocolError } from './common.mjs';
import { frozenDigest, SessionCaseStore } from './case.mjs';
import { finalizeResult } from './validate.mjs';

export async function sourceSnapshot(root, files) {
  const base=path.resolve(root); need(await fs.realpath(base)===base,'SYMLINK_SOURCE');
  need(Array.isArray(files)&&files.length>0&&new Set(files).size===files.length,'SOURCE_FILES_REQUIRED');
  const hashes={};
  for (const relative of [...files].sort()) {
    need(typeof relative==='string' && !path.isAbsolute(relative) && !relative.split(/[\\/]/).includes('..'),'SOURCE_PATH');
    const absolute=path.resolve(base,relative);
    need(absolute.startsWith(base+path.sep) && await fs.realpath(absolute)===absolute,'SYMLINK_SOURCE');
    need((await fs.stat(absolute)).isFile(),'SOURCE_NOT_FILE');
    hashes[relative]=sha256(await fs.readFile(absolute));
  }
  return {files:hashes,digest:digest(hashes)};
}
// Profiles are registered by reviewed code, never from user-controlled JSON or entrypoint text.
export class NativeRegistry {
  #profiles=new Map();
  register(profile) {
    for(const k of ['method_id','rule_profile','entrypoint','source_digest','native_schema','child_schema']) text(profile[k],k);
    for(const k of ['preflight','prepareInput','validateNative','factDefinitions','buildChild','validateChild'])
      need(typeof profile[k]==='function','INCOMPLETE_ADAPTER',k);
    need(Array.isArray(profile.source_files)&&profile.source_files.includes(profile.entrypoint),'ENTRYPOINT_NOT_PINNED');
    need(!this.#profiles.has(profile.method_id),'DUPLICATE_METHOD');
    need(Number.isInteger(profile.timeout_ms)&&profile.timeout_ms>0&&profile.timeout_ms<=120000,'INVALID_TIMEOUT');
    need(Number.isInteger(profile.max_output_bytes)&&profile.max_output_bytes>0&&profile.max_output_bytes<=16777216,'INVALID_OUTPUT_LIMIT');
    const copy={...profile,root:path.resolve(profile.root),source_files:[...profile.source_files]};
    this.#profiles.set(profile.method_id,Object.freeze(copy)); return this;
  }
  get(method) { const p=this.#profiles.get(method); need(p,'NATIVE_NOT_REGISTERED',`No reviewed native adapter: ${method}`); return p; }
  list() { return [...this.#profiles.values()].map(p=>({method_id:p.method_id,production_ready:p.production_ready===true})); }
}
async function runProcess(profile,input) {
  const body=canonical(input); need(Buffer.byteLength(body)<=1048576,'INPUT_TOO_LARGE');
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'metaphysics-run-')); await fs.chmod(cwd,0o700);
  const started_at=new Date().toISOString();
  try {
    return await new Promise(resolve=>{
      let stdout=[],stderr=[],bytes=0,timed_out=false,output_limited=false,spawn_error=null,done=false;
      const child=spawn(process.execPath,[path.join(profile.root,profile.entrypoint)],{
        cwd,shell:false,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe'],
        env:{PATH:path.dirname(process.execPath),LANG:'C.UTF-8',TZ:'UTC',HOME:cwd}
      });
      const kill=()=>{
        try { process.platform==='win32'?child.kill('SIGKILL'):process.kill(-child.pid,'SIGKILL'); }
        catch { child.kill('SIGKILL'); }
      };
      const timer=setTimeout(()=>{timed_out=true;kill();},profile.timeout_ms);
      const collect=target=>chunk=>{
        bytes+=chunk.length;
        if(bytes>profile.max_output_bytes){output_limited=true;kill();return;}
        target.push(chunk);
      };
      child.stdout.on('data',collect(stdout)); child.stderr.on('data',collect(stderr));
      child.on('error',e=>{spawn_error=e.code||'SPAWN_ERROR';});
      child.stdin.on('error',()=>{});
      child.on('close',(exit_code,signal)=>{
        if(done)return;done=true;clearTimeout(timer);
        resolve({started_at,ended_at:new Date().toISOString(),exit_code,signal,timed_out,output_limited,spawn_error,
          stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8'),bytes});
      });
      child.stdin.end(body);
    });
  } finally { await fs.rm(cwd,{recursive:true,force:true}); }
}
function checkAdapterReport(report,code) {
  need(Array.isArray(report), 'INVALID_VALIDATOR_RETURN'); need(report.length===0,code,code,{errors:report});
}
export class VerifiedRunner {
  #registry; #store; #issued=new Map();
  constructor({registry=new NativeRegistry(),store=new SessionCaseStore()}={}) {this.#registry=registry;this.#store=store;}
  get store(){return this.#store;}
  async compute(case_id,task_id,{retry_reason=null}={}) {
    const release=this.#store.lock(case_id,task_id);
    try {
      const {c,t}=this.#store.task(case_id,task_id);
      need(!['invalidated','superseded','closed'].includes(c.state),'CASE_NOT_ACTIVE');
      const existing=this.#store.result(case_id,task_id);
      if(existing){const current=this.#registry.get(t.method);need(existing.source_digest===current.source_digest,'SOURCE_VERSION_CHANGED');const snapshot=await sourceSnapshot(current.root,current.source_files);need(snapshot.digest===current.source_digest,'SOURCE_DIGEST_MISMATCH');return {...existing,reused:true};}
      const state=this.#store.taskState(case_id,task_id);
      need(['frozen','execution_failed'].includes(state),'CASE_NOT_EXECUTABLE');
      const p=this.#registry.get(t.method); need(p.rule_profile===t.rule_profile,'PROFILE_MISMATCH');
      checkAdapterReport(await p.preflight(clone(t.method_inputs),clone(c)),'INPUT_PREFLIGHT_FAILED');
      const source=await sourceSnapshot(p.root,p.source_files); need(source.digest===p.source_digest,'SOURCE_DIGEST_MISMATCH');
      const attempt=this.#store.attempts(case_id,task_id)+1;
      if(attempt>1)text(retry_reason,'technical retry reason');
      const input=await p.prepareInput(clone(t.method_inputs),clone(c)); const input_digest=digest(input);
      const previous=this.#store.records(case_id).filter(r=>r.task_id===task_id).at(-1);
      if(previous)need(previous.input_digest===input_digest && previous.frozen_case_digest===frozenDigest(c),'RETRY_INPUT_CHANGED');
      this.#store.nextAttempt(case_id,task_id);this.#store.transitionTask(case_id,task_id,'executing');
      const run_id=id('run'); let processResult;
      try { processResult=await runProcess(p,input); }
      catch(e) {
        processResult={started_at:new Date().toISOString(),ended_at:new Date().toISOString(),exit_code:null,
          signal:null,timed_out:false,output_limited:false,spawn_error:e.code||'RUNNER_ERROR',stdout:'',stderr:'',bytes:0};
      }
      const r=processResult;
      let source_unchanged_during_run=false;
      try {source_unchanged_during_run=(await sourceSnapshot(p.root,p.source_files)).digest===source.digest;}catch{}
      const record={schema:'metaphysics.execution-record.v1',run_id,case_id,revision:c.revision,task_id,
        method:t.method,attempt,entrypoint:p.entrypoint,source_digest:source.digest,dependency_digest:digest(source.files),
        input_digest,method_input_digest:digest(t.method_inputs),frozen_case_digest:frozenDigest(c),
        output_digest:null,raw_output_digest:sha256(r.stdout),stderr_digest:sha256(r.stderr),
        output_ref:null,exit_code:r.exit_code,signal:r.signal,timed_out:r.timed_out,output_limited:r.output_limited,
        started_at:r.started_at,ended_at:r.ended_at,retry_reason,
        environment:{node:process.versions.node,icu:process.versions.icu||null,tz:process.versions.tz||null,
          platform:process.platform,arch:process.arch,rule_profile:p.rule_profile,native_schema:p.native_schema},
        observation:{level:'local_runner_observed',source:'in-process-controlled-runner',host_tool_ref:null},
        source_unchanged_during_run,
        metrics:{input_bytes:Buffer.byteLength(canonical(input)),output_bytes:r.bytes,source_files:p.source_files.length,
          elapsed_ms:Date.parse(r.ended_at)-Date.parse(r.started_at)},validation:{status:'pending',errors:[]}};
      if(r.exit_code!==0||r.timed_out||r.output_limited||r.spawn_error) {
        record.validation={status:'execution_failed',errors:[r.spawn_error|| (r.timed_out?'TIMEOUT':r.output_limited?'OUTPUT_LIMIT':'NONZERO_EXIT')]};
        this.#store.record(record);this.#store.transitionTask(case_id,task_id,'execution_failed');
        throw new ProtocolError('EXECUTION_FAILED','Native process failed',{run_id,errors:record.validation.errors});
      }
      if(!source_unchanged_during_run) {
        record.validation={status:'validation_failed',errors:['SOURCE_CHANGED_DURING_RUN']};
        this.#store.record(record);this.#store.transitionTask(case_id,task_id,'validation_failed');
        throw new ProtocolError('SOURCE_CHANGED_DURING_RUN','Sources changed during execution',{run_id});
      }
      // Even a malformed successful stdout cannot be used as permission to change the event.
      this.#store.markCalculated(case_id);
      let payload;
      try {
        payload=parseStrictJson(r.stdout,{maxBytes:p.max_output_bytes});
        checkAdapterReport(await p.validateNative(payload,input),'NATIVE_VALIDATION_FAILED');
        record.output_digest=digest(payload);record.output_ref=`session://native/${run_id}`;
        record.validation={status:'validated',errors:[]};
      } catch(e) {
        record.validation={status:'validation_failed',errors:[e.code||'NATIVE_VALIDATION_FAILED']};
        this.#store.record(record);this.#store.transitionTask(case_id,task_id,'validation_failed');
        throw new ProtocolError('NATIVE_VALIDATION_FAILED','Native output rejected',{run_id,errors:record.validation.errors});
      }
      this.#store.record(record);this.#store.transitionTask(case_id,task_id,'calculated');
      this.#store.transitionTask(case_id,task_id,'validated');
      const result={run_id,case_id,task_id,output_digest:record.output_digest,native_result_ref:record.output_ref,
        execution_ref:`session://runs/${run_id}`,native_payload:payload,source_digest:source.digest,production_ready:p.production_ready===true};
      this.#store.storeResult(case_id,task_id,result);return {...result,reused:false};
    } finally {release();}
  }
  finalize(case_id,task_id,draft,{knowledge_cards=[]}={}) {
    const {c,t}=this.#store.task(case_id,task_id),result=this.#store.result(case_id,task_id);
    need(result,'NOT_EXECUTED');need(this.#store.resultIsCurrent(case_id,task_id,result.output_digest),'STALE_RESULT');
    const record=this.#store.records(case_id).find(r=>r.run_id===result.run_id);
    need(record && record.output_digest===digest(result.native_payload),'OUTPUT_DIGEST_MISMATCH');
    need(record.frozen_case_digest===frozenDigest(c),'CASE_DIGEST_MISMATCH');
    const p=this.#registry.get(t.method);
    need(p.source_digest===record.source_digest,'SOURCE_VERSION_CHANGED');
    const live={};for(const relative of p.source_files){const full=path.resolve(p.root,relative);need(syncFs.realpathSync(full)===full,'SYMLINK_SOURCE');live[relative]=sha256(syncFs.readFileSync(full));}
    need(digest(live)===record.source_digest,'SOURCE_DIGEST_MISMATCH');
    const bundle=finalizeResult({c,t,result,record,profile:p,draft,knowledge_cards,store:this.#store});
    if(this.#store.taskState(case_id,task_id)==='validated')this.#store.transitionTask(case_id,task_id,'interpreted');
    this.#store.rememberInterpretation(case_id,task_id,draft,bundle);
    this.#issued.set(`${case_id}/${task_id}`,digest(bundle));
    return bundle;
  }
  verifyBundle(bundle) {
    try {
      const b=bundle.binding;
      return this.#issued.get(`${b.case_id}/${b.task_id}`)===digest(bundle)
        && this.#store.resultIsCurrent(b.case_id,b.task_id,bundle.validation.payload_digest);
    } catch {return false;}
  }
}
