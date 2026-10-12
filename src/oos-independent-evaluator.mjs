// Read-only, fail-closed prospective evaluator. This module never places orders.
// Price bars must be supplied by an independent outcome collector, not by PriceNet.
import crypto from 'node:crypto';
const HOUR=3600_000;
const finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error('INVALID_'+name);return v};
const time=(v,name)=>{const t=Date.parse(v);if(!Number.isFinite(t))throw Error('INVALID_'+name);return t};
const bps=(a,b)=>(a/b-1)*10000;
export const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function evaluateOne(prediction,outcome,{feeEntryBps,feeExitBps,spreadBps,slippageEntryBps,slippageExitBps,fundingBps=0}={}){
 const p=prediction.payload??prediction, w=outcome.payload??outcome;
 if(!p.predictionId||w.predictionId!==p.predictionId)throw Error('PREDICTION_OUTCOME_ID_MISMATCH');
 const signal=time(p.market?.feature_timestamp??p.ts,'SIGNAL_TIME');
 const frozen=time(p.frozenAt??p.created_at??p.ts,'FREEZE_TIME');
 if(frozen<signal||frozen>signal+5*60_000)throw Error('UNTRUSTED_FREEZE_TIMESTAMP');
 if(!p.model?.sha256||!p.model?.calibration_sha256)throw Error('MODEL_LINEAGE_MISSING');
 if(p.epistemic?.status==='TAINTED'||p.tainted===true)throw Error('TAINTED_EVIDENCE');
 const observed=time(w.observedAt??w.settledAt,'OUTCOME_OBSERVED_AT');
 if(observed<signal+4*HOUR)throw Error('OUTCOME_NOT_MATURE');
 if(!w.independentSource||w.independentSource===p.market?.source)throw Error('OUTCOME_SOURCE_NOT_INDEPENDENT');
 if(!Array.isArray(w.bars)||w.bars.length!==4)throw Error('FOUR_CLOSED_HOURLY_BARS_REQUIRED');
 const bars=w.bars.map((b,i)=>{
  const t=time(b.closedAt,'BAR_CLOSED_AT');
  if(t!==signal+(i+1)*HOUR)throw Error('BAR_ALIGNMENT_OR_GAP');
  const o=finite(b.o,'OPEN'),h=finite(b.h,'HIGH'),l=finite(b.l,'LOW'),c=finite(b.c,'CLOSE');
  if(!(l>0&&l<=Math.min(o,c)&&h>=Math.max(o,c)))throw Error('INVALID_OHLC');
  return {t,o,h,l,c};
 });
 if(bars.some(b=>observed<b.t))throw Error('LOOKAHEAD_OUTCOME');
 const side=p.decision?.action;
 const params=[feeEntryBps,feeExitBps,spreadBps,slippageEntryBps,slippageExitBps,fundingBps];
 if(params.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0))throw Error('COST_SCHEDULE_REQUIRED');
 const costs=feeEntryBps+feeExitBps+spreadBps+slippageEntryBps+slippageExitBps+fundingBps;
 const ref=finite(p.market?.reference_close,'REFERENCE_PRICE');if(ref<=0)throw Error('INVALID_REFERENCE_PRICE');
 if(side==='NO_TRADE')return {id:p.predictionId,side,netBps:0,grossBps:0,costBps:0,trade:0,exit:'ABSTAIN',modelSha256:p.model.sha256,worldHash:digest(w)};
 if(!['LONG','SHORT'].includes(side)||!p.plan||p.plan.side!==side)throw Error('INVALID_TRADE_PLAN');
 const entry=finite(p.plan.entry,'ENTRY'),sl=finite(p.plan.stopLoss,'STOP'),tp=finite(p.plan.takeProfit,'TAKE_PROFIT');
 if(!(entry>0&&Math.abs(bps(entry,ref))<=100&&((side==='LONG'&&sl<entry&&tp>entry)||(side==='SHORT'&&sl>entry&&tp<entry))))throw Error('INVALID_FROZEN_PLAN');
 // Reference-entry execution assumed at the frozen entry. No optimistic intrabar order.
 let exitPrice=bars.at(-1).c,exit='TIME',ambiguous=false;
 for(const bar of bars){
  const gapStop=side==='LONG'?bar.o<=sl:bar.o>=sl;
  const gapTake=side==='LONG'?bar.o>=tp:bar.o<=tp;
  const hitStop=side==='LONG'?bar.l<=sl:bar.h>=sl;
  const hitTake=side==='LONG'?bar.h>=tp:bar.l<=tp;
  if(gapStop){exitPrice=bar.o;exit='STOP_GAP';break}
  if(gapTake){exitPrice=tp;exit='TAKE_GAP_CAPPED';break}
  if(hitStop){exitPrice=sl;exit=hitTake?'AMBIGUOUS_STOP_FIRST':'STOP';ambiguous=hitTake;break}
  if(hitTake){exitPrice=tp;exit='TAKE';break}
 }
 const grossBps=(side==='LONG'?1:-1)*bps(exitPrice,entry);
 return {id:p.predictionId,side,trade:1,exit,ambiguous,modelSha256:p.model.sha256,worldHash:digest(w),grossBps, costBps:costs,netBps:grossBps-costs};
}
export function scorePaired(rows,{minTrades=100}={}){
 if(!Array.isArray(rows)||!rows.length)throw Error('NO_PAIRED_ROWS');
 const ids=new Set();
 for(const r of rows){if(!r.id||ids.has(r.id)||!Number.isFinite(r.netBps)||![0,1].includes(r.trade))throw Error('INVALID_OR_DUPLICATED_ROW');ids.add(r.id)}
 const trades=rows.filter(r=>r.trade);
 const n=trades.length,net=trades.reduce((s,r)=>s+r.netBps,0),avg=n?net/n:null;
 const wins=trades.filter(r=>r.netBps>0).length;
 return {nPredictions:rows.length,nTrades:n,coverage:n/rows.length,meanNetTradeBps:avg,totalNetBps:net,winRate:n?wins/n:null,ambiguousCount:trades.filter(r=>r.ambiguous).length,promotionEligible:n>=minTrades&&trades.every(r=>!r.ambiguous)};
}
export function comparePaired(candidate,baseline){
 if(candidate.length!==baseline.length)throw Error('UNPAIRED_LENGTH');
 const ids=baseline.map(x=>x.id);
 if(candidate.some((x,i)=>x.id!==ids[i]))throw Error('UNPAIRED_ID');
 const d=candidate.map((x,i)=>x.netBps-baseline[i].netBps);
 const avg=d.reduce((a,b)=>a+b,0)/d.length;
 // Dependence-aware inference must be run separately with time blocks: no iid p-value here.
 return {n:d.length,meanIncrementalNetBps:avg,totalIncrementalNetBps:d.reduce((a,b)=>a+b,0),inference:'BLOCK_BOOTSTRAP_REQUIRED',promotionEligible:false};
}
