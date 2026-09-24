// Decision Constitution: money-facing authority is downstream of evidence, provenance and falsification.
export const DECISION_CONSTITUTION_VERSION='KISA-DC-1';
export function authorityGate({signal,evidence={},model={},execution={},risk={}}={}){
 const reasons=[];
 if(!signal||!['LONG','SHORT'].includes(signal.action)) reasons.push('NO_ACTIONABLE_SIGNAL');
 if(evidence.quality!=='VERIFIED') reasons.push('EVIDENCE_NOT_VERIFIED');
 if(!evidence.sourceObservedAt||!Number.isFinite(Date.parse(evidence.sourceObservedAt))) reasons.push('NO_SOURCE_TIME');
 if(model.calibration!=='CALIBRATED') reasons.push('MODEL_NOT_CALIBRATED');
 if(model.mode&&model.mode!=='PROSPECTIVE') reasons.push('MODEL_NOT_PROSPECTIVE');
 if(execution.evNetBps==null||!Number.isFinite(Number(execution.evNetBps))||Number(execution.evNetBps)<=0) reasons.push('NO_POSITIVE_NET_EV');
 if(risk.tailBps!=null&&risk.capBps!=null&&Number(risk.tailBps)>Number(risk.capBps)) reasons.push('TAIL_RISK_EXCEEDED');
 return {authority:reasons.length?'DENY':'SHADOW_ALLOW',reasons,constitution:DECISION_CONSTITUTION_VERSION};
}
export function provenanceEnvelope({decisionId,modelSha,featureCutoff,evidenceHashes=[],sensorStates={},createdAt=new Date().toISOString()}={}){
 return {decisionId,createdAt,modelSha,featureCutoff,evidenceHashes:[...evidenceHashes].sort(),sensorStates,immutableIntent:true,constitution:DECISION_CONSTITUTION_VERSION};
}
export function promotionGate({n=0,incrementalEvBps=null,ciLowBps=null,tailDeltaBps=null,regimeCount=0,leakage=false}={}){
 const checks={enoughN:n>=100,positiveIncrement:Number.isFinite(ciLowBps)&&ciLowBps>0,tailSafe:Number.isFinite(tailDeltaBps)&&tailDeltaBps<=0,regimeStable:regimeCount>=3,noLeakage:!leakage};
 return {promote:Object.values(checks).every(Boolean),checks,n,incrementalEvBps,ciLowBps,tailDeltaBps,regimeCount};
}
