import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {closedSnapshot,market} from '../src/market.mjs';
import {featureVector,loadPriceNet} from '../src/pricenet.mjs';
import {metaGate} from '../src/kernel.mjs';
import {runLive} from '../src/live.mjs';
const start=1699999200;
const bars=()=>Array.from({length:20},(_,i)=>({t:start+i*3600,o:100,h:102,l:99,c:101,v:10}));
const now=(start+20*3600)*1000;
const snapshot=()=>closedSnapshot(bars(),{now,source:'fixture',exchange:'fixture'});
test('open and future bars cannot influence inference features',()=>{
 const extra=[...bars(),{t:start+20*3600,o:1,h:1e8,l:1,c:1e8,v:1e10}];
 assert.deepEqual(featureVector(closedSnapshot(extra,{now}).bars),featureVector(snapshot().bars));
 assert.equal(snapshot().feature_timestamp,new Date(now).toISOString());
});
test('reject gaps, duplicates, invalid prices and stale history',()=>{
 const gap=bars();gap.splice(5,1);assert.throws(()=>closedSnapshot(gap,{now}),/NON_CONTIGUOUS/);
 const dup=bars();dup[5]={...dup[4]};assert.throws(()=>closedSnapshot(dup,{now}),/NON_CONTIGUOUS/);
 const bad=bars();bad[5].c=NaN;assert.throws(()=>closedSnapshot(bad,{now}),/INVALID_BAR/);
 assert.throws(()=>closedSnapshot(bars(),{now:now+3600000}),/STALE/);
});
test('non-JSON upstream fails over without mixing exchange bars',async()=>{
 let calls=0;
 const m=await market({now:()=>now,fetchImpl:async()=>{
   calls++;if(calls===1)return new Response('<html>Unavailable</html>',{headers:{'content-type':'text/html'}});
   return Response.json({error:[],result:{XXBTZUSD:bars().map(b=>[b.t,b.o,b.h,b.l,b.c,0,b.v]),last:0}});
 }});
 assert.equal(m.exchange,'kraken');assert.equal(m.provider_errors[0].error,'NON_JSON_RESPONSE');assert.equal(calls,2);
});
test('all providers unavailable yields no fabricated observation',async()=>{
 await assert.rejects(market({fetchImpl:async()=>new Response('',{status:503})}),/ALL_MARKET_SOURCES_FAILED/);
});
test('runtime rejects changed model bytes',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'kisa-model-'));
 try{const p=path.join(d,'model.json');fs.writeFileSync(p,'{}');assert.throws(()=>loadPriceNet(p),/MODEL_HASH_MISMATCH/);}finally{fs.rmSync(d,{recursive:true});}
});
test('missing excursions fail closed and serialize without Infinity',()=>{
 const d=metaGate({pUp:.8,pDown:.1,pRange:.1,mfe50:null,mae50:null,mae90:null});
 assert.equal(d.action,'NO_TRADE');assert.equal(d.reason,'INVALID_OR_UNAVAILABLE_FORECAST');assert.deepEqual(JSON.parse(JSON.stringify(d)),d);
});
test('market to frozen inference to persisted observation integration',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kisa-ledger-'));const ledger=path.join(dir,'nested','ledger.jsonl');
 try{const row=await runLive({marketFn:async()=>snapshot(),ledger});
   assert.equal(row.status,'OBSERVATION_ONLY');assert.equal(row.decision.action,'NO_TRADE');
   const saved=JSON.parse(fs.readFileSync(ledger,'utf8'));assert.equal(saved.predictionId,row.predictionId);assert.equal(saved.market.feature_timestamp,new Date(now).toISOString());
   assert.equal(saved.model.calibration_version,null);
 }finally{fs.rmSync(dir,{recursive:true});}
});
