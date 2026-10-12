import test from 'node:test';import assert from 'node:assert/strict';import {freezeShadowCandidate,shadowExecution,independentCalibration,closeShadowLoop} from '../src/shadow-loop.mjs';
const pred={predictionId:'x',ts:'2026-10-01T00:00:00Z',market:{reference_close:100,feature_timestamp:'2026-10-01T00:00:00Z'},decision:{action:'NO_TRADE',blockedAction:'LONG'}};
test('blocked candidate retained for shadow comparison',()=>{const c=freezeShadowCandidate(pred);assert.equal(c.side,'LONG');assert.equal(c.authorized,false);});
test('missing measured costs refuses simulated pnl',()=>assert.equal(shadowExecution(freezeShadowCandidate(pred),[]).status,'COST_EVIDENCE_MISSING'));
test('holdout leakage rejects',()=>assert.equal(independentCalibration([{id:'a',pWin:.5,y:1}],[{id:'a',pWin:.5,y:1}]).status,'LEAKAGE'));
test('pending candles never claim settlement',()=>assert.equal(shadowExecution(freezeShadowCandidate(pred),[],{roundTripFeesBps:10,slippageBps:2,fundingBps:1}).status,'PENDING'));
test('closed loop remains NO_TRADE without independently proven costs',()=>assert.equal(closeShadowLoop({prediction:pred,bars:[]}).decision.action,'NO_TRADE'));
test('independent calibration is not automatically authorization',()=>{const tr=Array.from({length:100},(_,i)=>({id:'t'+i,pWin:.6,y:i%2})),ev=Array.from({length:100},(_,i)=>({id:'v'+i,pWin:.6,y:i%2}));assert.equal(independentCalibration(tr,ev).status,'INDEPENDENT_HOLDOUT_EVALUATED');assert.equal(closeShadowLoop({prediction:pred,bars:[],training:tr,evaluation:ev}).decision.action,'NO_TRADE');});
