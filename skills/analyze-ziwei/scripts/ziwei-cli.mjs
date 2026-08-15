#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { canonicalStringify } from './engine/canonical-json.mjs';
import { runZiwei } from './engine/run.mjs';

function usage() {
  return 'Usage: node ziwei-cli.mjs [--input FILE]\nReads one ziwei.input.v2 JSON object using profile ziwei-core-true-solar-v2 from FILE or stdin.\n';
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stderr.write(usage());
    return;
  }
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--input')) {
    throw new Error(`Invalid arguments\n${usage().trimEnd()}`);
  }
  let inputText;
  if (args.length === 2) {
    inputText = await readFile(args[1], 'utf8');
  } else {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) chunks.push(chunk);
    inputText = chunks.join('');
  }
  let input;
  try {
    input = JSON.parse(inputText);
  } catch (error) {
    throw new Error(`Input is not valid JSON: ${error.message}`);
  }
  process.stdout.write(`${canonicalStringify(runZiwei(input))}\n`);
}

main().catch((error) => {
  process.stderr.write(`ziwei-cli: ${error.message}\n`);
  process.exitCode = 1;
});
