import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {AuthorizedStore} from '../../runtime-src/persistent-store.mjs';import {SessionCaseStore} from '../../runtime-src/case.mjs';
import {reviewInput} from '../fixtures/synthetic/native-inputs.mjs';import {ReviewSession} from '../../runtime-src/session-host.mjs';import {createProfile} from '../../skills/cast-meihua/scripts/profile.mjs';
const root=fileURLToPath(new URL('../../skills/cast-meihua/',import.meta.url));
async function temp(f){const d=await fs.mkdtemp(path.join(os.tmpdir(),'metaphysics-persist-'));try{return await f(d);}finally{await fs.rm(d,{recursive:true,force:true});}}
test('Storage requires explicit permission',()=>temp(async d=>{await assert.rejects(AuthorizedStore.open(d,{skill_root:root}),e=>e.code==='STORAGE_AUTHORIZATION_REQUIRED');}));
test('Storage cannot be written into an installed skill',()=>assert.rejects(AuthorizedStore.open(root,{skill_root:root,authorized:true}),e=>e.code==='STORE_INSIDE_SKILL'));
test('HMAC store detects modified content and never accepts an uploaded snapshot as an executed result',()=>temp(async d=>{
 const store=await AuthorizedStore.open(d,{authorized:true,skill_root:root});await store.write({synthetic:true});
 const p=path.join(d,'session.json');const data=JSON.parse(await fs.readFile(p,'utf8'));data.snapshot.synthetic=false;await fs.writeFile(p,JSON.stringify(data));
 await assert.rejects(store.read(),e=>e.code==='STORE_AUTHENTICATION');
}));
test('Atomic lock blocks concurrent transactions',()=>temp(async d=>{
 const store=await AuthorizedStore.open(d,{authorized:true,skill_root:root});await fs.mkdir(path.join(d,'transaction.lock'));
 await assert.rejects(store.transaction(async()=>({snapshot:{},value:null})),e=>e.code==='STORE_BUSY');
}));
test('Failed interpretation can be resumed without a fresh native run',()=>temp(async d=>{
 const p=await createProfile(),s=new ReviewSession(p),r=await s.review(reviewInput('meihua'));
 const storage=await AuthorizedStore.open(d,{authorized:true,skill_root:root});await storage.write(s.exportState());
 const resumed=new ReviewSession(p,{trustedState:await storage.read()});const next=await resumed.review(reviewInput('meihua'));
 assert.equal(next.execution_record.run_id,r.execution_record.run_id);assert.equal(next.reused,true);
}));
test('Two separate CLI processes reuse the authenticated original run',()=>temp(async d=>{
 const input=JSON.stringify({op:'review',input:reviewInput('meihua')});const args=[path.join(root,'scripts/run-verified.mjs'),'--once','--state-dir',d,'--authorize-storage'];
 const first=spawnSync(process.execPath,args,{input,encoding:'utf8',timeout:10000});assert.equal(first.status,0,first.stderr+first.stdout);
 const second=spawnSync(process.execPath,args,{input,encoding:'utf8',timeout:10000});assert.equal(second.status,0,second.stderr+second.stdout);
 const a=JSON.parse(first.stdout).result,b=JSON.parse(second.stdout).result;
 assert.equal(a.execution_record.run_id,b.execution_record.run_id);assert.equal(b.dedup_scope,'authorized_local_store');
}));
test('Changing proposition id cannot evade an event execution ledger',async()=>{
 const s=new ReviewSession(await createProfile()),r=await s.review(reviewInput('meihua')),c=r.case_snapshot;
 assert.throws(()=>s.open({...reviewInput('meihua'),subject_ref:c.subject_ref,event_ref:c.event_ref,proposition_id:'changed-id'}),e=>e.code==='EVENT_ALREADY_CALCULATED');
});
test('Correction creates a linked event while retaining old records',async()=>{
 const s=new ReviewSession(await createProfile()),r=await s.review(reviewInput('meihua'));
 const relation=s.store.relatedCase(r.case_snapshot.case_id,{relationship:'correction_context',reason:'Synthetic input transcription error',evidence_ref:'synthetic:correction'});
 assert.equal(s.store.get(r.case_snapshot.case_id).state,'invalidated');assert.ok(relation.event_ref);assert.equal(s.store.records(r.case_snapshot.case_id).length,1);
});
test('New observation alone does not authorize a new cycle',async()=>{
 const s=new ReviewSession(await createProfile()),r=await s.review(reviewInput('meihua'));s.store.addObservation(r.case_snapshot.case_id,{text:'Synthetic feedback',source_ref:'synthetic:feedback'});
 assert.throws(()=>s.store.relatedCase(r.case_snapshot.case_id,{relationship:'new_cycle',reason:'Synthetic cycle',clock_instant:'2024-06-02T00:00:00Z'}),e=>e.code==='CYCLE_NOT_ENDED');
});
test('Store delete requires confirmation and deletes only the state file',()=>temp(async d=>{
 const s=await AuthorizedStore.open(d,{authorized:true,skill_root:root});await s.write({test:true});await assert.rejects(s.deleteState(),e=>e.code==='DELETE_CONFIRMATION_REQUIRED');await s.deleteState({confirm:true});assert.equal(await s.read(),null);assert.equal((await fs.stat(path.join(d,'session.key'))).size,32);
}));
