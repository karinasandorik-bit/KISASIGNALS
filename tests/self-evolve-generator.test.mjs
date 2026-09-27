import test from 'node:test';
import assert from 'node:assert/strict';
import {generateFirstCandidate} from '../src/self-evolve-generator.mjs';

test('generator freezes machine-originated candidate against exact corpus cutoff',async()=>{
 const corpus=[{eventType:'agent_cycle',eventId:'e1',observedAt:'2026-09-27T10:00:00Z',payload:{type:'DECISION_FINAL',payload:{decision:{action:'ABSTAIN'}}}}];
 const client={responses:{create:async()=>({output_text:JSON.stringify({status:'CANDIDATE',residual:{description:'persistent unresolved evidence conflict'},candidate:{description:'derive a new executable distinction from the conflict'},predicted_decision_effect:'changes action only when distinction resolves conflict',required_artifact:{description:'machine-materializable artifact specification'},reasoning_evidence_ids:['e1']})})}};
 const events=[];
 const out=await generateFirstCandidate({corpus,baselineArtifactHash:'base-sha',client,model:'test-agent',persist:async(type,id,payload)=>events.push({type,id,payload})});
 assert.equal(out.status,'CANDIDATE');
 assert.equal(out.frozen.authority,'NONE');
 assert.equal(out.frozen.residual.evidenceCutoff,'2026-09-27T10:00:00Z');
 assert.deepEqual(out.frozen.residual.evidenceIds,['e1']);
 assert.deepEqual(events.map(x=>x.type),['self_evolve_attempt','self_evolve_generation']);
});

test('generator may conclude NO_CANDIDATE rather than fabricate novelty',async()=>{
 const corpus=[{eventType:'agent_cycle',eventId:'e1',observedAt:'2026-09-27T10:00:00Z',payload:{}}];
 const client={responses:{create:async()=>({output_text:JSON.stringify({status:'NO_CANDIDATE',reason:'insufficient discriminative evidence'})})}};
 const out=await generateFirstCandidate({corpus,baselineArtifactHash:'base-sha',client,model:'test-agent',persist:async()=>{}});
 assert.equal(out.status,'NO_CANDIDATE');
});
