// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest=JSON.parse(await fs.readFile(path.join(root,'docs/upstream-observed.json'),'utf8'));
function hash(kind,b){return createHash('sha1').update(`${kind} ${b.length}\0`).update(b).digest();}
async function tree(dir){
  const entries=await fs.readdir(dir,{withFileTypes:true});entries.sort((a,b)=>Buffer.compare(Buffer.from(a.name+(a.isDirectory()?'/':'')),Buffer.from(b.name+(b.isDirectory()?'/':''))));
  const parts=[];for(const e of entries){if(e.isSymbolicLink())throw new Error('Symlink in upstream snapshot');
    const p=path.join(dir,e.name),h=e.isDirectory()?await tree(p):hash('blob',await fs.readFile(p));
    parts.push(Buffer.from(`${e.isDirectory()?'40000':'100644'} ${e.name}\0`),h);}
  return hash('tree',Buffer.concat(parts));
}
for(const [file,info] of Object.entries(manifest.files)){
  const b=await fs.readFile(path.join(root,'upstream-snapshot',file));
  if(hash('blob',b).toString('hex')!==info.git_blob_sha)throw new Error('Upstream source drift: '+file);
}
for(const [skill,sha] of Object.entries(manifest.complete_verified_subtrees)) {
  if((await tree(path.join(root,'upstream-snapshot/skills',skill))).toString('hex')!==sha)throw new Error('Upstream tree mismatch: '+skill);
}
console.log(JSON.stringify({commit:manifest.commit,exact_files:Object.keys(manifest.files).length,
  complete_verified_subtrees:manifest.complete_verified_subtrees,full_repository_acquired:false},null,2));
