import {createHash} from 'node:crypto';
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
const sha=x=>createHash('sha256').update(stable(x)).digest('hex');
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
const date=x=>{const n=Date.parse(x);check(Number.isFinite(n),'BAD_TIMESTAMP');return n};
const num=x=>typeof x==='number'&&Number.isFinite(x);
export function freezeHypothesis(h){
  for(const k of ['id','symbol','baselineId','candidateId','source','counterargument','modelHash'])check(typeof h[k]==='string'&&h[k].length>0,'MISSING_'+k);
  check(['LONG','SHORT','NO_TRADE'].includes(h.action),'BAD_ACTION');
  check(date(h.observedAt)<=date(h.frozenAt)&&date(h.frozenAt)<date(h.targetAt),'LOOKAHEAD');
  check(num(h.entryPrice)&&h.entryPrice>0,'BAD_ENTRY');
  check(num(h.maxRoundtripCostBps)&&h.maxRoundtripCostBps>=0,'BAD_COST');
  const payload=Object.fromEntries(['id','symbol','baselineId','candidateId','source','counterargument','modelHash','action','observedAt','frozenAt','targetAt','entryPrice','maxRoundtripCostBps'].map(k=>[k,h[k]]));
  return Object.freeze({...payload,commitment:sha(payload)});
}
export function evaluateHypothesis(h,outcome){
  const {commitment,...data}=h;
  check(sha(data)===commitment,'TAMPERED');
  check(outcome.id===h.id,'ID_MISMATCH');
  check(date(outcome.observedAt)>=date(h.targetAt),'PREMATURE_OUTCOME');
  check(outcome.independentSource&&outcome.independentSource!==h.source,'SOURCE_NOT_INDEPENDENT');
  check(num(outcome.exitPrice)&&outcome.exitPrice>0,'BAD_EXIT');
  check(num(outcome.roundtripCostBps)&&outcome.roundtripCostBps>=0,'BAD_COST');
  const side=h.action==='LONG'?1:h.action==='SHORT'?-1:0;
  const grossPct=side*100*(outcome.exitPrice/h.entryPrice-1);
  const netPct=side===0?0:grossPct-outcome.roundtripCostBps/100;
  return Object.freeze({id:h.id,commitment,grossPct,netPct,observedAt:outcome.observedAt,independentSource:outcome.independentSource,costKind:outcome.costKind||'ASSUMED'});
}
export function promotionGate({candidate,baseline,minPairs=30,minImprovementPct=0,maxRegressionFraction=.4}){
  check(Array.isArray(candidate)&&Array.isArray(baseline)&&candidate.length===baseline.length,'UNPAIRED');
  const n=candidate.length;
  if(n<minPairs)return {status:'REJECT',reason:'INSUFFICIENT_PAIRS',n};
  check(candidate.every(num)&&baseline.every(num),'MISSING_OUTCOMES');
  const d=candidate.map((x,i)=>x-baseline[i]);
  const mean=d.reduce((a,b)=>a+b,0)/n;
  const sd=Math.sqrt(d.reduce((a,x)=>a+(x-mean)**2,0)/(n-1));
  const lower=mean-2.58*sd/Math.sqrt(n);
  const regressionFraction=d.filter(x=>x<0).length/n;
  return {status:lower>minImprovementPct&&regressionFraction<=maxRegressionFraction?'REVIEW':'REJECT',reason:'SCREENING_ONLY_NO_TRADING_AUTHORITY',n,mean,approxLower99Pct:lower,regressionFraction};
}
