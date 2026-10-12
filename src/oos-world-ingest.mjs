// Ingest an externally acquired, signed OHLC receipt after 4h maturity.
// Authentication is not proof of venue independence: provenance is audited separately.
import pg from 'pg';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function ingestIndependentWorld({raw,signature,secret=process.env.OOS_COLLECTOR_SECRET,connectionString=process.env.DATABASE_URL,now=Date.now()}){
 if(!secret||!connectionString)throw Error('COLLECTOR_CONFIG_REQUIRED');
 if(!Buffer.isBuffer(raw))throw Error('RAW_BYTES_REQUIRED');
 const expected=createHmac('sha256',secret).update(raw).digest();
 if(!/^[a-f0-9]{64}$/.test(signature||'')||!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw Error('INVALID_RECEIPT_HMAC');
 const w=JSON.parse(raw.toString('utf8'));
 if(!w.predictionId||!w.independentSource||!w.sourceReceiptId||!w.symbol||!Array.isArray(w.bars)||w.bars.length!==4)throw Error('INCOMPLETE_PROVENANCE');
 const signal=Date.parse(w.signalAt),observed=Date.parse(w.observedAt);
 if(!Number.isFinite(signal)||!Number.isFinite(observed)||observed<signal+4*3600000||observed>now+5000)throw Error('IMPOSSIBLE_OBSERVATION_TIME');
 for(let i=0;i<4;i++){
  const b=w.bars[i],closed=Date.parse(b.closedAt);
  if(closed!==signal+(i+1)*3600000||closed>observed)throw Error('INVALID_BAR_CHRONOLOGY');
  if(![b.o,b.h,b.l,b.c].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)||b.l>Math.min(b.o,b.c)||b.h<Math.max(b.o,b.c))throw Error('INVALID_BAR');
 }
 const c=new pg.Client({connectionString});await c.connect();
 try{
  await c.query('BEGIN');
  const r=await c.query('select payload from owl_internal.predictions where id=$1 for share',[w.predictionId]);
  if(r.rowCount!==1)throw Error('UNKNOWN_PREDICTION');
  const p=r.rows[0].payload;
  if(Date.parse(p.market?.feature_timestamp??p.ts)!==signal)throw Error('SIGNAL_TIME_MISMATCH');
  if((p.market?.symbol??'BTCUSDT')!==w.symbol)throw Error('SYMBOL_MISMATCH');
  if(p.market?.source===w.independentSource)throw Error('SOURCE_NOT_INDEPENDENT');
  const evidence={...w,receiptSha256:hash(raw),authentication:'HMAC_VERIFIED',provenanceStatus:'CLAIMED_NEEDS_SOURCE_AUDIT'};
  const ins=await c.query('SELECT public.oos_insert_world($1,$2,$3::jsonb) AS inserted',[w.predictionId,w.observedAt,JSON.stringify(evidence)]);
  const inserted=ins.rows[0].inserted;
  await c.query('COMMIT');return {id:w.predictionId,inserted,receiptSha256:evidence.receiptSha256};
 }catch(e){await c.query('ROLLBACK');throw e}finally{await c.end()}
}
if(import.meta.url===`file://${process.argv[1]}`){
 const filename=process.argv[2];if(!filename)throw Error('RECEIPT_FILE_REQUIRED');
 const raw=readFileSync(filename);
 ingestIndependentWorld({raw,signature:process.env.OOS_RECEIPT_HMAC}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1});
}
