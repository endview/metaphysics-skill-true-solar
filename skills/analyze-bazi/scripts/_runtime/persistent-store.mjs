// SPDX-License-Identifier: AGPL-3.0-only
// Optional authorized local session storage. HMAC detects edits by untrusted imports;
// it is not remote execution attestation and cannot protect against a malicious host.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHmac,randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
import {canonical,need,parseStrictJson} from './common.mjs';
export class AuthorizedStore {
  #dir; #key; #max=64*1024*1024;
  constructor(dir,key){this.#dir=dir;this.#key=key;}
  static async open(directory,{authorized=false,skill_root}={}) {
    need(authorized===true,'STORAGE_AUTHORIZATION_REQUIRED');
    const dir=path.resolve(directory),root=path.resolve(skill_root);
    need(dir!==root&&!dir.startsWith(root+path.sep),'STORE_INSIDE_SKILL');
    await fs.mkdir(dir,{recursive:true,mode:0o700});
    need(await fs.realpath(dir)===dir,'STORE_SYMLINK');
    const st=await fs.stat(dir);need(process.platform==='win32'||(st.mode&0o077)===0,'STORE_PERMISSIONS');
    const kp=path.join(dir,'session.key');
    try {const h=await fs.open(kp,'wx',0o600);try{await h.writeFile(randomBytes(32));await h.sync();}finally{await h.close();}}
    catch(e){if(e.code!=='EEXIST')throw e;}
    const ks=await fs.lstat(kp);need(ks.isFile()&&!ks.isSymbolicLink()&&(process.platform==='win32'||(ks.mode&0o077)===0),'STORE_KEY_PERMISSIONS');
    const key=await fs.readFile(kp);need(key.length===32,'STORE_KEY_LENGTH');return new AuthorizedStore(dir,key);
  }
  #mac(value){return createHmac('sha256',this.#key).update(canonical(value)).digest('hex');}
  async transaction(callback) {
    const lock=path.join(this.#dir,'transaction.lock');
    try{await fs.mkdir(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')need(false,'STORE_BUSY','Another transaction or an unrecovered crash lock exists; do not recast.');throw e;}
    try {
      const state=await this.read();
      const {value,snapshot}=await callback(state);
      if(snapshot)await this.write(snapshot);
      return value;
    } finally {await fs.rmdir(lock);}
  }
  async read() {
    const p=path.join(this.#dir,'session.json');let raw;
    try{const st=await fs.lstat(p);need(!st.isSymbolicLink()&&st.isFile()&&st.size<=this.#max,'STORE_FILE');raw=await fs.readFile(p,'utf8');}
    catch(e){if(e.code==='ENOENT')return null;throw e;}
    const envelope=parseStrictJson(raw,{maxBytes:this.#max});need(envelope.schema==='metaphysics.authenticated-store.v1','STORE_SCHEMA');
    need(typeof envelope.mac==='string'&&/^[0-9a-f]{64}$/.test(envelope.mac),'STORE_AUTHENTICATION');
    const actual=Buffer.from(this.#mac(envelope.snapshot),'hex'),claimed=Buffer.from(envelope.mac,'hex');
    need(timingSafeEqual(actual,claimed),'STORE_AUTHENTICATION');return envelope.snapshot;
  }
  async write(snapshot) {
    const body=canonical({schema:'metaphysics.authenticated-store.v1',snapshot,mac:this.#mac(snapshot)});
    need(Buffer.byteLength(body)<=this.#max,'STORE_SIZE');
    const tmp=path.join(this.#dir,`.state-${randomUUID()}.tmp`),dest=path.join(this.#dir,'session.json');
    try{const h=await fs.open(tmp,'wx',0o600);try{await h.writeFile(body+'\n');await h.sync();}finally{await h.close();}await fs.rename(tmp,dest);}
    finally{await fs.rm(tmp,{force:true});}
  }
  async deleteState({confirm=false}={}) {
    need(confirm,'DELETE_CONFIRMATION_REQUIRED');
    return this.transaction(async()=>{await fs.rm(path.join(this.#dir,'session.json'),{force:true});return {value:{deleted:true,snapshot:null},snapshot:null};});
  }
}
