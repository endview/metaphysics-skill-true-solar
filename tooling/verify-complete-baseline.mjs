import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),lines=(await fs.readFile(path.join(root,'docs/baseline-tree.txt'),'utf8')).trim().split('\n');
let count=0;const originals=[];
for(const line of lines){const m=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(line);if(!m)throw new Error('Unexpected baseline tree row');const [,mode,expected,name]=m;
 const b=await fs.readFile(path.join(root,'upstream/pinned-baseline',name));const hash=createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');if(hash!==expected)throw new Error('Baseline blob mismatch: '+name);count++;originals.push(name);
}
const unchanged=['skills/analyze-bazi/scripts/inspect_bazi.mjs','skills/cast-meihua/scripts/cast_meihua.mjs',...originals.filter(x=>x.startsWith('skills/analyze-ziwei/scripts/vendor/'))];
for(const name of unchanged)if(!(await fs.readFile(path.join(root,name))).equals(await fs.readFile(path.join(root,'upstream/pinned-baseline',name))))throw new Error('Original algorithm/vendor changed: '+name);
console.log(JSON.stringify({commit:'456100131d7f0492df9ac1d515d614d37515f9da',verified_blobs:count,original_algorithms_and_vendor_unchanged:true,original_468_test_source_available:false}));
