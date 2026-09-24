import test from'node:test';import assert from'node:assert/strict';import{loadPriceNet,loadCalibration,featureVector,inferPriceNet,EXPECTED_MODEL_SHA256}from'../src/pricenet.mjs';
const bars=()=>Array.from({length:20},(_,i)=>({t:1699999200+i*3600,o:10000+i*10,h:10020+i*10,l:9980+i*10,c:10000+i*10,v:100+i}));
test('frozen model artifact hash is pinned',()=>assert.equal(loadPriceNet().sha256,EXPECTED_MODEL_SHA256));
test('calibration artifact is frozen and shadow eligible',()=>{const c=loadCalibration().artifact;assert.equal(c.promotion.status,'SHADOW_ELIGIBLE');assert.equal(c.excursion.status,'SHADOW_ACCEPTED')});
test('feature contract has 7 finite values',()=>{const x=featureVector(bars());assert.equal(x.length,7);assert.ok(x.every(Number.isFinite))});
test('probabilities and calibrated excursions are finite',()=>{const p=inferPriceNet(bars());assert.ok(Math.abs(p.pUp+p.pDown+p.pRange-1)<1e-12);assert.equal(p.excursionStatus,'SHADOW_ACCEPTED');assert.ok(['LONG','SHORT'].every(s=>[p.excursions[s].mfe50,p.excursions[s].mae50,p.excursions[s].mae90].every(Number.isFinite)))});
test('insufficient bars fail closed',()=>assert.throws(()=>featureVector(bars().slice(0,10)),/PRICENET_NEEDS_14_BARS/));
