// SPDX-License-Identifier: AGPL-3.0-only
import tables from './reference-tables.json' with {type:'json'};
import {fileURLToPath} from 'node:url';
import {clone,digest,need,text} from './_runtime/common.mjs';
import {formatZonedInstant,parseInstant,parseLocal} from './_runtime/time-context.mjs';
import {exactKeys,verifyPackageSources,onlyCalculationDraft,projectStandardClaims,buildStandardChild,validateStandardChild} from './_runtime/native-utils.mjs';
export const RULE_PROFILE='meihua-calculation-review-v1-candidate';
function prepare(input,c) {
  exactKeys(input,['native_method','numbers','number_grouping_confirmed','timing_profile','time_basis','solar']);
  need(['calculation_review','symbolic_event'].includes(c.analysis_scope),'INTERPRETATION_NOT_IMPLEMENTED');
  need(['numbers-v2','lunar-time-v2'].includes(input.native_method),'METHOD_NOT_SUPPORTED');
  need(c.window.kind==='interval','BOUNDED_INTERVAL_REQUIRED');
  const time=c.time_context;
  need(time?.schema==='metaphysics.time-context.v1'&&time.resolution_status==='resolved'&&time.time_basis==='civil','CIVIL_SOURCE_REQUIRED');
  const normalized=parseInstant(time.instant,'UTC');text(time.source_ref,'time source');
  need(['user_specified','host_clock','imported'].includes(time.source_kind),'TIME_SOURCE_REQUIRED');
  const civil=formatZonedInstant(normalized.instant,time.timezone);
  const timing=input.timing_profile;
  need(timing && ['stage-within-horizon-v1','moving-line-count-v1'].includes(timing.profile),'TIMING_PROFILE_REQUIRED');
  need(['minutes','hours','days','weeks','months','years','events'].includes(timing.unit),'TIMING_UNIT_REQUIRED');
  if(timing.profile==='moving-line-count-v1') {
    need(['minutes','hours','days','weeks'].includes(timing.unit),'COUNT_UNIT_UNSUPPORTED');
    need(Date.parse(c.window.start)===Date.parse(time.instant),'COUNT_ANCHOR_MISMATCH');
  }
  const options={method:input.native_method,question:c.question,horizon:c.window.raw_input,
    'timing-unit':timing.unit,'timing-profile':timing.profile,'time-basis':input.time_basis,timezone:time.timezone};
  if(input.native_method==='numbers-v2') {
    need(input.number_grouping_confirmed===true,'NUMBER_GROUPING_NOT_CONFIRMED');
    need(Array.isArray(input.numbers)&&[2,3].includes(input.numbers.length),'NUMBER_COUNT');
    need(input.numbers.every(x=>Number.isSafeInteger(x)&&x>0),'NUMBER_RANGE');
    if(input.numbers.length===2)need(Number.isSafeInteger(input.numbers[0]+input.numbers[1]),'NUMBER_SUM_OVERFLOW');
    options.numbers=input.numbers.join(',');
  } else need(input.numbers==null&&input.number_grouping_confirmed==null,'UNUSED_NUMBER_INPUT');
  if(input.time_basis==='civil') {
    need(input.solar==null,'UNUSED_SOLAR_INPUT');options.datetime=civil;
  } else {
    need(input.time_basis==='true_solar','TIME_BASIS_REQUIRED');
    const solar=input.solar;exactKeys(solar,['verification_status','local_datetime','source_ref','location','longitude']);
    need(solar.verification_status==='user_declared','UNREVIEWED_SOLAR_ADAPTER');
    need(parseLocal(solar.local_datetime).precision==='second','SOLAR_SECOND_LABEL_REQUIRED');
    text(solar.source_ref,'solar source');text(solar.location,'solar location');
    need(Number.isFinite(solar.longitude)&&Math.abs(solar.longitude)<=180,'INVALID_LONGITUDE');
    Object.assign(options,{'civil-datetime':civil,'true-solar-local-datetime':solar.local_datetime,
      location:solar.location,longitude:String(solar.longitude),'conversion-source':solar.source_ref});
  }
  return {options,time_origin:clone(time),solar_origin:clone(input.solar??null)};
}
export function validateMeihuaNative(payload,input) {
  try {
    const options=input.options,o=payload;
    need(o.schema==='cast-meihua/result-v2'&&o.protocol.id===options.method,'MEIHUA_NATIVE_SCHEMA');
    need(o.case.question===options.question&&o.case.observationHorizon===options.horizon,'NATIVE_INPUT_ECHO');
    need(o.case.timingUnit===options['timing-unit']&&o.case.timingProfile===options['timing-profile'],'TIMING_PROFILE_CHANGED');
    const time=o.case.castTime;
    need(time.timeBasis===options['time-basis']&&time.civil.source==='specified'&&time.civil.timeZone===options.timezone,'TIME_SOURCE_CHANGED');
    const supplied=options.datetime||options['civil-datetime'];
    need(time.civil.requestedDateTime===supplied&&time.civil.instant===new Date(supplied).toISOString(),'TIME_INPUT_ECHO');
    if(time.timeBasis==='civil')need(time.resolvedTrueSolar===null&&time.location===null&&time.conversion===null,'TIME_UNION');
    else need(time.resolvedTrueSolar.localDateTime===options['true-solar-local-datetime'] &&
      !Object.hasOwn(time.resolvedTrueSolar,'instant') && time.conversion.performedByScript===false &&
      time.conversion.source===options['conversion-source'],'SOLAR_SOURCE_CHANGED');
    const raw=o.calculation.rawValues;
    need(raw.selectedTimeBasis===time.timeBasis && raw.selectedLocalDateTime===
      (time.timeBasis==='civil'?time.civil.localDateTime:time.resolvedTrueSolar.localDateTime),'TIME_INPUT_ECHO');
    if(options.method==='numbers-v2')need(digest(raw.numbers)===digest(options.numbers.split(',').map(Number)),'NUMBERS_CHANGED');
    else {
      need(raw.calendarWallDate===raw.selectedLocalDateTime.slice(0,10),'CALENDAR_DATE_CHANGED');
      need(raw.calendarCarrier===raw.calendarWallDate+'T12:00:00.000Z','INVALID_CALENDAR_CARRIER');
      need(raw.hourBranchIndex===Math.floor(((Number(raw.selectedLocalDateTime.slice(11,13))+1)%24)/2)+1,'HOUR_BRANCH_MAPPING');
      need(Number.isInteger(raw.hourBranchIndex)&&raw.hourBranchIndex>=1&&raw.hourBranchIndex<=12,'HOUR_BRANCH_RANGE');
    }
    const r=o.result;
    for(const key of ['primary','changed','mutual','opposite','reversed']) {
      const h=r[key];
      const upper=tables.trigrams.find(t=>t.number===h.upper.number),lower=tables.trigrams.find(t=>t.number===h.lower.number);
      need(upper&&lower,'TRIGRAM_NUMBER');
      need(h.name===tables.hexagrams[upper.name][lower.name],'HEXAGRAM_NAME_MAPPING');
      for(const [record,expected] of [[h.upper,upper],[h.lower,lower]]){need(record.name===expected.name&&record.element===expected.element&&record.linesBottomUp.join('')===expected.lines.join(''),'TRIGRAM_MAPPING');}
      need(typeof h.name==='string'&&h.name.length>0&&/^[01]{6}$/.test(h.binaryBottomUp),'HEXAGRAM_STRUCTURE');
      need(h.linesBottomUp.length===6&&h.linesBottomUp.every((x,i)=>x.position===i+1&&String(x.value)===h.binaryBottomUp[i]),'HEXAGRAM_LINE_ECHO');
      need(h.lower.linesBottomUp.join('')+h.upper.linesBottomUp.join('')===h.binaryBottomUp,'TRIGRAM_LINE_ECHO');
    }
    const bits=r.primary.binaryBottomUp,m=r.movingLine.position;
    need(Number.isInteger(m)&&m>=1&&m<=6,'MOVING_LINE_RANGE');
    need(r.changed.binaryBottomUp===[...bits].map((v,i)=>i===m-1?String(1-Number(v)):v).join(''),'CHANGED_HEXAGRAM');
    need(r.mutual.binaryBottomUp===bits.slice(1,4)+bits.slice(2,5),'MUTUAL_HEXAGRAM');
    need(r.opposite.binaryBottomUp===[...bits].map(v=>String(1-Number(v))).join(''),'OPPOSITE_HEXAGRAM');
    need(r.reversed.binaryBottomUp===[...bits].reverse().join(''),'REVERSED_HEXAGRAM');
    need(r.bodyUse.body.location===(m<=3?'upper':'lower')&&r.bodyUse.use.location===(m<=3?'lower':'upper'),'BODY_USE_LOCATION');
    const body=r.primary[r.bodyUse.body.location],use=r.primary[r.bodyUse.use.location];
    need(digest(r.bodyUse.body.trigram)===digest(body)&&digest(r.bodyUse.use.trigram)===digest(use),'BODY_USE_TRIGRAM');
    const generate={'\u6728':'\u706b','\u706b':'\u571f','\u571f':'\u91d1','\u91d1':'\u6c34','\u6c34':'\u6728'};
    const control={'\u6728':'\u571f','\u571f':'\u6c34','\u6c34':'\u706b','\u706b':'\u91d1','\u91d1':'\u6728'};
    const relation=body.element===use.element?'\u6bd4\u548c':generate[body.element]===use.element?'\u4f53\u751f\u7528':generate[use.element]===body.element?'\u7528\u751f\u4f53':control[body.element]===use.element?'\u4f53\u514b\u7528':'\u7528\u514b\u4f53';
    need(r.bodyUse.fiveElementRelation.code===relation&&r.bodyUse.fiveElementRelation.bodyElement===body.element&&r.bodyUse.fiveElementRelation.useElement===use.element,'BODY_USE_RELATION');
    need(r.movingLine.originalValue===Number(bits[m-1])&&r.movingLine.changedValue===1-Number(bits[m-1]),'MOVING_LINE_POLARITY');
    const mapping=o.calculation.remainderMapping;
    need(mapping.upper.divisor===8&&mapping.lower.divisor===8&&mapping.moving.divisor===6,'REMAINDER_DIVISORS');
    need(r.primary.upper.number===mapping.upper.mappedValue&&r.primary.lower.number===mapping.lower.mappedValue&&m===mapping.moving.mappedValue,'REMAINDER_BINDING');
    for(const [name,mappingValue] of Object.entries(mapping)){need(mappingValue.rawRemainder===mappingValue.sourceValue%mappingValue.divisor&&mappingValue.mappedValue===(mappingValue.rawRemainder||mappingValue.divisor)&&mappingValue.zeroRuleApplied===(mappingValue.rawRemainder===0),'REMAINDER_ARITHMETIC');}
    if(options.method==='numbers-v2'){const nums=raw.numbers;need(mapping.upper.sourceValue===nums[0]&&mapping.lower.sourceValue===nums[1]&&mapping.moving.sourceValue===(nums.length===2?nums[0]+nums[1]:nums[2]),'NUMBER_SOURCE_MAPPING');}
    if(options.method==='lunar-time-v2'){const upper=raw.yearBranchIndex+raw.lunarMonth+raw.lunarDay,lower=upper+raw.hourBranchIndex;need(mapping.upper.sourceValue===upper&&mapping.lower.sourceValue===lower&&mapping.moving.sourceValue===lower,'LUNAR_SOURCE_MAPPING');}
    need(typeof o.runtime.node==='string'&&Object.hasOwn(o.runtime,'icu'),'RUNTIME_EVIDENCE_MISSING');return [];
  }catch(e){return [e.code||e.message];}
}
export function meihuaFacts() {
  return [
    ['method','\u534f\u8bae','/protocol/id'],['time_basis','\u65f6\u95f4\u53e3\u5f84','/case/castTime/timeBasis'],
    ['civil_time','\u6c11\u7528\u65f6','/case/castTime/civil'],['solar_time','\u771f\u592a\u9633\u949f\u9762','/case/castTime/resolvedTrueSolar'],
    ['timing','\u5e94\u671f\u89c4\u5219','/case/timingProfile'],['raw_values','\u539f\u59cb\u503c','/calculation/rawValues'],
    ['intermediate','\u4e2d\u95f4\u503c','/calculation/intermediateValues'],['remainders','\u4f59\u6570\u6620\u5c04','/calculation/remainderMapping'],
    ['primary','\u672c\u5366','/result/primary/name'],['lines','\u516d\u723b\uff08\u81ea\u4e0b\u800c\u4e0a\uff09','/result/primary/binaryBottomUp'],
    ['moving','\u52a8\u723b','/result/movingLine'],['changed','\u53d8\u5366','/result/changed/name'],
    ['mutual','\u4e92\u5366','/result/mutual/name'],['opposite','\u9519\u5366','/result/opposite/name'],['reversed','\u7efc\u5366','/result/reversed/name'],
    ['body_use','\u4f53\u7528','/result/bodyUse'],['runtime','\u8fd0\u884c\u73af\u5883','/runtime'],['limits','\u8fb9\u754c','/boundary']
  ].map(([fact_id,label,pointer])=>({fact_id,label,pointer}));
}
export async function createProfile(root=new URL('../',import.meta.url)) {
  const source=await verifyPackageSources(root,'scripts/cast_meihua.mjs','e347d800ef542ec467675be7355773bec86af435');
  return {method_id:'meihua',rule_profile:RULE_PROFILE,root:fileURLToPath(root),entrypoint:'scripts/native-bridge.mjs',
    source_files:source.files,source_digest:source.digest,native_schema:'cast-meihua/result-v2',child_schema:'metaphysics.standard-child.v1',
    production_ready:false,timeout_ms:5000,max_output_bytes:1048576,
    preflight:(input,c)=>{try{prepare(input,c);return [];}catch(e){return [e.code||e.message];}},prepareInput:prepare,
    validateNative:validateMeihuaNative,factDefinitions:meihuaFacts,validateDraft:({draft,c,t,payload})=>{
      if(['structural_review','calculation_review'].includes(c.analysis_scope)) return onlyCalculationDraft({draft,c});
      
      need(draft.status!=='ok'||draft.claims.some(x=>x.nature==='traditional_interpretation'),'INTERPRETATION_REQUIRED');
    },projectClaims:projectStandardClaims,
    buildChild:args=>buildStandardChild({...args,uncertainty:['The native specified time may originate from a frozen host clock; consult the case time context.'],
      limitations:['Traditional interpretations are conditional symbolic readings, not hidden-fact detection or empirical probabilities. This local host does not attest independent model contexts.']}),
    validateChild:child=>validateStandardChild(child,'meihua')};
}
