import OpenAI from 'openai';
import crypto from 'node:crypto';
import {readSelfEvolutionCorpus,putEvidence} from './ledger.mjs';
import {freezeOpenCandidate,SELF_EVOLVE_001} from './self-evolve-001.mjs';

const sha256=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const instructions=`You are the candidate generator for frozen trial SELF-EVOLVE-001.
You receive raw historical evidence from KISASIGNALS. Infer a decision-relevant residual and propose one executable self-modification.
Do not assume the modification is a feature, model, measurement, trading rule, module, or code patch. Its form must follow from the evidence.
Do not optimize for sounding novel. If the corpus does not justify a candidate, return status=NO_CANDIDATE.
Do not use future/outcome information unavailable at the candidate cutoff.
Return JSON only:
{status,residual,candidate,predicted_decision_effect,required_artifact,reasoning_evidence_ids}
candidate must describe the modification itself but must not contain predeclaredType, requiredCandidateType, or targetModule.
required_artifact must be sufficiently concrete for a separate builder to materialize, but must not claim it has already been built.`;

export async function generateFirstCandidate({corpus=null,baselineArtifactHash,client=null,model=process.env.KISA_SELF_EVOLVE_MODEL||process.env.KISA_AGENT_MODEL||'gpt-5.6',persist=putEvidence}={}){
 const evidence=corpus??await readSelfEvolutionCorpus({limit:Number(process.env.KISA_SELF_EVOLVE_CORPUS_LIMIT||1000)});
 if(!evidence)throw Error('POSTGRES_SELF_EVOLVE_CORPUS_REQUIRED');
 if(!evidence.length)return Object.freeze({status:'NO_CANDIDATE',reason:'EMPTY_EVIDENCE_CORPUS'});
 if(!baselineArtifactHash)throw Error('BASELINE_ARTIFACT_REQUIRED');
 const cutoff=evidence.at(-1).observedAt,corpusHash=sha256(evidence),api=client??new OpenAI({apiKey:process.env.OPENAI_API_KEY});
 const response=await api.responses.create({model,instructions,input:JSON.stringify({trial:SELF_EVOLVE_001,evidenceCutoff:cutoff,corpusHash,evidence}),text:{format:{type:'json_object'}}});
 const generated=JSON.parse(response.output_text);
 if(generated.status!=='CANDIDATE')return Object.freeze({...generated,corpusHash,evidenceCutoff:cutoff});
 const frozen=freezeOpenCandidate({residual:{...generated.residual,evidenceCutoff:cutoff,corpusHash,evidenceIds:generated.reasoning_evidence_ids??[]},candidate:{...generated.candidate,predictedDecisionEffect:generated.predicted_decision_effect,requiredArtifact:generated.required_artifact},baselineArtifactHash,createdBy:model});
 await persist('self_evolve_generation',frozen.candidateHash,{schema:'KISA_SELF_EVOLVE_GENERATION_V1',trialId:'SELF-EVOLVE-001',candidateHash:frozen.candidateHash,corpusHash,evidenceCutoff:cutoff,model,generatedAt:new Date().toISOString()});
 return Object.freeze({status:'CANDIDATE',frozen,corpusHash,evidenceCutoff:cutoff});
}
