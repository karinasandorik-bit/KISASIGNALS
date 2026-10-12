import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {collectOutcome,PRICE_POLICY} from '../src/prospective-outcome-collector.mjs';
const decision={decision_id:'decision-1',decision_created_at:'2026-10-12T05:05:00.738Z',horizon_target_at:'2026-10-12T09:05:00.738Z',venue:'OKX_SWAP',reference_venue:'BITGET_USDT_FUTURES',action:'NO_TRADE'};
const original=[{a:10,T:1791795900705,p:'83504.30'},{a:11,T:1791795900859,p:'83504.30'}];
const fake=rows=>async()=>({ok:true,status:200,text:async()=>JSON.stringify(rows)});
test('fixed policy and collector-signed independent shadow bracket',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const x=await collectOutcome(decision,{fetchFn:fake(original),signingKey:privateKey,now:()=> '2026-10-12T09:06:00Z'});
 assert.equal(x.capture.observed_price,'83504.30');assert.equal(x.capture.policy.id,PRICE_POLICY.id);
 assert.equal(verify(null,Buffer.from(x.capture_hash,'hex'),publicKey,Buffer.from(x.collector_signature,'base64')),true);
 assert.equal(x.capture.provider_origin_signed,false);assert.equal(x.capture.reported_trade_pnl,null);
});
for(const [name,rows] of [['price mutation',[original[0],{...original[1],p:'83504.40'}]],['clock mutation',[{...original[0],T:1791795900200},original[1]]],['missing second',[original[0]]],['bad price',[{...original[0],p:'NaN'},original[1]]]])test('fail closed '+name,async()=>assert.rejects(collectOutcome(decision,{fetchFn:fake(rows)})));
test('source substitution blocked',async()=>assert.rejects(collectOutcome({...decision,reference_venue:'BINANCE_USDM_FUTURES'},{fetchFn:fake(original)})));
test('trade decisions cannot be silently treated as no-fill',async()=>assert.rejects(collectOutcome({...decision,action:'LONG'},{fetchFn:fake(original)})));
