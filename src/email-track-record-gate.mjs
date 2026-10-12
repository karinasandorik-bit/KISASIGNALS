// Prospective-only statistical qualification for EMAIL alerts.
// This is a safety brake, not a claim that signals are profitable.
const finite = x => typeof x === 'number' && Number.isFinite(x);
export function assessEmailTrackRecord(records, {minSamples=100, minIndependentDays=10, minNetBps=0, z=1.96}={}) {
  if(!Array.isArray(records)) return {eligible:false,reason:'NO_AUDITABLE_RECORDS',n:0};
  const seen=new Set(), accepted=[], days=new Set();
  for(const r of records){
    if(!r||typeof r.decisionId!=='string'||!r.decisionId||seen.has(r.decisionId)) continue;
    seen.add(r.decisionId);
    if(r.prospective!==true||r.independentlySettled!==true||
      !finite(r.netReturnBps)||!Number.isFinite(Date.parse(r.frozenAt))||
      !Number.isFinite(Date.parse(r.settledAt))||Date.parse(r.settledAt)<=Date.parse(r.frozenAt)) continue;
    accepted.push(r.netReturnBps);
    days.add(new Date(r.frozenAt).toISOString().slice(0,10));
  }
  const n=accepted.length;
  if(n<minSamples||days.size<minIndependentDays) return {eligible:false,reason:'INSUFFICIENT_PROSPECTIVE_EVIDENCE',n,days:days.size};
  const mean=accepted.reduce((a,b)=>a+b,0)/n;
  const variance=accepted.reduce((a,b)=>a+(b-mean)**2,0)/(n-1);
  const lowerBoundBps=mean-z*Math.sqrt(variance/n);
  if(!finite(lowerBoundBps)||lowerBoundBps<=minNetBps) return {eligible:false,reason:'EDGE_NOT_ESTABLISHED',n,days:days.size,meanNetBps:mean,lowerBoundBps};
  return {eligible:true,reason:'PROSPECTIVE_TRACK_RECORD_PASSED',n,days:days.size,meanNetBps:mean,lowerBoundBps};
}
