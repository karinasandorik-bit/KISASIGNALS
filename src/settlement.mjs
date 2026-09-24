import fs from 'node:fs';
import path from 'node:path';
import {readLedger,appendLedger} from './ledger.mjs';
const bps=(x,entry)=>((x/entry)-1)*10000;
export function settleEligible({predictions='data/prospective.jsonl',settlements='data/settlements.jsonl',bars,now=new Date().toISOString()}){
 if(!Array.isArray(bars)||!bars.length)return[];
 const rows=readLedger(predictions),done=new Set(readLedger(settlements).map(x=>x.predictionId)),out=[];
 for(const p of rows){
  if(done.has(p.predictionId)||!p.plan||!['LONG','SHORT'].includes(p.decision?.action))continue;
  const t0=Date.parse(p.market?.feature_timestamp||p.market?.observed_at),entry=p.plan.entry;
  if(!Number.isFinite(t0)||Date.parse(now)<t0+4*3600000)continue;
  const future=bars.filter(b=>b.t*1000>=t0&&b.t*1000<t0+4*3600000).slice(0,4);
  if(future.length<4)continue;
  const hi=Math.max(...future.map(b=>b.h)),lo=Math.min(...future.map(b=>b.l)),last=future.at(-1).c;
  const long=p.decision.action==='LONG',mfe=long?bps(hi,entry):-bps(lo,entry),mae=long?-bps(lo,entry):bps(hi,entry);
  let firstTouch='NONE',ambiguous=false;
  for(const b of future){const hitTP=long?b.h>=p.plan.takeProfit:b.l<=p.plan.takeProfit,hitSL=long?b.l<=p.plan.stopLoss:b.h>=p.plan.stopLoss;if(hitTP&&hitSL){firstTouch='AMBIGUOUS';ambiguous=true;break}if(hitTP){firstTouch='TP';break}if(hitSL){firstTouch='SL';break}}
  const terminal=(last/entry-1)*10000*(long?1:-1),net=terminal-(p.decision.costBps||0);
  const s={event:'PROSPECTIVE_4H_SETTLEMENT',predictionId:p.predictionId,signalAt:p.market.feature_timestamp||p.ts,settledAt:now,side:p.decision.action,entry,stopLoss:p.plan.stopLoss,takeProfit:p.plan.takeProfit,firstTouch,ambiguous,realizedMfeBps:+mfe.toFixed(2),realizedMaeBps:+mae.toFixed(2),terminalReturnBps:+terminal.toFixed(2),netTerminalBps:+net.toFixed(2),source:p.market.source,horizonHours:4};
  fs.mkdirSync(path.dirname(settlements),{recursive:true});appendLedger(settlements,s);out.push(s);console.log(JSON.stringify(s));
 }
 return out;
}
