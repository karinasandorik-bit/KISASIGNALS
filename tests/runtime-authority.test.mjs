import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRuntimeAuthority} from '../src/runtime-authority.mjs';

const grant={grantId:'g1',subjectHash:'model-a',status:'ACTIVE',expiresAt:'2099-01-01T00:00:00.000Z',evidenceRoot:'proof',rollbackTo:'safe',proofBaseline:{meanIncrementalNetBps:20}};

test('runtime returns persisted revocation before evaluating new outcomes',async()=>{
 const rev={grantId:'g1',revocationId:'r1',status:'REVOKED',reason:'EDGE_DEGRADATION'};
 const out=await resolveRuntimeAuthority({subjectHash:'model-a',grant,readLatest:async(type)=>type==='authority_revocation'?rev:null,readOutcomes:async()=>{throw Error('must not read')},persist:async()=>{}});
 assert.equal(out.revocation.revocationId,'r1');
 assert.equal(out.reason,'GRANT_ALREADY_REVOKED');
});

test('postgres authority outage is explicit and fail-closed',async()=>{
 const out=await resolveRuntimeAuthority({subjectHash:'model-a',grant,readLatest:async()=>null,readOutcomes:async()=>null,persist:async()=>{}});
 assert.equal(out.available,false);
 assert.equal(out.reason,'POSTGRES_AUTHORITY_STATE_UNAVAILABLE');
});

test('settled degradation produces live revocation',async()=>{
 const rows=Array.from({length:20},(_,i)=>({status:'SETTLED',subjectHash:'model-a',incrementalNetBps:-1,settledAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),baselineResult:{maeBps:20},challengerResult:{maeBps:20}}));
 const events=[];
 const out=await resolveRuntimeAuthority({subjectHash:'model-a',grant,policy:{minN:20,maxConsecutiveLosses:99,maxMeanDropBps:15},readLatest:async()=>null,readOutcomes:async()=>rows,persist:async(type)=>events.push(type)});
 assert.equal(out.revocation.status,'REVOKED');
 assert.equal(out.transition,'DEMOTE');
 assert.ok(events.includes('authority_revocation'));
});
