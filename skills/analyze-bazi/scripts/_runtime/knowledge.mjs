// SPDX-License-Identifier: AGPL-3.0-only
// Select from packaged, source-locked cards. Uploaded JSON cannot register a trusted card.
import fs from 'node:fs/promises';import path from 'node:path';
import {clone,need,pointer,parseStrictJson,digest} from './common.mjs';
function matches(card,payload){try{return card.prerequisites.every(r=>r.op==='exists'?(pointer(payload,r.pointer),true):r.op==='equals'&&digest(pointer(payload,r.pointer))===digest(r.value));}catch{return false;}}
function expand(card,values){return JSON.parse(JSON.stringify(card).replace(/\{(chart|group|palace|layer)\}/g,(all,k)=>{need(Object.hasOwn(values,k),'KNOWLEDGE_SELECTOR');return values[k];}));}
function walk(value,fn){if(value&&typeof value==='object'){fn(value);for(const child of Object.values(value))walk(child,fn);}}
export async function selectKnowledge(profile,payload,c,{domain=null,max_cards=24}={}) {
  need(Number.isInteger(max_cards)&&max_cards>0&&max_cards<=128,'KNOWLEDGE_LIMIT');
  const data=parseStrictJson(await fs.readFile(path.join(profile.root,'knowledge/cards.json'),'utf8'),{maxBytes:1048576});
  need(data.schema==='metaphysics.knowledge-cards.v1','KNOWLEDGE_SCHEMA');const selected=[];
  for(const original of data.cards) {
    if(original.method!==profile.method_id||!original.scopes.includes(c.analysis_scope))continue;
    const candidates=[];
    if(profile.method_id==='bazi') {
      for(const chart of Object.keys(payload.checks_by_chart)){const card=expand(original,{chart});if(Object.keys(payload.checks_by_chart).length>1)card.card_id+='.'+chart;candidates.push(card);}
    } else if(profile.method_id==='meihua') {
      if(original.selector?.kind==='trigram' && ![payload.result.primary.upper.number,payload.result.primary.lower.number].includes(original.selector.number))continue;
      candidates.push(clone(original));
    } else {
      const layer={annual_cycle:'yearly',multi_year_stage:'decadal'}[c.analysis_scope]||'origin';
      payload.candidates.groups.forEach((g,group)=>{
        const selector=original.selector;
        if(selector.kind==='star') g.facts.origin.palaces.forEach((p,palace)=>{
          let present=false;walk(p.stars,x=>{if(x.name===selector.name)present=true;});
          if(present){const card=expand(original,{group,palace,layer});card.card_id+=`.g${group}.p${palace}`;
            card.prerequisites.push({op:'equals',pointer:`/candidates/groups/${group}/chart_hash`,value:g.chart_hash});
            candidates.push(card);}
        });
        else if(selector.kind==='domain'&&(!domain||selector.domain===domain)) {
          const card=expand(original,{group,layer});card.card_id+=`.g${group}.${layer}`;candidates.push(card);
        } else if(selector.kind==='transformation') {
          let present=false;walk(g.facts[layer],x=>{if(x.label===selector.name||x.name===selector.name)present=true;});
          if(present){const card=expand(original,{group,layer});card.card_id+=`.g${group}.${layer}`;candidates.push(card);}
        }
      });
    }
    for(const card of candidates)if(matches(card,payload))selected.push(card);
  }
  // Never silently trim away candidate groups; the caller chooses narrower fact references instead.
  return {cards:selected,scope:c.analysis_scope,card_count:selected.length,read_count:1,
    suggested_context_limit:max_cards,requires_pagination:selected.length>max_cards,review_scope:'source_and_contract_only'};
}
