import test from 'node:test';
import assert from 'node:assert/strict';
import {checkReadiness,tickFailure} from '../src/readiness.mjs';

class MockClient {
  constructor(){this.rows=[{predictions:true,outbox:true,prediction_access:true,outbox_access:true}]}
  async connect(){}
  async query(){return {rows:this.rows}}
  async end(){}
}
test('no DB string fails closed',async()=>assert.deepEqual(await checkReadiness({connectionString:''}),{ok:false,code:'DATABASE_URL_REQUIRED'}));
test('healthy schema and privileges ready',async()=>assert.deepEqual(await checkReadiness({connectionString:'isolated-test',Client:MockClient}),{ok:true,code:'READY'}));
test('missing table fails closed',async()=>{
 class Missing extends MockClient{constructor(){super();this.rows=[{predictions:true,outbox:false}]}}
 assert.equal((await checkReadiness({connectionString:'test',Client:Missing})).code,'SCHEMA_MISSING');
});
test('DB outage fails readiness',async()=>{
 class Outage extends MockClient{async connect(){throw Object.assign(Error('connection refused'),{code:'ECONNREFUSED'})}}
 assert.equal((await checkReadiness({connectionString:'test',Client:Outage})).code,'DB_UNAVAILABLE');
});
test('DB timeout fails readiness',async()=>{
 class Timeout extends MockClient{async query(){throw Error('query timeout')}}
 assert.equal((await checkReadiness({connectionString:'test',Client:Timeout})).code,'DB_TIMEOUT');
});
test('permissions fail closed',async()=>{
 class Denied extends MockClient{constructor(){super();this.rows=[{predictions:true,outbox:true,prediction_access:false,outbox_access:true}]}}
 assert.equal((await checkReadiness({connectionString:'test',Client:Denied})).code,'DB_PERMISSION_DENIED');
});
test('market timeout is TICK_FAILED not liveness failure',()=>{
 assert.deepEqual(tickFailure(Object.assign(Error('market timeout'),{code:'ETIMEDOUT'}),'market',{now:()=> '2026-10-12T00:00:00Z'}),{event:'TICK_FAILED',at:'2026-10-12T00:00:00Z',stage:'market',code:'ETIMEDOUT'});
});
