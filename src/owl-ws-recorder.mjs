// OWL WS Recorder v0.1: SHADOW-only, no order execution.
// Node >=22 global WebSocket required. Disabled unless explicitly enabled.
import pg from 'pg';
import crypto from 'node:crypto';
const {Client}=pg;
export const LOCK_KEY=74110501;
export const normalizeFrame=(frame,receivedAt=new Date().toISOString())=>{
  if(!frame||typeof frame!=='object'||!frame.arg||!Array.isArray(frame.data))return [];
  const {channel,instId}=frame.arg;
  if(!['books5','trades'].includes(channel)||typeof instId!=='string')return [];
  return frame.data.map(d=>{
    const exchangeAt=Number(d.ts);
    if(!Number.isFinite(exchangeAt)||exchangeAt<=0)return null;
    const value=channel==='books5'
      ? {bids:d.bids,asks:d.asks,checksum:d.checksum??null}
      : {tradeId:d.tradeId,side:d.side,px:d.px,sz:d.sz};
    const id=crypto.createHash('sha256').update(JSON.stringify([channel,instId,d.ts,channel==='trades'?d.tradeId:value])).digest('hex');
    return {id,source:'okx-public',channel,symbol:instId,exchangeAt:new Date(exchangeAt).toISOString(),receivedAt,payload:value};
  }).filter(Boolean);
};
export async function main({env=process.env}={}){
  if(env.OWL_WS_RECORDER_ENABLED!=='true'){console.log(JSON.stringify({event:'OWL_WS_DISABLED'}));return;}
  if(!env.DATABASE_URL)throw Error('DATABASE_URL_REQUIRED');
  if(typeof WebSocket!=='function')throw Error('NODE_WEBSOCKET_UNAVAILABLE');
  const db=new Client({connectionString:env.DATABASE_URL});
  await db.connect();
  const acquired=await db.query('SELECT pg_try_advisory_lock($1) AS locked',[LOCK_KEY]);
  if(!acquired.rows[0]?.locked) {console.log(JSON.stringify({event:'OWL_WS_STANDBY',reason:'LOCK_HELD'}));await db.end();return;}
  await db.query(`CREATE TABLE IF NOT EXISTS owl_ws_events(
    id text PRIMARY KEY, source text NOT NULL, channel text NOT NULL,
    symbol text NOT NULL, exchange_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL, payload jsonb NOT NULL)`);
  let closed=false,attempt=0,ws,heartbeat;
  const stop=()=>{closed=true;clearInterval(heartbeat);if(ws)ws.close();};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try{
    while(!closed){
      let lastFrame=Date.now();
      try{
        ws=new WebSocket(env.OWL_WS_URL||'wss://ws.okx.com:8443/ws/v5/public');
        await new Promise((resolve,reject)=>{
          const timeout=setTimeout(()=>reject(Error('WS_CONNECT_TIMEOUT')),12000);
          ws.addEventListener('open',()=>{clearTimeout(timeout);resolve();},{once:true});
          ws.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('WS_OPEN_ERROR'));},{once:true});
        });
        attempt=0;
        ws.send(JSON.stringify({op:'subscribe',args:[{channel:'books5',instId:'BTC-USDT-SWAP'},{channel:'trades',instId:'BTC-USDT-SWAP'}]}));
        console.log(JSON.stringify({event:'OWL_WS_CONNECTED',source:'okx',symbol:'BTC-USDT-SWAP'}));
        heartbeat=setInterval(()=>{
          if(Date.now()-lastFrame>30000){try{ws.send('ping')}catch{}}
          if(Date.now()-lastFrame>60000)ws.close();
        },10000);
        for await (const data of streamFrames(ws,()=>{lastFrame=Date.now()})){
          if(data==='pong')continue;
          let parsed;try{parsed=JSON.parse(data)}catch{continue;}
          const frames=normalizeFrame(parsed);
          for(const frame of frames){
            await db.query(`INSERT INTO owl_ws_events(id,source,channel,symbol,exchange_at,received_at,payload)
            VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(id) DO NOTHING`,
              [frame.id,frame.source,frame.channel,frame.symbol,frame.exchangeAt,frame.receivedAt,JSON.stringify(frame.payload)]);
          }
          if(frames.length)console.log(JSON.stringify({event:'OWL_WS_FRAMES_WRITTEN',count:frames.length,channel:frames[0].channel,lastReceivedAt:frames.at(-1).receivedAt}));
        }
      }catch(e){console.error(JSON.stringify({event:'OWL_WS_RECONNECT',code:e.message}));}
      finally{clearInterval(heartbeat);try{ws?.close()}catch{}}
      if(!closed)await new Promise(r=>setTimeout(r,Math.min(60000,1000*2**Math.min(++attempt,6))));
    }
  }finally{await db.query('SELECT pg_advisory_unlock($1)',[LOCK_KEY]).catch(()=>{});await db.end();}
}
// Async queue avoids losing messages while PostgreSQL is writing.
// Exits on close/error; reconnection handled by outer loop.
export async function* streamFrames(ws,onFrame=()=>{}){
  const queue=[];let done=false,wake;
  const push=x=>{queue.push(x);if(wake){wake();wake=null}};
  ws.addEventListener('message',e=>{onFrame();if(queue.length>=10000){done=true;try{ws.close()}catch{};push(null);return;}push(typeof e.data==='string'?e.data:String(e.data))});
  ws.addEventListener('close',()=>{done=true;push(null)},{once:true});
  ws.addEventListener('error',()=>{done=true;push(null)},{once:true});
  while(!done||queue.length){if(!queue.length)await new Promise(r=>{wake=r});const msg=queue.shift();if(msg!==null&&msg!==undefined)yield msg;}
}
if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(JSON.stringify({event:'OWL_WS_FATAL',code:e.message}));process.exitCode=1});
