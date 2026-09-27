import crypto from 'node:crypto';
// Independent prospective promotion evaluator. It consumes settled evidence only.
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const sha256=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const quantile=(a,q)=>{const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo)};
function bootstrapCI(xs,iterations=2000){if(xs.length<2)return{low:null,high:null};let seed=2166136261;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};const ms=[];for(let k=0;k<iterations;k++){let s=0;for(let i=0;i<xs.length;i++)s+=xs[Math.floor(rnd()*xs.length)];ms.push(s/xs.length)}return{low:+quantile(ms,.025).toFixed(3),high:+quantile(ms,.975).toFixed(3)}}
export function evaluatePromotion(rows,{channel,minN=100,minActionChanges=30,minRegimes=3,alpha=.05}={}){
 const r=rows.filter(x=>x.status==='SETTLED'&&(!channel||x.channel===channel)&&Number.isFinite(x.incrementalNetBps));
 const changed=r.filter(x=>x.didActionChange),d=changed.map(x=>x.incrementalNetBps),ci=bootstrapCI(d);
 const regimes=new Set(changed.map(x=>x.regime).filter(Boolean));
 const tailBase=changed.map(x=>x.baselineResult?.maeBps).filter(Number.isFinite),tailCh=changed.map(x=>x.challengerResult?.maeBps).filter(Number.isFinite);
 const tailDelta=tailBase.length&&tailCh.length?quantile(tailCh,.95)-quantile(tailBase,.95):null;
 const checks={enoughN:r.length>=minN,enoughActionChanges:changed.length>=minActionChanges,positiveLowerBound:Number.isFinite(ci.low)&&ci.low>0,regimeStable:regimes.size>=minRegimes,tailSafe:Number.isFinite(tailDelta)&&tailDelta<=0,prospectiveOnly:r.every(x=>x.world?.pathHash&&x.featureCutoff&&Date.parse(x.featureCutoff)<=Date.parse(x.armedAt)),noAuthorityLeak:r.every(x=>x.tradeAuthority==='NONE')};
 const promote=Object.values(checks).every(Boolean);
 const proof={schema:'KISA_PROMOTION_PROOF_V1',channel,n:r.length,actionChanges:changed.length,meanIncrementalNetBps:d.length?+mean(d).toFixed(3):null,bootstrap95:ci,tailDelta95Bps:Number.isFinite(tailDelta)?+tailDelta.toFixed(3):null,regimeCount:regimes.size,alpha,checks,promote,status:promote?'PROMOTION_CANDIDATE':'CONTINUE_SHADOW',settledEvidence:changed.map(x=>({trialId:x.trialId??x.decisionId??null,pathHash:x.world?.pathHash??null,featureCutoff:x.featureCutoff,armedAt:x.armedAt,incrementalNetBps:x.incrementalNetBps})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};
 return Object.freeze({...proof,evidenceRoot:sha256(proof)});
}
