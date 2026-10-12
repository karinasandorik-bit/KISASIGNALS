import pg from 'pg';
const {Pool}=pg;
export async function claimDelivery(pool,reportId,workerId){
 const r=await pool.query(`UPDATE public.owl_market_report_delivery
 SET state='SENDING',attempts=attempts+1,updated_at=clock_timestamp()
 WHERE report_id=$1 AND state='PENDING'
 RETURNING report_id,recipient,payload,attempts`,[reportId]);
 return r.rows[0]??null;
}
export async function reconcileDelivery(pool,reportId,lookup){
 const current=await pool.query('SELECT report_id,state,provider_message_id FROM public.owl_market_report_delivery WHERE report_id=$1',[reportId]);
 const row=current.rows[0];if(!row)throw Error('REPORT_NOT_FOUND');
 if(row.state==='SENT')return {state:'SENT',providerMessageId:row.provider_message_id,reused:true};
 if(!['SENDING','UNKNOWN'].includes(row.state))return {state:row.state,blocked:true};
 const found=await lookup(reportId);
 if(!Array.isArray(found))throw Error('RECONCILIATION_UNAVAILABLE');
 if(found.length!==1){
  await pool.query(`UPDATE public.owl_market_report_delivery SET state='UNKNOWN',last_error=$2,updated_at=now() WHERE report_id=$1 AND state IN ('SENDING','UNKNOWN')`,[reportId,found.length===0?'PROVIDER_UNCERTAIN':'PROVIDER_DUPLICATE']);
  return {state:'UNKNOWN',count:found.length,blocked:true};
 }
 const id=String(found[0]?.id||'');if(!id)throw Error('INVALID_PROVIDER_RECEIPT');
 const verified=await pool.query(`UPDATE public.owl_market_report_delivery
 SET state='SENT',provider_message_id=$2,updated_at=now()
 WHERE report_id=$1 AND state IN ('SENDING','UNKNOWN') AND (provider_message_id IS NULL OR provider_message_id=$2)
 RETURNING report_id,state,provider_message_id,attempts`,[reportId,id]);
 if(!verified.rowCount)throw Error('RECEIPT_CONFLICT');
 return {state:'SENT',providerMessageId:id,recovered:true};
}
export async function runDelivery({connectionString=process.env.DATABASE_URL,reportId,workerId,send,lookup,crashAfterSend=false}){
 if(!connectionString||!reportId||!workerId||typeof send!=='function'||typeof lookup!=='function')throw Error('DELIVERY_CONFIG_REQUIRED');
 const pool=new Pool({connectionString,max:2});
 try{
  const row=await claimDelivery(pool,reportId,workerId);
  if(!row)return reconcileDelivery(pool,reportId,lookup);
  const receipt=await send(reportId,row);
  if(crashAfterSend)process.kill(process.pid,'SIGKILL');
  if(!receipt?.id)throw Error('PROVIDER_ID_UNKNOWN');
  // A failed write is explicitly uncertain: next worker must look up provider, NEVER resend.
  const r=await pool.query(`UPDATE public.owl_market_report_delivery SET state='SENT',provider_message_id=$2,updated_at=now()
 WHERE report_id=$1 AND state='SENDING' RETURNING report_id`,[reportId,receipt.id]);
  if(!r.rowCount)throw Error('DELIVERY_LEASE_LOST');
  return {state:'SENT',providerMessageId:receipt.id};
 }finally{await pool.end()}
}
