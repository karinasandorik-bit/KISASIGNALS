import {putEvidence} from './ledger.mjs';
import {evaluatePromotion} from './promotion-evaluator.mjs';
import {createCapabilityGrantFromPromotion} from './capability-grant.mjs';

export async function proveAndPromote({
  rows,subjectHash,evaluationPolicy={},grantPolicy={},persist=putEvidence
}={}){
  if(!Array.isArray(rows)) throw Error('SETTLED_EVIDENCE_REQUIRED');
  if(!subjectHash) throw Error('SUBJECT_HASH_REQUIRED');

  const evaluation=evaluatePromotion(rows,evaluationPolicy);
  await persist('promotion_proof',evaluation.evidenceRoot,evaluation);

  if(!evaluation.promote){
    const event={schema:'KISA_PROMOTION_EVENT_V1',status:'NOT_PROMOTED',subjectHash,evidenceRoot:evaluation.evidenceRoot,at:new Date().toISOString()};
    await persist('promotion_decision',evaluation.evidenceRoot,event);
    return Object.freeze({evaluation,grant:null,event});
  }

  const grant=createCapabilityGrantFromPromotion(evaluation,{subjectHash,...grantPolicy});
  await persist('capability_grant',grant.grantId,grant);
  const event={schema:'KISA_PROMOTION_EVENT_V1',status:'PROMOTED',subjectHash,evidenceRoot:evaluation.evidenceRoot,grantId:grant.grantId,at:new Date().toISOString()};
  await persist('promotion_decision',grant.grantId,event);
  return Object.freeze({evaluation,grant,event});
}
