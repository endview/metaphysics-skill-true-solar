import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectBazi,tenGodFor,parsePillar} from '../../skills/analyze-bazi/scripts/inspect_bazi.mjs';
import {castMeihua} from '../../skills/cast-meihua/scripts/cast_meihua.mjs';
import golden from '../fixtures/synthetic/native-golden.json' with {type:'json'};

function options(extra={}) {return {method:'numbers-v2',numbers:'1,2,3',question:'Synthetic structural audit only',
  horizon:'Synthetic bounded 30-day interval','timing-unit':'days','timing-profile':'stage-within-horizon-v1',
  'time-basis':'civil',datetime:'2024-06-01T12:00:00+08:00',timezone:'Asia/Taipei',...extra};}
const map=(n,d)=>1+(n-1)%d;
for(const [path,sha] of Object.entries(golden.original_blobs)) test(`untouched upstream blob: ${path}`,()=>{
  const b=fs.readFileSync(new URL('../../'+path,import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),sha);
});
for(let a=1;a<=8;a++)for(let b=1;b<=8;b++)for(let moving=1;moving<=6;moving++)
  test(`meihua structure u${a}-l${b}-m${moving}`,()=>{
    const o=castMeihua(options({numbers:`${a},${b},${moving}`})),r=o.result;
    const bits=golden.trigram_bits[b-1]+golden.trigram_bits[a-1];
    assert.equal(o.schema,'cast-meihua/result-v2');assert.equal(r.primary.binaryBottomUp,bits);
    assert.equal(r.primary.upper.number,a);assert.equal(r.primary.lower.number,b);
    assert.equal(r.movingLine.position,moving);
    assert.equal(r.changed.binaryBottomUp,[...bits].map((v,i)=>i===moving-1?String(1-Number(v)):v).join(''));
    assert.equal(r.mutual.binaryBottomUp,bits.slice(1,4)+bits.slice(2,5));
    assert.equal(r.opposite.binaryBottomUp,[...bits].map(v=>String(1-Number(v))).join(''));
    assert.equal(r.reversed.binaryBottomUp,[...bits].reverse().join(''));
    assert.equal(r.bodyUse.body.location,moving<=3?'upper':'lower');
    assert.equal(r.bodyUse.use.location,moving<=3?'lower':'upper');
    assert.equal(r.primary.linesBottomUp.filter(l=>l.moving).length,1);
    assert.equal(r.primary.linesBottomUp[moving-1].value,Number(bits[moving-1]));
    assert.equal(r.bodyUse.body.trigram.number,moving<=3?a:b);
    assert.equal(r.bodyUse.use.trigram.number,moving<=3?b:a);
    if(a===b) assert.equal(r.primary.name,golden.pure_names[a-1]);
  });
for(let hour=0;hour<24;hour++)for(const minute of [0,59])test(`meihua civil hour boundary ${hour}:${minute}`,()=>{
  const o=castMeihua(options({method:'lunar-time-v2',numbers:undefined,
    datetime:`2024-06-01T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+08:00`}));
  const raw=o.calculation.rawValues;
  assert.equal(raw.hourBranchIndex,golden.hour_branch_index[hour]);
  assert.equal(raw.hourBranchName,golden.branches[golden.hour_branch_index[hour]-1]);
  assert.equal(raw.calendarWallDate,'2024-06-01');assert.equal(raw.calendarCarrier,'2024-06-01T12:00:00.000Z');
  assert.equal(raw.selectedLocalDateTime,o.case.castTime.civil.localDateTime);
});
for(let i=0;i<10;i++)for(let j=0;j<10;j++)test(`bazi ten-god ${i}/${j}`,()=>{
  assert.equal(tenGodFor(golden.stems[i],golden.ten_god_targets[i][j]),golden.ten_god_order[j]);
});
for(let i=0;i<10;i++)for(let j=0;j<12;j++)test(`bazi pillar parity ${i}/${j}`,()=>{
  const p=golden.stems[i]+golden.branches[j];
  if(i%2===j%2)assert.equal(parsePillar(p).value,p);else assert.throws(()=>parsePillar(p));
});
test('bazi optional layers retain explicit source labels',()=>{
  const out=inspectBazi({pillars:golden.pillars,dayun:golden.pillars[0],liunian:golden.pillars[1]});
  assert.equal(out.schemaVersion,'1.0.0');assert.equal(out.pillars.length,6);
  assert.equal(out.input.dayun,golden.pillars[0]);assert.equal(out.input.liunian,golden.pillars[1]);
  assert.ok(out.relationships.repeatedBranches.length>0);
});
test('hidden metal is retained rather than described as absent',()=>{
  const out=inspectBazi({pillars:golden.hidden_metal_pillars});
  assert.equal(out.pillars[3].earthlyBranch.hiddenStems[2].symbol,golden.stems[6]);
});
for(const bad of ['0,1','-1,2','1.5,2','123','1,2,3,4','1e2,3',`9007199254740991,1`,'9007199254740992,1,2'])
  test(`meihua rejects malformed numbers ${bad}`,()=>assert.throws(()=>castMeihua(options({numbers:bad}))));
test('two and three numbers use their declared moving-line formula',()=>{
  const a=castMeihua(options({numbers:'8,8'})),b=castMeihua(options({numbers:'8,8,6'}));
  assert.equal(a.result.movingLine.position,4);assert.equal(b.result.movingLine.position,6);
  assert.equal(b.calculation.remainderMapping.moving.rawRemainder,0);
  assert.equal(b.calculation.remainderMapping.moving.zeroRuleApplied,true);
});
for(const datetime of ['2023-02-29T12:00:00+08:00','2024-06-01T24:00:00+08:00','2024-06-01T12:00:60+08:00',
  '2024-06-01T12:00:00Z','2024-06-01T12:00+08:00'])test(`native rejects invalid datetime ${datetime}`,()=>{
  assert.throws(()=>castMeihua(options({datetime})));
});
test('true-solar labels are continuous wall clocks, not invented instants',()=>{
  const o=castMeihua(options({datetime:undefined,'time-basis':'true_solar',
    'civil-datetime':'2024-03-10T03:30:00-04:00','true-solar-local-datetime':'2024-03-10T02:30:00',
    timezone:'America/New_York',location:'Synthetic location label',longitude:'-74',
    'conversion-source':'synthetic supplied conversion, NOT independently verified'}));
  assert.equal(o.case.castTime.conversion.performedByScript,false);
  assert.equal(o.case.castTime.conversion.wallClockShiftSeconds,-3600);
  assert.equal(Object.hasOwn(o.case.castTime.resolvedTrueSolar,'instant'),false);
});
test('legacy native accepts nonempty free-text horizon; wrapper must add semantic validation',()=>{
  const o=castMeihua(options({horizon:'0 days'}));assert.equal(o.case.observationHorizon,'0 days');
});
