import test from 'node:test';
import assert from 'node:assert/strict';
import {createCapabilityGrant,verifyCapabilityGrant,createAuthorityController} from '../src/capability-grant.mjs';

const intent={symbol:'BTCUSDT',risk_usd:.5,notional_usd:10,leverage:1,model_sha256:'model-abc'};

test('shadow has base authority without promotion',()=>{
 const a=createAuthorityController();
 assert.equal(a.authorize(intent,{mode:'SHADOW'}).permitted,true);
});

test('paper is fail-closed without a capability grant',()=>{
 const a=createAuthorityController();
 const r=a.authorize(intent,{mode:'PAPER'});
 assert.equal(r.permitted,false);
 assert.ok(r.reasons.includes('GRANT_MISSING'));
});

test('scoped proven grant authorizes only its bounded action',()=>{
 const grant=createCapabilityGrant({subjectHash:'model-abc',modes:['PAPER'],symbols:['BTCUSDT'],maxRiskUsd:1,maxNotionalUsd:25,maxLeverage:1,evidenceRoot:'evidence-sha256',expiresAt:'2099-01-01T00:00:00.000Z'});
 assert.equal(verifyCapabilityGrant(grant,{subjectHash:'model-abc',mode:'PAPER',intent}).permitted,true);
 assert.equal(verifyCapabilityGrant(grant,{subjectHash:'other-model',mode:'PAPER',intent}).permitted,false);
 assert.equal(verifyCapabilityGrant(grant,{subjectHash:'model-abc',mode:'MICRO_LIVE',intent}).permitted,false);
 assert.equal(verifyCapabilityGrant(grant,{subjectHash:'model-abc',mode:'PAPER',intent:{...intent,notional_usd:26}}).permitted,false);
});
