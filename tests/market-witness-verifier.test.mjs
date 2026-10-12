import test from 'node:test';
import assert from 'node:assert/strict';
import witness from '../evidence/owl-exp-003-binance-bracketing-witness.json' with {type:'json'};
import {verifyBracketWitness} from '../src/market-witness-verifier.mjs';
const frozen={decision_id:'okx-btc-15m-1791780300000-ema-v1',horizon_target_at:'2026-10-12T09:05:00.738Z'};
const mutate=(fn)=>{const w=structuredClone(witness);fn(w);return w;};
test('independent historical trade bracket accepted, NOT executed PnL',()=>{const r=verifyBracketWitness(witness,frozen);assert.equal(r.verified,true);assert.equal(r.exactTickAtTarget,false);assert.equal(r.executedTrade,false);});
for(const [name,change] of [
 ['price substitution',w=>w.trades[1].price='83604.30'],
 ['time substitution',w=>w.trades[2].time_ms+=600],
 ['source substitution',w=>w.independent_venue='BITGET_USDT_FUTURES'],
 ['primary as third venue',w=>w.independent_venue='OKX_SWAP'],
 ['trade id substitution',w=>w.trades[1].id+=10],
 ['target manipulation',w=>w.target_ms+=1000],
 ['instrument substitution',w=>w.instrument='ETHUSDT']
])test('reject '+name,()=>assert.equal(verifyBracketWitness(mutate(change),frozen).verified,false));
