import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEmailSignal} from '../src/email-signal-gate.mjs';
const now=Date.parse('2026-10-11T16:00:00Z');
const valid=()=>({decisionId:'decision-001',symbol:'BTCUSDT',side:'LONG',mode:'SHADOW_ONLY',status:'SHADOW_SIGNAL_ARMED',
  independentValidation:true,futuresConsensus:{verified:true,sourceCount:2},entry:100,stopLoss:99,
  takeProfit:102,takeProfit2:103,observedAt:new Date(now-10_000).toISOString(),
  expiresAt:new Date(now+60_000).toISOString(),netRR:2.1,riskFraction:0.005,sources:['okx','bitget']});
test('valid preverified SHADOW signal passes',()=>assert.equal(validateEmailSignal(valid(),{now}).eligible,true));
test('missing independent verification blocks',()=>{const s=valid();s.independentValidation=false;assert.ok(validateEmailSignal(s,{now}).errors.includes('INDEPENDENT_VALIDATION'))});
test('NO_TRADE and no authorization blocked',()=>{const s=valid();s.status='OBSERVATION_ONLY';assert.equal(validateEmailSignal(s,{now}).eligible,false)});
test('stale signal blocked',()=>{const s=valid();s.observedAt=new Date(now-180_000).toISOString();assert.ok(validateEmailSignal(s,{now}).errors.includes('STALE_OR_INVALID_EVIDENCE'))});
test('expired signal blocked',()=>{const s=valid();s.expiresAt=new Date(now-1).toISOString();assert.ok(validateEmailSignal(s,{now}).errors.includes('EXPIRED_OR_INVALID_EXPIRY'))});
test('wrong directional levels blocked',()=>{const s=valid();s.stopLoss=101;assert.ok(validateEmailSignal(s,{now}).errors.includes('LONG_LEVEL_ORDER'))});
test('risk budget violation blocked',()=>{const s=valid();s.riskFraction=.01;assert.ok(validateEmailSignal(s,{now}).errors.includes('RISK_LIMIT'))});
test('missing takeProfit2 blocked',()=>{const s=valid();delete s.takeProfit2;assert.ok(validateEmailSignal(s,{now}).errors.includes('PRICE_FIELDS'))});
test('single source blocks',()=>{const s=valid();s.sources=['okx'];assert.ok(validateEmailSignal(s,{now}).errors.includes('INDEPENDENT_SOURCES'))});
test('SHORT price order valid',()=>{const s=valid();s.side='SHORT';s.stopLoss=101;s.takeProfit=98;s.takeProfit2=97;assert.equal(validateEmailSignal(s,{now}).eligible,true)});
