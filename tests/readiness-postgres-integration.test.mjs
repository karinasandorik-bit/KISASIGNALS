import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {checkReadiness} from '../src/readiness.mjs';

const connectionString=process.env.OWL_ISOLATED_DATABASE_URL;
test('isolated PostgreSQL readiness checks schema, privileges and DB outage',{skip:!connectionString},async()=>{
 const db=new pg.Client({connectionString});await db.connect();
 try{
  // Dedicated disposable CI instance ONLY. Never run against production credentials.
  assert.equal(process.env.CI,'true','must run on disposable CI only');
  assert.match(connectionString,/\/kisa_readiness_ci(?:\?|$)/);
  await db.query('DROP SCHEMA IF EXISTS owl_internal CASCADE');
  assert.equal((await checkReadiness({connectionString})).code,'SCHEMA_MISSING');
  await db.query('CREATE SCHEMA owl_internal');
  await db.query('CREATE TABLE owl_internal.predictions (id text PRIMARY KEY)');
  assert.equal((await checkReadiness({connectionString})).code,'SCHEMA_MISSING');
  await db.query('CREATE TABLE owl_internal.outbox (id bigint PRIMARY KEY)');
  assert.deepEqual(await checkReadiness({connectionString}),{ok:true,code:'READY'});
  await db.query('DROP SCHEMA owl_internal CASCADE');
  assert.equal((await checkReadiness({connectionString})).code,'SCHEMA_MISSING');
 }finally{await db.end()}
 // Different isolated loopback port must fail even while HTTP process can be live.
 const unavailable=connectionString.replace(':5432/',':1/');
 assert.equal((await checkReadiness({connectionString:unavailable,timeoutMs:500})).ok,false);
});
