// SPDX-License-Identifier: AGPL-3.0-only
import { createHash, randomUUID } from 'node:crypto';

export class ProtocolError extends Error {
  constructor(code, message, details = {}) {
    super(message); this.name = 'ProtocolError'; this.code = code; this.details = details;
  }
}
export function need(condition, code, message = code, details) {
  if (!condition) throw new ProtocolError(code, message, details);
}
export const id = prefix => `${prefix}_${randomUUID()}`;
export const clone = value => structuredClone(value);
export function text(value, name, max = 4096) {
  need(typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    'INVALID_TEXT', `Invalid ${name}`);
  return value;
}
export function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

// Deliberately restricted JSON: plain data only, finite numbers, no duplicate keys.
export function canonical(value, seen = new Set(), depth = 0) {
  need(depth <= 64, 'JSON_DEPTH');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    need(Number.isFinite(value), 'NONFINITE_NUMBER'); return JSON.stringify(value);
  }
  need(typeof value === 'object' && !seen.has(value), 'NOT_JSON_DATA');
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    need(Object.keys(value).length === value.length && Array.from({length:value.length},(_,i)=>i).every(i=>Object.hasOwn(value,i)), 'SPARSE_OR_EXTENDED_ARRAY');
    result = '[' + value.map(v => canonical(v, seen, depth + 1)).join(',') + ']';
  } else {
    need(plain(value), 'NOT_PLAIN_OBJECT');
    const keys = Object.keys(value).sort();
    need(keys.every(k => !forbidden.has(k)), 'UNSAFE_KEY');
    result = '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(value[k], seen, depth + 1)).join(',') + '}';
  }
  seen.delete(value); return result;
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const digest = value => sha256(canonical(value));
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export function parseStrictJson(source, { maxBytes = 1048576, maxDepth = 64 } = {}) {
  need(typeof source === 'string' && Buffer.byteLength(source) <= maxBytes, 'JSON_SIZE');
  let i = 0;
  const ws = () => { while (i < source.length && /[\x20\t\n\r]/.test(source[i])) i++; };
  function string() {
    need(source[i] === '"', 'JSON_SYNTAX');
    const start = i++;
    while (i < source.length) {
      if (source[i] === '\\') { i += 2; continue; }
      if (source[i++] === '"') {
        try { return JSON.parse(source.slice(start, i)); }
        catch { throw new ProtocolError('JSON_SYNTAX', 'Invalid JSON string'); }
      }
    }
    throw new ProtocolError('JSON_SYNTAX', 'Unterminated string');
  }
  function value(depth) {
    need(depth <= maxDepth, 'JSON_DEPTH'); ws();
    const c = source[i];
    if (c === '{') {
      i++; ws(); const keys = new Set();
      if (source[i] === '}') { i++; return; }
      while (true) {
        ws(); const key = string();
        need(!keys.has(key), 'DUPLICATE_KEY', `Duplicate key: ${key}`);
        need(!forbidden.has(key), 'UNSAFE_KEY'); keys.add(key); ws();
        need(source[i++] === ':', 'JSON_SYNTAX'); value(depth + 1); ws();
        if (source[i] === '}') { i++; return; }
        need(source[i++] === ',', 'JSON_SYNTAX');
      }
    }
    if (c === '[') {
      i++; ws(); if (source[i] === ']') { i++; return; }
      while (true) {
        value(depth + 1); ws(); if (source[i] === ']') { i++; return; }
        need(source[i++] === ',', 'JSON_SYNTAX');
      }
    }
    if (c === '"') { string(); return; }
    const m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(i));
    need(m, 'JSON_SYNTAX'); i += m[0].length;
  }
  value(0); ws(); need(i === source.length, 'JSON_SYNTAX');
  let out;
  try { out = JSON.parse(source); } catch { throw new ProtocolError('JSON_SYNTAX', 'Invalid JSON'); }
  canonical(out); return out;
}

export function pointer(payload, path) {
  need(typeof path === 'string' && path.startsWith('/') && !/~(?:[^01]|$)/.test(path), 'INVALID_POINTER');
  let node = payload;
  for (const part of path.slice(1).split('/')) {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    need(!forbidden.has(key), 'INVALID_POINTER');
    need(node !== null && typeof node === 'object', 'MISSING_BASIS');
    if (Array.isArray(node)) need(/^(0|[1-9]\d*)$/.test(key), 'INVALID_POINTER');
    need(Object.hasOwn(node, key), 'MISSING_BASIS', `Missing ${path}`); node = node[key];
  }
  return node;
}
