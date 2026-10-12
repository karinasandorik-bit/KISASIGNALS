import pg from 'pg';

// Read-only database readiness: a successful TCP handshake alone is insufficient.
// Do not let market feeds, model inference, or notification providers determine liveness.
export async function checkReadiness({connectionString=process.env.DATABASE_URL,Client=pg.Client,timeoutMs=2500}={}){
  if(!connectionString)return {ok:false,code:'DATABASE_URL_REQUIRED'};
  const client=new Client({connectionString,connectionTimeoutMillis:timeoutMs,query_timeout:timeoutMs});
  try{
    await client.connect();
    const q=await client.query(`SELECT
      to_regclass('owl_internal.predictions') IS NOT NULL AS predictions,
      to_regclass('owl_internal.outbox') IS NOT NULL AS outbox,
      has_table_privilege(current_user, 'owl_internal.predictions', 'SELECT, INSERT') AS prediction_access,
      has_table_privilege(current_user, 'owl_internal.outbox', 'SELECT, INSERT, UPDATE') AS outbox_access
    `);
    const x=q.rows[0];
    if(!x?.predictions||!x?.outbox)return {ok:false,code:'SCHEMA_MISSING',checks:{predictions:!!x?.predictions,outbox:!!x?.outbox}};
    if(!x.prediction_access||!x.outbox_access)return {ok:false,code:'DB_PERMISSION_DENIED'};
    return {ok:true,code:'READY'};
  }catch(e){
    // undefined_table and invalid_schema_name are expected configuration failures.
    const code=e.code==='42P01'||e.code==='3F000'?'SCHEMA_MISSING':
      e.code==='42501'?'DB_PERMISSION_DENIED':
      e.code==='ETIMEDOUT'||/timeout/i.test(e.message||'')?'DB_TIMEOUT':'DB_UNAVAILABLE';
    return {ok:false,code};
  }finally{try{await client.end()}catch{/* connection never established */}}
}

export function tickFailure(error,stage,{now=()=>new Date().toISOString()}={}){
  const raw=typeof error?.code==='string'?error.code:'';
  const code=/^[A-Z][A-Z0-9_]{1,63}$/.test(raw)?raw:
    /timeout|aborted/i.test(error?.message||'')?'DEPENDENCY_TIMEOUT':'TICK_ERROR';
  return {event:'TICK_FAILED',at:now(),stage,code};
}
