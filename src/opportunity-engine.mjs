const finite=Number.isFinite;
const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
export function rankOpportunities(rows=[],{minQuality=62,minStrength=18,minCoverage=.2}={}){
 const ranked=rows.map(x=>{
  const coverage=x.sensors?.coverage??0,quality=x.decisionQuality??0,strength=x.candidateStrength??0;
  const candidate=['LONG_CANDIDATE','SHORT_CANDIDATE'].includes(x.action);
  const eligible=candidate&&quality>=minQuality&&strength>minStrength&&coverage>=minCoverage;
  const direction=x.action==='LONG_CANDIDATE'?'LONG':x.action==='SHORT_CANDIDATE'?'SHORT':null;
  const evidencePenalty=clip(coverage,0,1);
  const score=eligible?+(quality*0.55+clip(strength,0,100)*0.30+evidencePenalty*100*0.15).toFixed(2):null;
  return {...x,opportunity:{eligible,direction,score,reason:eligible?'CANDIDATE_REQUIRES_CALIBRATED_ASSET_MODEL':!candidate?'NOT_DIRECTIONAL_CANDIDATE':coverage<minCoverage?'INSUFFICIENT_EVIDENCE_COVERAGE':'QUALITY_GATE'}};
 }).sort((a,b)=>(b.opportunity.score??-1)-(a.opportunity.score??-1));
 return ranked;
}
export function marketOpportunityDecision(rows=[]){
 const ranked=rankOpportunities(rows),best=ranked.find(x=>x.opportunity.eligible);
 return best?{action:'RESEARCH_CANDIDATE',symbol:best.symbol,direction:best.opportunity.direction,score:best.opportunity.score,tradeAuthority:'NONE_UNTIL_CALIBRATED_ASSET_MODEL',reason:best.opportunity.reason,ranked}:{action:'NO_TRADE',symbol:null,direction:null,score:null,tradeAuthority:'NONE',reason:'NO_MARKET_WIDE_CANDIDATE_PASSED',ranked};
}
