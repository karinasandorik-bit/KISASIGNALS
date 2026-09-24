import fs from 'node:fs';
import path from 'node:path';
import {inferPriceNet} from './pricenet.mjs';
import {makePrediction} from './kernel.mjs';
import {appendLedger,readLedger} from './ledger.mjs';
import {market} from './market.mjs';
export {market} from './market.mjs';
const pxPlan=(side,entry,risk)=>side==='LONG'?{entry,stopLoss:entry*(1-risk.slBps/10000),takeProfit:entry*(1+risk.tpBps/10000)}:{entry,stopLoss:entry*(1+risk.slBps/10000),takeProfit:entry*(1-risk.tpBps/10000)};
export async function runLive({marketFn=market,ledger=process.env.LEDGER_PATH||'data/prospective.jsonl'}={}){
 const m=await marketFn(),px=inferPriceNet(m.bars),forecast={pUp:px.pUp,pDown:px.pDown,pRange:px.pRange,LONG:px.excursions.LONG,SHORT:px.excursions.SHORT};
 const p=makePrediction({ts:m.received_at,modelVersion:px.modelVersion,features:px.features,forecast}),entry=m.bars.at(-1).c,trade=p.decision.action!=='NO_TRADE',plan=trade?{...pxPlan(p.decision.action,entry,p.risk),side:p.decision.action,rr:p.risk.rr,evBps:p.decision.evBps,costBps:p.decision.costBps,horizonHours:4}:null;
 const row={...p,plan,market:{...m,bars:undefined,reference_close:entry},model:{sha256:px.modelSha256,uncertainty:px.uncertainty,ood:px.ood,kind:'linear-softmax',calibration_version:px.calibrationVersion,calibration_sha256:px.calibrationSha256,calibration_status:px.calibrationStatus,calibration_diagnostics:px.calibrationDiagnostics},excursion:{status:px.excursionStatus,distribution:px.excursions,holdout:px.excursionDiagnostics,horizon_bars:px.horizonBars},signalQuality:{status:trade?'SHADOW_SIGNAL':'NO_TRADE',requirements:trade?['PROSPECTIVE_4H_SETTLEMENT']:[]},status:trade?'SHADOW_SIGNAL_ARMED':'OBSERVATION_ONLY',note:trade?'Entry/SL/TP frozen before outcome; no order execution.':'MetaGate abstained; no trade plan emitted.'};
 const prior=readLedger(ledger).find(x=>x.market?.feature_timestamp===row.market.feature_timestamp&&x.model?.calibration_version===row.model.calibration_version);\n if(prior)return prior;\n fs.mkdirSync(path.dirname(ledger),{recursive:true});appendLedger(ledger,row);
 console.log(JSON.stringify({event:'MODEL_INFERENCE',timestamp:m.received_at,decision_id:row.predictionId,symbol:m.symbol,model_version:px.modelVersion,calibration_version:px.calibrationVersion,source:m.source,status:row.status,action:row.decision.action,ev_bps:row.decision.evBps,rr:row.risk.rr}));
 return row;
}
if(import.meta.url===`file://${process.argv[1]}`)runLive().catch(e=>{console.error(JSON.stringify({event:'ERROR',timestamp:new Date().toISOString(),status:'FAILED',error:e.message}));process.exitCode=1});
