import crypto from 'node:crypto';

const finite=x=>Number.isFinite(Number(x));
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function signalContract(row){
  if(!row?.predictionId) throw Error('SIGNAL_CONTRACT_REQUIRES_PREDICTION_ID');
  const action=row.decision?.action??'NO_TRADE';
  const contract={
    schema:'kisa.signal-contract.v1',
    decisionId:row.predictionId,
    createdAt:row.market?.feature_timestamp||row.ts,
    symbol:row.market?.symbol||'BTCUSDT',
    action,
    horizonHours:row.plan?.horizonHours??4,
    entry:row.plan?.entry??null,
    stopLoss:row.plan?.stopLoss??null,
    takeProfit:row.plan?.takeProfit??null,
    probabilities:{up:row.forecast?.pUp??null,down:row.forecast?.pDown??null,range:row.forecast?.pRange??null},
    forecastExcursions:row.excursion?.distribution??null,
    expectedValueBps:row.decision?.evBps??null,
    rr:row.risk?.rr??null,
    evidence:{
      source:row.market?.source??null,
      observedAt:row.market?.feature_timestamp||row.market?.observed_at||null,
      futuresVerified:row.futuresConsensus?.verified===true,
      venueCount:row.futuresConsensus?.sourceCount??0,
      venueSpreadBps:row.futuresConsensus?.markSpreadBps??null
    },
    model:{version:row.modelVersion,sha256:row.model?.sha256??null,calibrationVersion:row.model?.calibration_version??null,calibrationSha256:row.model?.calibration_sha256??null}
  };
  return Object.freeze({...contract,contractHash:sha(contract)});
}

function sideProbability(p){
  if(p?.decision?.action==='LONG') return Number(p.forecast?.pUp);
  if(p?.decision?.action==='SHORT') return Number(p.forecast?.pDown);
  return null;
}
function outcomeSuccess(s){return s?.firstTouch==='TP'?1:s?.firstTouch==='SL'?0:null}

export function calibrationSnapshot(predictions=[],settlements=[]){
  const byId=new Map(predictions.map(x=>{const p=x.payload||x;return [p.predictionId,p]}));
  const obs=[];
  for(const raw of settlements){
    const s=raw.payload||raw,p=byId.get(s.predictionId),y=outcomeSuccess(s),q=sideProbability(p);
    if(!p||y===null||!finite(q)) continue;
    obs.push({decisionId:s.predictionId,q:clamp(q),y,netBps:Number(s.netTerminalBps),side:p.decision?.action});
  }
  const n=obs.length;
  if(!n) return {schema:'kisa.calibration.v1',n:0,status:'INSUFFICIENT_PROSPECTIVE_EVIDENCE',brier:null,winRate:null,expectancyBps:null};
  const brier=obs.reduce((a,o)=>a+(o.q-o.y)**2,0)/n;
  const winRate=obs.reduce((a,o)=>a+o.y,0)/n;
  const net=obs.filter(o=>finite(o.netBps));
  const expectancy=net.length?net.reduce((a,o)=>a+o.netBps,0)/net.length:null;
  return {schema:'kisa.calibration.v1',n,status:n>=30?'PROSPECTIVE_CALIBRATION_ACTIVE':'WARMING_UP',brier:+brier.toFixed(6),winRate:+winRate.toFixed(6),expectancyBps:expectancy===null?null:+expectancy.toFixed(3),observationHash:sha(obs)};
}

export function kisaEdge(row,calibration){
  const q=sideProbability(row),n=Number(calibration?.n||0);
  if(!['LONG','SHORT'].includes(row?.decision?.action)||!finite(q)) return {status:'ABSTAIN',score:null,label:'NO_TRADE',prospectiveN:n};
  if(n<10) return {status:'WARMING_UP',score:null,label:'UNPROVEN',prospectiveN:n};
  const skill=clamp(1-Number(calibration.brier)/0.25);
  const sample=clamp(Math.log10(n+1)/2);
  const expectancy=finite(calibration.expectancyBps)?clamp((Number(calibration.expectancyBps)+25)/75):0.5;
  const score=Math.round(100*(0.5*skill+0.3*sample+0.2*expectancy));
  return {status:'PROSPECTIVE',score,label:score>=75?'HIGH':score>=55?'MEDIUM':'LOW',prospectiveN:n,calibrationBrier:calibration.brier,expectancyBps:calibration.expectancyBps};
}
