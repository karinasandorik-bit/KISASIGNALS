// Offline reproducible audit runner; no trade execution and no invented missing evidence.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readLedger,appendLedger} from './ledger.mjs';
import {closeShadowLoop} from './shadow-loop.mjs';
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function auditShadowCycle({predictions,bars,executionCosts,training,evaluation,payoffs}){
 if(!Array.isArray(predictions)||!Array.isArray(bars))throw Error('PREDICTIONS_AND_BARS_REQUIRED');
 const rows=predictions.map(p=>closeShadowLoop({prediction:p,bars,executionCosts,training,evaluation,payoffs}));
 const report={schema:'kisa.shadow-cycle.v1',generatedAt:new Date().toISOString(),predictions:predictions.length,settled:rows.filter(r=>r.execution?.status==='SETTLED').length,shadowEligible:rows.filter(r=>r.decision?.action!=='NO_TRADE').length,blocked:rows.filter(r=>r.decision?.action==='NO_TRADE').length,rows};
 return {...report,hash:sha(report)};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const input=process.argv[2],output=process.argv[3];
 if(!input||!output)throw Error('Usage: node src/shadow-cycle-runner.mjs <evidence.json> <audit.jsonl>');
 const bundle=JSON.parse(fs.readFileSync(input,'utf8'));
 const report=auditShadowCycle(bundle);
 appendLedger(output,report);
 console.log(JSON.stringify({event:'SHADOW_CYCLE_AUDIT',reportHash:report.hash,predictions:report.predictions,settled:report.settled,shadowEligible:report.shadowEligible,blocked:report.blocked,output}));
}
