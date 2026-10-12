import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {claimDue,finishSettlement} from './atomic-research-store.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function verifySettlementEvidence(item, evidence,{now=Date.now(),maxLagMs=300000}={}){
 const target=Date.parse(item.target_at),observed=Date.parse(evidence.observedAt),received=Date.parse(evidence.receivedAt);
 if(![target,observed,received].every(Number.isFinite))throw Error('BAD_TIME');
 if(observed<target||observed>received||received>now+5000||now-received>maxLagMs||observed-target>maxLagMs)throw Error('STALE_OR_PREMATURE');
 if(evidence.independentSource===item.payload?.market?.source)throw Error('SAME_SOURCE');
 if(evidence.instrument!=='BTC-USD'||evidence.marketType!=='spot')throw Error('INSTRUMENT_MISMATCH');
 if(!Number.isFinite(evidence.exitPrice)||evidence.exitPrice<=0)throw Error('BAD_PRICE');
 return {...evidence,evidenceHash:sha(evidence)};
}
export async function fetchIndependentOutcome(item,{fetchImpl=fetch,now=()=>Date.now()}={}){
 // Kraken OHLC is independent from Coinbase source; reject same-source rather than fallback.
 const source=item.payload?.market?.source||'';
 if(source.includes('kraken'))throw Error('INDEPENDENT_VENUE_UNAVAILABLE');
 const res=await fetchImpl('https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1',{signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw Error('PROVIDER_HTTP_'+res.status);
 const body=await res.json();if(body.error?.length)throw Error('PROVIDER_ERROR');
 const key=Object.keys(body.result||{}).find(x=>x!=='last');if(!key)throw Error('NO_CANDLES');
 const target=Date.parse(item.target_at);
 const candle=body.result[key].find(v=>Number(v[0])*1000===Math.floor(target/60000)*60000);
 if(!candle)throw Error('TARGET_CANDLE_MISSING');
 // Use a completed one-minute candle close only; do not claim a point-in-time execution fill.
 const observedAt=new Date((Number(candle[0])+60)*1000).toISOString();
 const evidence={observedAt,receivedAt:new Date(now()).toISOString(),exitPrice:Number(candle[4]),independentSource:'kraken:XBTUSD:1m',instrument:'BTC-USD',marketType:'spot',candleOpenAt:new Date(Number(candle[0])*1000).toISOString(),costKind:'ASSUMED'};
 return verifySettlementEvidence(item,evidence,{now:now()});
}
export async function runWorker({connectionString=process.env.DATABASE_URL,workerId=randomUUID(),pollMs=5000,signal}={}){
 if(!connectionString)throw Error('DATABASE_URL_REQUIRED');
 const client=new pg.Client({connectionString});await client.connect();
 try{
  while(!signal?.aborted){
   const item=await claimDue(client,workerId);
   if(item){
    try{const outcome=await fetchIndependentOutcome(item);await finishSettlement(client,item,workerId,outcome);console.log(JSON.stringify({event:'SETTLED',id:item.prediction_id,workerId}));}
    catch(e){console.error(JSON.stringify({event:'SETTLEMENT_RETRY',id:item.prediction_id,reason:e.message}));}
   }
   await new Promise(resolve=>setTimeout(resolve,pollMs));
  }
 }finally{await client.end()}
}
if(import.meta.url===new URL('file://'+process.argv[1]).href)runWorker().catch(e=>{console.error(e);process.exitCode=1});
