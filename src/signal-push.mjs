import {putEvidence} from './ledger.mjs';
import {enqueueSignal} from './signal-delivery-outbox.mjs';
export async function pushActionableSignal(row,{emit}={}){
 if(row?.status!=='SHADOW_SIGNAL_ARMED'||!['LONG','SHORT'].includes(row?.decision?.action)||!row.plan)return {pushed:false,reason:'NOT_ACTIONABLE'};
 const event={event:'ACTIONABLE_SIGNAL',decisionId:row.predictionId,symbol:row.market?.symbol,side:row.decision.action,horizonHours:row.plan.horizonHours,entry:row.plan.entry,stopLoss:row.plan.stopLoss,takeProfit:row.plan.takeProfit,evBps:row.plan.evBps,rr:row.plan.rr,calibrationStatus:row.model?.calibration_status,evidenceTimestamp:row.market?.feature_timestamp||row.market?.observed_at,emittedAt:new Date().toISOString()};
 await putEvidence('actionable_signal_push',row.predictionId,event);
 if(emit)await emit(event);
 await enqueueSignal(event);
 console.log(JSON.stringify({...event,push:'EVENT_DRIVEN'}));return {pushed:true,event};
}
