import {armSensorAblation,settleSensorAblationBars} from './ablation-engine.mjs';
import {putEvidence,hasEvidence,readEvidence} from './ledger.mjs';
import {settlementPolicyForAsset,extractClosedSwapPath,fetchSwapCandles} from './ablation-price-path.mjs';
const channels=['funding','deltaOi','basis','orderFlow','depthImbalance'];
const baseDecision=a=>({action:a.action==='LONG_CANDIDATE'?'LONG':a.action==='SHORT_CANDIDATE'?'SHORT':'NO_TRADE',costBps:13});
function challenger(a,ch){const v=a.sensors?.values?.[ch],b=baseDecision(a);if(!Number.isFinite(v))return b;let support=0;if(ch==='funding')support=-Math.sign(v);if(ch==='deltaOi')support=Math.sign(v)*Math.sign(a.technicalScore||0);if(ch==='basis')support=-Math.sign(v)*Math.sign(a.technicalScore||0);if(ch==='orderFlow'||ch==='depthImbalance')support=Math.sign(v)*Math.sign(a.technicalScore||0);if(b.action==='NO_TRADE'&&a.action==='WATCH'&&support>0)return{action:(a.technicalScore||0)>=0?'LONG':'SHORT',costBps:13};if(b.action!=='NO_TRADE'&&support<0)return{action:'NO_TRADE',costBps:13};return b;}
export async function armLiveAblations(assets,at){
 const out=[];
 for(const a of assets.slice(0,12)){
  const policy=settlementPolicyForAsset(a,at);
  if(!policy)continue;
  for(const ch of channels){
   const v=a.sensors?.values?.[ch];if(!Number.isFinite(v))continue;
   const evidence={value:v,quality:a.sensors.status[ch].quality,source:a.sensors.status[ch].source,observedAt:a.observedAt};
   const t={...armSensorAblation({symbol:a.symbol,at,channel:ch,evidence,baseDecision:baseDecision(a),challengerDecision:challenger(a,ch)}),...policy};
   if(!await hasEvidence('ablation_trial',t.trialId)){await putEvidence('ablation_trial',t.trialId,t);out.push(t)}
  }
 }
 return out;
}
export async function settleLiveAblations(_assets,now,_spotBars=[],{fetchImpl=fetch}={}){
 const trials=await readEvidence('ablation_trial',{limit:5000})||[],settled=[],byInstrument=new Map();
 for(const t of trials){
  if(t.status!=='ARMED'||!t.settlementPolicy||Date.parse(now)<Date.parse(t.horizonEndAt)||await hasEvidence('ablation_settlement',t.trialId))continue;
  if(!byInstrument.has(t.instrumentId))byInstrument.set(t.instrumentId,[]);
  byInstrument.get(t.instrumentId).push(t);
 }
 for(const [instrumentId,group] of byInstrument){
  let rows;
  try{rows=await fetchSwapCandles(instrumentId,fetchImpl)}
  catch(error){console.error(JSON.stringify({event:'ABLATION_SETTLEMENT_SOURCE_UNAVAILABLE',instrumentId,error:error.message}));continue}
  for(const t of group){
   const path=extractClosedSwapPath(rows,t,now);
   if(!path)continue;
   const s=settleSensorAblationBars({...t,referencePrice:path.entryPrice},{bars:path.bars,settledAt:now,source:`okx-v5:${instrumentId}:closed-1H`});
   s.entryPrice=path.entryPrice;s.entryAt=t.entryAt;s.horizonEndAt=t.horizonEndAt;s.priceSource=t.priceSource;
   await putEvidence('ablation_settlement',t.trialId,s);settled.push(s);
  }
 }
 return settled;
}
