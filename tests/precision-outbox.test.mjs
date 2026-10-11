import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {requireDatabase,withLedgerTransaction,ensureOutbox} from '../src/precision-outbox.mjs';

test('production refuses missing PostgreSQL',()=>{
  assert.throws(()=>requireDatabase({}),/POSTGRES_REQUIRED/);
});
test('database failure never enters work callback',async()=>{
  let invoked=false;
  await assert.rejects(withLedgerTransaction(async()=>{invoked=true},{env:{DATABASE_URL:'postgresql://127.0.0.1:1/unavailable'}}));
  assert.equal(invoked,false);
});
test('concurrent SKIP LOCKED claims assign one job to one worker', {
  skip:!process.env.OWL_TEST_DATABASE_URL
},async()=>{
  const p=new Pool({connectionString:process.env.OWL_TEST_DATABASE_URL,max:5});
  try {
    const a=await p.connect(),b=await p.connect();
    const id='fault-test-'+process.pid+'-'+Date.now();
    try {
      await ensureOutbox(a);
      await a.query("INSERT INTO owl_email_outbox_v2(decision_id,payload_hash,signal,recipient) VALUES($1,'test','{}'::jsonb,'test@example.invalid')",[id]);
      await a.query('BEGIN');
      const first=await a.query("SELECT decision_id FROM owl_email_outbox_v2 WHERE decision_id=$1 FOR UPDATE SKIP LOCKED",[id]);
      await b.query('BEGIN');
      const second=await b.query("SELECT decision_id FROM owl_email_outbox_v2 WHERE decision_id=$1 FOR UPDATE SKIP LOCKED",[id]);
      assert.equal(first.rowCount,1);
      assert.equal(second.rowCount,0);
    }finally {
      await a.query('ROLLBACK');await b.query('ROLLBACK');
      await p.query("DELETE FROM owl_email_outbox_v2 WHERE decision_id=$1",[id]);
      a.release();b.release();
    }
  }finally{await p.end();}
});
