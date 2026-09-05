import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';

const manifestUrl = new URL('../vendor/iztro/manifest.json', import.meta.url);
export const vendorManifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));

if (vendorManifest.package !== 'iztro' || vendorManifest.version !== '2.5.8') {
  throw new Error('Unexpected iztro vendor manifest identity');
}

const encoded = vendorManifest.artifact.packaged.chunks.map((chunk) => {
  if (!/^iztro\.min\.js\.gz\.b64\.part-\d{2}\.txt$/.test(chunk.path)) {
    throw new Error('Unexpected iztro vendor chunk path');
  }
  const bytes = readFileSync(new URL(`../vendor/iztro/${chunk.path}`, import.meta.url));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== chunk.bytes || digest !== chunk.sha256) {
    throw new Error(`Vendored iztro chunk failed integrity verification: ${chunk.path}`);
  }
  return bytes.toString('ascii');
}).join('');
const compressed = Buffer.from(encoded, 'base64');
if (compressed.toString('base64') !== encoded) throw new Error('Vendored iztro base64 encoding is not canonical');
const compressedDigest = createHash('sha256').update(compressed).digest('hex');
if (compressed.length !== vendorManifest.artifact.packaged.gzip_bytes || compressedDigest !== vendorManifest.artifact.packaged.gzip_sha256) {
  throw new Error('Vendored iztro package failed integrity verification');
}
const artifact = gunzipSync(compressed);
const digest = createHash('sha256').update(artifact).digest('hex');
if (digest !== vendorManifest.artifact.sha256 || artifact.length !== vendorManifest.artifact.bytes) {
  throw new Error('Vendored iztro artifact failed integrity verification');
}
const source = artifact.toString('utf8');

const compiled = new vm.Script(source, { filename: 'iztro-2.5.8.min.js' });

export function loadIsolatedIztro() {
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    self: {},
    console: Object.freeze({ debug() {}, error() {}, info() {}, log() {}, warn() {} })
  };
  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
    name: 'iztro-isolated-candidate'
  });
  compiled.runInContext(context, { timeout: 10000 });
  const api = module.exports;
  if (!api || typeof api.astro?.withOptions !== 'function') {
    throw new Error('Vendored iztro UMD did not expose the expected API');
  }
  return api;
}
