// SPDX-License-Identifier: AGPL-3.0-only
import {readStdin} from './_runtime/native-utils.mjs';
import {castMeihua} from './cast_meihua.mjs';
try {
  const input=await readStdin();
  process.stdout.write(JSON.stringify(castMeihua(input.options))+'\n');
} catch(e) {process.stderr.write(`meihua bridge: ${e.code||e.message}\n`);process.exitCode=2;}
