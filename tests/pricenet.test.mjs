import test from'node:test';import assert from'node:assert/strict';import{loadPriceNet,featureVector,inferPriceNet,EXPECTED_MODEL_SHA256}from'../src/pricenet.mjs';
const bars=()=>Array.from({length:20},(_,i)=>({t:1699999200+i*3600,o:10000+i*10,h:10020+i*10,l:9980+i*10,c:10000+i*10,v:100+i}));
test('frozen artifact hash is pinned',()=>assert.equal(loadPriceNet().sha256,EXPECTED_MODEL_SHA256));
test('feature contract has 7 finite values',()=>{const x=featureVector(bars());assert.equal(x.length,7);assert.ok(x.every(Number.isFinite))});
test('classifier probabilities normalize',()=>{const p=inferPriceNet(bars());const s=p.pUp+p.pDown+p.pRange;assert.ok(Math.abs(s-1)<1e-12);assert.ok([p.pUp,p.pDown,p.pRange,p.uncertainty,p.ood].every(Number.isFinite))});
test('insufficient bars fail closed',()=>assert.throws(()=>featureVector(bars().slice(0,10)),/PRICENET_NEEDS_14_BARS/));
