// KISASIGNALS product contract: signal-terminal usability with evidence-first semantics.
// Never convert backtest/recent-hit statistics into a claim of future accuracy.
const finite=x=>Number.isFinite(Number(x));
const n=x=>finite(x)?Number(x):null;
const q=(obj={},name)=>n(obj[name]??obj[name.toLowerCase()]??obj[name.toUpperCase()]);
function trajectory(row={}){
 const f=row.forecast||row.prediction||row.probs||{},side=(row.plan?.action||row.action||row.decision?.action||'NO_TRADE');
 const ex=f[side]||f.excursion?.[side]||{};
 return {
  probabilities:{up:q(f,'pUp')??q(f,'UP'),down:q(f,'pDown')??q(f,'DOWN'),range:q(f,'pRange')??q(f,'RANGE')},
  mfeBps:{q10:q(ex,'mfe10'),q50:q(ex,'mfe50'),q90:q(ex,'mfe90')},
  maeBps:{q10:q(ex,'mae10'),q50:q(ex,'mae50'),q90:q(ex,'mae90')}
 };
}
function score(row={}){
 const cal=String(row.calibration_status||row.calibration?.status||row.model?.calibration_status||'UNKNOWN').toUpperCase();
 const consensus=row.futuresConsensus||row.consensus||row.futures_state?.consensus;
 const calibrated=/OK|PASS|CALIBRATED|VERIFIED/.test(cal),venues=n(consensus?.sourceCount)||0,disagreement=n(consensus?.markSpreadBps);
 const uncertainty=n(row.model?.uncertainty),ood=n(row.model?.ood);
 let s=50;if(calibrated)s+=15;if(venues>=2)s+=10;if(venues>=3)s+=5;if(finite(disagreement))s+=Math.max(-15,10-Math.abs(disagreement));if(finite(uncertainty))s-=Math.min(20,uncertainty*20);if(finite(ood))s-=Math.min(20,ood*20);
 return Math.max(0,Math.min(100,Math.round(s)));
}
export function signalProductView(row={},liveFutures=null){
 const plan=row.plan||{},entry=row.entryPolicy||{},action=plan.action||row.action||row.decision?.action||'NO_TRADE';
 const status=action==='NO_TRADE'?'PASS':entry.action==='WAIT'?'WAITING':entry.action==='LIMIT'?'IN_ENTRY':'ACTIVE';
 const t=trajectory(row),consensus=liveFutures?.consensus||row.futuresConsensus||row.consensus||row.futures_state?.consensus||null,fs=liveFutures?.state||row.futuresState||{};
 const venueStates=(consensus?.states||[]).map(v=>({source:v.source,markPrice:n(v.markPrice),indexPrice:n(v.indexPrice),fundingRate:n(v.fundingRate),observedAt:v.observedAt||v.sourceObservedAt||null,status:v.quality||'LIVE'}));
 const marks=venueStates.map(v=>v.markPrice).filter(finite),referencePrice=marks.length?[...marks].sort((a,b)=>a-b)[Math.floor(marks.length/2)]:n(fs.markPrice);
 return {
  id:row.decision_id||row.predictionId||row.event_id||row.id||null,symbol:row.symbol||row.market?.symbol||'BTCUSDT',horizon:row.horizon||'4h',
  action,status,prospectiveScore:score(row),priority:row.validator?.confluence?.agreement??null,
  entry:{mode:entry.action||'REFERENCE',price:n(entry.limitPrice??plan.entry_price??plan.entry??row.entry_price),zone:entry.zone||null,expiresAt:entry.expiresAt||null},
  risk:{sl:n(plan.SL??plan.sl??plan.stopLoss),tp1:n(plan.TP1??plan.tp1??plan.TP??plan.tp??plan.takeProfit),tp2:n(plan.TP2??plan.tp2),tp3:n(plan.TP3??plan.tp3),tp4:n(plan.TP4??plan.tp4),rr:n(plan.rr??row.rr),evBps:n(row.probabilisticEvBps??row.evBps??plan.evBps)},
  trajectory:t,
  model:{calibration:row.calibration_status||row.calibration?.status||row.model?.calibration_status||'UNKNOWN',version:row.modelVersion||row.model?.version||null,uncertainty:n(row.model?.uncertainty),ood:n(row.model?.ood)},
  market:{referencePrice,fundingRate:n(fs.fundingRate??row.fundingRate),openInterest:n(fs.openInterest??row.openInterest),basisBps:n(fs.markIndexBps??row.basisBps),depthImbalance:n(fs.depthImbalance??row.depthImbalance),flowImbalance:n(fs.flowImbalance??row.flowImbalance)},
  consensus:consensus?{verified:Boolean(consensus.verified),tradeAuthority:consensus.tradeAuthority??null,sourceCount:n(consensus.sourceCount),sources:venueStates.length?venueStates:(consensus.sources||[]),markSpreadBps:n(consensus.markSpreadBps),reason:consensus.reason||null}:null,
  validator:row.validator||null,
  evidence:{mode:'PROSPECTIVE_ONLY',frozenAt:row.created_at||row.armedAt||row.observedAt||row.ts||null,modelSha:row.model_sha||row.model?.sha256||null,source:row.evidence?.source||row.market?.source||row.source||null,sourceObservedAt:row.evidence?.observed_at||row.market?.feature_timestamp||row.sourceObservedAt||null}
 };
}
export function openEntries(rows=[]){return rows.map(x=>signalProductView(x.payload||x)).filter(x=>['WAITING','IN_ENTRY','ACTIVE'].includes(x.status)&&x.action!=='NO_TRADE')}
export function evidenceStats({rows=[],settlements=[],trials=[],trialSettlements=[]}={}){
 const settled=settlements.map(x=>x.payload||x),net=settled.map(x=>Number(x.netPnlBps??x.net_pnl_bps??x.netTerminalBps)).filter(Number.isFinite),wins=net.filter(x=>x>0).length;
 return {frozenSignals:rows.length,settled:settled.length,winRate:net.length?wins/net.length:null,expectancyBps:net.length?net.reduce((a,b)=>a+b,0)/net.length:null,prospectiveTrials:trials.length,trialSettlements:trialSettlements.length,evidenceMode:'PROSPECTIVE_ONLY',accuracyClaim:'NOT_AUTHORIZED_WITHOUT_SUFFICIENT_PROSPECTIVE_OOS_EVIDENCE'};
}
