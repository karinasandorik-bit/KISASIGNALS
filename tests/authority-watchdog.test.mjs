import test from 'node:test';
import assert from 'node:assert/strict';
import {createCapabilityGrant} from '../src/capability-grant.mjs';
import {evaluateGrantHealth,watchAuthority} from '../src/authority-watchdog.mjs';

const grant=Object.freeze({...createCapabilityGrant({subjectHash:'model-a',modes:['PAPER'],evidenceRoot:'proof-root',expiresAt:'2099-01-01T00:00:00.000Z',rollbackTo:'model-safe'}),proofBaseline:{meanIncrementalNetBps:20}});
const rows=(n,value,tail=0)=>Array.from({length:n},(_,i)=>({status:'SETTLED',incrementalNetBps:value,settledAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),baselineResult:{maeBps:20},challengerResult:{maeBps:20+tail}}));

test('healthy live evidence holds authority',()=>{
 const h=evaluateGrantHealth(grant,rows(20,18),{minN:20});
 assert.equal(h.healthy,true);
 assert.equal(h.reason,'WITHIN_PROVEN_BOUNDS');
});

test('edge degradation automatically DEMOTEs and revokes grant',async()=>{
 const events=[];
 const out=await watchAuthority({grant,rows:rows(20,-1),policy:{minN:20,maxConsecutiveLosses:99,maxMeanDropBps:15},persist:async(type,id,payload)=>events.push(type)});
 assert.equal(out.transition,'DEMOTE');
 assert.equal(out.revocation.status,'REVOKED');
 assert.equal(out.revocation.rollbackTo,'model-safe');
 assert.deepEqual(events,['authority_health','authority_revocation','authority_transition']);
});

test('tail degradation automatically ROLLBACKs to frozen target',async()=>{
 const out=await watchAuthority({grant,rows:rows(20,18,25),policy:{minN:20,maxTailDeteriorationBps:10},persist:async()=>{}});
 assert.equal(out.transition,'ROLLBACK');
 assert.equal(out.event.rollbackTo,'model-safe');
 assert.equal(out.health.reason,'TAIL_RISK_DEGRADATION');
});

test('insufficient evidence cannot demote',()=>{
 const h=evaluateGrantHealth(grant,rows(3,-100),{minN:20});
 assert.equal(h.healthy,true);
 assert.equal(h.reason,'INSUFFICIENT_LIVE_EVIDENCE');
});
