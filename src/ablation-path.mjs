// Prospective 4h outcome path for OKX USDT perpetuals.
// The evaluation window begins at the next complete UTC minute after arming.
// No candle is accepted until the venue confirms it closed.
export const SETTLEMENT_PROTOCOL='OKX_SWAP_1M_V1';
export const MINUTE_MS=60_000;
export const EXPECTED_BARS=240;
export function evaluationWindow(armedAt){
 const armed=Date.parse(armedAt);
 if(!Number.isFinite(armed))throw Error('INVALID_ARMED_AT');
 const start=Math.ceil(armed/MINUTE_MS)*MINUTE_MS;
 return {start,end:start+EXPECTED_BARS*MINUTE_MS};
}
export function isEligibleAblationAsset(asset){
 return asset?.source==='okx-swap-public'
  && /^[A-Z0-9]+USDT$/.test(asset.symbol||'')
  && Number.isFinite(asset.price)&&asset.price>0;
}
export function validatedMinutePath(rows,{start,end}){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end-start!==EXPECTED_BARS*MINUTE_MS)
  throw Error('INVALID_EVALUATION_WINDOW');
 const byTime=new Map();
 for(const row of rows){
  if(!Array.isArray(row)||row[8]!=='1')continue;
  const ts=Number(row[0]);
  if(ts<start||ts>=end)continue;
  const [o,h,l,c]=[1,2,3,4].map(i=>Number(row[i]));
  if(![ts,o,h,l,c].every(Number.isFinite)||o<=0||h<=0||l<=0||c<=0||h<Math.max(o,c)||l>Math.min(o,c))
   throw Error('INVALID_VERIFIED_CANDLE');
  const prior=byTime.get(ts);
  if(prior&&JSON.stringify(prior)!==JSON.stringify([ts,o,h,l,c]))throw Error('CONFLICTING_CANDLES');
  byTime.set(ts,[ts,o,h,l,c]);
 }
 if(byTime.size!==EXPECTED_BARS)throw Error('INCOMPLETE_CONFIRMED_MINUTE_PATH');
 const ordered=[...byTime.values()].sort((a,b)=>a[0]-b[0]);
 for(let i=0;i<EXPECTED_BARS;i++)if(ordered[i][0]!==start+i*MINUTE_MS)
  throw Error('NONCONTIGUOUS_MINUTE_PATH');
 return ordered.map(([t,o,h,l,c])=>({t:t/1000,o,h,l,c}));
}
export async function fetchOkxMinuteHistory(symbol,earliestStart,{fetchFn=fetch,maxPages=6}={}){
 if(!/^[A-Z0-9]+USDT$/.test(symbol))throw Error('INVALID_OKX_SYMBOL');
 const instId=symbol.slice(0,-4)+'-USDT-SWAP';
 const all=[];let after=null,oldest=Infinity;
 for(let i=0;i<maxPages;i++){
  const url=new URL('https://www.okx.com/api/v5/market/history-candles');
  url.searchParams.set('instId',instId);url.searchParams.set('bar','1m');url.searchParams.set('limit','100');
  if(after!==null)url.searchParams.set('after',String(after));
  const response=await fetchFn(url.toString(),{headers:{'user-agent':'KISASIGNALS/3.1','accept':'application/json'},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('OKX_HISTORY_HTTP_'+response.status);
  const body=await response.json();
  if(body.code!=='0'||!Array.isArray(body.data)||!body.data.length)throw Error('OKX_HISTORY_INVALID_RESPONSE');
  const page=body.data,minimum=Math.min(...page.map(r=>Number(r[0])));
  if(!Number.isFinite(minimum)||minimum>=oldest)throw Error('OKX_HISTORY_PAGINATION_STALLED');
  all.push(...page);oldest=minimum;after=minimum;
  if(oldest<=earliestStart)break;
 }
 return all;
}
