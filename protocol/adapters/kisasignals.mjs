import {digestJSON,digestRoot} from '../integrity/digest.mjs';

export function evidenceFromMarket(market,{id='market:'+market.feature_timestamp,producer='kisasignals.market'}={}){
 const data={...market}; return {kisaVersion:'0.1',id,entityType:'Evidence.MarketSnapshot',createdAt:market.observed_at||market.feature_timestamp,observedAt:market.observed_at||market.feature_timestamp,source:{identity:market.source||'unknown',canonicalRoot:market.source||'unknown'},contentDigest:digestJSON(data),producer,epistemicStatus:'OBSERVED',validityStatus:'CLEAN',independenceGroup:'market-source:'+(market.source||'unknown'),status:'CLEAN',data};
}
export function decisionFromPrediction(p,{inputEntityIds,agentId='kisasignals.metagate'}={}){
 if(!p?.predictionId) throw Error('PREDICTION_ID_REQUIRED'); if(!Array.isArray(inputEntityIds)||!inputEntityIds.length) throw Error('INPUT_ENTITIES_REQUIRED');
 return {kisaVersion:'0.1',id:p.predictionId,entityType:'Decision.TradeSignal',createdAt:p.ts||p.market?.feature_timestamp,frozenAt:p.ts||p.market?.feature_timestamp,contentDigest:digestJSON({predictionId:p.predictionId,decision:p.decision,plan:p.plan}),producer:agentId,agentId,inputEntityIds:[...inputEntityIds],inputRootDigest:digestRoot(inputEntityIds),action:{type:p.decision?.action,plan:p.plan},status:p.decision?.action==='NO_TRADE'?'ABSTAIN':'FROZEN',data:p};
}
export function outcomeFromSettlement(s){return {kisaVersion:'0.1',id:'outcome:'+s.predictionId,entityType:'Outcome.Trade4H',createdAt:s.settledAt,observedAt:s.settledAt,contentDigest:digestJSON(s),producer:'kisasignals.settlement',decisionId:s.predictionId,metricSpecDigest:digestJSON({horizonHours:s.horizonHours,fields:['firstTouch','realizedMfeBps','realizedMaeBps','netTerminalBps']}).value,status:s.ambiguous?'AMBIGUOUS':'SETTLED',score:{netTerminalBps:s.netTerminalBps,realizedMfeBps:s.realizedMfeBps,realizedMaeBps:s.realizedMaeBps},data:s}}
