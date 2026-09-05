import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {sourceManifest} from './source-manifest.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),tests=[];
for(const dir of ['unit','contract','integration','native'])for(const file of await fs.readdir(path.join(root,'tests',dir)))
  if(file.endsWith('.test.mjs'))tests.push(`tests/${dir}/${file}`);
const before=await sourceManifest(root),started_at=new Date().toISOString();
const run=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests.sort()],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:16777216});
const log=(run.stdout||'')+(run.stderr||'');const after=await sourceManifest(root);
const count=key=>{const match=new RegExp(`^# ${key} (\\d+)$`,'m').exec(log);return match?Number(match[1]):null;};
const report={schema:'metaphysics.development-test-report.v1',scope:'four-Skill local implementation: native algorithms, adapters, case/time, fault injection, two-stage routing and isolated CLI; synthetic input only',
  started_at,ended_at:new Date().toISOString(),command:[process.execPath,'--test','--test-reporter=tap',...tests.sort()],
  environment:{node:process.versions.node,icu:process.versions.icu,tz:process.versions.tz,platform:process.platform,arch:process.arch},
  exit_code:run.status,signal:run.signal,error:run.error?.message||null,
  counts:Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(k=>[k,count(k)])),
  source_manifest:after,source_unchanged_during_run:before.digest===after.digest,
  full_original_repository_fetched:true,complete_upstream_skills:['metaphysics','analyze-bazi','analyze-ziwei','cast-meihua'],original_468_reproduced:false,native_astrology_integration_executed:true,
  llm_behavior_matrix_executed:false,isolated_directory_cli_tested:['analyze-bazi','cast-meihua','analyze-ziwei'],router_api_tested:true,chatgpt_skill_installation_tested:false,
  release_accepted:false,observation_level:'local_runner_observed'};
await fs.mkdir(path.join(root,'reports'),{recursive:true});
await fs.writeFile(path.join(root,'reports/test-results.tap'),log);
await fs.writeFile(path.join(root,'reports/test-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,source_unchanged:report.source_unchanged_during_run,exit_code:run.status,release_accepted:false},null,2));
process.exitCode=run.status===0&&report.counts.fail===0&&report.counts.tests>0&&report.source_unchanged_during_run?0:1;
