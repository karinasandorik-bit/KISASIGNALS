import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFrozenPrediction,evaluateNet} from '../src/prospective-price-ledger.mjs';
import {gmailLookup} from '../src/gmail-provider-readback.mjs';
const h='a'.repeat(64),at=Date.parse('2026-10-12T10:00:00.000Z');
const p={decisionId:'p1',modelSha256:h,evidenceSha256:h,evidenceAt:new Date(at-1000).toISOString(),targetAt:new Date(at+4*3600000).toISOString(),venue:'OKX',symbol:'BTCUSDT',entryPrice:100,side:'LONG'};
test('forecast must be committed before exact future target',()=>{
 assert.equal(validateFrozenPrediction(p,at),true);
 assert.throws(()=>validateFrozenPrediction({...p,evidenceAt:new Date(at+1000).toISOString()},at),/INVALID_PROSPECTIVE/);
 assert.throws(()=>validateFrozenPrediction({...p,targetAt:new Date(at+3*3600000).toISOString()},at),/INVALID_PROSPECTIVE/);
});
test('net return is direction aware and costs included',()=>{
 const x=evaluateNet(p,{decisionId:'p1',quality:'EXACT_INDEPENDENT',venue:'BITGET',sourceSha256:h,observedAt:p.targetAt,exitPrice:101,feeBps:8,slippageBps:3,fundingBps:1});
 assert.ok(Math.abs(x.netReturnPct-0.88)<1e-10);
 assert.equal(evaluateNet({...p,side:'NO_TRADE'},{decisionId:'p1',quality:'EXACT_INDEPENDENT',venue:'BITGET',sourceSha256:h,observedAt:p.targetAt,exitPrice:101,feeBps:8,slippageBps:3,fundingBps:1}).eligibleTrade,false);
 assert.throws(()=>evaluateNet(p,{decisionId:'p1',quality:'EXACT_INDEPENDENT',venue:'OKX',sourceSha256:h,observedAt:p.targetAt,exitPrice:101,feeBps:8,slippageBps:3,fundingBps:1}),/DEPENDENT/);
});
test('Gmail reconciliation rejects partial pagination and verifies exact ID',async()=>{
 const token='ci-placeholder',id='OWL-TEST-12345678';
 const lookup=gmailLookup({token,recipient:'test@example.invalid',fetchImpl:async url=>url.includes('format=full')?{ok:true,json:async()=>({labelIds:['SENT'],payload:{headers:[{name:'Subject',value:id+' NO TRADE'},{name:'To',value:'test@example.invalid'}]}})}:{ok:true,json:async()=>({messages:[{id:'gmail1'}]})}});
 assert.deepEqual((await lookup(id)).map(x=>x.id),['gmail1']);
 const incomplete=gmailLookup({token,fetchImpl:async()=>({ok:true,json:async()=>({messages:[{id:'gmail1'}],nextPageToken:'more'})})});
 await assert.rejects(incomplete(id),/PAGINATION_UNVERIFIED/);
});
