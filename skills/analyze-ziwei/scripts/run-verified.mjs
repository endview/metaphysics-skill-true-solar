#!/usr/bin/env node
import {serve,cliOptions} from './_runtime/session-host.mjs';
import {createProfile} from './profile.mjs';
try {await serve(await createProfile(),cliOptions(process.argv.slice(2)));}catch(e){process.stderr.write((e.code||'RUNNER_ERROR')+'\n');process.exitCode=2;}
