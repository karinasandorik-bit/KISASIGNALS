import {validateEmailSignal} from './email-signal-gate.mjs';
import {Pool} from 'pg';
import {assessEmailTrackRecord} from './email-track-record-gate.mjs';
// SMTP credentials must be supplied only via Railway secret variables.
// A send timeout after provider acceptance is UNKNOWN, never automatically retried.
export async function deliverGmailSignal(signal,{env=process.env, now=Date.now(), transport}={}) {
  if(env.OWL_EMAIL_ENABLED!=='true') return {status:'DISABLED'};
  const check=validateEmailSignal(signal,{now});
  if(!check.eligible) return {status:'REJECTED',errors:check.errors};
  if(!env.DATABASE_URL||!env.OWL_GMAIL_USER||!env.OWL_GMAIL_APP_PASSWORD||!env.OWL_SIGNAL_RECIPIENT) return {status:'CONFIG_MISSING'};
  const pool=new Pool({connectionString:env.DATABASE_URL,max:2});
  try {
    // Fail closed: no email is claimed or transmitted before real, independently
    // settled prospective track-record evidence supports the model.
    let trackRecord;
    try {
      // Read immutable prediction + independently sourced settled outcome directly.
      // Never trust self-declared 'independentlySettled' event flags.
      const q=await pool.query(`SELECT p.id, p.payload AS prediction, p.target_at,
        s.outcome FROM owl_internal.predictions p
        INNER JOIN owl_internal.settlements s ON s.prediction_id=p.id
        WHERE p.target_at <= clock_timestamp()
        ORDER BY p.target_at DESC LIMIT 1000`);
      const records=q.rows.flatMap(({id,prediction,outcome,target_at})=>{
        const side=prediction?.decision?.action;
        const entry=prediction?.plan?.entry;
        const exit=outcome?.exitPrice;
        const frozenAt=prediction?.market?.received_at||prediction?.ts;
        const settledAt=outcome?.observedAt;
        const independent=typeof outcome?.independentSource==='string' &&
          outcome.independentSource.startsWith('kraken:') &&
          !String(prediction?.market?.source||'').toLowerCase().includes('kraken') &&
          outcome.instrument==='BTC-USD' && outcome.marketType==='spot' &&
          typeof outcome.evidenceHash==='string' && /^[a-f0-9]{64}$/.test(outcome.evidenceHash) &&
          Number.isFinite(Date.parse(settledAt)) &&
          Date.parse(settledAt)>=Date.parse(target_at) &&
          outcome.costKind==='ASSUMED';
        if(!independent || !['LONG','SHORT'].includes(side) ||
           prediction?.status!=='SHADOW_SIGNAL_ARMED' ||
           prediction?.model?.sha256!==signal?.modelHash ||
           !(Number.isFinite(entry)&&entry>0&&Number.isFinite(exit)&&exit>0) ||
           !(Number.isFinite(Date.parse(frozenAt))&&Date.parse(frozenAt)<Date.parse(target_at)) ||
           !(Number.isFinite(prediction?.decision?.costBps)&&prediction.decision.costBps>=0))return [];
        return [{decisionId:id,prospective:true,independentlySettled:true,
          frozenAt,settledAt,netReturnBps:(exit/entry-1)*10000*(side==='LONG'?1:-1)-prediction.decision.costBps}];
      });
      trackRecord=assessEmailTrackRecord(records);
    } catch(e) {
      return {status:'QUALITY_GATE_UNAVAILABLE',errorCode:'EVIDENCE_QUERY_FAILED'};
    }
    if(!trackRecord.eligible) return {status:'QUALITY_GATE_REJECTED',reason:trackRecord.reason,n:trackRecord.n};
    await pool.query(`CREATE TABLE IF NOT EXISTS owl_email_outbox (
      decision_id text PRIMARY KEY, status text NOT NULL,
      recipient text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      provider_message_id text, sent_at timestamptz, error_code text)`);
    const claim=await pool.query(`INSERT INTO owl_email_outbox(decision_id,status,recipient)
      VALUES($1,'CLAIMED',$2) ON CONFLICT DO NOTHING RETURNING decision_id`,
      [signal.decisionId,env.OWL_SIGNAL_RECIPIENT]);
    if(!claim.rowCount) return {status:'DUPLICATE_OR_UNCERTAIN',decisionId:signal.decisionId};
    const mailer=transport??(await import('nodemailer')).default.createTransport({
      host:'smtp.gmail.com',port:465,secure:true,auth:{user:env.OWL_GMAIL_USER,pass:env.OWL_GMAIL_APP_PASSWORD},
      connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000
    });
    const subject=`OWL SHADOW ${signal.symbol} ${signal.side} | expires ${signal.expiresAt}`;
    const body=[
      'RESEARCH / SHADOW — NOT A LIVE ORDER',
      `Decision: ${signal.decisionId}`,`Symbol: ${signal.symbol}`,`Side: ${signal.side}`,
      `Entry: ${signal.entry}`,`SL: ${signal.stopLoss}`,
      `TP1: ${signal.takeProfit}`,`TP2: ${signal.takeProfit2}`,
      `Expiry (ISO UTC): ${signal.expiresAt}`,`Observed: ${signal.observedAt}`,
      `Net R:R: ${signal.netRR}`,`Max account risk: ${signal.riskFraction*100}%`,
      `Sources: ${signal.sources.join(', ')}`,'Manual execution only. No profit guarantee.'
    ].join('\\n');
    try {
      const receipt=await mailer.sendMail({from:env.OWL_GMAIL_USER,to:env.OWL_SIGNAL_RECIPIENT,subject,text:body});
      await pool.query(`UPDATE owl_email_outbox SET status='SENT',provider_message_id=$2,sent_at=now() WHERE decision_id=$1`,
        [signal.decisionId,receipt.messageId??null]);
      return {status:'SENT',decisionId:signal.decisionId,providerMessageId:receipt.messageId??null};
    } catch(e) {
      await pool.query(`UPDATE owl_email_outbox SET status='UNKNOWN',error_code=$2 WHERE decision_id=$1`,
        [signal.decisionId,String(e.code||'SEND_ERROR').slice(0,100)]).catch(()=>{});
      return {status:'UNKNOWN',decisionId:signal.decisionId,errorCode:String(e.code||'SEND_ERROR')};
    }
  } finally {await pool.end();}
}
