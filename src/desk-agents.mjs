const clamp=x=>Math.max(-1,Math.min(1,x));
const opinion=(agent,score,evidence,reason)=>({agent,score:+clamp(score).toFixed(4),vote:score>.15?'LONG':score<-.15?'SHORT':'ABSTAIN',confidence:+Math.min(1,Math.abs(score)).toFixed(4),evidence,reason});
export function runDeskAgents({px,consensus,futuresState,context,marketOpportunity}){
 const fs=futuresState?.ok?futuresState.state:null;
 const trend=(px.pUp??0)-(px.pDown??0);
 const micro=fs?clamp((fs.depthImbalance??0)*.55+(fs.flowImbalance??0)*.45):0;
 const deriv=fs?clamp((fs.openInterestChangePct??0)/4-(fs.fundingRate??0)*1500):0;
 const regime=clamp(trend*(1-(px.pRange??0)));
 const cross=clamp((consensus?.agreementScore??0)*trend);
 const opportunity=marketOpportunity?.symbol==='BTCUSDT'?clamp((marketOpportunity.direction==='LONG'?1:-1)*(marketOpportunity.score??0)/100):0;
 const skeptic=clamp(-Math.sign(trend||1)*Math.max(typeof px.ood==='number'?px.ood:(px.ood?.score??0),consensus?.verified?0:.8));
 const quality=consensus?.verified?clamp(trend):0;
 return [
  opinion('PRICENET',trend,['pricenet'],'frozen directional posterior'),
  opinion('MICROSTRUCTURE',micro,['depth_imbalance','flow_imbalance'],'order-book and trade flow'),
  opinion('DERIVATIVES',deriv,['open_interest','funding'],'positioning pressure'),
  opinion('REGIME',regime,['p_range','direction'],'direction discounted by range probability'),
  opinion('CROSS_VENUE',cross,['venue_agreement'],'direction weighted by independent venue agreement'),
  opinion('OPPORTUNITY',opportunity,['universe_rank'],'cross-asset opportunity engine'),
  opinion('SKEPTIC',skeptic,['ood','consensus'],'adversarial veto-seeking critic'),
  opinion('EVIDENCE_QUALITY',quality,['consensus_verified'],'epistemic quality vote')
 ];
}
