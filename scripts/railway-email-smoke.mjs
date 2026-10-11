import pg from 'pg';
import nodemailer from 'nodemailer';
const {Pool}=pg;
const env=process.env;
const decisionId=env.OWL_EMAIL_TEST_DECISION_ID || 'OWL_EMAIL_RAILWAY_TEST_001';
if(env.OWL_EMAIL_TEST_ENABLED!=='true') {console.log(JSON.stringify({event:'EMAIL_SMOKE',status:'DISABLED'}));process.exit(0);}
if(!env.DATABASE_URL||!env.OWL_GMAIL_USER||!env.OWL_GMAIL_APP_PASSWORD||!env.OWL_SIGNAL_RECIPIENT) throw Error('MISSING_SMOKE_CONFIG');
const pool=new Pool({connectionString:env.DATABASE_URL,max:1});
try {
 await pool.query(`CREATE TABLE IF NOT EXISTS owl_email_smoke_outbox(
   decision_id text PRIMARY KEY, state text NOT NULL, created_at timestamptz DEFAULT now(),
   provider_message_id text, sent_at timestamptz)`);
 const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,
  auth:{user:env.OWL_GMAIL_USER,pass:env.OWL_GMAIL_APP_PASSWORD},
  connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000});
 for(let i=1;i<=2;i++){
  const claim=await pool.query("INSERT INTO owl_email_smoke_outbox(decision_id,state) VALUES($1,'CLAIMED') ON CONFLICT DO NOTHING RETURNING decision_id",[decisionId]);
  if(!claim.rowCount){console.log(JSON.stringify({event:'EMAIL_SMOKE',attempt:i,status:'DUPLICATE_SUPPRESSED',decisionId}));continue;}
  try{
   const receipt=await transport.sendMail({from:env.OWL_GMAIL_USER,to:env.OWL_SIGNAL_RECIPIENT,
     subject:'OWL QUANT | Railway SMTP control test | NO TRADE',
     text:`RAILWAY CONTROL TEST ONLY. NOT A MARKET SIGNAL. No order.\\nDecision ID: ${decisionId}\\nAttempt: ${i}\\n`});
   await pool.query("UPDATE owl_email_smoke_outbox SET state='SENT',provider_message_id=$2,sent_at=now() WHERE decision_id=$1",[decisionId,receipt.messageId||null]);
   console.log(JSON.stringify({event:'EMAIL_SMOKE',attempt:i,status:'SENT',decisionId,providerMessageId:receipt.messageId||null}));
  }catch(err) {
   await pool.query("UPDATE owl_email_smoke_outbox SET state='UNKNOWN' WHERE decision_id=$1",[decisionId]);
   console.error(JSON.stringify({event:'EMAIL_SMOKE',attempt:i,status:'UNKNOWN',code:err.code||'SMTP_ERROR'}));process.exitCode=1;
  }
 }
 const out=await pool.query("SELECT decision_id,state,provider_message_id,sent_at FROM owl_email_smoke_outbox WHERE decision_id=$1",[decisionId]);
 console.log(JSON.stringify({event:'EMAIL_SMOKE_READBACK',rowCount:out.rowCount,row:out.rows[0]||null}));
} finally {await pool.end();}
