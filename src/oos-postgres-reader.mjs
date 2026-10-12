import pg from 'pg';
import {createHash} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex');
export async function readOosLedger({connectionString=process.env.OOS_READONLY_DATABASE_URL,limit=5000}={}){
 if(!connectionString)throw Error('OOS_READONLY_DATABASE_URL_REQUIRED');
 if(!Number.isInteger(limit)||limit<1||limit>100000)throw Error('INVALID_LIMIT');
 const c=new pg.Client({connectionString,application_name:'kisa-oos-readonly'});
 await c.connect();
 try{
  await c.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ');
  const p=await c.query('SELECT id,commitment,payload,target_at,frozen_at FROM owl_internal.predictions ORDER BY target_at,id LIMIT $1',[limit]);
  const w=await c.query("SELECT event_id,payload FROM public.evidence_events WHERE event_type='oos_independent_world' ORDER BY event_id LIMIT $1",[limit]);
  const b=await c.query("SELECT event_id,payload FROM public.evidence_events WHERE event_type='oos_frozen_baseline' ORDER BY event_id LIMIT $1",[limit]);
  await c.query('COMMIT');
  const predictions=p.rows.map(row=>{
   const raw=JSON.stringify(row.payload);
   // Original commitment uses JSON.stringify(row) before PG jsonb conversion.
   // Recompute only if canonical freeze format/serialization has been standardized.
   if(!/^[a-f0-9]{64}$/.test(row.commitment))throw Error('INVALID_PREDICTION_COMMITMENT');
   return {id:row.id,commitment:row.commitment,targetAt:row.target_at,frozenAt:row.frozen_at,payload:row.payload,dbPayloadHash:digest(raw)};
  });
  return {predictions,worlds:w.rows.map(x=>({id:x.event_id,payload:x.payload})),baselines:b.rows.map(x=>({id:x.event_id,payload:x.payload})),
   snapshotHash:digest(JSON.stringify({predictions,w:w.rows,b:b.rows})),readAt:new Date().toISOString()};
 }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{await c.end()}
}
