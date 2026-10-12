import pg from 'pg';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function atomicFreeze(row,{connectionString=process.env.DATABASE_URL}={}){
 if(!connectionString)throw Error('DATABASE_URL_REQUIRED');
 const id=String(row.predictionId||'');if(!id)throw Error('MISSING_PREDICTION_ID');
 const target=new Date(Date.parse(row.market?.received_at||row.ts||row.timestamp)+4*3600000);
 if(!Number.isFinite(target.getTime()))throw Error('INVALID_HORIZON');
 const client=new pg.Client({connectionString});await client.connect();
 try{
  await client.query('BEGIN');
  const commitment=hash(row);
  const baseline={...row,model:{...row.model,sha256:'BASELINE_ALWAYS_LONG_V1',calibration_sha256:'NOT_APPLICABLE'},decision:{action:'LONG'},plan:{side:'LONG',entry:row.market?.reference_close,stopLoss:row.market?.reference_close*0.98,takeProfit:row.market?.reference_close*1.03},frozenAt:row.market?.feature_timestamp||row.ts};
  if(!Number.isFinite(baseline.plan.entry)||baseline.plan.entry<=0)throw Error('BASELINE_REFERENCE_PRICE_REQUIRED');
  if(Date.parse(row.market?.received_at||row.ts||row.timestamp)>Date.now()+5000)throw Error('FUTURE_PREDICTION_TIMESTAMP');
  await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[id]);
  const existing=await client.query('select commitment,frozen_at from owl_internal.predictions where id=$1',[id]);
  if(existing.rowCount&&existing.rows[0].commitment!==commitment)throw Error('IMMUTABLE_CONFLICT');
  if(!existing.rowCount){
   await client.query('insert into owl_internal.predictions(id,commitment,payload,target_at) values($1,$2,$3,$4)',[id,commitment,JSON.stringify(row),target]);
   await client.query("insert into public.evidence_events(event_type,event_id,observed_at,payload) values('oos_frozen_baseline',$1,clock_timestamp(),$2::jsonb) on conflict(event_type,event_id) do nothing",[id,JSON.stringify(baseline)]);
   await client.query('insert into owl_internal.outbox(prediction_id) values($1)',[id]);
  }
  const stored=await client.query('select frozen_at from owl_internal.predictions where id=$1',[id]);
  await client.query('COMMIT');
  return {id,commitment,inserted:!existing.rowCount,frozenAt:stored.rows[0].frozen_at.toISOString(),timestampType:'POSTGRES_INSERT_TIME_NOT_COMMIT_TIME'};
 }catch(e){await client.query('ROLLBACK');throw e}finally{await client.end()}
}
export async function claimDue(client,workerId){
 await client.query('BEGIN');
 try{
  const r=await client.query(`select o.id,o.prediction_id,p.payload,p.target_at from owl_internal.outbox o join owl_internal.predictions p on p.id=o.prediction_id where p.target_at<=clock_timestamp() and (o.state='PENDING' or (o.state='LEASED' and o.lease_until<clock_timestamp())) order by o.id for update of o skip locked limit 1`);
  if(!r.rowCount){await client.query('COMMIT');return null}
  const item=r.rows[0];
  await client.query("update owl_internal.outbox set state='LEASED',worker_id=$2,lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 where id=$1",[item.id,workerId]);
  await client.query('COMMIT');return item;
 }catch(e){await client.query('ROLLBACK');throw e}
}
export async function finishSettlement(client,item,workerId,outcome){
 if(!outcome||Date.parse(outcome.observedAt)<Date.parse(item.target_at)||!Number.isFinite(outcome.exitPrice)||outcome.exitPrice<=0)throw Error('INVALID_OUTCOME');
 await client.query('BEGIN');
 try{
  const r=await client.query("select id from owl_internal.outbox where id=$1 and worker_id=$2 and state='LEASED' and lease_until>clock_timestamp() for update",[item.id,workerId]);
  if(!r.rowCount)throw Error('LEASE_LOST');
  await client.query('insert into owl_internal.settlements(prediction_id,outcome) values($1,$2) on conflict(prediction_id) do nothing',[item.prediction_id,JSON.stringify(outcome)]);
  await client.query("update owl_internal.outbox set state='DONE',lease_until=null where id=$1",[item.id]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e}
}
