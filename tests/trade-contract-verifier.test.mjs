import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVerifiedEmailContract,verifyTradeContract} from '../src/trade-contract-verifier.mjs';
const now=Date.parse('2026-10-11T16:00:00Z');
function fixture(){
 const timestamp=new Date(now-10000).toISOString();
 return {predictionId:'p1',market:{symbol:'BTCUSDT',feature_timestamp:timestamp,reference_close:100},
 decision:{action:'LONG',costBps:10,evBps:35},status:'SHADOW_SIGNAL_ARMED',
 plan:{entry:100,stopLoss:99,takeProfit:103},entryPolicy:{expiryHours:2},
 forecast:{LONG:{mfe90:400}},futuresConsensus:{verified:true,sourceCount:2,sources:['OKX','Bitget']}};
}
test('complete independently checked LONG email contract',()=>{
 const c=buildVerifiedEmailContract(fixture(),{now});
 assert.equal(c.independentValidation,true);
 assert.ok(c.takeProfit2>c.takeProfit);
 assert.ok(c.netRR>=2);
 assert.equal(c.validation.errors.length,0);
 assert.match(c.validation.contractHash,/^[0-9a-f]{64}$/);
});
test('missing second target excursion fails closed',()=>{let f=fixture();delete f.forecast.LONG.mfe90;assert.equal(buildVerifiedEmailContract(f,{now}).independentValidation,false);});
test('stale prices fail closed',()=>{let f=fixture();f.market.feature_timestamp=new Date(now-180000).toISOString();assert.ok(buildVerifiedEmailContract(f,{now}).validation.errors.includes('STALE_EVIDENCE'));});
test('single venue fails closed',()=>{let f=fixture();f.futuresConsensus.sources=['OKX'];assert.ok(buildVerifiedEmailContract(f,{now}).validation.errors.includes('INDEPENDENT_VENUES'));});
test('unfavorable net RR fails closed',()=>{let f=fixture();f.plan.takeProfit=101;assert.ok(buildVerifiedEmailContract(f,{now}).validation.errors.includes('NET_RR'));});
test('short construction verified',()=>{let f=fixture();f.decision.action='SHORT';f.plan.stopLoss=101;f.plan.takeProfit=97;f.forecast={SHORT:{mfe90:400}};assert.equal(buildVerifiedEmailContract(f,{now}).independentValidation,true);});
test('TP2 unsupported by excursion fails closed',()=>{let f=fixture();f.forecast.LONG.mfe90=200;assert.ok(buildVerifiedEmailContract(f,{now}).validation.errors.includes('LEVEL_ORDER'));});
