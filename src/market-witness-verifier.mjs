// Source/clock/price witness verifier. Distinct from trade-PnL approval.
export function verifyBracketWitness(w,approved) {
 const reasons=[];
 if(w?.schema!=='owl.market-witness.v1')reasons.push('SCHEMA');
 if(w?.decision_id!==approved.decision_id)reasons.push('DECISION_ID');
 if(w?.target_ms!==Date.parse(approved.horizon_target_at))reasons.push('TARGET_TIME');
 if(w?.instrument!=='BTCUSDT'||w?.market_type!=='USDT_M_PERPETUAL')reasons.push('INSTRUMENT');
 if(w?.independent_venue!=='BINANCE_USDM_FUTURES'||w.independent_venue===w.primary_venue||w.independent_venue===w.reference_venue)reasons.push('SOURCE_INDEPENDENCE');
 if(w?.collection_status!=='HISTORICAL_RETRIEVAL_NOT_ORIGIN_SIGNED')reasons.push('PROVENANCE_LEVEL');
 if(w?.action!=='NO_TRADE')reasons.push('ACTION_INTEGRITY');
 const t=w?.trades??[],ts=w?.target_ms;
 if(!Array.isArray(t)||t.length<2||!t.every(x=>Number.isSafeInteger(x.id)&&Number.isSafeInteger(x.time_ms)&&typeof x.price==='string'&&/^\d+(?:\.\d+)?$/.test(x.price)&&Number(x.price)>0))reasons.push('INVALID_TRADES');
 const pre=t.filter(x=>x.time_ms<=ts).sort((a,b)=>b.time_ms-a.time_ms)[0];
 const post=t.filter(x=>x.time_ms>=ts).sort((a,b)=>a.time_ms-b.time_ms)[0];
 if(!pre||!post||ts-pre.time_ms>200||post.time_ms-ts>200||pre.id>=post.id)reasons.push('TARGET_NOT_BRACKETED');
 if(pre?.price!==post?.price)reasons.push('NO_SINGLE_BRACKET_PRICE');
 if(pre?.price!=='83504.30'||pre?.id!==3482004273||post?.id!==3482004274)reasons.push('SOURCE_PRICE_OR_TRADE_ID_CHANGED');
 return {verified:reasons.length===0,reasons,observedBracketPrice:reasons.length===0?pre.price:null,exactTickAtTarget:false,executedTrade:false};
}
