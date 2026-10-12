// OWL EXP-001 v2: conservative fail-closed eligibility for executed-trade labels.
// Eligibility is NOT independent verification of hash authenticity or actual execution.
const validDate=(x)=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
const hashOk=(x)=>typeof x==='string'&&/^(?:sha256:)?[0-9a-f]{64}$/i.test(x);
export function assessTrainingExample(d,s,{expectedModel='owl-ema-v1'}={}) {
 const r=[];
 if(!d||!s)return {eligible:false,reasons:['MISSING_DECISION_OR_SETTLEMENT']};
 if(typeof d.decision_id!=='string'||!d.decision_id||d.decision_id!==s.decision_id)r.push('DECISION_JOIN_INVALID');
 if(d.model_version!==expectedModel)r.push('BASELINE_MODEL_MISMATCH');
 if(!['LONG','SHORT'].includes(d.action))r.push('NOT_EXECUTABLE_TRADE_LABEL');
 if(d.status!=='SHADOW')r.push('UNEXPECTED_DECISION_STATUS');
 if(d.rationale?.quality!=='CALIBRATED')r.push('UNCALIBRATED_DECISION');
 if(d.rationale?.futures_verified!==true)r.push('FUTURES_NOT_VERIFIED');
 if(s.evaluation_status!=='INDEPENDENT_EXACT_HORIZON_VERIFIED')r.push('UNVERIFIED_SETTLEMENT');
 if(!hashOk(s.source_evidence_hash))r.push('INVALID_EVIDENCE_HASH_FORMAT');
 if(!s.independent_venue||s.independent_venue===d.venue||!finite(Number(s.independent_exit_price))||Number(s.independent_exit_price)<=0)r.push('INVALID_INDEPENDENT_PRICE');
 if(!finite(s.net_estimate_return_pct)||s.net_estimate_status!=='VERIFIED')r.push('MISSING_VERIFIED_NET_COST');
 const decisionAt=validDate(d.decision_created_at??d.created_at), target=validDate(d.horizon_target_at), observed=validDate(s.outcome_observed_at), settled=validDate(s.settled_at);
 if(![decisionAt,target,observed,settled].every(Number.isFinite)||!(decisionAt<target&&target<=observed&&observed<=settled))r.push('INVALID_CAUSAL_TIME_ORDER');
 if(validDate(s.target_at)!==target)r.push('TARGET_MISMATCH');
 const lag=(observed-target)/1000;
 if(!Number.isInteger(s.horizon_lag_seconds)||s.horizon_lag_seconds<0||s.horizon_lag_seconds>60||!Number.isFinite(lag)||Math.abs(lag-s.horizon_lag_seconds)>1)r.push('HORIZON_LAG_NOT_EXACT');
 const candleClose=validDate(s.source_candle_close_at),candleOpen=validDate(s.source_candle_open_at);
 if(!Number.isFinite(candleClose)||!Number.isFinite(candleOpen)||candleOpen>=candleClose||candleClose>observed||candleOpen>target)r.push('INVALID_SOURCE_CANDLE_TIME');
 if(!finite(Number(d.price))||Number(d.price)<=0)r.push('INVALID_ENTRY_PRICE');
 return {eligible:r.length===0,reasons:r};
}
export function auditTrainingBatch(decisions,settlements,options){
 const byId=new Map(),duplicate=new Set();
 for(const s of settlements){if(byId.has(s.decision_id))duplicate.add(s.decision_id);byId.set(s.decision_id,s);}
 const countsByDecision=new Map(); for(const d of decisions)countsByDecision.set(d.decision_id,(countsByDecision.get(d.decision_id)??0)+1);
 const results=decisions.map(d=>{
  const r=assessTrainingExample(d,byId.get(d.decision_id),options);
  if(duplicate.has(d.decision_id))r.reasons.push('DUPLICATE_SETTLEMENT');
  if(countsByDecision.get(d.decision_id)>1)r.reasons.push('DUPLICATE_DECISION');
  return {decision_id:d.decision_id,eligible:r.reasons.length===0,reasons:r.reasons};
 });
 const reasons={};for(const r of results)for(const code of r.reasons)reasons[code]=(reasons[code]??0)+1;
 return {total:results.length,eligible:results.filter(x=>x.eligible).length,rejected:results.filter(x=>!x.eligible).length,reasons,results};
}
