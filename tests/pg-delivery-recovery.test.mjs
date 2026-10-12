import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';
import pg from 'pg';import {randomUUID} from 'node:crypto';
const run=(args)=>new Promise(resolve=>{
 const c=spawn(process.execPath,['tests/pg-delivery-child.mjs',...args],{env:process.env});
 let stdout='',stderr='';c.stdout.on('data',x=>stdout+=x);c.stderr.on('data',x=>stderr+=x);
 c.on('exit',(code,signal)=>resolve({code,signal,stdout,stderr}));
});
test('SIGKILL after provider commit recovers PG receipt without resending',{skip:!process.env.OWL_TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.OWL_TEST_DATABASE_URL});
 const id='OWL-CI-'+randomUUID(),dir=mkdtempSync(path.join(tmpdir(),'owl-fault-')),ledger=path.join(dir,'provider.json');
 try{
  await pool.query(`INSERT INTO public.owl_market_report_delivery(report_id,window_start,window_end,recipient,state,attempts,payload)
 VALUES($1,now()-interval '4 hours',now(),'test@example.invalid','PENDING',0,'{"test":true}'::jsonb)`,[id]);
  const killed=await run([id,ledger,'worker-A','kill']);
  assert.equal(killed.signal,'SIGKILL');
  assert.equal(existsSync(ledger),true);
  let row=(await pool.query('SELECT state,provider_message_id FROM public.owl_market_report_delivery WHERE report_id=$1',[id])).rows[0];
  assert.equal(row.state,'SENDING');assert.equal(row.provider_message_id,null);
  const recovered=await run([id,ledger,'worker-B','normal']);
  assert.equal(recovered.code,0,recovered.stderr);
  const replay=await run([id,ledger,'worker-C','normal']);
  assert.equal(replay.code,0,replay.stderr);
  row=(await pool.query('SELECT state,attempts,provider_message_id FROM public.owl_market_report_delivery WHERE report_id=$1',[id])).rows[0];
  assert.equal(row.state,'SENT');assert.equal(row.attempts,1);
  assert.equal(row.provider_message_id,JSON.parse(readFileSync(ledger,'utf8')).id);
  assert.equal(JSON.parse(recovered.stdout).recovered,true);
  assert.equal(JSON.parse(replay.stdout).reused,true);
 }finally{await pool.query('DELETE FROM public.owl_market_report_delivery WHERE report_id=$1',[id]);await pool.end();rmSync(dir,{recursive:true,force:true})}
});
