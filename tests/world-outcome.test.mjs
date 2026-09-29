import test from 'node:test';
import assert from 'node:assert/strict';
import {worldOutcome4h} from '../src/settlement.mjs';

test('NO_TRADE receives falsifiable action-neutral 4h world outcome',()=>{
 const p={predictionId:'n1',ts:'2026-09-29T00:00:00Z',decision:{action:'NO_TRADE'},market:{feature_timestamp:'2026-09-29T00:00:00Z',reference_close:100,source:'test'}};
 const bars=[{h:102,l:99,c:101},{h:103,l:100,c:102},{h:102,l:98,c:99},{h:104,l:99,c:103}];
 const w=worldOutcome4h(p,bars,'2026-09-29T04:01:00Z');
 assert.equal(w.chosenAction,'NO_TRADE');
 assert.equal(w.long.mfeBps,400);
 assert.equal(w.long.maeBps,200);
 assert.equal(w.short.mfeBps,200);
 assert.equal(w.short.maeBps,400);
 assert.equal(w.terminalMarketReturnBps,300);
 assert.ok(!('netTerminalBps' in w));
});
