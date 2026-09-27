import crypto from 'node:crypto';
import {putEvidence} from './ledger.mjs';

const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const sha256=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');

export const SELF_EVOLVE_001=Object.freeze({
 schema:'KISA_SELF_EVOLVE_TRIAL_V1',
 trialId:'SELF-EVOLVE-001',
 objective:'discover and test a decision-relevant self-modification from observed residuals',
 candidateForm:null,
 targetModule:null,
 measurementType:null,
 modelClass:null,
 allowedAuthority:'SHADOW_ONLY',
 acceptance:Object.freeze({
   prospective:true,
   candidateMustPrecedeOutcome:true,
   externalOutcomeRequired:true,
   causalAblationRequired:true,
   heldOutRequired:true,
   privilegedAuthorityBeforeProof:false
 })
});

export function freezeOpenCandidate({residual,candidate,baselineArtifactHash,createdBy='self-evolver'}={}){
 if(!residual)throw Error('RESIDUAL_REQUIRED');
 if(!candidate)throw Error('CANDIDATE_REQUIRED');
 if(!baselineArtifactHash)throw Error('BASELINE_ARTIFACT_REQUIRED');
 const forbidden=['predeclaredType','requiredCandidateType','targetModule'];
 for(const k of forbidden)if(candidate[k]!=null)throw Error('CANDIDATE_FORM_WAS_PREDECLARED');
 const core={schema:'KISA_SELF_EVOLVE_CANDIDATE_V1',trialId:'SELF-EVOLVE-001',residual,candidate,baselineArtifactHash,createdBy,createdAt:new Date().toISOString(),authority:'NONE'};
 return Object.freeze({...core,candidateHash:sha256(core)});
}

export async function armSelfEvolve({frozenCandidate,baselineDecision,challengerDecision,persist=putEvidence}={}){
 if(!frozenCandidate?.candidateHash)throw Error('FROZEN_CANDIDATE_REQUIRED');
 const core={schema:'KISA_SELF_EVOLVE_ARM_V1',trialId:'SELF-EVOLVE-001',candidateHash:frozenCandidate.candidateHash,baselineArtifactHash:frozenCandidate.baselineArtifactHash,baselineDecision,challengerDecision,armedAt:new Date().toISOString(),authority:'SHADOW_ONLY',outcomeObserved:false};
 const arm=Object.freeze({...core,armHash:sha256(core)});
 await persist('self_evolve_candidate',frozenCandidate.candidateHash,frozenCandidate);
 await persist('self_evolve_arm',arm.armHash,arm);
 return arm;
}

export function settleSelfEvolve({arm,outcome,baselineScore,challengerScore,ablation,heldOut=true}={}){
 if(!arm?.armHash||arm.outcomeObserved)throw Error('VALID_ARM_REQUIRED');
 if(outcome==null)throw Error('EXTERNAL_OUTCOME_REQUIRED');
 if(!Number.isFinite(baselineScore)||!Number.isFinite(challengerScore))throw Error('SCORES_REQUIRED');
 const delta=challengerScore-baselineScore,causal=ablation?.causal===true;
 const core={schema:'KISA_SELF_EVOLVE_SETTLEMENT_V1',trialId:arm.trialId,armHash:arm.armHash,candidateHash:arm.candidateHash,outcome,baselineScore,challengerScore,delta,ablation,heldOut,settledAt:new Date().toISOString(),status:delta>0&&causal&&heldOut?'PROSPECTIVE_HIT':'NO_PROMOTION'};
 return Object.freeze({...core,settlementHash:sha256(core)});
}
