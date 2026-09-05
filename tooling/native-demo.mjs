// Synthetic only. No real person's data or event is used.
import fs from 'node:fs/promises';
import {ReviewSession} from '../runtime-src/session-host.mjs';
import {createProfile as bazi} from '../skills/analyze-bazi/scripts/profile.mjs';
import {createProfile as meihua} from '../skills/cast-meihua/scripts/profile.mjs';
import {reviewInput} from '../tests/fixtures/synthetic/native-inputs.mjs';
const out={scope:'synthetic native integration demonstration, not a real consultation',results:{}};
for(const [method,create] of [['bazi',bazi],['meihua',meihua]]) {
  const session=new ReviewSession(await create());out.results[method]=await session.review(reviewInput(method));
}
await fs.writeFile(new URL('../reports/native-demo.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.results).map(([k,r])=>[k,{
  schema:r.bundle.child_result.schema_version,method:r.bundle.child_result.method_id,
  run_id:r.execution_record.run_id,exit_code:r.execution_record.exit_code,
  evidence:r.execution_record.observation.level,metrics:r.execution_record.metrics,accepted_scope:r.accepted_scope}])),null,2));
