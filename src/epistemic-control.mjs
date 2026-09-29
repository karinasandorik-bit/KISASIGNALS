import crypto from 'node:crypto';
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const age=(a,b)=>Math.max(0,Date.parse(b)-Date.parse(a));
export function epistemicManifest(row,{now=row.market?.received_at||row.ts,maxAgeMs=120000,maxSpreadBps=35,minVenues=2}={}){
 const observedAt=row.market?.feature_timestamp||row.market?.observed_at||row.ts;
 const evidenceAgeMs=Number.isFinite(Date.parse(observedAt))&&Number.isFinite(Date.parse(now))?age(observedAt,now):null;
 const venues=Number(row.futuresConsensus?.sourceCount||0),spread=Number(row.futuresConsensus?.markSpreadBps);
 const checks={
  fresh:evidenceAgeMs!==null&&evidenceAgeMs<=maxAgeMs,
  multiVenue:venues>=minVenues,
  venueAgreement:row.futuresConsensus?.verified===true&&Number.isFinite(spread)&&spread<=maxSpreadBps,
  modelFrozen:Boolean(row.model?.sha256),
  calibrationFrozen:Boolean(row.model?.calibration_sha256)
 };
 const blockers=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
 const action=row.decision?.action||'NO_TRADE';
 const falsifier=action==='LONG'?{type:'PRICE_INVALIDATION',operator:'LTE',value:row.plan?.stopLoss??null}:action==='SHORT'?{type:'PRICE_INVALIDATION',operator:'GTE',value:row.plan?.stopLoss??null}:{type:'COUNTERFACTUAL_OPPORTUNITY',horizonHours:4,criterion:'best_action_net_bps_exceeds_abstention_threshold'};
 const manifest={schema:'kisa.epistemic-manifest.v1',decisionId:row.predictionId,observedAt,evidenceAgeMs,provenance:{marketSource:row.market?.source??null,futuresSources:row.futuresConsensus?.sources??[],venueCount:venues,venueSpreadBps:Number.isFinite(spread)?spread:null},checks,blockers,epistemicStatus:blockers.length?'INSUFFICIENT':'ADMISSIBLE',falsifier};
 return Object.freeze({...manifest,manifestHash:sha(manifest)});
}
export function epistemicAuthority(manifest){return manifest?.epistemicStatus==='ADMISSIBLE'&&manifest?.blockers?.length===0}
