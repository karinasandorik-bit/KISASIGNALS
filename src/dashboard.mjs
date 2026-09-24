import http from 'node:http';
import fs from 'node:fs';
import {runLive,market} from './live.mjs';
import {settleEligible} from './settlement.mjs';
import {ledgerHealth,readEvidence} from './ledger.mjs';
import {safeCaptureFuturesState} from './futures-recorder.mjs';
const PORT=Number(process.env.PORT||3000),LEDGER=process.env.LEDGER_PATH||'data/prospective.jsonl',SETTLEMENTS=process.env.SETTLEMENT_PATH||'data/settlements.jsonl',REFRESH_MS=Math.max(60_000,Number(process.env.REFRESH_MS||300_000)),clients=new Set();
let latest=null,lastError=null,running=false,dbHealth={backend:'initializing',postgres:false},dbRows=null,dbSettlements=null,futuresState=null;
function read(path,n=100){try{return fs.readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).slice(-n).reverse()}catch{return[]}}
function payload(){return JSON.stringify({latest,rows:dbRows??read(LEDGER),settlements:dbSettlements??read(SETTLEMENTS),persistence:dbHealth,futuresState,lastError,server_time:new Date().toISOString(),refresh_ms:REFRESH_MS})}
function broadcast(){const d='data: '+payload()+'\n\n';for(const r of clients)r.write(d)}
async function refreshEvidence(){dbHealth=await ledgerHealth();if(dbHealth.postgres){dbRows=await readEvidence('prediction');dbSettlements=await readEvidence('settlement')}else{dbRows=dbSettlements=null}}
async function tick(){if(running)return;running=true;try{const m=await market();latest=await runLive({marketFn:async()=>m,ledger:LEDGER});await settleEligible({predictions:LEDGER,settlements:SETTLEMENTS,bars:m.bars,now:m.received_at});futuresState=await safeCaptureFuturesState('BTCUSDT');await refreshEvidence();lastError=null}catch(e){lastError={at:new Date().toISOString(),message:e.message}}finally{running=false;broadcast()}}
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const server=http.createServer((req,res)=>{if(req.url==='/api/state'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(payload())}if(req.url==='/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});clients.add(res);res.write('data: '+payload()+'\n\n');req.on('close',()=>clients.delete(res));return}if(req.url==='/health'){res.writeHead(lastError?503:200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:!lastError,persistence:dbHealth,lastError}))}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});
server.listen(PORT,()=>console.log(JSON.stringify({event:'DASHBOARD_READY',port:PORT,refresh_ms:REFRESH_MS})));tick();setInterval(tick,REFRESH_MS);
