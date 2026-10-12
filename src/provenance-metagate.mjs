const clip=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const EPISTEMIC_WEIGHTS=Object.freeze({VERIFIED:1,DERIVED:.82,CAPTURED:.72,UNVERIFIED:.35,UNKNOWN:0,FAILED:0,STALE:0,CONFLICTED:0});
const qualityOf=e=>String(e?.epistemicStatus||e?.quality||'UNKNOWN').toUpperCase();
const weightOf=e=>EPISTEMIC_WEIGHTS[qualityOf(e)]??0;
export function provenanceProfile(evidence={}){
 const entries=Object.entries(evidence).map(([channel,e])=>{const quality=qualityOf(e),weight=weightOf(e),available=e?.value!==null&&e?.value!==undefined,source=e?.source||'unknown',observedAt=e?.observedAt||e?.sourceObservedAt||null,ageMs=observedAt?Date.now()-Date.parse(observedAt):null;return{channel,quality,weight:available?weight:0,available,source,observedAt,ageMs:Number.isFinite(ageMs)?ageMs:null}});
 const usable=entries.filter(x=>x.available),den=Math.max(1,usable.length),trust=usable.reduce((s,x)=>s+x.weight,0)/den,verified=usable.filter(x=>x.quality==='VERIFIED').length,unsafe=usable.filter(x=>['FAILED','STALE','CONFLICTED'].includes(x.quality));
 return{trust:+clip(trust).toFixed(4),verifiedCount:verified,usableCount:usable.length,unsafeChannels:unsafe.map(x=>x.channel),entries};
}
export function provenanceAwareForecast(forecast,evidence={},cfg={}){
 const profile=provenanceProfile(evidence),minTrust=cfg.minEvidenceTrust??.65,minVerified=cfg.minVerifiedEvidence??1;
 const blocked=profile.unsafeChannels.length>0||profile.trust<minTrust||profile.verifiedCount<minVerified;
 const directional=Math.max(forecast.pUp??0,forecast.pDown??0),shrink=clip(profile.trust),pRange=clip((forecast.pRange??0)+(1-shrink)*directional),pUp=(forecast.pUp??0)*shrink,pDown=(forecast.pDown??0)*shrink,sum=pUp+pDown+pRange||1;
 return{forecast:{...forecast,pUp:pUp/sum,pDown:pDown/sum,pRange:pRange/sum},profile,blocked,blockReason:profile.unsafeChannels.length?'UNSAFE_EVIDENCE':profile.verifiedCount<minVerified?'INSUFFICIENT_VERIFIED_EVIDENCE':profile.trust<minTrust?'LOW_EVIDENCE_TRUST':null};
}
export function evidenceAttribution(evidence={}){return provenanceProfile(evidence).entries.sort((a,b)=>a.weight-b.weight).map(x=>({channel:x.channel,status:x.quality,weight:x.weight,source:x.source,observedAt:x.observedAt}));}
