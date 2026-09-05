import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {checkSkillPackage} from '../../runtime-src/package-check.mjs';
async function fixture(fn){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'synthetic-package-'));
  try{await fs.mkdir(path.join(dir,'agents'));await fs.writeFile(path.join(dir,'SKILL.md'),'---\nname: synthetic\ndescription: Synthetic packaging test only\n---\n');
    await fs.writeFile(path.join(dir,'agents/openai.yaml'),'interface:\n  display_name: Synthetic\n');await fn(dir,['SKILL.md','agents/openai.yaml']);
  }finally{await fs.rm(dir,{recursive:true,force:true});}}
test('clean synthetic package passes structural allowlist checks',()=>fixture(async(dir,list)=>assert.equal((await checkSkillPackage(dir,list)).file_count,2)));
test('unlisted file blocks packaging',()=>fixture(async(dir,list)=>{await fs.writeFile(path.join(dir,'extra.txt'),'x');await assert.rejects(checkSkillPackage(dir,list),e=>e.code==='PACKAGE_UNLISTED_FILE');}));
test('test fixtures cannot enter a skill runtime package',()=>fixture(async(dir,list)=>{await fs.mkdir(path.join(dir,'tests'));await fs.writeFile(path.join(dir,'tests/test.txt'),'synthetic');await assert.rejects(checkSkillPackage(dir,[...list,'tests/test.txt']),e=>e.code==='PACKAGE_FORBIDDEN_FILE');}));
test('runtime logs cannot enter a package',()=>fixture(async(dir,list)=>{await fs.mkdir(path.join(dir,'scripts'));await fs.writeFile(path.join(dir,'scripts/run.log'),'synthetic');await assert.rejects(checkSkillPackage(dir,[...list,'scripts/run.log']),e=>e.code==='PACKAGE_FORBIDDEN_FILE');}));
test('external symlink blocks packaging',()=>fixture(async(dir,list)=>{await fs.symlink(os.tmpdir(),path.join(dir,'external'),process.platform==='win32'?'junction':'dir');await assert.rejects(checkSkillPackage(dir,[...list,'external']),e=>e.code==='PACKAGE_SYMLINK');}));
test('sibling-skill dependency blocks packaging',()=>fixture(async(dir,list)=>{await fs.mkdir(path.join(dir,'scripts'));await fs.writeFile(path.join(dir,'scripts/x.mjs'),"import '../analyze-ziwei/runtime.mjs';");await assert.rejects(checkSkillPackage(dir,[...list,'scripts/x.mjs']),e=>e.code==='PACKAGE_SIBLING_DEPENDENCY');}));
test('private key marker blocks packaging',()=>fixture(async(dir,list)=>{await fs.mkdir(path.join(dir,'scripts'));await fs.writeFile(path.join(dir,'scripts/x.mjs'),'-----BEGIN PRIVATE KEY-----');await assert.rejects(checkSkillPackage(dir,[...list,'scripts/x.mjs']),e=>e.code==='PACKAGE_SECRET_PATTERN');}));
test('duplicate allowlist entries rejected',()=>fixture(async(dir,list)=>{await assert.rejects(checkSkillPackage(dir,[...list,'SKILL.md']),e=>e.code==='PACKAGE_ALLOWLIST');}));
test('no fake claim of complete privacy audit',()=>fixture(async(dir,list)=>{const r=await checkSkillPackage(dir,list);assert.equal(r.privacy_review,'manual_review_still_required');assert.equal(r.native_integration,'not_checked');}));
