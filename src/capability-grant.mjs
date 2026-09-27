import crypto from 'node:crypto';

const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const canonical=x=>JSON.stringify(stable(x));
const sha256=x=>crypto.createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');

export const PRIVILEGED_MODES=Object.freeze(['PAPER','MICRO_LIVE']);

export function createCapabilityGrant({
  subjectHash,action='OPEN_POSITION',modes=['PAPER'],symbols=['BTCUSDT'],
  maxRiskUsd=1,maxNotionalUsd=25,maxLeverage=1,evidenceRoot,issuedAt=new Date().toISOString(),
  expiresAt,rollbackTo=null
}={}){
  if(!subjectHash||!evidenceRoot||!expiresAt) throw Error('CAPABILITY_GRANT_FIELDS_REQUIRED');
  const body={schema:'KISA_CAPABILITY_GRANT_V1',subjectHash,action,modes:[...modes],symbols:[...symbols],
    limits:{maxRiskUsd,maxNotionalUsd,maxLeverage},evidenceRoot,issuedAt,expiresAt,rollbackTo,status:'ACTIVE'};
  return Object.freeze({...body,grantId:sha256(body).slice(0,32)});
}

export function verifyCapabilityGrant(grant,{subjectHash,action='OPEN_POSITION',mode,intent,now=Date.now()}={}){
  const deny=[];
  if(!grant) deny.push('GRANT_MISSING');
  else {
    if(grant.status!=='ACTIVE') deny.push('GRANT_NOT_ACTIVE');
    if(grant.subjectHash!==subjectHash) deny.push('SUBJECT_MISMATCH');
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

export function createAuthorityController({grant=null,subjectHash=null}={}){
  return Object.freeze({
    authorize(intent,{mode}={}){
      if(!PRIVILEGED_MODES.includes(mode)) return Object.freeze({permitted:true,reason:'BASE_SHADOW_AUTHORITY'});
      return verifyCapabilityGrant(grant,{subjectHash,mode,intent});
    }
  });
}
