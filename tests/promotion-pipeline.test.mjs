import test from 'node:test';
import assert from 'node:assert/strict';
import {proveAndPromote} from '../src/promotion-pipeline.mjs';

function rows(n=6){
 return Array.from({length:n},(_,i)=>({
  status:'SETTLED',channel:'test',incrementalNetBps:10+i,didActionChange:true,regime:['A','B','C'][i%3],
  baselineResult:{maeBps:20+i},challengerResult:{maeBps:10+i},
  world:{pathHash:'world-'+i},featureCutoff:'2026-01-01T00:00:00.000Z',armedAt:'2026-01-01T00:01:00.000Z',
  tradeAuthority:'NONE',trialId:'t-'+i
 }));
}

test('PROVE -> PROMOTE mints evidence-rooted grant and ledger events',async()=>{
 const events=[];
 const out=await proveAndPromote({
  rows:rows(),subjectHash:'model-abc',
  evaluationPolicy:{channel:'test',minN:6,minActionChanges:6,minRegimes:3},
  grantPolicy:{modes:['PAPER'],ttlHours:1,now:new Date('2026-01-02T00:00:00.000Z')},
  persist:async(type,id,payload)=>events.push({type,id,payload})
 });
 assert.equal(out.evaluation.promote,true);
 assert.ok(out.evaluation.evidenceRoot);
 assert.equal(out.grant.evidenceRoot,out.evaluation.evidenceRoot);
 assert.equal(out.grant.subjectHash,'model-abc');
 assert.equal(out.event.status,'PROMOTED');
 assert.deepEqual(events.map(x=>x.type),['promotion_proof','capability_grant','promotion_decision']);
});

test('failed proof never mints authority',async()=>{
 const events=[];
 const out=await proveAndPromote({
  rows:rows(2),subjectHash:'model-abc',
  evaluationPolicy:{channel:'test',minN:100,minActionChanges:30,minRegimes:3},
  persist:async(type,id,payload)=>events.push({type,id,payload})
 });
 assert.equal(out.evaluation.promote,false);
 assert.equal(out.grant,null);
 assert.equal(out.event.status,'NOT_PROMOTED');
 assert.deepEqual(events.map(x=>x.type),['promotion_proof','promotion_decision']);
});
