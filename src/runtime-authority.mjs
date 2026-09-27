import {readLatestEvidence,readSettledAuthorityOutcomes,putEvidence} from './ledger.mjs';
import {watchAuthority} from './authority-watchdog.mjs';

export async function resolveRuntimeAuthority({subjectHash,grant=null,policy={},readLatest=readLatestEvidence,readOutcomes=readSettledAuthorityOutcomes,persist=putEvidence}={}){
  if(!subjectHash) throw Error('AUTHORITY_SUBJECT_REQUIRED');
  const activeGrant=grant??await readLatest('capability_grant',{match:{subjectHash}});
  if(!activeGrant) return Object.freeze({available:true,grant:null,revocation:null,reason:'NO_CAPABILITY_GRANT'});
  const existing=await readLatest('authority_revocation',{match:{grantId:activeGrant.grantId}});
  if(existing) return Object.freeze({available:true,grant:activeGrant,revocation:existing,reason:'GRANT_ALREADY_REVOKED'});
  const rows=await readOutcomes({subjectHash,limit:200});
  if(rows===null) return Object.freeze({available:false,grant:activeGrant,revocation:null,reason:'POSTGRES_AUTHORITY_STATE_UNAVAILABLE'});
  const watched=await watchAuthority({grant:activeGrant,rows,policy,persist});
  return Object.freeze({available:true,grant:activeGrant,revocation:watched.revocation,health:watched.health,transition:watched.transition,reason:watched.health.reason});
}
