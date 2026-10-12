import test from 'node:test';
import assert from 'node:assert/strict';
import {assessEmailTrackRecord} from '../src/email-track-record-gate.mjs';
const samples=(n,ret=20)=>Array.from({length:n},(_,i)=>({
 decisionId:'d'+i,prospective:true,independentlySettled:true,netReturnBps:ret,
 frozenAt:new Date(Date.UTC(2026,0,1+i)).toISOString(),
 settledAt:new Date(Date.UTC(2026,0,1+i,4)).toISOString()
}));
test('insufficient evidence cannot qualify',()=>{
 assert.equal(assessEmailTrackRecord(samples(99)).eligible,false);
});
test('unverified settlement cannot qualify',()=>{
 assert.equal(assessEmailTrackRecord(samples(120).map(r=>({...r,independentlySettled:false}))).eligible,false);
});
test('deduplicates decision ids',()=>{
 const row=samples(1)[0];
 assert.equal(assessEmailTrackRecord(Array.from({length:120},()=>({...row}))).n,1);
});
test('negative measured edge is rejected',()=>{
 assert.equal(assessEmailTrackRecord(samples(120,-10)).reason,'EDGE_NOT_ESTABLISHED');
});
test('synthetic positive fixture exercises mathematical branch only',()=>{
 assert.equal(assessEmailTrackRecord(samples(120,20)).eligible,true);
});
