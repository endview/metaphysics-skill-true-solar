// Local implementation validation is not model/host production acceptance.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {sourceManifest} from './source-manifest.mjs';import {sha256} from '../runtime-src/common.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),localOnly=process.argv.includes('--local'),source=(await sourceManifest(root)).digest;
const read=async name=>{try{return JSON.parse(await fs.readFile(path.join(root,'reports',name),'utf8'));}catch{return null;}};
const tests=await read('test-report.json'),schemas=await read('schema-check.json'),packages=await read('skill-package-checks.json'),build=await read('build-report.json'),smoke=await read('zip-smoke.json'),behavior=await read('behavior-matrix.json');
const checks={tests:tests?.exit_code===0&&tests.counts.tests>0&&tests.counts.fail===0&&tests.source_manifest.digest===source&&tests.source_unchanged_during_run,
 schemas:schemas?.status==='passed'&&schemas.source_digest===source,
 four_packages:packages?.source_digest===source&&Object.keys(packages.packages||{}).length===4,
 four_zips:smoke?.source_digest===source&&build?.source_digest===source&&Object.keys(smoke.packages||{}).length===4,
 baseline:false};
if(checks.four_zips){for(const [name,info] of Object.entries(build.packages)){try{const actual=sha256(await fs.readFile(path.join(root,info.archive)));if(actual!==info.sha256||actual!==smoke.packages[name]?.zip_sha256||!smoke.packages[name]?.package_unmodified)checks.four_zips=false;}catch{checks.four_zips=false;}}}
const baseline=spawnSync(process.execPath,['tooling/verify-complete-baseline.mjs'],{cwd:root,encoding:'utf8',timeout:20000});checks.baseline=baseline.status===0;
const localPassed=Object.values(checks).every(Boolean),modelPassed=behavior?.source_digest===source&&behavior.status==='executed'&&behavior.production_accepted===true&&behavior.rows?.length>=16;
const blockers=[...Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>'LOCAL_'+k.toUpperCase()+'_FAILED_OR_STALE'),...(!modelPassed?['REAL_HOST_MODEL_BEHAVIOR_MATRIX_NOT_ACCEPTED']:[])];
const report={schema:'metaphysics.release-gate.v1',version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,source_digest:source,local_implementation_accepted:localPassed,production_accepted:localPassed&&modelPassed,
 candidate_execution_profile:'method-v5',global_profile_activated:false,checks,test_counts:tests?.counts||null,blockers,
 historical_audit:{original_468_reproduced:false,warning:'The original audit source/report was not retrieved. Current tests have their own source, fixtures, commands and source-bound results; they do not claim to reproduce that historical artifact.'},
 external_solar_converter:'not_configured_fail_closed',cross_platform_and_product_installation:'not_certified_by_this_local_gate',model_matrix_status:behavior?.status||'not_run'};
await fs.writeFile(path.join(root,'reports/release-gate.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=(localOnly?localPassed:report.production_accepted)?0:1;
