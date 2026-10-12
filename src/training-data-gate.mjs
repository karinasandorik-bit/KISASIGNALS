// OWL EXP-001: fail-closed selection of prospective training labels.
// Never infer missing provenance or substitute approximated horizon outcomes.
export function assessTrainingExample(decision, settlement, {expectedModel='owl-ema-v1'}={}) {
  const reasons=[];
  if (!decision || !settlement) return {eligible:false,reasons:['MISSING_DECISION_OR_SETTLEMENT']};
  if (!decision.decision_id || decision.decision_id!==settlement.decision_id) reasons.push('DECISION_JOIN_INVALID');
  if (decision.model_version!==expectedModel) reasons.push('BASELINE_MODEL_MISMATCH');
  if (!['LONG','SHORT'].includes(decision.action)) reasons.push('NOT_EXECUTABLE_TRADE_LABEL');
  if (decision.status!=='SHADOW') reasons.push('UNEXPECTED_DECISION_STATUS');
  if (decision.rationale?.quality!=='CALIBRATED') reasons.push('UNCALIBRATED_DECISION');
  if (decision.rationale?.futures_verified!==true) reasons.push('FUTURES_NOT_VERIFIED');
  if (settlement.evaluation_status!=='INDEPENDENT_EXACT_HORIZON_VERIFIED') reasons.push('UNVERIFIED_SETTLEMENT');
  if (!settlement.source_evidence_hash) reasons.push('MISSING_OUTCOME_EVIDENCE_HASH');
  if (!settlement.independent_venue || settlement.independent_exit_price == null) reasons.push('MISSING_INDEPENDENT_PRICE');
  if (settlement.net_estimate_return_pct == null || settlement.net_estimate_status!=='VERIFIED') reasons.push('MISSING_VERIFIED_NET_COST');
  const decisionAt=Date.parse(decision.decision_created_at??decision.created_at??'');
  const targetAt=Date.parse(decision.horizon_target_at??'');
  const observedAt=Date.parse(settlement.outcome_observed_at??'');
  if (![decisionAt,targetAt,observedAt].every(Number.isFinite) || !(decisionAt<targetAt && targetAt<=observedAt)) reasons.push('INVALID_CAUSAL_TIME_ORDER');
  if (settlement.target_at && Number.isFinite(targetAt) && Date.parse(settlement.target_at)!==targetAt) reasons.push('TARGET_MISMATCH');
  if (settlement.horizon_lag_seconds==null || settlement.horizon_lag_seconds<0 || settlement.horizon_lag_seconds>60) reasons.push('HORIZON_LAG_NOT_EXACT');
  return {eligible:reasons.length===0,reasons};
}
export function auditTrainingBatch(decisions,settlements,options) {
  const byId=new Map(settlements.map(s=>[s.decision_id,s]));
  const results=decisions.map(d=>({decision_id:d.decision_id,...assessTrainingExample(d,byId.get(d.decision_id),options)}));
  const counts={}; for (const r of results) for (const reason of r.reasons) counts[reason]=(counts[reason]??0)+1;
  return {total:results.length,eligible:results.filter(x=>x.eligible).length,rejected:results.filter(x=>!x.eligible).length,reasons:counts,results};
}
