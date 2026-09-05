import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {digest,sha256} from '../runtime-src/common.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),check=process.argv.includes('--check');
const shared=['common','case','time-context','execution','validate','native-utils'];
const modules={metaphysics:[...shared,'route-v5','local-route-host'],...Object.fromEntries(['analyze-bazi','cast-meihua','analyze-ziwei'].map(x=>[x,[...shared,'session-host','knowledge','persistent-store','time-adapter']]))};
for(const [skill,names] of Object.entries(modules)){
 const dir=path.join(root,'skills',skill),dest=path.join(dir,'scripts/_runtime');await fs.mkdir(dest,{recursive:true});
 const sources=names.map(n=>['runtime-src/'+n+'.mjs','scripts/_runtime/'+n+'.mjs']);
 for(const name of await fs.readdir(path.join(root,'runtime-src/schema')))sources.push(['runtime-src/schema/'+name,'assets/schema/'+name]);
 for(const [from,to] of sources){const bytes=await fs.readFile(path.join(root,from)),target=path.join(dir,to);await fs.mkdir(path.dirname(target),{recursive:true});if(check){if(!bytes.equals(await fs.readFile(target)))throw new Error('Generated runtime/schema drift: '+skill+'/'+to);}else await fs.writeFile(target,bytes);}
 const files={};async function walk(rel){const st=await fs.lstat(path.join(dir,rel));if(st.isSymbolicLink())throw new Error('Symlink: '+rel);if(st.isDirectory()){for(const name of (await fs.readdir(path.join(dir,rel))).sort())await walk(path.posix.join(rel,name));}else if(rel!=='scripts/source-lock.json')files[rel]=sha256(await fs.readFile(path.join(dir,rel)));}
 for(const rel of ['SKILL.md','agents','scripts','references','assets','LICENSE','NOTICE.md'])await walk(rel);
 try{await fs.access(path.join(dir,'knowledge'));await walk('knowledge');}catch(e){if(e.code!=='ENOENT')throw e;}
 const lock={schema:'metaphysics.package-source-lock.v1',baseline_commit:'456100131d7f0492df9ac1d515d614d37515f9da',files},target=path.join(dir,'scripts/source-lock.json');
 if(check){if(digest(JSON.parse(await fs.readFile(target,'utf8')))!==digest(lock))throw new Error('Source-lock drift: '+skill);}else await fs.writeFile(target,JSON.stringify(lock,null,2)+'\n');
}
console.log(check?'All four generated runtimes, schemas and source locks verified':'All four runtimes, schemas and source locks synchronized');
