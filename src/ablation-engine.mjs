import crypto from 'node:crypto';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function armSensorAblation({symbol,at,horizonHours=4,baseDecision,channel,evidence,challengerDecision}){
 if(!symbol||!at||!channel)throw new Error('INVALID_ABLATION_TRIAL');
 const trialId=hash({symbol,at,horizonHours,channel,evidence:hash(evidence)}).slice(0,24);
 return{trialId,symbol,armedAt:at,horizonHours,channel,evidenceHash:hash(evidence),evidenceObservedAt:evidence?.observedAt||null,evidenceQuality:evidence?.quality||'UNKNOWN',baseline:baseDecision,challenger:challengerDecision,didActionChange:baseDecision?.action!==challengerDecision?.action,status:'ARMED',admission:'OBSERVE_ONLY'};
}
export function settleSensorAblation(trial,outcome){
 const score=d=>d?.action==='NO_TRADE'||!d?.action?0:(d.action==='LONG'?1:-1)*(outcome.returnBps||0)-(d.costBps||0);
 const b=score(trial.baseline),c=score(trial.challenger);return{...trial,status:'SETTLED',settledAt:outcome.settledAt||new Date().toISOString(),outcome,baselineNetBps:+b.toFixed(3),challengerNetBps:+c.toFixed(3),incrementalNetBps:+(c-b).toFixed(3)};
}
export function channelEvidence(rows,channel){const r=rows.filter(x=>x.channel===channel&&x.status==='SETTLED');if(!r.length)return{channel,n:0,status:'INSUFFICIENT_EVIDENCE'};const ds=r.map(x=>x.incrementalNetBps),mean=ds.reduce((a,b)=>a+b,0)/ds.length;return{channel,n:r.length,meanIncrementalNetBps:+mean.toFixed(3),actionChangeRate:+(r.filter(x=>x.didActionChange).length/r.length).toFixed(3),status:'OBSERVATION_ONLY',promotionAllowed:false};}
