import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {runLive} from './live.mjs';

const PORT=Number(process.env.PORT||3000);
const LEDGER=process.env.LEDGER_PATH||'data/prospective.jsonl';
const REFRESH_MS=Math.max(60_000,Number(process.env.REFRESH_MS||300_000));
const clients=new Set();
let latest=null,lastError=null,running=false;

function readRows(){
 try{return fs.readFileSync(LEDGER,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)).slice(-100).reverse()}
 catch{return[]}
}
function payload(){return JSON.stringify({latest,rows:readRows(),lastError,server_time:new Date().toISOString(),refresh_ms:REFRESH_MS})}
function broadcast(){const d='data: '+payload()+'\n\n';for(const r of clients)r.write(d)}
async function tick(){
 if(running)return; running=true;
 try{latest=await runLive({ledger:LEDGER});lastError=null}catch(e){lastError={at:new Date().toISOString(),message:e.message}}
 finally{running=false;broadcast()}
}
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const server=http.createServer((req,res)=>{
 if(req.url==='/api/state'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(payload())}
 if(req.url==='/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});clients.add(res);res.write('data: '+payload()+'\n\n');req.on('close',()=>clients.delete(res));return}
 if(req.url==='/health'){res.writeHead(lastError?503:200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:!lastError,lastError}))}
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);
});
server.listen(PORT,()=>console.log(JSON.stringify({event:'DASHBOARD_READY',port:PORT,refresh_ms:REFRESH_MS})));
tick();setInterval(tick,REFRESH_MS);