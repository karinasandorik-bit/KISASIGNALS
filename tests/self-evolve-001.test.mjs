import test from 'node:test';
import assert from 'node:assert/strict';
import {SELF_EVOLVE_001,freezeOpenCandidate,armSelfEvolve,settleSelfEvolve} from '../src/self-evolve-001.mjs';

test('SELF-EVOLVE-001 does not predeclare improvement form',()=>{
 assert.equal(SELF_EVOLVE_001.candidateForm,null);
 assert.equal(SELF_EVOLVE_001.targetModule,null);
 assert.equal(SELF_EVOLVE_001.measurementType,null);
 assert.equal(SELF_EVOLVE_001.modelClass,null);
 assert.equal(SELF_EVOLVE_001.allowedAuthority,'SHADOW_ONLY');
});

test('candidate is frozen before outcome with no authority',async()=>{
 const f=freezeOpenCandidate({residual:{description:'observed disagreement',evidence:['e1']},candidate:{description:'machine-originated modification',artifact:{patch:'opaque'}},baselineArtifactHash:'base'});
 const events=[];
 const arm=await armSelfEvolve({frozenCandidate:f,baselineDecision:{action:'WAIT'},challengerDecision:{action:'LONG'},persist:async(type,id,payload)=>events.push(type)});
 assert.equal(f.authority,'NONE');
 assert.equal(arm.authority,'SHADOW_ONLY');
 assert.equal(arm.outcomeObserved,false);
 assert.deepEqual(events,['self_evolve_candidate','self_evolve_arm']);
});

test('positive score alone cannot promote without causal held-out evidence',()=>{
 const arm={trialId:'SELF-EVOLVE-001',armHash:'a',candidateHash:'c',outcomeObserved:false};
 const s=settleSelfEvolve({arm,outcome:{external:true},baselineScore:0,challengerScore:10,ablation:{causal:false},heldOut:true});
 assert.equal(s.status,'NO_PROMOTION');
});

test('prospective hit requires gain plus causal ablation plus held-out outcome',()=>{
 const arm={trialId:'SELF-EVOLVE-001',armHash:'a',candidateHash:'c',outcomeObserved:false};
 const s=settleSelfEvolve({arm,outcome:{external:true},baselineScore:0,challengerScore:10,ablation:{causal:true},heldOut:true});
 assert.equal(s.status,'PROSPECTIVE_HIT');
});
