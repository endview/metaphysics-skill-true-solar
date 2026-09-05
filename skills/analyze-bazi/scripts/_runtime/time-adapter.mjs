// SPDX-License-Identifier: AGPL-3.0-only
import {need,text,clone,digest,plain} from './common.mjs';import {parseLocal,parseInstant} from './time-context.mjs';
export class SolarAdapterRegistry {
  #providers=new Map();#receipts=new Map();
  register(provider) {
    for(const key of ['id','version','license','review_ref'])text(provider[key],key);
    need(provider.reviewed===true&&typeof provider.convert==='function','UNREVIEWED_ADAPTER');
    need(!this.#providers.has(provider.id),'DUPLICATE_PROVIDER');this.#providers.set(provider.id,provider);return this;
  }
  async convert(request) {
    const provider=this.#providers.get(request.provider_id);
    if(!provider)return {schema:'metaphysics.solar-resolution.v1',resolution_status:'unresolved',verification_status:null,
      candidates:[],reason:'No installed reviewed converter; no approximation performed'};
    need(request.authorized===true,'CONVERSION_AUTHORIZATION_REQUIRED');
    parseInstant(request.civil_datetime,request.timezone);need(Number.isFinite(request.longitude)&&Math.abs(request.longitude)<=180,'INVALID_LONGITUDE');
    text(request.longitude_source,'longitude_source');
    const out=await provider.convert(clone(request));
    need(plain(out)&&Object.keys(out).every(k=>['candidates','parameters','limitations'].includes(k)),'CONVERTER_OUTPUT_KEYS');
    need(Array.isArray(out.candidates)&&out.candidates.length>0&&out.candidates.length<=64,'SOLAR_CANDIDATES_REQUIRED');
    const ids=new Set();for(const c of out.candidates){text(c.candidate_id,'candidate_id');need(!ids.has(c.candidate_id),'DUPLICATE_CANDIDATE');ids.add(c.candidate_id);parseLocal(c.local_datetime);text(c.source_ref,'source_ref');}
    need(plain(out.parameters),'CONVERSION_PARAMETERS_REQUIRED');
    need(out.limitations===undefined||Array.isArray(out.limitations)&&out.limitations.every(x=>typeof x==='string'),'CONVERTER_LIMITATIONS');
    const result={schema:'metaphysics.solar-resolution.v1',resolution_status:out.candidates.length>1?'candidate_set':'resolved',verification_status:'tool_verified',
      provider:{id:provider.id,version:provider.version,review_ref:provider.review_ref,license:provider.license},input_digest:digest(request),candidates:clone(out.candidates),parameters:clone(out.parameters),limitations:clone(out.limitations??[])};
    // Never accept verification_status or provider identity from converter output.
    result.verification_status='tool_verified';result.provider={id:provider.id,version:provider.version,review_ref:provider.review_ref,license:provider.license};
    this.#receipts.set(digest(result),provider.id);return result;
  }
  verify(result){return this.#receipts.has(digest(result));}
}
