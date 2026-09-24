import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCaptureFuturesState} from '../src/futures-recorder.mjs';

test('futures recorder fails closed when venue is unavailable',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>({ok:false,status:451});
 try{
  const r=await safeCaptureFuturesState('BTCUSDT');
  assert.equal(r.ok,false);
  assert.match(r.error,/ALL_FUTURES_PROVIDERS_FAILED:.*HTTP_451/);
  assert.ok(Number.isFinite(Date.parse(r.observedAt)));
 }finally{globalThis.fetch=old}
});
