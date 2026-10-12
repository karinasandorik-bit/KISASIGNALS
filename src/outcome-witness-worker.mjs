import pg from 'pg';
import {createPrivateKey} from 'node:crypto';
import {collectOutcome} from './prospective-outcome-collector.mjs';
const {Pool}=pg;
export async function runWitnessBatch({pool,collector=collectOutcome,now=new Date()}={}){
 if(!pool)throw new Error('DATABASE_REQUIRED');
 const {rows}=await pool.query(`select d.decision_id,d.decision_created_at,d.horizon_target_at,d.venue,d.reference_venue,d.action
 from public.owl_signal_market_decisions d
 where d.action='NO_TRADE'
 and d.horizon_target_at <= $1::timestamptz - interval '1 minute'
 and d.horizon_target_at > $1::timestamptz - interval '20 minutes'
 and not exists(select 1 from public.owl_external_outcome_receipts r where r.decision_id=d.decision_id)
 order by d.horizon_target_at limit 20`,[now.toISOString()]);
 const output=[];
 for(const row of rows){
  let receipt;
  try{
   const key=process.env.OWL_COLLECTOR_SIGNING_KEY_PEM;
   if(!key)throw new Error('COLLECTOR_SIGNING_KEY_MISSING');
   receipt=await collector(row,{signingKey:createPrivateKey(key)});
   await pool.query(`insert into public.owl_external_outcome_receipts
   (decision_id,capture_hash,capture,collector_signature,classification)
   values($1,$2,$3::jsonb,$4,$5) on conflict(decision_id) do nothing`,
   [row.decision_id,receipt.capture_hash,JSON.stringify(receipt.capture),receipt.collector_signature,'INDEPENDENT_SHADOW_PRICE_ONLY']);
   output.push({decision_id:row.decision_id,status:'RECORDED',capture_hash:receipt.capture_hash});
  }catch(e){output.push({decision_id:row.decision_id,status:'REJECTED',reason:e.message});}
 }
 return output;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const url=process.env.OWL_WITNESS_DATABASE_URL;
 if(!url)throw new Error('OWL_WITNESS_DATABASE_URL_MISSING');
 const pool=new Pool({connectionString:url,ssl:{rejectUnauthorized:true}});
 try{console.log(JSON.stringify(await runWitnessBatch({pool})));}finally{await pool.end();}
}
