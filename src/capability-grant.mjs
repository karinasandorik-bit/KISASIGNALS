import crypto from 'node:crypto';

const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const canonical=x=>JSON.stringify(stable(x));
const sha256=x=>crypto.createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');

export const PRIVILEGED_MODES=Object.freeze(['PAPER','MICRO_LIVE']);

export function createCapabilityGrantFromPromotion(evaluation,{subjectHash,decisionId=null,action='OPEN_POSITION',modes=['PAPER'],symbols=['BTCUSDT'],maxRiskUsd=1,maxNotionalUsd=25,maxLeverage=1,ttlHours=168,rollbackTo=null,now=new Date()}={}){
  if(!evaluation?.promote) throw Error('PROMOTION_NOT_PROVEN');
  if(!evaluation?.evidenceRoot) throw Error('PROMOTION_EVIDENCE_ROOT_REQUIRED');
  if(!subjectHash) throw Error('PROMOTION_SUBJECT_REQUIRED');
  const issuedAt=now.toISOString(),expiresAt=new Date(now.getTime()+ttlHours*3600000).toISOString();
  const grant=createCapabilityGrant({subjectHash,decisionId,action,modes,symbols,maxRiskUsd,maxNotionalUsd,maxLeverage,evidenceRoot:evaluation.evidenceRoot,issuedAt,expiresAt,rollbackTo});
  return Object.freeze({...grant,proofBaseline:Object.freeze({meanIncrementalNetBps:evaluation.meanIncrementalNetBps,ciLowBps:evaluation.bootstrap95?.low,tailDelta95Bps:evaluation.tailDelta95Bps,n:evaluation.n,actionChanges:evaluation.actionChanges})});
}

export function createCapabilityGrant({
  subjectHash,decisionId=null,action='OPEN_POSITION',modes=['PAPER'],symbols=['BTCUSDT'],
  maxRiskUsd=1,maxNotionalUsd=25,maxLeverage=1,evidenceRoot,issuedAt=new Date().toISOString(),
  expiresAt,rollbackTo=null
}={}){
  if(!subjectHash||!evidenceRoot||!expiresAt) throw Error('CAPABILITY_GRANT_FIELDS_REQUIRED');
  const body={schema:'KISA_CAPABILITY_GRANT_V1',subjectHash,decisionId,action,modes:[...modes],symbols:[...symbols],
    limits:{maxRiskUsd,maxNotionalUsd,maxLeverage},evidenceRoot,issuedAt,expiresAt,rollbackTo,status:'ACTIVE'};
  return Object.freeze({...body,grantId:sha256(body).slice(0,32)});
}

export function verifyCapabilityGrant(grant,{subjectHash,decisionId=null,action='OPEN_POSITION',mode,intent,now=Date.now()}={}){
  const deny=[];
  if(!grant) deny.push('GRANT_MISSING');
  else {
    if(grant.status!=='ACTIVE') deny.push('GRANT_NOT_ACTIVE');
    if(grant.subjectHash!==subjectHash) deny.push('SUBJECT_MISMATCH');
    if(grant.decisionId&&grant.decisionId!==decisionId) deny.push('DECISION_MISMATCH');
    if(grant.action!==action) deny.push('ACTION_NOT_GRANTED');
    if(!grant.modes?.includes(mode)) deny.push('MODE_NOT_GRANTED');
    if(!grant.symbols?.includes(intent?.symbol)) deny.push('SYMBOL_NOT_GRANTED');
    if(!Number.isFinite(Date.parse(grant.expiresAt))||now>Date.parse(grant.expiresAt)) deny.push('GRANT_EXPIRED');
    if(!(intent?.risk_usd>0&&intent.risk_usd<=grant.limits.maxRiskUsd)) deny.push('GRANT_RISK_LIMIT');
    if(!(intent?.notional_usd>0&&intent.notional_usd<=grant.limits.maxNotionalUsd)) deny.push('GRANT_NOTIONAL_LIMIT');
    if(!(intent?.leverage>0&&intent.leverage<=grant.limits.maxLeverage)) deny.push('GRANT_LEVERAGE_LIMIT');
  }
  return Object.freeze(deny.length?{permitted:false,reasons:deny}:{permitted:true,grantId:grant.grantId,evidenceRoot:grant.evidenceRoot});
}

export function createAuthorityController({grant=null,subjectHash=null,revocation=null}={}){
  return Object.freeze({
    authorize(intent,{mode}={}){
      if(revocation && revocation.grantId===grant?.grantId) return Object.freeze({permitted:false,reasons:['GRANT_REVOKED'],revocationId:revocation.revocationId,reason:revocation.reason});
      if(!PRIVILEGED_MODES.includes(mode)) return Object.freeze({permitted:true,reason:'BASE_SHADOW_AUTHORITY'});
      return verifyCapabilityGrant(grant,{subjectHash:subjectHash??intent?.model_sha256,decisionId:intent?.decisionId??intent?.predictionId??null,mode,intent});
    }
  });
}
