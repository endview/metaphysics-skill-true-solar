// SPDX-License-Identifier: AGPL-3.0-only
// Calls the unchanged upstream checker. No birth-to-pillars calculation is performed.
import {readStdin} from './_runtime/native-utils.mjs';
import {inspectBazi} from './inspect_bazi.mjs';
try {
  const input=await readStdin();
  const checks=Object.fromEntries((input.candidates??[input]).map(x=>[x.review_chart_id,inspectBazi(x.native_input)]));
  process.stdout.write(JSON.stringify({schema_version:'bazi.provided-review.v1',
    evidence:input.evidence,structure_check:{status:'completed',scope:'fixed_structure_only',grade:'P1'},checks_by_chart:checks})+'\n');
} catch(e) {process.stderr.write(`bazi bridge: ${e.code||e.message}\n`);process.exitCode=2;}
