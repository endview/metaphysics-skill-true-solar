#!/usr/bin/env node
import {RouterV5} from './_runtime/route-v5.mjs';
import {LocalRouteHost} from './_runtime/local-route-host.mjs';
import {parseStrictJson,need} from './_runtime/common.mjs';
const roots={};const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
  need(args[i]==='--method-root'&&['bazi','ziwei','meihua'].includes(args[i+1])&&args[i+2],'ROUTER_CLI');
  const method=args[++i];need(!roots[method],'DUPLICATE_METHOD_ROOT');roots[method]=args[++i];
}
const host=new LocalRouteHost(roots),router=new RouterV5(host);let buffer='';
async function handle(line){if(!line.trim())return;try{
  const request=parseStrictJson(line),result=request.op==='capabilities'?host.capabilities():request.op==='plan'?router.plan(request.input):request.op==='run'?await router.run(request.input):request.op==='supply_input'?router.supplyInput(request.route_id,request.method,request.input):request.op==='resume'?await router.resume(request.route_id):request.op==='branch_context'?router.branchContext(request.route_id,request.method):request.op==='finalize_branch'?await router.finalizeBranch(request.route_id,request.method,request.draft):need(false,'ROUTER_OPERATION');
  process.stdout.write(JSON.stringify({schema:'metaphysics.router-response.v1',status:'ok',result})+'\n');
}catch(e){process.stdout.write(JSON.stringify({schema:'metaphysics.router-response.v1',status:'error',code:e.code||'ROUTER_ERROR'})+'\n');}}
try{process.stdin.setEncoding('utf8');for await(const chunk of process.stdin){buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);need(Buffer.byteLength(line)<=1048576,'INPUT_TOO_LARGE');await handle(line);}need(Buffer.byteLength(buffer)<=1048576,'INPUT_TOO_LARGE');}if(buffer)await handle(buffer);}
catch(e){process.stderr.write((e.code||'ROUTER_STREAM_ERROR')+'\n');process.exitCode=2;}
