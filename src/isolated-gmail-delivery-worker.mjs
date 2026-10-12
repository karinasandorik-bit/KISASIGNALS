// Opt-in isolated delivery entrypoint. No trading signals or production auto-enablement.
import {runDelivery} from './pg-delivery-recovery.mjs';
import {gmailLookup} from './gmail-provider-readback.mjs';
const reportId=process.env.OWL_ISOLATED_REPORT_ID;
const recipient=process.env.OWL_ISOLATED_RECIPIENT;
const token=process.env.GMAIL_OAUTH_ACCESS_TOKEN;
if(process.env.OWL_ENABLE_ISOLATED_GMAIL!=='true'||!/^OWL-[A-Z0-9-]{8,120}$/.test(reportId||'')||!recipient||!token)throw Error('ISOLATED_GMAIL_NOT_CONFIGURED');
if(process.env.OWL_EMAIL_ENABLED==='true')throw Error('TRADING_EMAIL_MUST_REMAIN_DISABLED');
const base='https://gmail.googleapis.com/gmail/v1/users/me/messages';
const lookup=gmailLookup({token,recipient});
const send=async(id)=>{
 // This code is purposefully scoped to an isolated self-addressed NO TRADE report.
 const to=recipient,from=process.env.OWL_GMAIL_USER;
 if(!from||to.toLowerCase()!==from.toLowerCase())throw Error('SELF_TEST_ONLY');
 const subject=id+' | ISOLATED NO TRADE';
 const raw=['To: '+to,'From: '+from,'Subject: '+subject,'MIME-Version: 1.0','Content-Type: text/plain; charset=utf-8','','Report ID: '+id,'NO TRADE. ISOLATED DELIVERY TEST.'].join('\r\n');
 const res=await fetch(base+'/send',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({raw:Buffer.from(raw).toString('base64url')})});
 if(!res.ok)throw Error('GMAIL_SEND_RESULT_UNKNOWN_'+res.status);
 const body=await res.json();if(!body.id)throw Error('GMAIL_RECEIPT_UNKNOWN');
 return {id:body.id};
};
const response=await runDelivery({reportId,workerId:'owl-isolated-'+process.pid,send,lookup,crashAfterSend:process.env.OWL_FAULT_AFTER_GMAIL==='SIGKILL'});
process.stdout.write(JSON.stringify(response)+'\n');
