import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {checkSkillPackage} from '../runtime-src/package-check.mjs';import {sourceManifest} from './source-manifest.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),allow=JSON.parse(await fs.readFile(path.join(root,'tooling/package-allowlist.json'),'utf8')),reports={};
for(const [name,list] of Object.entries(allow)){
 const dir=path.join(root,'skills',name),report=await checkSkillPackage(dir,list);
 for(const file of list){
  if(file.endsWith('.json'))JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));
  if(file.endsWith('.mjs')){const run=spawnSync(process.execPath,['--check',path.join(dir,file)],{encoding:'utf8'});if(run.status!==0)throw new Error('Syntax error: '+name+'/'+file+'\n'+run.stderr);}
  if(file.endsWith('.md'))for(const match of (await fs.readFile(path.join(dir,file),'utf8')).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
   const link=match[1].split('#')[0];if(!link||/^[a-z]+:/i.test(link))continue;const target=path.resolve(dir,path.dirname(file),link);
   if(!target.startsWith(path.resolve(dir)+path.sep))throw new Error('External local Markdown reference: '+file);await fs.access(target);
  }
 }
 reports[name]={...report,allowlist:list,scope:'self-contained candidate runtime; model acceptance is separate'};
}
const output={source_digest:(await sourceManifest(root)).digest,packages:reports};await fs.mkdir(path.join(root,'reports'),{recursive:true});await fs.writeFile(path.join(root,'reports/skill-package-checks.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,{status:v.status,file_count:v.file_count,bytes:v.uncompressed_bytes}])),null,2));
