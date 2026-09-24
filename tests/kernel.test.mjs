import test from 'node:test';import assert from 'node:assert/strict';import{metaGate,riskEngine,makePrediction,settle,metrics}from'../src/kernel.mjs';
const good={pUp:.7,pDown:.15,pRange:.15,mfe50:120,mae50:35,mae90:70};
const weak={pUp:.36,pDown:.34,pRange:.30,mfe50:45,mae50:45,mae90:90};
test('selective gate trades positive edge',()=>assert.equal(metaGate(good).action,'LONG'));
test('selective gate abstains weak edge',()=>assert.equal(metaGate(weak).action,'NO_TRADE'));
test('risk is zero on abstention',()=>assert.equal(riskEngine(metaGate(weak)).sizeUsd,0));
test('prediction is deterministic',()=>{const x={ts:'t',modelVersion:'m',features:[1,2],forecast:good};assert.equal(makePrediction(x).predictionId,makePrediction(x).predictionId)});
test('settlement charges costs',()=>{const p=makePrediction({ts:'t',modelVersion:'m',features:[1],forecast:good});assert.equal(settle(p,{returnBps:100}).outcome.netPnlBps,87)});
test('metrics enforce coverage and tail loss',()=>{const a=makePrediction({ts:'1',modelVersion:'m',features:[1],forecast:good});const b=makePrediction({ts:'2',modelVersion:'m',features:[2],forecast:weak});const m=metrics([settle(a,{returnBps:-40}),settle(b,{returnBps:0})]);assert.equal(m.coverage,.5);assert.equal(m.cvar95LossBps,53)});
