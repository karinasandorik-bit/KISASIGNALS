export const INTERVAL_SECONDS = 3600;
export const FEATURE_SCHEMA_VERSION = 'pricenet-seven-hourly-v1';
export function validateBars(bars) {
  if (!Array.isArray(bars) || bars.length < 14) throw Error('NEEDS_14_BARS');
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (![b.t,b.o,b.h,b.l,b.c,b.v].every(Number.isFinite) || !Number.isInteger(b.t) || b.t % 3600 !== 0 ||
        Math.min(b.o,b.h,b.l,b.c) <= 0 || b.v < 0 || b.h < Math.max(b.o,b.c) || b.l > Math.min(b.o,b.c)) throw Error('INVALID_BAR');
    if (i && b.t - bars[i-1].t !== INTERVAL_SECONDS) throw Error('NON_CONTIGUOUS_BARS');
  }
  return bars;
}
export function closedSnapshot(raw, {now=Date.now(), source, exchange, symbol='BTC-USD'}={}) {
  if (!Number.isFinite(now) || !Array.isArray(raw)) throw Error('INVALID_OBSERVATION');
  const bars = raw.filter(b => b.t * 1000 + 3600000 <= now).sort((a,b)=>a.t-b.t).slice(-100);
  validateBars(bars);
  const closedAt = (bars.at(-1).t + 3600) * 1000;
  if (now - closedAt >= 3600000) throw Error('STALE_MARKET_DATA');
  return {bars, source, exchange, symbol, observed_at:new Date(closedAt).toISOString(),
    received_at:new Date(now).toISOString(), freshness_ms:now-closedAt,
    quality_flags:['CLOSED_BARS_ONLY','SPOT_ONLY','FUNDING_UNAVAILABLE','OPEN_INTEREST_UNAVAILABLE'],
    feature_schema_version:FEATURE_SCHEMA_VERSION, feature_timestamp:new Date(closedAt).toISOString(),
    lookback_bars:14, normalization_version:'frozen-model-featureMean-featureStd'};
}
async function json(url, fetchImpl) {
  const r = await fetchImpl(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if (!r.ok) throw Error(`HTTP_${r.status}`);
  if (!(r.headers.get('content-type')||'').includes('json')) throw Error('NON_JSON_RESPONSE');
  return r.json();
}
export async function market({fetchImpl=fetch,now=()=>Date.now()}={}) {
  const errors=[];
  const providers=[
    {exchange:'coinbase',source:'coinbase:BTC-USD:1h',url:'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600',parse:x=>x.map(v=>({t:+v[0],l:+v[1],h:+v[2],o:+v[3],c:+v[4],v:+v[5]}))},
    {exchange:'kraken',source:'kraken:XBTUSD:1h',url:'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=60',parse:x=>{
      if(x.error?.length) throw Error('KRAKEN_API_ERROR');
      const key=Object.keys(x.result).find(k=>k!=='last');
      return x.result[key].map(v=>({t:+v[0],o:+v[1],h:+v[2],l:+v[3],c:+v[4],v:+v[6]}));
    }}
  ];
  for(const p of providers) try {
    const bars=p.parse(await json(p.url,fetchImpl));
    return {...closedSnapshot(bars,{...p,now:now()}),provider_errors:errors};
  } catch(e) { errors.push({source:p.source,error:e.message}); }
  throw Error('ALL_MARKET_SOURCES_FAILED '+JSON.stringify(errors));
}
