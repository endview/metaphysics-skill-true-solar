import {spawnSync} from 'node:child_process';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);process.chdir(fileURLToPath(root));
if(process.versions.node!==fs.readFileSync('.node-version','utf8').trim())throw new Error('Use the pinned reproduction runtime');
for(const [command,...args] of [
 [process.execPath,'tooling/verify-complete-baseline.mjs'],[process.execPath,'tooling/sync-runtime.mjs','--check'],
 [process.execPath,'tooling/test-report.mjs'],['python','tooling/check-schemas.py'],['python','tooling/build-skills.py'],
 ['python','tooling/smoke-archives.py'],[process.execPath,'tooling/release-gate.mjs','--local']]){
 const result=spawnSync(command,args,{stdio:'inherit',shell:false,timeout:120000});if(result.status!==0)process.exit(result.status??1);
}
