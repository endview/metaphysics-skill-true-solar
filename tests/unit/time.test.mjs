import test from 'node:test';import assert from 'node:assert/strict';
import {parseInstant,resolveWallTime,normalizeTimeContext,normalizeWindow,durationWindow,validateSolarProvenance} from '../../runtime-src/time-context.mjs';
import {window} from '../fixtures/synthetic/helpers.mjs';
const code=(fn,c)=>assert.throws(fn,e=>e.code===c);
test('explicit historical time is not overwritten by current clock',()=>{
  let calls=0;const r=normalizeTimeContext({source_kind:'user_specified',source_ref:'synthetic:history',
    raw_input:'2025-01-02T18:11+08:00',timezone:'Asia/Taipei'},()=>{calls++;return new Date('2030-01-01Z');});
  assert.equal(calls,0);assert.equal(r.instant,'2025-01-02T10:11:00.000Z');assert.equal(r.input_precision,'minute');
});
test('host current clock is read once and attributed to host',()=>{
  let calls=0;const r=normalizeTimeContext({source_kind:'host_clock',source_ref:'synthetic:clock',raw_input:'now',timezone:'UTC'},
    ()=>{calls++;return new Date('2024-01-01T00:00:00.123Z');});
  assert.equal(calls,1);assert.equal(r.source_kind,'host_clock');assert.equal(r.instant,'2024-01-01T00:00:00.123Z');
});
test('minute input is not upgraded to seconds',()=>code(()=>normalizeTimeContext({source_kind:'user_specified',source_ref:'synthetic',
  raw_input:'2024-01-01T00:00Z',timezone:'UTC',input_precision:'second'}),'FALSE_PRECISION'));
for(const label of ['2023-02-29T00:00Z','2024-02-30T00:00Z','2024-13-01T00:00Z','2024-01-01T24:00Z','2024-01-01T01:60Z'])
  test(`invalid date/time rejected: ${label}`,()=>code(()=>parseInstant(label,'UTC'),'INVALID_DATE'));
test('valid leap day accepted',()=>assert.equal(parseInstant('2024-02-29T00:00Z','UTC').instant,'2024-02-29T00:00:00.000Z'));
test('offset timezone mismatch rejected',()=>code(()=>parseInstant('2024-01-01T08:00Z','Asia/Taipei'),'OFFSET_ZONE_CONFLICT'));
test('invalid numeric offset rejected',()=>code(()=>parseInstant('2024-01-01T08:00+00:90','UTC'),'INVALID_OFFSET'));
test('offset alone does not imply an IANA timezone',()=>assert.throws(()=>parseInstant('2024-01-01T08:00+08:00',undefined)));
test('DST gap is nonexistent, not silently corrected',()=>assert.equal(resolveWallTime('2024-03-10T02:30','America/New_York').resolution_status,'nonexistent'));
test('DST fold preserves both candidates',()=>{
  const r=resolveWallTime('2024-11-03T01:30','America/New_York');assert.equal(r.resolution_status,'ambiguous');
  assert.deepEqual(r.candidates,['2024-11-03T05:30:00.000Z','2024-11-03T06:30:00.000Z']);
});
test('explicit offset selects a valid fold occurrence',()=>assert.equal(parseInstant('2024-11-03T01:30-05:00','America/New_York').instant,'2024-11-03T06:30:00.000Z'));
test('calendar day and 24 hours differ across DST',()=>{
  const common={start:'2024-03-09T12:00-05:00',timezone:'America/New_York',days:1,source_ref:'synthetic'};
  const a=normalizeWindow(durationWindow({...common,mode:'calendar_days'})),b=normalizeWindow(durationWindow({...common,mode:'fixed_24h'}));
  assert.equal(Date.parse(a.end)-Date.parse(a.start),23*3600000);assert.equal(Date.parse(b.end)-Date.parse(b.start),24*3600000);
});
for(const days of [0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])test(`invalid duration ${days}`,()=>code(()=>durationWindow({days}),'INVALID_DURATION'));
test('zero observation interval rejected',()=>code(()=>normalizeWindow({...window(),end:window().start}),'NONPOSITIVE_WINDOW'));
test('reversed interval rejected',()=>code(()=>normalizeWindow({...window(),end:'2023-12-31T00:00Z'}),'NONPOSITIVE_WINDOW'));
test('unresolved free-text end is not invented',()=>code(()=>normalizeWindow({...window(),kind:'open',raw_input:'until the reply arrives'}),'UNRESOLVED_WINDOW'));
test('missing boundary inclusivity is rejected',()=>code(()=>normalizeWindow({...window(),include_end:undefined}),'BOUNDARY_FLAGS_REQUIRED'));
test('solar clock labels are not civil instants',()=>code(()=>normalizeTimeContext({source_kind:'user_specified',source_ref:'synthetic',
  raw_input:'2024-01-01T10:00+08:00',timezone:'Asia/Taipei',time_basis:'true_solar'}),'SOLAR_REQUIRES_SEPARATE_PROVENANCE'));
test('user-declared true solar source stays user-declared',()=>assert.equal(validateSolarProvenance({level:'user_declared',source_ref:'synthetic'}).level,'user_declared'));
test('tool claim lacking metadata rejected',()=>assert.throws(()=>validateSolarProvenance({level:'tool_verified',source_ref:'synthetic'})));
test('complete tool claim is still pending a reviewed adapter',()=>assert.equal(validateSolarProvenance({level:'tool_verified',source_ref:'synthetic',
  converter:'synthetic',converter_version:'1',review_ref:'synthetic',parameters_digest:'synthetic',output_ref:'synthetic'}).resolution_status,'requires_reviewed_adapter'));
