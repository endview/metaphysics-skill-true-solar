import fs from 'node:fs/promises';import path from 'node:path';import {sha256,digest} from '../runtime-src/common.mjs';
export async function sourceManifest(root){
  const files={};
  async function walk(relative){
    const abs=path.join(root,relative),stat=await fs.lstat(abs);
    if(stat.isSymbolicLink())throw new Error('Symlink in development source manifest');
    if(stat.isDirectory()){for(const name of (await fs.readdir(abs)).sort())await walk(path.join(relative,name));}
    else files[relative.replaceAll(path.sep,'/')]=sha256(await fs.readFile(abs));
  }
  for(const rel of ['runtime-src','tests','tooling','skills','upstream','upstream-snapshot','docs','.github','package.json','.node-version','LICENSE','NOTICE.md','README.md','CHANGELOG.md','GITHUB_UPLOAD_GUIDE.md','requirements-dev.txt','.gitignore','.gitattributes'])await walk(rel);
  return {files,digest:digest(files)};
}
