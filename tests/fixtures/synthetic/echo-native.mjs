// Synthetic protocol fixture only. This is NOT an astrology calculator.
let raw='';for await (const chunk of process.stdin)raw+=chunk;
const input=JSON.parse(raw);
if(input.mode==='sleep')await new Promise(r=>setTimeout(r,3000));
if(input.mode==='fail')process.exit(7);
if(input.mode==='large'){process.stdout.write('x'.repeat(100000));process.exit(0);}
if(input.mode==='duplicate'){process.stdout.write('{"schema":"synthetic.echo.v1","data":1,"data":2}');process.exit(0);}
if(input.mode==='broken'){process.stdout.write('{broken');process.exit(0);}
if(input.delay_ms)await new Promise(r=>setTimeout(r,input.delay_ms));
process.stdout.write(JSON.stringify({schema:'synthetic.echo.v1',data:{value:input.value,
  input_echo:input,env_secret:process.env.METAPHYSICS_TEST_SECRET||null},
  untrusted_source_claim:input.forge_grade||null}));
