import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {atomicFreeze,claimDue,finishSettlement} from '../src/atomic-research-store.mjs';
test('two workers cannot settle one frozen prediction', {skip:!process.env.DATABASE_URL},async()=>{
 const id='fault-'+randomUUID();
 const row={predictionId:id,market:{received_at:new Date(Date.now()-5*3600000).toISOString(),reference_close:100,feature_timestamp:new Date(Date.now()-5*3600000).toISOString(),source:'fixture'},decision:{action:'NO_TRADE'}};
 await atomicFreeze(row);
 const a=new pg.Client({connectionString:process.env.DATABASE_URL});
 const b=new pg.Client({connectionString:process.env.DATABASE_URL});
 await Promise.all([a.connect(),b.connect()]);
 try{
  const [x,y]=await Promise.all([claimDue(a,'worker-A'),claimDue(b,'worker-B')]);
  const claimed=[x,y].filter(z=>z?.prediction_id===id);
  // Other pending jobs may be claimed first; isolated test DB is required.
  assert.equal(claimed.length,1,'exactly one worker must claim target');
  const item=claimed[0];const winner=x?.prediction_id===id?'worker-A':'worker-B';
  await finishSettlement(winner==='worker-A'?a:b,item,winner,{observedAt:new Date().toISOString(),exitPrice:100,independentSource:'test'});
  const q=await a.query('select count(*)::int n from owl_internal.settlements where prediction_id=$1',[id]);
  assert.equal(q.rows[0].n,1);
 }finally{await Promise.all([a.end(),b.end()])}
});
