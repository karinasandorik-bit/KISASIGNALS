import pg from 'pg';
const {Pool}=pg;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false,max:2});
export async function ensureOutbox(){
 await pool.query(`CREATE TABLE IF NOT EXISTS signal_delivery_outbox(
 decision_id text PRIMARY KEY,
 payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'PENDING',
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,
 delivered_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
 )`);
}
export async function enqueueSignal(event){
 if(!event?.decisionId||!['LONG','SHORT'].includes(event.side)||!Number.isFinite(event.entry)||!Number.isFinite(event.stopLoss)||!Number.isFinite(event.takeProfit)) throw Error('INVALID_SIGNAL');
 await ensureOutbox();
 await pool.query('INSERT INTO signal_delivery_outbox(decision_id,payload) VALUES($1,$2::jsonb) ON CONFLICT(decision_id) DO NOTHING',[event.decisionId,JSON.stringify({...event,mode:'SHADOW_ONLY'})]);
}
export async function flushSignals({fetchFn=fetch,now=new Date(),limit=10}={}){
 const webhook=process.env.KISA_SIGNAL_WEBHOOK_URL;
 if(!webhook) return {status:'NOT_CONFIGURED',delivered:0};
 if(!process.env.DATABASE_URL) return {status:'NO_DATABASE',delivered:0};
 await ensureOutbox();let delivered=0,failed=0;
 for(let i=0;i<limit;i++){
  const r=await pool.query(`UPDATE signal_delivery_outbox SET state='LEASED',lease_until=now()+interval '30 seconds',attempts=attempts+1
   WHERE decision_id=(SELECT decision_id FROM signal_delivery_outbox WHERE
    ((state='PENDING' AND next_attempt_at <= now()) OR (state='LEASED' AND lease_until < now()))
    ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
   RETURNING decision_id,payload,attempts`);
  if(!r.rowCount)break;
  const job=r.rows[0];
  try{
   const response=await fetchFn(webhook,{method:'POST',headers:{'content-type':'application/json','idempotency-key':job.decision_id},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('HTTP_'+response.status);
   await pool.query("UPDATE signal_delivery_outbox SET state='DELIVERED',delivered_at=now(),lease_until=NULL,last_error=NULL WHERE decision_id=$1",[job.decision_id]);delivered++;
  }catch(e){
   const delay=Math.min(3600,Math.pow(2,Math.min(job.attempts,10))*15);
   await pool.query("UPDATE signal_delivery_outbox SET state='PENDING',lease_until=NULL,next_attempt_at=now()+($2*interval '1 second'),last_error=$3 WHERE decision_id=$1",[job.decision_id,delay,String(e.message).slice(0,400)]);failed++;
  }
 }
 return {status:'OK',delivered,failed};
}
if(import.meta.url===`file://${process.argv[1]}`){try{console.log(JSON.stringify(await flushSignals()));}finally{await pool.end();}}
