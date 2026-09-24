import fs from 'node:fs';
import path from 'node:path';
import {inferPriceNet} from './pricenet.mjs';
import {makePrediction} from './kernel.mjs';
import {appendLedger} from './ledger.mjs';
import {market} from './market.mjs';
export {market} from './market.mjs';
export async function runLive({marketFn=market,ledger=process.env.LEDGER_PATH||'data/prospective.jsonl'}={}) {
  const m=await marketFn(), px=inferPriceNet(m.bars);
  const forecast={pUp:px.pUp,pDown:px.pDown,pRange:px.pRange,mfe50:null,mae50:null,mae90:null};
  const p=makePrediction({ts:m.received_at,modelVersion:px.modelVersion,features:px.features,forecast});
  const row={...p,market:{...m,bars:undefined,reference_close:m.bars.at(-1).c},
    model:{sha256:px.modelSha256,uncertainty:px.uncertainty,ood:px.ood,kind:'linear-softmax',calibration_version:null},
    status:'OBSERVATION_ONLY',note:'Uncalibrated classifier. No executable entry, no shadow trade. Excursion artifact and calibrator are missing.'};
  fs.mkdirSync(path.dirname(ledger),{recursive:true});
  appendLedger(ledger,row);
  console.log(JSON.stringify({event:'MODEL_INFERENCE',timestamp:m.received_at,decision_id:row.predictionId,symbol:m.symbol,model_version:px.modelVersion,source:m.source,status:row.status,action:row.decision.action}));
  return row;
}
if(import.meta.url===`file://${process.argv[1]}`) runLive().catch(e=>{console.error(JSON.stringify({event:'ERROR',timestamp:new Date().toISOString(),status:'FAILED',error:e.message}));process.exitCode=1});
