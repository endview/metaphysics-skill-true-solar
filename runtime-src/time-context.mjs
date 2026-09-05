// SPDX-License-Identifier: AGPL-3.0-only
import { need, text, clone, digest } from './common.mjs';

const precisions = ['minute', 'second', 'millisecond'];
function utcOf(p) {
  const d = new Date(0); d.setUTCFullYear(p[0], p[1] - 1, p[2]);
  d.setUTCHours(p[3] || 0, p[4] || 0, p[5] || 0, p[6] || 0); return d.getTime();
}
function checkParts(p) {
  need(p[0] >= 1 && p[0] <= 9999, 'INVALID_DATE');
  const d = new Date(utcOf(p));
  need([d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate(), d.getUTCHours(),
    d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()].every((v,j) => v === (p[j] || 0)), 'INVALID_DATE');
}
export function zoneFormatter(zone) {
  text(zone, 'timezone', 128);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit',
      day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23', calendar:'gregory' });
  } catch { need(false, 'INVALID_TIMEZONE'); }
}
export function zonedParts(instant, zone) {
  const p = Object.fromEntries(zoneFormatter(zone).formatToParts(new Date(instant)).map(x => [x.type,x.value]));
  return ['year','month','day','hour','minute','second'].map(k => Number(p[k]));
}
export function parseLocal(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  need(m, 'INVALID_LOCAL_TIME');
  const p = [Number(m[1]),Number(m[2]),Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0),Number((m[7]||'').padEnd(3,'0'))];
  checkParts(p); return { parts:p, precision:m[7]?'millisecond':m[6]?'second':'minute' };
}
export function parseInstant(value, zone) {
  text(value, 'datetime', 64);
  const m = /^(.*?)(Z|[+-]\d{2}:\d{2})$/.exec(value); need(m, 'OFFSET_REQUIRED');
  const {parts:p, precision} = parseLocal(m[1]);
  const off = m[2] === 'Z' ? 0 : (m[2][0] === '-'?-1:1) * (Number(m[2].slice(1,3))*60 + Number(m[2].slice(4,6)));
  need(m[2] === 'Z' || (Number(m[2].slice(4,6))<60 && Math.abs(off)<=840), 'INVALID_OFFSET');
  const instant = utcOf(p) - off*60000;
  need(zonedParts(instant,zone).every((v,j)=>v===p[j]), 'OFFSET_ZONE_CONFLICT');
  return { instant:new Date(instant).toISOString(), input_precision:precision, local_parts:p, timezone:zone };
}
// Resolve a wall clock label without selecting one side of a DST fold.
export function resolveWallTime(value, zone) {
  const {parts:p} = parseLocal(value); zoneFormatter(zone);
  const naive = utcOf(p), offsets = new Set();
  for (let h=-48; h<=48; h+=6) {
    const t=naive+h*3600000; offsets.add(utcOf(zonedParts(t,zone))-Math.floor(t/1000)*1000);
  }
  const candidates = [...offsets].map(o=>naive-o)
    .filter(t=>zonedParts(t,zone).every((v,j)=>v===p[j])).sort((a,b)=>a-b);
  return { resolution_status:candidates.length===1?'resolved':candidates.length===0?'nonexistent':'ambiguous',
    candidates:candidates.map(t=>new Date(t).toISOString()), timezone:zone, raw_input:value };
}
export function normalizeTimeContext(request, clock = () => new Date()) {
  need(['user_specified','host_clock','imported'].includes(request.source_kind), 'TIME_SOURCE_REQUIRED');
  text(request.source_ref,'source_ref');
  // True solar labels are NOT IANA civil timestamps. Use the separate provenance interface.
  need((request.time_basis || 'civil') === 'civil', 'SOLAR_REQUIRES_SEPARATE_PROVENANCE');
  let parsed;
  if (request.source_kind === 'host_clock') {
    need(request.raw_input === 'now', 'CLOCK_REQUEST_REQUIRED');
    zoneFormatter(request.timezone);
    const d=clock(); need(d instanceof Date && Number.isFinite(d.getTime()), 'INVALID_CLOCK');
    parsed={instant:d.toISOString(),input_precision:'millisecond',timezone:request.timezone};
  } else parsed=parseInstant(request.raw_input, request.timezone);
  const precision=request.input_precision || parsed.input_precision;
  need(precisions.includes(precision) && precisions.indexOf(precision)<=precisions.indexOf(parsed.input_precision), 'FALSE_PRECISION');
  return { schema:'metaphysics.time-context.v1', source_kind:request.source_kind,
    raw_input:request.raw_input, instant:parsed.instant, timezone:request.timezone,
    input_precision:precision, time_basis:'civil', resolution_status:'resolved', source_ref:request.source_ref };
}
export function normalizeWindow(window) {
  need(window && typeof window === 'object', 'WINDOW_REQUIRED');
  text(window.raw_input,'window.raw_input'); text(window.source_ref,'window.source_ref');
  if (window.kind === 'cycle') {
    for (const k of ['cycle_id','calendar_basis','boundary_profile','precision']) text(window[k],`window.${k}`,128);
    need(['year','decade','natal'].includes(window.precision), 'INVALID_WINDOW_PRECISION');
    return {kind:'cycle',raw_input:window.raw_input,source_ref:window.source_ref,cycle_id:window.cycle_id,
      calendar_basis:window.calendar_basis,boundary_profile:window.boundary_profile,precision:window.precision};
  }
  need(window.kind === 'interval', 'UNRESOLVED_WINDOW');
  const start=parseInstant(window.start,window.timezone), end=parseInstant(window.end,window.timezone);
  need(Date.parse(end.instant)>Date.parse(start.instant), 'NONPOSITIVE_WINDOW');
  need(typeof window.include_start==='boolean' && typeof window.include_end==='boolean', 'BOUNDARY_FLAGS_REQUIRED');
  text(window.calendar_basis,'calendar_basis',128); text(window.boundary_profile,'boundary_profile',128);
  return {kind:'interval',raw_input:window.raw_input,source_ref:window.source_ref,start:start.instant,end:end.instant,
    timezone:window.timezone,include_start:window.include_start,include_end:window.include_end,
    calendar_basis:window.calendar_basis,boundary_profile:window.boundary_profile};
}
export function windowKey(window) {
  const w=normalizeWindow(window), semantic=clone(w); delete semantic.raw_input; delete semantic.source_ref;
  return digest(semantic);
}
export function durationWindow({start,timezone,days,mode,source_ref}) {
  need(Number.isSafeInteger(days) && days>0 && days<=36525,'INVALID_DURATION');
  need(['fixed_24h','calendar_days'].includes(mode),'DURATION_MODE_REQUIRED');
  const p=parseInstant(start,timezone); let end;
  if (mode==='fixed_24h') end=new Date(Date.parse(p.instant)+days*86400000).toISOString();
  else {
    const local=p.local_parts, d=new Date(utcOf(local)); d.setUTCDate(d.getUTCDate()+days);
    const label=d.toISOString().slice(0,23), r=resolveWallTime(label,timezone);
    need(r.resolution_status==='resolved','DURATION_DST_AMBIGUITY'); end=r.candidates[0];
  }
  return {kind:'interval',raw_input:`${days} days (${mode})`,source_ref,start,
    end:formatZonedInstant(end,timezone),timezone,include_start:true,include_end:false,
    calendar_basis:'gregorian',boundary_profile:mode};
}
export function formatZonedInstant(instant, zone) {
  const t=Date.parse(instant); need(Number.isFinite(t),'INVALID_DATE');
  const p=zonedParts(t,zone), ms=new Date(t).getUTCMilliseconds();
  const delta=(utcOf(p)-Math.floor(t/1000)*1000)/60000;
  need(Number.isInteger(delta),'SUBMINUTE_OFFSET_UNSUPPORTED');
  const pad=(n,w=2)=>String(n).padStart(w,'0');
  const offset=delta===0?'Z':`${delta<0?'-':'+'}${pad(Math.floor(Math.abs(delta)/60))}:${pad(Math.abs(delta)%60)}`;
  return `${pad(p[0],4)}-${pad(p[1])}-${pad(p[2])}T${pad(p[3])}:${pad(p[4])}:${pad(p[5])}.${pad(ms,3)}${offset}`;
}
export const freezeWindow = normalizeWindow;
export function validateSolarProvenance(value) {
  need(['unknown','user_declared','tool_verified'].includes(value?.level),'SOLAR_SOURCE_REQUIRED');
  if (value.level==='unknown') return {resolution_status:'unresolved',level:'unknown'};
  text(value.source_ref,'solar.source_ref');
  if (value.level==='tool_verified') {
    for (const k of ['converter','converter_version','review_ref','parameters_digest','output_ref']) text(value[k],`solar.${k}`);
    // This interface checks completeness only. No tool authenticity upgrade occurs here.
    return {resolution_status:'requires_reviewed_adapter',level:'tool_verified',provenance:clone(value)};
  }
  return {resolution_status:'user_declared',level:'user_declared',provenance:clone(value)};
}
