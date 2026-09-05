import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {sourceSnapshot} from '../runtime-src/execution.mjs';import {need} from '../runtime-src/common.mjs';
const expected='456100131d7f0492df9ac1d515d614d37515f9da';
try{
  need(process.argv.length===3,'USAGE','node tooling/verify-baseline.mjs /path/to/original-repository');
  const root=path.resolve(process.argv[2]);
  function git(args){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:10000,maxBuffer:1048576});need(r.status===0,'GIT_UNAVAILABLE',r.stderr||'Git command failed');return r.stdout;}
  const commit=git(['rev-parse','HEAD']).trim();need(commit===expected,'BASELINE_MISMATCH');
  need(git(['status','--porcelain']).trim()==='','DIRTY_BASELINE');
  const files=git(['ls-files','-z']).split('\0').filter(Boolean);
  for(const skill of ['metaphysics','analyze-bazi','analyze-ziwei','cast-meihua'])need(files.includes(`skills/${skill}/SKILL.md`),'MISSING_SKILL');
  need(files.includes('LICENSE'),'MISSING_ORIGINAL_LICENSE');
  const snapshot=await sourceSnapshot(root,files);
  console.log(JSON.stringify({status:'source_identity_checked',commit,source_digest:snapshot.digest,files:snapshot.files,
    original_audit_reproduced:false,native_adapters_verified:false,profile_activation_allowed:false},null,2));
}catch(e){console.error(JSON.stringify({status:'blocked',code:e.code||'BASELINE_UNAVAILABLE',message:e.message}));process.exitCode=2;}
