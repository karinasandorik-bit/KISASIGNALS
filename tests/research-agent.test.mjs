import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeTrial,executeResearchBranches,settleResearchTrial} from '../src/research-agent.mjs';

const spec={trialId:'T1',frozenAt:'2026-09-27T00:00:00Z',target:{event:'CPI'},prior:{regime:'cutting'},frozenEvidence:['old'],residual:'M1 vs M2',requiredObservation:'primary source',acquisitionSpec:{authority:'federalreserve.gov'},scoring:{metric:'utility'}};

test('freeze is deterministic and tamper evident',()=>{
 const a=freezeTrial(spec),b=freezeTrial({...spec});
 assert.equal(a.freezeHash,b.freezeHash);
 assert.match(a.freezeHash,/^[a-f0-9]{64}$/);
});

test('A1 is closure-only while A2 receives acquisition spec',async()=>{
 const t=freezeTrial(spec);let seenA1,seenA2;
 const armed=await executeResearchBranches({trial:t,a0:async c=>({action:'WAIT',c}),a1:async c=>(seenA1=c,{action:'WAIT'}),a2:async c=>(seenA2=c,{action:'LONG'})});
 assert.equal(seenA1.liveAcquisition,false);
 assert.equal(seenA1.acquisitionSpec,undefined);
 assert.equal(seenA2.liveAcquisition,true);
 assert.equal(seenA2.acquisitionSpec.authority,'federalreserve.gov');
 assert.equal(armed.freezeHash,t.freezeHash);
});

test('event settlement uses A2 minus A1 and no per-event CI',async()=>{
 const t=freezeTrial(spec);
 const armed=await executeResearchBranches({trial:t,a0:async()=>({action:'WAIT'}),a1:async()=>({action:'WAIT',prediction:0}),a2:async()=>({action:'LONG',prediction:1})});
 const s=settleResearchTrial({armed,outcome:{y:1},score:(b,o)=>-Math.abs((b.prediction??0)-o.y),thetaPractical:.2});
 assert.equal(s.delta21,1);
 assert.equal(s.status,'PROSPECTIVE_HIT');
 assert.equal('ciLower' in s,false);
});
