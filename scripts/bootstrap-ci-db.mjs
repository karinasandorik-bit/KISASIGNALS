import pg from 'pg';
import {readFileSync} from 'node:fs';
if(process.env.NODE_ENV!=='test') throw Error('CI_SCHEMA_REQUIRES_TEST_MODE');
if(!process.env.DATABASE_URL) throw Error('CI_DATABASE_URL_REQUIRED');
const url=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1','postgres'].includes(url.hostname)) throw Error('CI_REQUIRES_DISPOSABLE_LOCAL_DB');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
  await client.query(readFileSync(new URL('../sql/ci-atomic-schema.sql',import.meta.url),'utf8'));
  const r=await client.query("select to_regclass('owl_internal.predictions') as predictions,to_regclass('owl_internal.outbox') as outbox,to_regclass('owl_internal.settlements') as settlements");
  if(Object.values(r.rows[0]).some(x=>!x)) throw Error('CI_SCHEMA_INCOMPLETE');
  process.stdout.write('CI_ATOMIC_SCHEMA_READY\n');
} finally {await client.end();}
