import {readLatestEvidence,readSettledAuthorityOutcomes,putEvidence} from './ledger.mjs';
import {watchAuthority} from './authority-watchdog.mjs';
import {physicallyRollback,createArtifactResolver} from './physical-rollback.mjs';

export async function resolveRuntimeAuthority({subjectHash,grant=null,policy={},readLatest=readLatestEvidence,readOutcomes=readSettledAuthorityOutcomes,persist=putEvidence,rollback=physicallyRollback,resolveArtifact=createArtifactResolver(),activePath=process.env.KISA_ACTIVE_MODEL_PATH}={}){
  if(!subjectHash) throw Error('AUTHORITY_SUBJECT_REQUIRED');
  const activeGrant=grant??await readLatest('capability_grant',{match:{subjectHash}});
  if(!activeGrant) return Object.freeze({available:true,grant:null,revocation:null,reason:'NO_CAPABILITY_GRANT'});
  const existing=await readLatest('authority_revocation',{match:{grantId:activeGrant.grantId}});
  if(existing) return Object.freeze({available:true,grant:activeGrant,revocation:existing,reason:'GRANT_ALREADY_REVOKED'});
  const rows=await readOutcomes({subjectHash,limit:200});
  if(rows===null) return Object.freeze({available:false,grant:activeGrant,revocation:null,reason:'POSTGRES_AUTHORITY_STATE_UNAVAILABLE'});
  const watched=await watchAuthority({grant:activeGrant,rows,policy,persist});
  let rollbackAttestation=null;
  if(watched.transition==='ROLLBACK'){
    if(!activePath) return Object.freeze({available:false,grant:activeGrant,revocation:watched.revocation,health:watched.health,transition:'ROLLBACK_PENDING',reason:'ROLLBACK_ACTIVE_PATH_UNCONFIGURED'});
    try{rollbackAttestation=await rollback({transition:watched.event,resolveArtifact,activePath,persist});}
    catch(error){await persist('rollback_failure',watched.revocation.revocationId,{schema:'KISA_ROLLBACK_FAILURE_V1',grantId:activeGrant.grantId,rollbackTo:watched.event.rollbackTo,error:error.message,at:new Date().toISOString()});return Object.freeze({available:false,grant:activeGrant,revocation:watched.revocation,health:watched.health,transition:'ROLLBACK_FAILED',reason:error.message});}
  }
  return Object.freeze({available:true,grant:activeGrant,revocation:watched.revocation,health:watched.health,transition:watched.transition,rollbackAttestation,reason:watched.health.reason});
}
