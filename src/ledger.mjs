import fs from 'node:fs';
import pg from 'pg';
const {Pool}=pg;
let pool,ready;
function db(){if(!process.env.DATABASE_URL)return null;pool??=new Pool({connectionString:process.env.DATABASE_URL,ssl:false,max:3});return pool}
export async function initLedger(){
 const p=db();if(!p)return false;
 ready??=p.query(`CREATE TABLE IF NOT EXISTS evidence_events (
  event_type text NOT NULL,
  event_id text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY(event_type,event_id)
 )`);
 await ready;return true;
}
export function appendLedger(path,row){fs.mkdirSync(new URL('.', 'file://'+process.cwd()+'/'+path).pathname,{recursive:true});fs.appendFileSync(path,JSON.stringify(row)+'\n')}
export function readLedger(path){if(!fs.existsSync(path))return[];return fs.readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)}
export async function putEvidence(eventType,eventId,row){
 const p=db();if(!p)return false;await initLedger();
 await p.query('INSERT INTO evidence_events(event_type,event_id,observed_at,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(event_type,event_id) DO NOTHING',[eventType,eventId,row.ts||row.signalAt||row.settledAt||new Date().toISOString(),JSON.stringify(row)]);return true;
}
export async function hasEvidence(eventType,eventId){const p=db();if(!p)return false;await initLedger();const r=await p.query('SELECT 1 FROM evidence_events WHERE event_type=$1 AND event_id=$2 LIMIT 1',[eventType,eventId]);return r.rowCount>0}
export async function readEvidence(eventType,{limit=100}={}){const p=db();if(!p)return null;await initLedger();const r=await p.query('SELECT payload FROM evidence_events WHERE event_type=$1 ORDER BY observed_at DESC LIMIT $2',[eventType,limit]);return r.rows.map(x=>x.payload)}
export async function ledgerHealth(){const p=db();if(!p)return{backend:'jsonl',postgres:false};try{await initLedger();await p.query('SELECT 1');return{backend:'postgres+jsonl',postgres:true}}catch(e){return{backend:'jsonl-fallback',postgres:false,error:e.message}}}
