import test from 'node:test';
import assert from 'node:assert/strict';
import {signalContract,calibrationSnapshot,kisaEdge} from '../src/prospective-intelligence.mjs';

const prediction=(id='p1',q=.7)=>({predictionId:id,ts:'2026-01-01T00:00:00Z',modelVersion:'m1',forecast:{pUp:q,pDown:1-q,pRange:0},decision:{action:'LONG',evBps:20},risk:{rr:2},plan:{entry:100,stopLoss:99,takeProfit:102,horizonHours:4},market:{symbol:'BTCUSDT',source:'test',feature_timestamp:'2026-01-01T00:00:00Z'},model:{sha256:'abc',calibration_version:'c1',calibration_sha256:'def'},futuresConsensus:{verified:true,sourceCount:3,markSpreadBps:2}});
test('signal contract is deterministic and prospective',()=>{const a=signalContract(prediction());const b=signalContract(prediction());assert.equal(a.contractHash,b.contractHash);assert.equal(a.action,'LONG');assert.equal(a.evidence.futuresVerified,true)});
test('calibration uses settled prospective observations',()=>{const ps=[prediction('a',.8),prediction('b',.8)];const ss=[{predictionId:'a',firstTouch:'TP',netTerminalBps:50},{predictionId:'b',firstTouch:'SL',netTerminalBps:-30}];const c=calibrationSnapshot(ps,ss);assert.equal(c.n,2);assert.equal(c.winRate,.5);assert.equal(c.brier,.34)});
test('KISA EDGE refuses to fabricate confidence before evidence',()=>assert.equal(kisaEdge(prediction(),{n:3,brier:.1,expectancyBps:20}).label,'UNPROVEN'));
test('KISA EDGE activates only from prospective sample',()=>{const e=kisaEdge(prediction(),{n:100,brier:.08,expectancyBps:20});assert.equal(e.status,'PROSPECTIVE');assert.ok(e.score>=0&&e.score<=100)});
