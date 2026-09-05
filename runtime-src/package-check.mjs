// SPDX-License-Identifier: AGPL-3.0-only
import fs from 'node:fs/promises';
import path from 'node:path';
import {need,sha256} from './common.mjs';

const forbidden=/(^|\/)(?:tests?|fixtures?|logs?|reports?|node_modules|\.git|\.cache|__pycache__|user-data|case-data)(\/|$)|(?:\.log|\.pyc)$/i;
const permitted=rel=>/^(?:(?:SKILL\.md|LICENSE(?:\.[A-Za-z0-9]+)?|NOTICE(?:\.[A-Za-z0-9]+)?)$|(?:agents|references|scripts|assets|knowledge)\/)/.test(rel);
export async function checkSkillPackage(root,allowlist){
  const base=path.resolve(root);need(await fs.realpath(base)===base,'PACKAGE_SYMLINK');
  need(Array.isArray(allowlist)&&allowlist.length>0&&new Set(allowlist).size===allowlist.length,'PACKAGE_ALLOWLIST');
  need(allowlist.includes('SKILL.md')&&allowlist.includes('agents/openai.yaml'),'PACKAGE_ENTRYPOINT_REQUIRED');
  const actual=[];
  async function walk(dir,prefix=''){
    for(const entry of await fs.readdir(dir,{withFileTypes:true})){
      const rel=prefix+entry.name,abs=path.join(dir,entry.name);
      need(!entry.isSymbolicLink(),'PACKAGE_SYMLINK',rel);
      if(entry.isDirectory())await walk(abs,rel+'/');else {need(entry.isFile(),'PACKAGE_SPECIAL_FILE');actual.push(rel);}
    }
  }
  await walk(base);
  need(actual.length===allowlist.length&&actual.every(f=>allowlist.includes(f)),'PACKAGE_UNLISTED_FILE');
  let bytes=0;const hashes={};
  for(const rel of allowlist){
    need(!path.isAbsolute(rel)&&!rel.split(/[\\/]/).includes('..')&&!rel.includes('\\'),'PACKAGE_PATH');
    need(permitted(rel)&&!forbidden.test(rel),'PACKAGE_FORBIDDEN_FILE',rel);
    const data=await fs.readFile(path.join(base,rel));bytes+=data.length;hashes[rel]=sha256(data);
    if(/\.(?:md|ya?ml|json|[cm]?js|txt)$/.test(rel)){
      need(!/\.\.\/[a-z-]*?(?:analyze-bazi|analyze-ziwei|cast-meihua|metaphysics)\//.test(data.toString('utf8')),'PACKAGE_SIBLING_DEPENDENCY');
      need(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(data.toString('utf8')),'PACKAGE_SECRET_PATTERN');
    }
  }
  // Conservative preflight. This is not a complete personal-data or secret detector.
  need(bytes<=25*1024*1024,'PACKAGE_TOO_LARGE');
  return {status:'structurally_checked',file_count:actual.length,uncompressed_bytes:bytes,files:hashes,
    privacy_review:'manual_review_still_required',native_integration:'not_checked'};
}
