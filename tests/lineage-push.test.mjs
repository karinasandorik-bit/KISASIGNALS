import test from 'node:test';import assert from 'node:assert/strict';
import {hashEvidence} from '../src/lineage.mjs';import {pushActionableSignal} from '../src/signal-push.mjs';
test('lineage hash is stable across key order',()=>assert.equal(hashEvidence({b:2,a:1}),hashEvidence({a:1,b:2})));
test('event push only emits armed actionable signal',async()=>{let got=null;const row={status:'SHADOW_SIGNAL_ARMED',predictionId:'d1',decision:{action:'LONG'},market:{symbol:'BTC-USD',feature_timestamp:'2026-09-29T00:00:00Z'},plan:{entry:1,stopLoss:.9,takeProfit:1.2,horizonHours:4,evBps:10,rr:2},model:{calibration_status:'VALID'}};const r=await pushActionableSignal(row,{emit:e=>{got=e}});assert.equal(r.pushed,true);assert.equal(got.decisionId,'d1');assert.equal(got.entry,1)});
test('event push rejects observation-only rows',async()=>assert.equal((await pushActionableSignal({status:'OBSERVATION_ONLY'})).pushed,false));
