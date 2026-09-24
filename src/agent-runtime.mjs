import {inferPriceNet} from './pricenet.mjs';
import {metaGate,riskEngine} from './kernel.mjs';
import {captureFuturesConsensus} from './futures-recorder.mjs';
import {market} from './market.mjs';
import {putEvidence} from './ledger.mjs';
import {ProspectiveLedger,createRiskConstitution,createExecutor,runBoundedCycle} from './bounded-agent.mjs';

const bps=(a,b)=>b?Math.abs(a-b)/b*1e4:Infinity;
const pgLedger=new ProspectiveLedger({append:async e=>{
  const ok=await putEvidence('agent_cycle',e.event_id,e);
  if(!ok) throw Error('POSTGRES_LEDGER_REQUIRED');
}});

function decisionFromPriceNet(px,consensus,referencePrice){
 const f={pUp:px.pUp,pDown:px.pDown,pRange:px.pRange,LONG:px.excursions.LONG,SHORT:px.excursions.SHORT};
 const d=metaGate(f);
 if(d.action==='NO_TRADE') return {action:'ABSTAIN',reason:d.reason};
 if(!consensus?.verified) return {action:'ABSTAIN',reason:'FUTURES_CONSENSUS_BLOCK'};
 const r=riskEngine(d,Number(process.env.KISA_EQUITY_USD||1000),Number(process.env.KISA_RISK_FRACTION||.001));
 const stop=d.action==='LONG'?referencePrice*(1-r.slBps/10000):referencePrice*(1+r.slBps/10000);
 return {action:d.action,symbol:'BTCUSDT',risk_usd:+(r.sizeUsd*r.slBps/10000).toFixed(4),notional_usd:r.sizeUsd,leverage:1,stop,model_version:px.modelVersion,model_sha256:px.modelSha256,reason:d.reason};
}

export async function runIntegratedAgent({mode=process.env.KISA_EXECUTION_MODE||'SHADOW',marketFn=market,shadowFn=async i=>({kind:'shadow',accepted:true,intent:i}),paperFn=async i=>({kind:'paper',accepted:true,intent:i}),microLiveFn=async()=>{throw Error('MICRO_LIVE_ADAPTER_NOT_CONFIGURED')}}={}){
 let state;
 return runBoundedCycle({
  mode,ledger:pgLedger,
  perceive:async()=>{
   const m=await marketFn(),consensus=await captureFuturesConsensus('BTCUSDT'),referencePrice=m.bars.at(-1).c;
   state={m,consensus,referencePrice,px:inferPriceNet(m.bars)};
   return {symbol:'BTCUSDT',received_at:m.received_at,referencePrice,model:{version:state.px.modelVersion,sha256:state.px.modelSha256},futures:{verified:consensus.verified,reason:consensus.reason,sources:consensus.sources},risk_context:{dailyLossUsd:0,venueDisagreementBps:consensus.markSpreadBps,evidenceAgeMs:Math.max(0,Date.now()-Date.parse(consensus.observedAt))}};
  },
  estimateUncertainty:async()=>({pricenet:state.px.uncertainty,ood:state.px.ood,venueAgreement:state.consensus.agreementScore}),
  decide:async()=>decisionFromPriceNet(state.px,state.consensus,state.referencePrice),
  proposeEvidence:async({decision})=>decision.action==='ABSTAIN'&&state.consensus.reason!=='CONSENSUS'?{measurement:'futures_consensus_refresh',predicted_effect:'may change ABSTAIN to trade only if independent venues converge'}:null,
  acquireEvidence:async()=>{const c=await captureFuturesConsensus('BTCUSDT');state.consensus=c;return {measurement:'futures_consensus_refresh',verified:c.verified,reason:c.reason,sources:c.sources}},
  riskConstitution:createRiskConstitution({allowedSymbols:['BTCUSDT'],maxRiskUsd:Number(process.env.KISA_MAX_RISK_USD||1),maxNotionalUsd:Number(process.env.KISA_MAX_NOTIONAL_USD||1000),maxLeverage:1,maxDailyLossUsd:Number(process.env.KISA_MAX_DAILY_LOSS_USD||3),maxVenueDisagreementBps:Number(process.env.FUTURES_MAX_MARK_SPREAD_BPS||8)}),
  executor:createExecutor({shadow:shadowFn,paper:paperFn,microLive:microLiveFn}),
  settle:async({execution})=>({status:'PENDING_4H',execution_kind:execution.kind,settle_after:new Date(Date.now()+4*3600e3).toISOString()}),
  causalAudit:async({d0,decision,evidence,outcome})=>({decision_changed:JSON.stringify(d0)!==JSON.stringify(decision),measurement:evidence?.measurement??null,outcome_status:outcome.status})
 });
}
if(import.meta.url===`file://${process.argv[1]}`)runIntegratedAgent().then(x=>console.log(JSON.stringify({event:'BOUNDED_AGENT_CYCLE',status:x.status,mode:x.mode,run_id:x.runId}))).catch(e=>{console.error(JSON.stringify({event:'BOUNDED_AGENT_ERROR',error:e.message}));process.exitCode=1});
