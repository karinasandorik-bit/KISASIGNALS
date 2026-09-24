import crypto from 'node:crypto';import {putEvidence} from './ledger.mjs';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function issueBoundedAuthority(evaluation,{artifactHash,channel,symbols=['BTCUSDT'],horizonHours=4,regimes=[],maxRiskFraction=.001,ttlHours=168}={}){
 if(!evaluation?.promote)throw Error('PROMOTION_NOT_PROVEN');if(!artifactHash||!channel)throw Error('AUTHORITY_SCOPE_REQUIRED');
 const grantedAt=new Date().toISOString(),expiresAt=new Date(Date.parse(grantedAt)+ttlHours*3600000).toISOString(),scope={artifactHash,channel,symbols,horizonHours,regimes,maxRiskFraction};
 return{licenseId:hash({scope,grantedAt}).slice(0,24),status:'ACTIVE_SHADOW_LICENSE',scope,grantedAt,expiresAt,baseline:{meanIncrementalNetBps:evaluation.meanIncrementalNetBps,ciLowBps:evaluation.bootstrap95?.low,tailDelta95Bps:evaluation.tailDelta95Bps},realMoneyAuthority:false};
}
export function authorityHealth(license,recent,{minN=20,maxMeanDropBps=15,maxTailDeteriorationBps=10}={}){
 if(!license||license.status!=='ACTIVE_SHADOW_LICENSE')return{valid:false,reason:'NO_ACTIVE_LICENSE'};
 if(Date.now()>Date.parse(license.expiresAt))return{valid:false,reason:'LICENSE_EXPIRED'};
 const r=recent.filter(x=>x.status==='SETTLED'&&x.channel===license.scope.channel&&Number.isFinite(x.incrementalNetBps));
 if(r.length<minN)return{valid:true,reason:'INSUFFICIENT_NEW_EVIDENCE_FOR_REVOKE',n:r.length};
 const m=r.reduce((s,x)=>s+x.incrementalNetBps,0)/r.length,base=license.baseline.meanIncrementalNetBps??0;
 const bd=r.map(x=>x.baselineResult?.maeBps).filter(Number.isFinite),cd=r.map(x=>x.challengerResult?.maeBps).filter(Number.isFinite),tail=bd.length&&cd.length?Math.max(...cd)-Math.max(...bd):0;
 if(base-m>maxMeanDropBps)return{valid:false,reason:'EDGE_DEGRADATION',n:r.length,meanIncrementalNetBps:m};
 if(tail>maxTailDeteriorationBps)return{valid:false,reason:'TAIL_RISK_DEGRADATION',n:r.length,tailDeteriorationBps:tail};
 return{valid:true,reason:'WITHIN_FROZEN_BOUNDS',n:r.length,meanIncrementalNetBps:m,tailDeteriorationBps:tail};
}
export async function persistAuthority(license){await putEvidence('authority_license',license.licenseId,license);return license}
export async function revokeAuthority(license,health){if(health.valid)return null;const row={licenseId:license.licenseId,status:'REVOKED',reason:health.reason,revokedAt:new Date().toISOString(),health,realMoneyAuthority:false};await putEvidence('authority_revocation',license.licenseId,row);return row}
