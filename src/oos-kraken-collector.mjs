// Independent public Kraken OHLC collector. Emits a SIGNED receipt; never fills gaps.
// Input is a known frozen prediction receipt with a settled 4-hour UTC horizon.
import {createHmac} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const H=3600000;
export async function krakenWorldReceipt({predictionId,signalAt,symbol='BTCUSDT',predictionSource,secret=process.env.OOS_COLLECTOR_SECRET,fetchImpl=fetch,now=Date.now()}){
 if(!secret)throw Error('COLLECTOR_SECRET_REQUIRED');
 if(!predictionId||symbol!=='BTCUSDT'||String(predictionSource||'').toLowerCase().includes('kraken'))throw Error('INDEPENDENT_SOURCE_OR_SYMBOL_UNSUPPORTED');
 const t=Date.parse(signalAt);
 if(!Number.isFinite(t)||t%H!==0||now<t+4*H+60000)throw Error('HORIZON_NOT_MATURE');
 // Kraken reports OHLC candle OPEN seconds. Last potentially in-progress candle is excluded.
 const url=`https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=60&since=${Math.floor(t/1000)}`;
 const response=await fetchImpl(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('KRAKEN_HTTP_'+response.status);
 const dateHeader=response.headers.get('date'),serverAt=Date.parse(dateHeader);
 if(!Number.isFinite(serverAt)||Math.abs(now-serverAt)>180000)throw Error('UNVERIFIED_PROVIDER_RESPONSE_TIME');
 const json=await response.json();
 if(!Array.isArray(json.error)||json.error.length||!json.result)throw Error('INVALID_PROVIDER_RESPONSE');
 const key=Object.keys(json.result).find(k=>k!=='last');
 if(!key||!Array.isArray(json.result[key]))throw Error('NO_KRAKEN_CANDLES');
 const raw=json.result[key];
 const bars=Array.from({length:4},(_,i)=>{
  const start=t+i*H,match=raw.filter(x=>Number(x[0])*1000===start);
  if(match.length!==1)throw Error('KRAKEN_CANDLE_MISSING_OR_DUPLICATE');
  const x=match[0];return {closedAt:new Date(start+H).toISOString(),o:Number(x[1]),h:Number(x[2]),l:Number(x[3]),c:Number(x[4])};
 });
 if(bars.some((b,i)=>Date.parse(b.closedAt)>serverAt-60000))throw Error('CANDLE_NOT_CLOSED_WITH_BUFFER');
 const receipt={predictionId,signalAt,symbol,independentSource:'Kraken',sourceReceiptId:`kraken-ohlc-60-${predictionId}`,observedAt:new Date(serverAt).toISOString(),bars,
  venueEndpoint:'https://api.kraken.com/0/public/OHLC',sourceResponseDate:dateHeader,sourceInstrument:key,ingestionKind:'DIRECT_PUBLIC_REST'};
 const bytes=Buffer.from(JSON.stringify(receipt));
 return {raw:bytes,signature:createHmac('sha256',secret).update(bytes).digest('hex')};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const [predictionId,signalAt,filename]=process.argv.slice(2);
 krakenWorldReceipt({predictionId,signalAt,predictionSource:process.env.OOS_PREDICTION_SOURCE}).then(({raw,signature})=>{
  if(!filename)throw Error('OUTPUT_PATH_REQUIRED');
  writeFileSync(filename,raw,{flag:'wx',mode:0o600});
  console.log(JSON.stringify({path:filename,receiptHmac:signature,source:'Kraken'}));
 }).catch(e=>{console.error(e.message);process.exitCode=1});
}
