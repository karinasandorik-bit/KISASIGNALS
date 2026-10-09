import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceEventTime} from '../src/ledger.mjs';
test('ablation settlement timestamp uses actual settlement event time',()=>{
 const trial={armedAt:'2026-10-08T00:20:00.000Z',settledAt:'2026-10-08T05:03:00.000Z'};
 assert.equal(evidenceEventTime('ablation_settlement',trial),trial.settledAt);
 assert.equal(evidenceEventTime('ablation_trial',trial),trial.armedAt);
});
test('invalid settlement timestamp fails closed',()=>{
 assert.throws(()=>evidenceEventTime('ablation_settlement',{armedAt:'2026-10-08T00:20:00.000Z'}),/MISSING_VALID_SETTLEMENT_TIME/);
 assert.throws(()=>evidenceEventTime('ablation_settlement',{settledAt:'not-a-date'}),/MISSING_VALID_SETTLEMENT_TIME/);
});
