// Synthetic demonstration only. No Bazi, Zi Wei, or Meihua calculator is invoked.
import {setup,draftFor} from '../tests/fixtures/synthetic/helpers.mjs';
import {RouteSession} from '../runtime-src/route.mjs';
const s=await setup(),computed=await s.runner.compute(s.c.case_id,s.t.task_id);
const bundle=s.runner.finalize(s.c.case_id,s.t.task_id,draftFor(s.c,s.t));
const route=new RouteSession(s.runner).compose(s.c.case_id,[bundle]);
console.log(JSON.stringify({demonstration:'synthetic_only',fact_block:bundle.fact_block,
  observed_run:s.store.records(s.c.case_id)[0],bundle,route,
  repeat_start_reuses_run:(await s.runner.compute(s.c.case_id,s.t.task_id)).run_id===computed.run_id},null,2));
