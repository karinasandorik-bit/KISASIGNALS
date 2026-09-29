import fs from 'node:fs';
import path from 'node:path';
import {readLedger,appendLedger,hasEvidence,putEvidence} from './ledger.mjs';
import {recordLineage} from './lineage.mjs';
const bps=(x,entry)=>((x/entry)-1)*10000;
export function worldOutcome4h(p,future,now){
 const entry=p.market?.reference_close??p.plan?.entry;
 if(!Number.isFinite(entry)||!Array.isArray(future)||future.length<4)return null;
 const hi=Math.max(...future.map(b=>b.h)),lo=Math.min(...future.map(b=>b.l)),last=future.at(-1).c;
 return {event:'WORLD_OUTCOME_4H',predictionId:p.predictionId,signalAt:p.market?.feature_timestamp||p.ts,settledAt:now,chosenAction:p.decision?.action||'UNKNOWN',referencePrice:entry,terminalMarketReturnBps:+bps(last,entry).toFixed(2),long:{mfeBps:+bps(hi,entry).toFixed(2),maeBps:+(-bps(lo,entry)).toFixed(2),terminalBps:+bps(last,entry).toFixed(2)},short:{mfeBps:+(-bps(lo,entry)).toFixed(2),maeBps:+bps(hi,entry).toFixed(2),terminalBps:+(-bps(last,entry)).toFixed(2)},source:p.market?.source,horizonHours:4};
}
export async function settleEligible({predictions='data/prospective.jsonl',settlements='data/settlements.jsonl',bars,now=new Date().toISOString()}){
 if(!Array.isArray(bars)||!bars.length)return[];
 const rows=readLedger(predictions),done=new Set(readLedger(settlements).map(x=>x.predictionId)),out=[];
 for(const p of rows){
  const t0=Date.parse(p.market?.feature_timestamp||p.market?.observed_at||p.ts);
  if(!Number.isFinite(t0)||Date.parse(now)<t0+4*3600000)continue;
  const future=bars.filter(b=>b.t*1000>t0&&b.t*1000<=t0+4*3600000).slice(0,4);
  if(future.length<4)continue;
  const world=worldOutcome4h(p,future,now);
  if(world){
   const worldId=p.predictionId+':4h';
   let exists=false;try{exists=await hasEvidence('world_outcome',worldId)}catch{}
   if(!exists){try{await putEvidence('world_outcome',worldId,world);world.lineageHash=await recordLineage('world_outcome',worldId,world,{parentHashes:p.lineageHash?[p.lineageHash]:[]})}catch(e){console.error(JSON.stringify({event:'POSTGRES_WORLD_OUTCOME_WRITE_FAILED',error:e.message}))}out.push(world);console.log(JSON.stringify(world))}
  }
  if(done.has(p.predictionId)||!p.plan||!['LONG','SHORT'].includes(p.decision?.action))continue;
  try{if(await hasEvidence('settlement',p.predictionId))continue}catch{}
  const entry=p.plan.entry,hi=Math.max(...future.map(b=>b.h)),lo=Math.min(...future.map(b=>b.l)),last=future.at(-1).c;
  const long=p.decision.action==='LONG',mfe=long?bps(hi,entry):-bps(lo,entry),mae=long?-bps(lo,entry):bps(hi,entry);
  let firstTouch='NONE',ambiguous=false;
  for(const b of future){const hitTP=long?b.h>=p.plan.takeProfit:b.l<=p.plan.takeProfit,hitSL=long?b.l<=p.plan.stopLoss:b.h>=p.plan.stopLoss;if(hitTP&&hitSL){firstTouch='AMBIGUOUS';ambiguous=true;break}if(hitTP){firstTouch='TP';break}if(hitSL){firstTouch='SL';break}}
  const terminal=(last/entry-1)*10000*(long?1:-1),net=terminal-(p.decision.costBps||0);
  const s={event:'PROSPECTIVE_4H_SETTLEMENT',predictionId:p.predictionId,signalAt:p.market.feature_timestamp||p.ts,settledAt:now,side:p.decision.action,entry,stopLoss:p.plan.stopLoss,takeProfit:p.plan.takeProfit,firstTouch,ambiguous,realizedMfeBps:+mfe.toFixed(2),realizedMaeBps:+mae.toFixed(2),terminalReturnBps:+terminal.toFixed(2),netTerminalBps:+net.toFixed(2),source:p.market.source,horizonHours:4};
  fs.mkdirSync(path.dirname(settlements),{recursive:true});appendLedger(settlements,s);try{await putEvidence('settlement',p.predictionId,s);s.lineageHash=await recordLineage('settlement',p.predictionId,s,{parentHashes:p.lineageHash?[p.lineageHash]:[]})}catch(e){console.error(JSON.stringify({event:'POSTGRES_SETTLEMENT_WRITE_FAILED',error:e.message}))}out.push(s);console.log(JSON.stringify(s));
 }
 return out;
}
