import test from 'node:test';
import assert from 'node:assert/strict';
import {assessTrainingExample,auditTrainingBatch} from '../src/training-data-gate.mjs';
const d={decision_id:'a',model_version:'owl-ema-v1',action:'LONG',status:'SHADOW',venue:'okx',price:100,rationale:{quality:'CALIBRATED',futures_verified:true},decision_created_at:'2026-10-11T10:00:00Z',horizon_target_at:'2026-10-11T14:00:00Z'};
const s={decision_id:'a',evaluation_status:'INDEPENDENT_EXACT_HORIZON_VERIFIED',source_evidence_hash:'a'.repeat(64),independent_venue:'bitget',independent_exit_price:101,net_estimate_return_pct:0.2,net_estimate_status:'VERIFIED',outcome_observed_at:'2026-10-11T14:00:25Z',settled_at:'2026-10-11T14:01:00Z',target_at:'2026-10-11T14:00:00Z',horizon_lag_seconds:25,source_candle_open_at:'2026-10-11T13:45:00Z',source_candle_close_at:'2026-10-11T14:00:00Z'};
test('synthetic complete example passes structural gate',()=>assert.equal(assessTrainingExample(d,s).eligible,true));
for(const [name,sd,ss] of [
 ['uncalibrated',{...d,rationale:{...d.rationale,quality:'UNCALIBRATED_RESEARCH_BASELINE'}},s],
 ['missing hash',d,{...s,source_evidence_hash:null}],
 ['garbage hash',d,{...s,source_evidence_hash:'garbage'}],
 ['negative price',d,{...s,independent_exit_price:-1}],
 ['non-finite net',d,{...s,net_estimate_return_pct:Infinity}],
 ['NaN net',d,{...s,net_estimate_return_pct:NaN}],
 ['before-target outcome',d,{...s,outcome_observed_at:'2026-10-11T13:59:00Z'}],
 ['false lag',d,{...s,horizon_lag_seconds:1}],
 ['post-observed candle',d,{...s,source_candle_close_at:'2026-10-11T14:02:00Z'}],
 ['self-sourced price',d,{...s,independent_venue:'okx'}],
 ['not a trade',{...d,action:'NO_TRADE'},s],
 ['incorrect target',d,{...s,target_at:'2026-10-11T15:00:00Z'}]
])test('adversarial rejection: '+name,()=>assert.equal(assessTrainingExample(sd,ss).eligible,false));
test('duplicate settlements fail closed',()=>assert.equal(auditTrainingBatch([d],[s,{...s,independent_exit_price:105}]).eligible,0));
test('duplicate decisions fail closed',()=>assert.equal(auditTrainingBatch([d,d],[s]).eligible,0));
