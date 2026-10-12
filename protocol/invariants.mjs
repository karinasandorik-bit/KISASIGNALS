export const KISA_VERSION='0.1';

export function checkProspectiveOrdering({decision,outcome}={}){
  const d=Date.parse(decision?.frozenAt),o=Date.parse(outcome?.observedAt);
  return Number.isFinite(d)&&Number.isFinite(o)&&o>d
    ? {ok:true}
    : {ok:false,reason:'OUTCOME_NOT_STRICTLY_AFTER_DECISION_FREEZE'};
}

export function checkDecisionFrozenInputs(decision={}){
  const ids=decision.inputEntityIds;
  if(!Array.isArray(ids)||ids.length===0) return {ok:false,reason:'DECISION_INPUTS_REQUIRED'};
  if(new Set(ids).size!==ids.length) return {ok:false,reason:'DECISION_INPUTS_NOT_UNIQUE'};
  if(!/^[a-f0-9]{64}$/.test(decision.inputRootDigest||'')) return {ok:false,reason:'INPUT_ROOT_DIGEST_REQUIRED'};
  return {ok:true};
}

export function checkGrantBinding({grant,decision}={}){
  if(!grant||!decision) return {ok:false,reason:'GRANT_AND_DECISION_REQUIRED'};
  if(grant.decisionId!==decision.id) return {ok:false,reason:'GRANT_DECISION_MISMATCH'};
  if(!grant.scope||!grant.action||!grant.expiresAt) return {ok:false,reason:'GRANT_SCOPE_INCOMPLETE'};
  if(Date.parse(grant.expiresAt)<=Date.parse(grant.issuedAt)) return {ok:false,reason:'GRANT_EXPIRY_INVALID'};
  return {ok:true};
}

export function causalDescendants(relations,root){
  const edges=relations.filter(r=>['GENERATED','DERIVED_FROM','SUPPORTED_BY','AUTHORIZED_BY','EVALUATED_BY'].includes(r.type));
  const seen=new Set([root]); let changed=true;
  while(changed){changed=false;for(const e of edges)if(seen.has(e.from)&&!seen.has(e.to)){seen.add(e.to);changed=true}}
  return [...seen];
}

export function taintPlan({relations,invalidRoot}={}){
  if(!invalidRoot) throw Error('INVALID_ROOT_REQUIRED');
  return {invalidRoot,descendants:causalDescendants(relations||[],invalidRoot),requiredStatus:'TAINTED'};
}
