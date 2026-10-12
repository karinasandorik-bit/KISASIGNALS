import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateOne,scorePaired,comparePaired} from '../src/oos-independent-evaluator.mjs';
const at=h=>new Date(Date.parse('2026-10-01T00:00:00Z')+h*3600000).toISOString();
const pred={predictionId:'P1',ts:at(0),frozenAt:at(0),market:{feature_timestamp:at(0),reference_close:100,source:'OKX'},model:{sha256:'model',calibration_sha256:'cal'},decision:{action:'LONG'},plan:{side:'LONG',entry:100,stopLoss:98,takeProfit:103}};
const candles=[{o:100,h:101,l:99,c:100},{o:100,h:104,l:97,c:101},{o:101,h:102,l:100,c:101},{o:101,h:103,l:100,c:102}].map((b,i)=>({...b,closedAt:at(i+1)}));
const world={predictionId:'P1',observedAt:at(4),independentSource:'Bitget',bars:candles};
const cost={feeEntryBps:4,feeExitBps:4,spreadBps:2,slippageEntryBps:2,slippageExitBps:3,fundingBps:1};
test('intrabar ambiguity resolves stop first and deducts all costs',()=>{
 const r=evaluateOne(pred,world,cost);
 assert.equal(r.exit,'AMBIGUOUS_STOP_FIRST');
 assert.equal(r.ambiguous,true);
 assert.equal(r.costBps,16);
 assert.ok(Math.abs(r.netBps+216)<1e-8);
});
test('no outcome before maturity',()=>assert.throws(()=>evaluateOne(pred,{...world,observedAt:at(3)},cost),/OUTCOME_NOT_MATURE/));
test('independent source required',()=>assert.throws(()=>evaluateOne(pred,{...world,independentSource:'OKX'},cost),/NOT_INDEPENDENT/));
test('cost assumptions may not be omitted',()=>assert.throws(()=>evaluateOne(pred,world,{}),/COST_SCHEDULE_REQUIRED/));
test('four consecutive closed bars required',()=>assert.throws(()=>evaluateOne(pred,{...world,bars:candles.slice(1)},cost),/FOUR_CLOSED/));
test('no-trade returns zero exposure',()=>{
 const r=evaluateOne({...pred,decision:{action:'NO_TRADE'},plan:null},world,cost);
 assert.equal(r.netBps,0); assert.equal(r.trade,0);
});
test('paired evaluation rejects duplicates',()=>assert.throws(()=>scorePaired([{id:'x',netBps:1,trade:1},{id:'x',netBps:2,trade:1}]),/DUPLICATED/));
test('paired delta is not a promotional confidence claim',()=>{
 const r=comparePaired([{id:'a',netBps:5},{id:'b',netBps:-2}],[{id:'a',netBps:2},{id:'b',netBps:-1}]);
 assert.equal(r.meanIncrementalNetBps,1);assert.equal(r.promotionEligible,false);
});
