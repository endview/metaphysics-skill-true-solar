// SPDX-License-Identifier: AGPL-3.0-only
import {readStdin} from './_runtime/native-utils.mjs';
import {runZiwei} from './engine/run.mjs';
try { const input=await readStdin(); process.stdout.write(JSON.stringify(runZiwei(input))+'\n'); }
catch(e) { process.stderr.write((e.code||'ZIWEI_NATIVE_ERROR')+'\n'); process.exitCode=2; }
