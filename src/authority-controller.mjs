import {putEvidence} from './ledger.mjs';
import {createCapabilityGrantFromPromotion} from './capability-grant.mjs';

// Compatibility facade. CapabilityGrant is the single authority primitive.
// Legacy callers may keep issueBoundedAuthority/authorityHealth while migration completes.
export function issueBoundedAuthority(evaluation,{artifactHash,decisionId=null,channel,symbols=['BTCUSDT'],horizonHours=4,regimes=[],maxRiskFraction=.001,ttlHours=168}={}){
 if(!evaluation?.promote)throw Error('PROMOTION_NOT_PROVEN');if(!artifactHash||!channel)throw Error('AUTHORITY_SCOPE_REQUIRED');
 const maxRiskUsd=Math.max(Number(evaluation.maxRiskUsd??1),0.000001);
 const normalizedEvaluation=evaluation.evidenceRoot?evaluation:{...evaluation,evidenceRoot:'legacy-promotion:'+artifactHash};
 const grant=createCapabilityGrantFromPromotion(normalizedEvaluation,{subjectHash:artifactHash,decisionId,action:'OPEN_POSITION',modes:['PAPER'],symbols,maxRiskUsd,maxNotionalUsd:Number(evaluation.maxNotionalUsd??25),maxLeverage:Number(evaluation.maxLeverage??1),ttlHours});
 return Object.freeze({...grant,licenseId:grant.grantId,status:'ACTIVE',scope:Object.freeze({artifactHash,channel,symbols:[...symbols],horizonHours,regimes:[...regimes],maxRiskFraction}),grantedAt:grant.issuedAt,baseline:grant.proofBaseline,legacyScope:Object.freeze({channel,horizonHours,regimes:[...regimes],maxRiskFraction}),realMoneyAuthority:false});
}
export function authorityHealth(grant,recent,{minN=20,maxMeanDropBps=15,maxTailDeteriorationBps=10}={}){
 if(!grant||grant.status!=='ACTIVE')return{valid:false,reason:'NO_ACTIVE_GRANT'};
 if(Date.now()>Date.parse(grant.expiresAt))return{valid:false,reason:'GRANT_EXPIRED'};
 const channel=grant.legacyScope?.channel;
 const r=recent.filter(x=>x.status==='SETTLED'&&(!channel||x.channel===channel)&&Number.isFinite(x.incrementalNetBps));
 if(r.length<minN)return{valid:true,reason:'INSUFFICIENT_NEW_EVIDENCE_FOR_REVOKE',n:r.length};
 const m=r.reduce((s,x)=>s+x.incrementalNetBps,0)/r.length,base=grant.proofBaseline?.meanIncrementalNetBps??0;
 const bd=r.map(x=>x.baselineResult?.maeBps).filter(Number.isFinite),cd=r.map(x=>x.challengerResult?.maeBps).filter(Number.isFinite),tail=bd.length&&cd.length?Math.max(...cd)-Math.max(...bd):0;
 if(base-m>maxMeanDropBps)return{valid:false,reason:'EDGE_DEGRADATION',n:r.length,meanIncrementalNetBps:m};
 if(tail>maxTailDeteriorationBps)return{valid:false,reason:'TAIL_RISK_DEGRADATION',n:r.length,tailDeteriorationBps:tail};
 return{valid:true,reason:'WITHIN_FROZEN_BOUNDS',n:r.length,meanIncrementalNetBps:m,tailDeteriorationBps:tail};
}
export async function persistAuthority(grant){await putEvidence('capability_grant',grant.grantId,grant);return grant}
export async function revokeAuthority(grant,health){if(health.valid)return null;const row={grantId:grant.grantId,status:'REVOKED',reason:health.reason,revokedAt:new Date().toISOString(),health,realMoneyAuthority:false};await putEvidence('capability_revocation',grant.grantId,row);return row}
