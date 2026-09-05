import { createHash } from 'node:crypto';

function normalize(value, path = '$') {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((item, index) => normalize(item, `${path}/${index}`));
  if (typeof value === 'object') {
    const result = {};
    const normalizedKeys = Object.keys(value).map((key) => [key, key.normalize('NFC')]);
    normalizedKeys.sort((left, right) => left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0);
    for (const [sourceKey, key] of normalizedKeys) {
      if (Object.hasOwn(result, key)) throw new TypeError(`Duplicate normalized key at ${path}/${key}`);
      const item = value[sourceKey];
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') {
        throw new TypeError(`Unsupported value at ${path}/${key}`);
      }
      result[key] = normalize(item, `${path}/${key}`);
    }
    return result;
  }
  throw new TypeError(`Unsupported value at ${path}`);
}

export function canonicalStringify(value) {
  return JSON.stringify(normalize(value));
}

export function sha256Canonical(value) {
  return createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex');
}
