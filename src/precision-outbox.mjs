import {Pool} from 'pg';
import crypto from 'node:crypto';
import {validateEmailSignal} from './email-signal-gate.mjs';

const canonical=x=>JSON.stringify(x,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
const sha=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
export function requireDatabase(env=process.env) {
  if (!env.DATABASE_URL) throw Error('POSTGRES_REQUIRED');
}
export async function withLedgerTransaction(work,{env=process.env,pool}={}) {
  requireDatabase(env);
  const owned=!pool;
  const p=pool??new Pool({connectionString:env.DATABASE_URL,max:2,connectionTimeoutMillis:7000});
  const client=await p.connect();
  try {
    await client.query('BEGIN');
    const result=await work(client);
    await client.query('COMMIT');
    return result;
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    throw e;
  } finally {
    client.release();
    if(owned) await p.end();
  }
}
export async function ensureOutbox(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS owl_email_outbox_v2(
    decision_id text PRIMARY KEY, payload_hash text NOT NULL, signal jsonb NOT NULL,
    recipient text NOT NULL, status text NOT NULL DEFAULT 'PENDING',
    created_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz,
    sent_at timestamptz, provider_message_id text, error_code text,
    CHECK (status IN ('PENDING','CLAIMED','SENT','UNKNOWN','REJECTED')))`);
}
export async function persistDecisionAndQueue(row,signal,{env=process.env,pool,now=Date.now()}={}) {
  requireDatabase(env);
  if(!row?.predictionId) throw Error('DECISION_ID_REQUIRED');
  if(!env.OWL_SIGNAL_RECIPIENT) throw Error('RECIPIENT_REQUIRED');
  const check=validateEmailSignal(signal,{now});
  if(!check.eligible) return {status:'REJECTED',errors:check.errors};
  const payloadHash=sha(row);
  return withLedgerTransaction(async c=>{
    await c.query(`CREATE TABLE IF NOT EXISTS evidence_events(
      event_type text NOT NULL,event_id text NOT NULL,observed_at timestamptz NOT NULL DEFAULT now(),
      payload jsonb NOT NULL,PRIMARY KEY(event_type,event_id))`);
    await ensureOutbox(c);
    const existing=await c.query("SELECT payload FROM evidence_events WHERE event_type='prediction' AND event_id=$1 FOR UPDATE",[row.predictionId]);
    if(existing.rowCount && sha(existing.rows[0].payload)!==payloadHash) throw Error('DECISION_PAYLOAD_CONFLICT');
    if(!existing.rowCount) await c.query("INSERT INTO evidence_events(event_type,event_id,payload) VALUES('prediction',$1,$2::jsonb)",[row.predictionId,JSON.stringify(row)]);
    const queued=await c.query(`INSERT INTO owl_email_outbox_v2(decision_id,payload_hash,signal,recipient)
       VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING RETURNING decision_id`,
       [row.predictionId,payloadHash,JSON.stringify(signal),env.OWL_SIGNAL_RECIPIENT]);
    const original=await c.query('SELECT payload_hash,status FROM owl_email_outbox_v2 WHERE decision_id=$1',[row.predictionId]);
    if(original.rows[0]?.payload_hash!==payloadHash) throw Error('OUTBOX_PAYLOAD_CONFLICT');
    return {status:queued.rowCount?'QUEUED':'ALREADY_QUEUED',decisionId:row.predictionId,outboxStatus:original.rows[0].status};
  },{env,pool});
}
export async function drainEmailOutbox({env=process.env,pool,transport,limit=20}={}) {
  requireDatabase(env);
  if(env.OWL_EMAIL_ENABLED!=='true') return {status:'DISABLED'};
  if(!env.OWL_GMAIL_USER||!env.OWL_GMAIL_APP_PASSWORD) throw Error('SMTP_CREDENTIALS_REQUIRED');
  const owned=!pool;
  const p=pool??new Pool({connectionString:env.DATABASE_URL,max:2,connectionTimeoutMillis:7000});
  const sender=transport??(await import('nodemailer')).default.createTransport({
    host:'smtp.gmail.com',port:465,secure:true,
    auth:{user:env.OWL_GMAIL_USER,pass:env.OWL_GMAIL_APP_PASSWORD},
    connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000});
  const outcomes=[];
  try {
    for(let i=0;i<limit;i++){
      const claim=await withLedgerTransaction(async c=>{
        await ensureOutbox(c);
        const r=await c.query(`SELECT decision_id,signal,recipient FROM owl_email_outbox_v2
          WHERE status='PENDING' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`);
        if(!r.rowCount)return null;
        const s=r.rows[0];
        await c.query("UPDATE owl_email_outbox_v2 SET status='CLAIMED',claimed_at=now() WHERE decision_id=$1",[s.decision_id]);
        return s;
      },{env,pool:p});
      if(!claim)break;
      const s=claim.signal;
      const body=['RESEARCH / SHADOW — NOT A LIVE ORDER',`Decision: ${claim.decision_id}`,
        `Symbol: ${s.symbol}`,`Side: ${s.side}`,`Entry: ${s.entry}`,
        `Stop Loss: ${s.stopLoss}`,`TP1: ${s.takeProfit}`,`TP2: ${s.takeProfit2}`,
        `Expiry: ${s.expiresAt}`,`Observed: ${s.observedAt}`,
        `Sources: ${(s.sources||[]).join(', ')}`,
        'Manual execution only. No profit guarantee.'].join('\n');
      try {
        const receipt=await sender.sendMail({from:env.OWL_GMAIL_USER,to:claim.recipient,
          subject:`OWL SHADOW ${s.symbol} ${s.side} | ${claim.decision_id}`,text:body});
        await p.query(`UPDATE owl_email_outbox_v2 SET status='SENT',provider_message_id=$2,sent_at=now()
          WHERE decision_id=$1 AND status='CLAIMED'`,[claim.decision_id,receipt.messageId??null]);
        outcomes.push({decisionId:claim.decision_id,status:'SENT',messageId:receipt.messageId??null});
      } catch(e) {
        await p.query(`UPDATE owl_email_outbox_v2 SET status='UNKNOWN',error_code=$2
          WHERE decision_id=$1 AND status='CLAIMED'`,[claim.decision_id,String(e.code||'SMTP_UNKNOWN').slice(0,100)]);
        outcomes.push({decisionId:claim.decision_id,status:'UNKNOWN'});
      }
    }
    return {status:'COMPLETE',outcomes};
  }finally{if(owned)await p.end();}
}
// A CLAIMED event is intentionally NOT retried automatically: provider acceptance may
// have happened just before a crash. Reconcile against Gmail before manual reset.
