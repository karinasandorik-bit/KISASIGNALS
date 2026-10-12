import {createHash, sign} from 'node:crypto';
import {canonical} from './independent-training-verifier.mjs';
const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
export const PRICE_POLICY=Object.freeze({id:'OWL-EXACT-TRADE-BRACKET-V1',instrument:'BTCUSDT',market:'USDT_M_PERPETUAL',venue:'BINANCE_USDM_FUTURES',maxBracketMs:250,metric:'last trade before target; first trade after target; only if both prices agree',execution:'SHADOW_NO_FILLS'});
export async function collectOutcome(decision,{fetchFn=fetch,now=()=>new Date().toISOString(),base='https://fapi.binance.com',signingKey=null}={}){
 const target=Date.parse(decision?.horizon_target_at);
 if(!Number.isFinite(target)||target<=Date.parse(decision?.decision_created_at)||decision.action!=='NO_TRADE')throw new Error('INVALID_FROZEN_DECISION_OR_ACTION');
 if(decision.venue===PRICE_POLICY.venue||decision.reference_venue===PRICE_POLICY.venue)throw new Error('VENUE_NOT_INDEPENDENT');
 const url=new URL('/fapi/v1/aggTrades',base);
 url.searchParams.set('symbol',PRICE_POLICY.instrument);
 url.searchParams.set('startTime',String(target-PRICE_POLICY.maxBracketMs));
 url.searchParams.set('endTime',String(target+PRICE_POLICY.maxBracketMs));
 url.searchParams.set('limit','1000');
 const response=await fetchFn(url.toString());
 if(!response.ok)throw new Error('PROVIDER_HTTP_'+response.status);
 const raw=await response.text(), trades=JSON.parse(raw);
 if(!Array.isArray(trades)||!trades.length||trades.length>=1000)throw new Error('EMPTY_OR_TRUNCATED_PROVIDER_RESPONSE');
 if(!trades.every(t=>Number.isSafeInteger(t.a)&&Number.isSafeInteger(t.T)&&typeof t.p==='string'&&/^\d+(?:\.\d+)?$/.test(t.p)&&Number(t.p)>0))throw new Error('INVALID_PROVIDER_TRADES');
 const before=trades.filter(t=>t.T<=target).sort((a,b)=>b.T-a.T||b.a-a.a)[0];
 const after=trades.filter(t=>t.T>=target).sort((a,b)=>a.T-b.T||a.a-b.a)[0];
 if(!before||!after||target-before.T>PRICE_POLICY.maxBracketMs||after.T-target>PRICE_POLICY.maxBracketMs||before.a>=after.a)throw new Error('NO_VALID_EXACT_BRACKET');
 if(before.p!==after.p)throw new Error('BRACKET_PRICE_DISAGREES');
 const core={schema:'owl.provider-capture.v1',decision_id:decision.decision_id,decision_time:decision.decision_created_at,target_at:decision.horizon_target_at,action:decision.action,policy:PRICE_POLICY,request_url:url.toString(),retrieved_at:now(),http_status:response.status,raw_response_sha256:createHash('sha256').update(raw).digest('hex'),provider_origin_signed:false,provider_identity:'BINANCE_USDM_FUTURES',before:{trade_id:before.a,time_ms:before.T,price:before.p},after:{trade_id:after.a,time_ms:after.T,price:after.p},observed_price:before.p,classification:'INDEPENDENT_SHADOW_PRICE_ONLY',reported_trade_pnl:null};
 const captureHash=digest(core);
 const signature=signingKey?sign(null,Buffer.from(captureHash,'hex'),signingKey).toString('base64'):null;
 return {capture:core,capture_hash:captureHash,collector_signature:signature,collector_signed:!!signature,provider_origin_signed:false};
}
