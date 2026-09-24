import {putEvidence} from './ledger.mjs';
const BASE=process.env.BINANCE_FUTURES_BASE_URL||'https://fapi.binance.com';
const num=x=>Number(x);
async function j(path){const r=await fetch(BASE+path,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`BINANCE_FUTURES_HTTP_${r.status}`);return r.json()}
function bookFeatures(depth){
 const bids=depth.bids.map(([p,q])=>[num(p),num(q)]),asks=depth.asks.map(([p,q])=>[num(p),num(q)]);
 const bid=bids[0]?.[0],ask=asks[0]?.[0],mid=(bid+ask)/2,bq=bids.reduce((s,x)=>s+x[1],0),aq=asks.reduce((s,x)=>s+x[1],0);
 return {bestBid:bid,bestAsk:ask,mid,spreadBps:(ask-bid)/mid*10000,depthImbalance:(bq-aq)/(bq+aq),bidDepth:bq,askDepth:aq,lastUpdateId:depth.lastUpdateId};
}
function flowFeatures(ts){let buy=0,sell=0;for(const t of ts){const q=num(t.q);if(t.m)sell+=q;else buy+=q}const total=buy+sell;return{aggressiveBuyQty:buy,aggressiveSellQty:sell,flowImbalance:total?(buy-sell)/total:0,tradeCount:ts.length}}
export async function captureFuturesState(symbol='BTCUSDT'){
 const [mark,oi,depth,trades,funding]=await Promise.all([
  j(`/fapi/v1/premiumIndex?symbol=${symbol}`),
  j(`/fapi/v1/openInterest?symbol=${symbol}`),
  j(`/fapi/v1/depth?symbol=${symbol}&limit=20`),
  j(`/fapi/v1/aggTrades?symbol=${symbol}&limit=100`),
  j(`/fapi/v1/fundingRate?symbol=${symbol}&limit=1`)
 ]);
 const observedAt=new Date(Math.max(num(mark.time)||0,num(oi.time)||0,Date.now())).toISOString(),book=bookFeatures(depth),flow=flowFeatures(trades);
 const row={event:'FUTURES_STATE',symbol,observedAt,source:'binance-usds-futures-public',markPrice:num(mark.markPrice),indexPrice:num(mark.indexPrice),markIndexBps:(num(mark.markPrice)/num(mark.indexPrice)-1)*10000,fundingRate:num(mark.lastFundingRate??funding.at(-1)?.fundingRate),nextFundingTime:mark.nextFundingTime,openInterest:num(oi.openInterest),...book,...flow};
 const id=`${symbol}:${Math.floor(Date.parse(observedAt)/60000)}`;await putEvidence('futures_state',id,row);return row;
}
export async function safeCaptureFuturesState(symbol='BTCUSDT'){try{return{ok:true,state:await captureFuturesState(symbol)}}catch(e){return{ok:false,error:e.message,observedAt:new Date().toISOString()}}}
