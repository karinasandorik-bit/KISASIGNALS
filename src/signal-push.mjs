import {putEvidence} from './ledger.mjs';
import {deliverGmailSignal} from './gmail-signal-dispatcher.mjs';
export async function pushActionableSignal(row,{emit}={}){
 if(row?.status!=='SHADOW_SIGNAL_ARMED'||!['LONG','SHORT'].includes(row?.decision?.action)||!row.plan)return {pushed:false,reason:'NOT_ACTIONABLE'};
 const event={event:'ACTIONABLE_SIGNAL',decisionId:row.predictionId,symbol:row.market?.symbol,side:row.decision.action,horizonHours:row.plan.horizonHours,entry:row.plan.entry,stopLoss:row.plan.stopLoss,takeProfit:row.plan.takeProfit,evBps:row.plan.evBps,rr:row.plan.rr,calibrationStatus:row.model?.calibration_status,evidenceTimestamp:row.market?.feature_timestamp||row.market?.observed_at,emittedAt:new Date().toISOString()};
 await putEvidence('actionable_signal_push',row.predictionId,event);
 if(emit)await emit(event);
 const url=process.env.KISA_SIGNAL_WEBHOOK_URL;
 if(url){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('SIGNAL_WEBHOOK_HTTP_'+r.status)}
 // Mail is separately gated. Legacy single-TP signals fail closed until full, independently verified contracts exist.
 const emailSignal={
   decisionId:row.predictionId,symbol:row.market?.symbol,side:row.decision.action,
   status:row.status,mode:'SHADOW_ONLY',entry:row.plan?.entry,stopLoss:row.plan?.stopLoss,
   takeProfit:row.plan?.takeProfit,takeProfit2:row.plan?.takeProfit2,
   observedAt:row.market?.feature_timestamp||row.market?.observed_at,
   expiresAt:row.signalContract?.expiresAt,
   netRR:row.plan?.netRR,riskFraction:row.plan?.riskFraction,
   independentValidation:row.signalContract?.independentValidation===true,
   futuresConsensus:row.futuresConsensus,sources:row.futuresConsensus?.sources
 };
 const email=await deliverGmailSignal(emailSignal).catch(e=>({status:'ERROR',errorCode:e.code||'DISPATCH_FAILED'}));
 console.log(JSON.stringify({event:'EMAIL_DISPATCH_RESULT',decisionId:row.predictionId,status:email.status,errorCode:email.errorCode||null}));
 console.log(JSON.stringify({...event,push:'EVENT_DRIVEN'}));return {pushed:true,event,email};
}
