import test from 'node:test';
import assert from 'node:assert/strict';
import {blockBootstrap} from '../src/oos-block-bootstrap.mjs';
import {runOosEvaluation} from '../src/oos-evaluator-service.mjs';
const t=i=>new Date(Date.parse('2026-10-01T00:00:00Z')+i*3600000).toISOString();
test('bootstrap reproducible and zero paired effect',()=>{
 const rows=Array.from({length:120},(_,i)=>({id:String(i),signalAt:t(i),netBps:i%3-1}));
 const a=blockBootstrap(rows,rows),b=blockBootstrap(rows,rows);
 assert.deepEqual(a,b);assert.equal(a.lower95OneSided,0);assert.equal(a.positiveLowerBound,false);
});
test('detect pairing swaps',()=>{
 const a=Array.from({length:100},(_,i)=>({id:String(i),signalAt:t(i),netBps:1}));
 assert.throws(()=>blockBootstrap(a,a.toReversed()),/UNPAIRED/);
});
test('no fabricated world means no scores and no promotion',async()=>{
 const r=await runOosEvaluation({priceCosts:{feeEntryBps:1,feeExitBps:1,spreadBps:1,slippageEntryBps:1,slippageExitBps:1},
 read:async()=>({predictions:[{id:'a',payload:{}}],worlds:[],baselines:[],snapshotHash:'test',readAt:t(0)})});
 assert.equal(r.nMatched,0);assert.equal(r.promotionEligible,false);assert.equal(r.excluded[0].reason,'NO_TRUSTED_PROSPECTIVE_FREEZE');
});
