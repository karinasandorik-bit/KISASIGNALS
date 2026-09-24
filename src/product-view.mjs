// KISASIGNALS product contract: GGShot-grade usability, evidence-first semantics.
export function signalProductView(row={}){
 const p=row.prediction||row.probs||{},plan=row.plan||{},entry=row.entryPolicy||{};
 const action=plan.action||row.action||'NO_TRADE';
 const status=action==='NO_TRADE'?'PASS':entry.action==='WAIT'?'WAITING':entry.action==='LIMIT'?'IN_ENTRY':'ACTIVE';
 return {
  id:row.decision_id||row.event_id||row.id||null,symbol:row.symbol||'BTCUSDT',horizon:row.horizon||'4h',
  action,status,priority:row.validator?.confluence?.agreement??null,
  entry:{mode:entry.action||'REFERENCE',price:entry.limitPrice??plan.entry_price??row.entry_price??null,zone:entry.zone||null},
  risk:{sl:plan.SL??plan.sl??null,tp1:plan.TP1??plan.tp1??plan.TP??plan.tp??null,tp2:plan.TP2??plan.tp2??null,tp3:plan.TP3??plan.tp3??null,tp4:plan.TP4??plan.tp4??null,rr:plan.rr??row.rr??null},
  model:{pUp:p.UP??p.pUp??null,pDown:p.DOWN??p.pDown??null,pRange:p.RANGE??p.pRange??null,calibration:row.calibration_status||row.calibration?.status||'UNKNOWN'},
  validator:row.validator||null,evBps:row.probabilisticEvBps??row.evBps??null,
  evidence:{frozenAt:row.created_at||row.armedAt||row.observedAt||null,modelSha:row.model_sha||row.model?.sha256||null,source:row.evidence?.source||row.source||null,sourceObservedAt:row.evidence?.observed_at||row.sourceObservedAt||null}
 };
}
export function openEntries(rows=[]){return rows.map(signalProductView).filter(x=>['WAITING','IN_ENTRY','ACTIVE'].includes(x.status)&&x.action!=='NO_TRADE')}
export function evidenceStats({rows=[],settlements=[],trials=[],trialSettlements=[]}={}){
 const settled=settlements.map(x=>x.payload||x),net=settled.map(x=>Number(x.netPnlBps??x.net_pnl_bps)).filter(Number.isFinite);
 const wins=net.filter(x=>x>0).length;return {frozenSignals:rows.length,settled:settled.length,winRate:net.length?wins/net.length:null,expectancyBps:net.length?net.reduce((a,b)=>a+b,0)/net.length:null,prospectiveTrials:trials.length,trialSettlements:trialSettlements.length,evidenceMode:'PROSPECTIVE_ONLY'};
}
