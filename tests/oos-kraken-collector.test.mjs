import test from 'node:test';
import assert from 'node:assert/strict';
import {krakenWorldReceipt} from '../src/oos-kraken-collector.mjs';
const H=3600000,t=Date.parse('2026-10-10T00:00:00Z'),now=t+6*H;
const input=()=>({predictionId:'locked-001',signalAt:new Date(t).toISOString(),symbol:'BTCUSDT',predictionSource:'OKX',secret:'fixture-only',now});
function mock({missing=false,wrongServer=false}={}){
 const candles=Array.from({length:5},(_,i)=>[Math.floor((t+i*H)/1000),'100','102','99','101','100','1','1']);
 if(missing)candles.splice(2,1);
 return async()=>({ok:true,headers:new Headers({'date':new Date(wrongServer?now-600000:now).toUTCString()}),
 json:async()=>({error:[],result:{XXBTZUSD:candles,last:0}})});
}
test('valid independent Kraken bars produce signed 4h receipt',async()=>{
 const a=await krakenWorldReceipt({...input(),fetchImpl:mock()});
 const world=JSON.parse(a.raw.toString());
 assert.equal(world.bars.length,4);assert.equal(world.independentSource,'Kraken');
 assert.match(a.signature,/^[0-9a-f]{64}$/);
});
test('source spoofing and mixed-case Kraken name are rejected',async()=>{
 await assert.rejects(krakenWorldReceipt({...input(),predictionSource:'kraken',fetchImpl:mock()}),/INDEPENDENT_SOURCE/);
});
test('missing closed candle fails rather than backfilling',async()=>{
 await assert.rejects(krakenWorldReceipt({...input(),fetchImpl:mock({missing:true})}),/MISSING_OR_DUPLICATE/);
});
test('provider date outside verification window fails closed',async()=>{
 await assert.rejects(krakenWorldReceipt({...input(),fetchImpl:mock({wrongServer:true})}),/UNVERIFIED_PROVIDER_RESPONSE_TIME/);
});
