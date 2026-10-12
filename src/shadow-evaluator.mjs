// Paired prospective shadow evaluation: baseline NO_TRADE has return 0.
const valid=x=>typeof x==='number'&&Number.isFinite(x);
export function compareShadow(rows,{minN=100}={}){
 if(!Array.isArray(rows)||rows.length<minN)return{status:'INSUFFICIENT_DATA',n:rows?.length??0};
 if(rows.some(r=>!r?.prospective||!r?.settled||!r?.independentOutcome||!valid(r?.kisaNetReturn)||!valid(r?.baselineNetReturn)||!valid(r?.opportunityNetReturn)))
  return{status:'UNVERIFIED_OUTCOMES'};
 const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
 const ks=rows.map(x=>x.kisaNetReturn),bs=rows.map(x=>x.baselineNetReturn);
 const excess=ks.map((x,i)=>x-bs[i]);
 const missed=rows.filter(x=>x.kisaAction==='NO_TRADE'&&x.opportunityNetReturn>0);
 const negative=rows.filter(x=>x.kisaAction!=='NO_TRADE'&&x.kisaNetReturn<0);
 return{status:'DESCRIPTIVE_ONLY',n:rows.length,kisaNetMean:mean(ks),noTradeMean:0,ruleNetMean:mean(bs),pairedDeltaVsRule:mean(excess),missedProfitableOpportunities:missed.length,losingKisaSignals:negative.length,warning:'Requires preregistered held-out confidence test and independent replay before promotion'};
}
