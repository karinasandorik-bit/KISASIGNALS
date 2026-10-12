import test from 'node:test';
import assert from 'node:assert/strict';
import {assessTrainingExample,auditTrainingBatch} from '../src/training-data-gate.mjs';
const d={decision_id:'a',model_version:'owl-ema-v1',action:'LONG',status:'SHADOW',rationale:{quality:'CALIBRATED',futures_verified:true},decision_created_at:'2026-10-11T10:00:00Z',horizon_target_at:'2026-10-11T14:00:00Z'};
const s={decision_id:'a',evaluation_status:'INDEPENDENT_EXACT_HORIZON_VERIFIED',source_evidence_hash:'sha256:abc',independent_venue:'bitget',independent_exit_price:101,net_estimate_return_pct:0.2,net_estimate_status:'VERIFIED',outcome_observed_at:'2026-10-11T14:00:25Z',target_at:'2026-10-11T14:00:00Z',horizon_lag_seconds:25};
test('accepts fully evidenced prospective label',()=>assert.equal(assessTrainingExample(d,s).eligible,true));
test('rejects approximate uncalibrated label',()=>{const x=assessTrainingExample({...d,action:'NO_TRADE',rationale:{quality:'UNCALIBRATED_RESEARCH_BASELINE',futures_verified:false}},{...s,evaluation_status:'SHADOW_APPROX_HORIZON_UNCALIBRATED',source_evidence_hash:null,net_estimate_return_pct:null}); assert.equal(x.eligible,false); assert.ok(x.reasons.includes('UNVERIFIED_SETTLEMENT'));});
test('rejects future leakage and mismatched join',()=>{const x=assessTrainingExample(d,{...s,decision_id:'other',outcome_observed_at:'2026-10-11T13:00:00Z'});assert.ok(x.reasons.includes('DECISION_JOIN_INVALID'));assert.ok(x.reasons.includes('INVALID_CAUSAL_TIME_ORDER'));});
test('batch reports rejection reasons',()=>{const x=auditTrainingBatch([d],[{...s,evaluation_status:'SHADOW_APPROX_HORIZON_UNCALIBRATED'}]);assert.equal(x.eligible,0);assert.equal(x.rejected,1);});
