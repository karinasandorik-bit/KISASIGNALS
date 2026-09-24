import http from 'node:http';
import fs from 'node:fs';
import {runLive,market} from './live.mjs';
import {settleEligible} from './settlement.mjs';
import {ledgerHealth,readEvidence} from './ledger.mjs';
import {safeCaptureFuturesState,futuresProviderHealth} from './futures-recorder.mjs';
import {scanUniverse} from './universe.mjs';
import {marketContext} from './context.mjs';
import {captureExternalEvidence,evidenceMap} from './evidence-adapters.mjs';
import {buildDecisionIntelligence} from './decision-intelligence.mjs';
import {armLiveAblations,settleLiveAblations} from './live-ablation.mjs';
import {putEvidence} from './ledger.mjs';
import {ingestCollectorSnapshot} from './collector-ingest.mjs';
const PORT=Number(process.env.PORT||3000),LEDGER=process.env.LEDGER_PATH||'data/prospective.jsonl',SETTLEMENTS=process.env.SETTLEMENT_PATH||'data/settlements.jsonl',REFRESH_MS=Math.max(60_000,Number(process.env.REFRESH_MS||300_000)),clients=new Set();
let latest=null,lastError=null,running=false,dbHealth={backend:'initializing',postgres:false},dbRows=null,dbSettlements=null,dbTrials=[],dbTrialSettlements=[],providerHealth=[],futuresState=null,universe=[],context=null,previousUniverse=new Map(),externalEvidence={},decisionUniverse=[],candles=[];
function read(path,n=100){try{return fs.readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).slice(-n).reverse()}catch{return[]}}
function payload(){return JSON.stringify({latest,rows:dbRows??read(LEDGER),settlements:dbSettlements??read(SETTLEMENTS),trials:dbTrials,trialSettlements:dbTrialSettlements,providerHealth,persistence:dbHealth,futuresState,universe:decisionUniverse.length?decisionUniverse:universe,candles,context,externalEvidence,lastError,server_time:new Date().toISOString(),refresh_ms:REFRESH_MS})}
function broadcast(){const d='data: '+payload()+'\n\n';for(const r of clients)r.write(d)}
async function refreshEvidence(){dbHealth=await ledgerHealth();if(dbHealth.postgres){dbRows=await readEvidence('prediction');dbSettlements=await readEvidence('settlement');dbTrials=await readEvidence('ablation_trial',{limit:500});dbTrialSettlements=await readEvidence('ablation_settlement',{limit:500});providerHealth=await readEvidence('provider_health',{limit:50})}else{dbRows=dbSettlements=null;dbTrials=[];dbTrialSettlements=[];providerHealth=[]}}
async function tick(){if(running)return;running=true;try{const m=await market();candles=(m.bars||[]).slice(-80);latest=await runLive({marketFn:async()=>m,ledger:LEDGER});await settleEligible({predictions:LEDGER,settlements:SETTLEMENTS,bars:m.bars,now:m.received_at});futuresState=await safeCaptureFuturesState('BTCUSDT');
const intel=await Promise.allSettled([scanUniverse({limit:Number(process.env.UNIVERSE_LIMIT||60),previous:previousUniverse}),marketContext()]);
if(intel[0].status==='fulfilled'){universe=intel[0].value;previousUniverse=new Map(universe.filter(x=>Number.isFinite(x.openInterest)).map(x=>[x.symbol,{openInterest:x.openInterest,observedAt:x.observedAt}]))}else console.error(JSON.stringify({event:'UNIVERSE_SCAN_FAILED',error:intel[0].reason?.message}));
if(intel[1].status==='fulfilled')context=intel[1].value;else console.error(JSON.stringify({event:'MARKET_CONTEXT_FAILED',error:intel[1].reason?.message}));
const leaders=universe.slice(0,8);const ev=await Promise.allSettled(leaders.map(x=>captureExternalEvidence(x.symbol)));externalEvidence=Object.fromEntries(leaders.map((x,i)=>[x.symbol,ev[i].status==='fulfilled'?evidenceMap(ev[i].value):{}]));decisionUniverse=buildDecisionIntelligence(universe,externalEvidence);const matrixAt=new Date().toISOString();await putEvidence('asset_matrix',matrixAt,{observedAt:matrixAt,assets:decisionUniverse});const armed=await armLiveAblations(decisionUniverse,matrixAt);const abSettled=await settleLiveAblations(decisionUniverse,matrixAt);if(armed.length)console.log(JSON.stringify({event:'ABLATION_TRIALS_ARMED',n:armed.length,at:matrixAt}));if(abSettled.length)console.log(JSON.stringify({event:'ABLATION_TRIALS_SETTLED',n:abSettled.length,at:matrixAt}));
if(futuresState.ok){
 const s=futuresState.state;
 console.log(JSON.stringify({event:'FUTURES_PROVIDER_HEALTH',providers:futuresProviderHealth()}));
 console.log(JSON.stringify({event:'FUTURES_STATE_VERIFIED',symbol:s.symbol,observed_at:s.observedAt,source:s.source,funding_rate:s.fundingRate,open_interest:s.openInterest,mark_index_bps:s.markIndexBps,spread_bps:s.spreadBps,depth_imbalance:s.depthImbalance,flow_imbalance:s.flowImbalance}));
}else{
 console.error(JSON.stringify({event:'FUTURES_STATE_FAILED',observed_at:futuresState.observedAt,error:futuresState.error}));
}
await refreshEvidence();lastError=null}catch(e){lastError={at:new Date().toISOString(),message:e.message}}finally{running=false;broadcast()}}
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const server=http.createServer((req,res)=>{if(req.url==='/api/collector'&&req.method==='POST'){let body='';req.on('data',x=>body+=x);req.on('end',async()=>{try{const snapshot=JSON.parse(body);const row=await ingestCollectorSnapshot(snapshot,{signature:req.headers['x-kisa-signature'],rawBody:body});res.writeHead(202,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,quality:row.quality,sourceObservedAt:row.sourceObservedAt}))}catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:e.message}))}});return}if(req.url==='/api/state'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(payload())}if(req.url==='/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});clients.add(res);res.write('data: '+payload()+'\n\n');req.on('close',()=>clients.delete(res));return}if(req.url==='/health'){res.writeHead(lastError?503:200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:!lastError,persistence:dbHealth,lastError}))}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});
server.listen(PORT,()=>console.log(JSON.stringify({event:'DASHBOARD_READY',port:PORT,refresh_ms:REFRESH_MS})));tick();setInterval(tick,REFRESH_MS);
