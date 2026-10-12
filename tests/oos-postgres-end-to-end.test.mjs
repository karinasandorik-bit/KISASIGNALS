import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID,createHmac} from 'node:crypto';
import {atomicFreeze} from '../src/atomic-research-store.mjs';
import {ingestIndependentWorld} from '../src/oos-world-ingest.mjs';
import {readOosLedger} from '../src/oos-postgres-reader.mjs';
import {runOosEvaluation} from '../src/oos-evaluator-service.mjs';
const H=3600000;
test('real PostgreSQL: immutable prediction → signed independent_world → read-only evaluation',{skip:!process.env.DATABASE_URL||!process.env.OOS_READONLY_DATABASE_URL},async()=>{
 const now=Date.now(),t=Math.floor((now-7*H)/H)*H,id='oos-e2e-'+randomUUID(),at=n=>new Date(t+n*H).toISOString();
 const p={predictionId:id,ts:at(0),frozenAt:at(0),market:{received_at:at(0),feature_timestamp:at(0),reference_close:100,symbol:'BTCUSDT',source:'OKX'},
 model:{sha256:'fixture-model-sha',calibration_sha256:'fixture-calibration-sha'},
 decision:{action:'LONG'},plan:{side:'LONG',entry:100,stopLoss:98,takeProfit:103}};
 const frozen=await atomicFreeze(p);assert.equal(frozen.inserted,true);
 const bars=[{o:100,h:101,l:99,c:100},{o:100,h:102,l:99,c:101},{o:101,h:102,l:100,c:101},{o:101,h:102,l:100,c:102}].map((x,i)=>({...x,closedAt:at(i+1)}));
 const secret='ci-e2e-secret',world={predictionId:id,signalAt:at(0),observedAt:new Date(now).toISOString(),symbol:'BTCUSDT',independentSource:'Kraken',sourceReceiptId:'ci-fixture-'+id,bars};
 const raw=Buffer.from(JSON.stringify(world)),signature=createHmac('sha256',secret).update(raw).digest('hex');
 const ingest=await ingestIndependentWorld({raw,signature,secret,connectionString:process.env.DATABASE_URL,now});
 assert.equal(ingest.inserted,true);
 const again=await ingestIndependentWorld({raw,signature,secret,connectionString:process.env.DATABASE_URL,now});
 assert.equal(again.inserted,false);
 const reader=new pg.Client({connectionString:process.env.OOS_READONLY_DATABASE_URL});await reader.connect();
 try{
  const privileges=await reader.query("SELECT has_table_privilege(current_user,'owl_internal.predictions','SELECT') AS can_read,has_table_privilege(current_user,'owl_internal.predictions','INSERT') AS can_insert");
  assert.equal(privileges.rows[0].can_read,true);assert.equal(privileges.rows[0].can_insert,false);
 }finally{await reader.end()}
 const read=async()=>{
  const snap=await readOosLedger({limit:10000});
  return {...snap,predictions:snap.predictions.filter(x=>x.id===id),
   worlds:snap.worlds.filter(x=>x.id===id),baselines:snap.baselines.filter(x=>x.id===id)};
 };
 const snapshot=await read();assert.equal(snapshot.predictions.length,1);assert.equal(snapshot.worlds.length,1);assert.equal(snapshot.baselines.length,1);
 const costs={feeEntryBps:4,feeExitBps:4,spreadBps:2,slippageEntryBps:3,slippageExitBps:3,fundingBps:1};
 const report=await runOosEvaluation({read,priceCosts:costs});
 assert.equal(report.nFrozen,1);assert.equal(report.nMatched,0);
 assert.equal(report.excluded[0].reason,'NO_TRUSTED_PROSPECTIVE_FREEZE');
 assert.equal(report.promotionEligible,false);
});
