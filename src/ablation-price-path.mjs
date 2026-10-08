export const SETTLEMENT_POLICY = 'NEXT_HOURLY_OPEN_4_CLOSED_SWAP_BARS_V1';
const HOUR_MS = 3_600_000;
export function settlementPolicyForAsset(asset, at) {
  if (asset?.source !== 'okx-swap-public' || !/^[A-Z0-9]+USDT$/.test(asset.symbol || '')) return null;
  const observedMs = Date.parse(at);
  if (!Number.isFinite(observedMs)) throw Error('INVALID_OBSERVATION_TIME');
  const entryMs = (Math.floor(observedMs / HOUR_MS) + 1) * HOUR_MS;
  return {settlementPolicy:SETTLEMENT_POLICY,priceSource:'okx-v5-swap-1H',instrumentId:`${asset.symbol.slice(0,-4)}-USDT-SWAP`,entryRule:'NEXT_FULL_HOURLY_BAR_OPEN',entryAt:new Date(entryMs).toISOString(),horizonEndAt:new Date(entryMs+4*HOUR_MS).toISOString()};
}
export async function fetchSwapCandles(instrumentId, fetchImpl=fetch) {
  if (!/^[A-Z0-9]+-USDT-SWAP$/.test(instrumentId||'')) throw Error('INVALID_SWAP_INSTRUMENT');
  const url=`https://www.okx.com/api/v5/market/history-candles?instId=${encodeURIComponent(instrumentId)}&bar=1H&limit=100`;
  const response=await fetchImpl(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw Error(`SWAP_CANDLES_HTTP_${response.status}`);
  const data=await response.json();
  if(data?.code!=='0'||!Array.isArray(data.data))throw Error('INVALID_SWAP_CANDLE_RESPONSE');
  return data.data;
}
export function extractClosedSwapPath(rows,trial,now){
 if(trial?.settlementPolicy!==SETTLEMENT_POLICY||trial.priceSource!=='okx-v5-swap-1H'||trial.horizonHours!==4||!/^[A-Z0-9]+-USDT-SWAP$/.test(trial.instrumentId||'')||trial.instrumentId.replace('-USDT-SWAP','USDT')!==trial.symbol)return null;
 const entryMs=Date.parse(trial.entryAt),endMs=Date.parse(trial.horizonEndAt),nowMs=Date.parse(now);
 if(![entryMs,endMs,nowMs].every(Number.isFinite)||endMs!==entryMs+4*HOUR_MS||nowMs<endMs||entryMs%HOUR_MS!==0)return null;
 const candles=new Map();
 for(const row of rows||[]){
  if(!Array.isArray(row)||row[8]!=='1')continue;
  const [t,o,h,l,c]=row.slice(0,5).map(Number);
  if(![t,o,h,l,c].every(Number.isFinite)||t%HOUR_MS!==0||Math.min(o,h,l,c)<=0||h<Math.max(o,c)||l>Math.min(o,c))continue;
  if(t>=entryMs&&t<endMs)candles.set(t,{t:t/1000,o,h,l,c});
 }
 const bars=[];
 for(let i=0;i<4;i++){const bar=candles.get(entryMs+i*HOUR_MS);if(!bar)return null;bars.push(bar)}
 return {bars,entryPrice:bars[0].o};
}
