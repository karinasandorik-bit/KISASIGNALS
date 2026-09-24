const finite=x=>Number.isFinite(x),clip=(x,a,b)=>Math.max(a,Math.min(b,x));
export const SENSOR_CHANNELS=['funding','deltaOi','basis','orderFlow','depthImbalance','liquidations','social','news','fundamental','onchain'];
export function sensorSnapshot(asset,evidence={}){
 const values={funding:asset.fundingRate,deltaOi:asset.deltaOiPct,basis:asset.basisBps,orderFlow:asset.orderFlow,depthImbalance:asset.depthImbalance};
 for(const k of ['liquidations','social','news','fundamental','onchain']) values[k]=evidence[k]?.value??asset[k]??null;
 const status=Object.fromEntries(SENSOR_CHANNELS.map(k=>[k,{available:values[k]!==null&&values[k]!==undefined,quality:evidence[k]?.quality||(finite(values[k])?'CAPTURED':'UNKNOWN'),source:evidence[k]?.source||(finite(values[k])?asset.source:'unconfigured')}]));
 const coverage=SENSOR_CHANNELS.filter(k=>status[k].available).length/SENSOR_CHANNELS.length;
 return{values,status,coverage:+coverage.toFixed(3)};
}
export function informationRequest(asset,snapshot){
 const missing=SENSOR_CHANNELS.filter(k=>!snapshot.status[k].available);
 const priority=['deltaOi','orderFlow','depthImbalance','funding','basis','liquidations','news','social','onchain','fundamental'];
 const next=priority.find(k=>missing.includes(k))||null;
 return next?{channel:next,reason:'MISSING_DECISION_EVIDENCE',canChangeAction:'UNKNOWN',admission:'OBSERVE_ONLY'}:{channel:null,reason:'CORE_EVIDENCE_COMPLETE',canChangeAction:'UNKNOWN',admission:'OBSERVE_ONLY'};
}
export function decisionBoundary(asset){
 const q=asset.decisionQuality??0,s=asset.candidateStrength??0;
 if(asset.action==='PASS')return{current:'PASS',next:'WATCH',condition:`decisionQuality >= 42 (now ${q})`};
 if(asset.action==='WATCH')return{current:'WATCH',next:asset.technicalScore>=0?'LONG_CANDIDATE':'SHORT_CANDIDATE',condition:`decisionQuality >= 62 and candidateStrength > 18 (now Q=${q}, S=${s})`};
 return{current:asset.action,next:'MODEL_EVALUATION',condition:'candidate must enter calibrated asset model; candidate score cannot authorize trade'};
}
export function buildDecisionIntelligence(universe,evidenceBySymbol={}){
 return universe.map(a=>{const sensors=sensorSnapshot(a,evidenceBySymbol[a.symbol]||{}),request=informationRequest(a,sensors),boundary=decisionBoundary(a);return{...a,sensors,informationRequest:request,decisionBoundary:boundary,tradeAuthority:'NONE_UNTIL_CALIBRATED_MODEL'}}).sort((a,b)=>b.decisionQuality-a.decisionQuality);
}
