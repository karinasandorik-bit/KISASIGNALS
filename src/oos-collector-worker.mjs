// Independent Kraken settlement poller: persist only matured, signed future observations.
// Deploy as its own non-trading process with DATABASE_URL and OOS_COLLECTOR_SECRET.
import pg from 'pg';
import {krakenWorldReceipt} from './oos-kraken-collector.mjs';
import {ingestIndependentWorld} from './oos-world-ingest.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function collectorTick({connectionString=process.env.DATABASE_URL,secret=process.env.OOS_COLLECTOR_SECRET,
 fetchImpl=fetch,now=Date.now(),limit=25}={}){
 if(!connectionString||!secret)throw Error('COLLECTOR_CONFIG_REQUIRED');
 const c=new pg.Client({connectionString});await c.connect();
 let rows;try{
  const r=await c.query(`SELECT p.id,p.payload,p.target_at FROM owl_internal.predictions p
   WHERE p.target_at <= $1::timestamptz - interval '1 minute'
   AND NOT EXISTS (SELECT 1 FROM public.evidence_events e WHERE e.event_type='oos_independent_world' AND e.event_id=p.id)
   ORDER BY p.target_at ASC LIMIT $2`,[new Date(now),limit]);rows=r.rows
 }finally{await c.end()}
 const results=[];
 for(const row of rows){
  const p=row.payload,id=row.id,signalAt=p.market?.feature_timestamp??p.ts;
  try{
   const {raw,signature}=await krakenWorldReceipt({predictionId:id,signalAt,predictionSource:p.market?.source,
    symbol:p.market?.symbol??'BTCUSDT',secret,fetchImpl,now});
   const recorded=await ingestIndependentWorld({raw,signature,secret,connectionString,now});
   results.push({id,status:'RECORDED',...recorded});
  }catch(e){results.push({id,status:'EXCLUDED_OR_RETRY',reason:e.message})}
 }
 return {attempted:rows.length,recorded:results.filter(x=>x.status==='RECORDED').length,results};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const once=process.argv.includes('--once'),interval=Math.max(60000,Number(process.env.OOS_COLLECTOR_INTERVAL_MS||300000));
 do{
  try{console.log(JSON.stringify({event:'OOS_COLLECTOR_TICK',at:new Date().toISOString(),...await collectorTick()}))}
  catch(e){console.error(JSON.stringify({event:'OOS_COLLECTOR_FAILED',error:e.message}));if(once)process.exitCode=1}
  if(once)break;await pause(interval);
 }while(true)
}
