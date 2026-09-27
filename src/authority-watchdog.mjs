import crypto from 'node:crypto';
import {putEvidence} from './ledger.mjs';

const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const sha256=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),i=(s.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return s[l]+(s[h]-s[l])*(i-l)};

export function evaluateGrantHealth(grant,rows,{
  minN=20,maxMeanDropBps=15,maxTailDeteriorationBps=10,maxConsecutiveLosses=8,now=Date.now()
}={}){
  if(!grant||grant.status!=='ACTIVE') return Object.freeze({healthy:false,severity:'ROLLBACK',reason:'GRANT_NOT_ACTIVE',n:0});
  if(now>Date.parse(grant.expiresAt)) return Object.freeze({healthy:false,severity:'DEMOTE',reason:'GRANT_EXPIRED',n:0});
  const r=(rows??[]).filter(x=>x.status==='SETTLED'&&Number.isFinite(x.incrementalNetBps));
  if(r.length<minN) return Object.freeze({healthy:true,severity:'NONE',reason:'INSUFFICIENT_LIVE_EVIDENCE',n:r.length});

  const liveMean=mean(r.map(x=>x.incrementalNetBps));
  const proofMean=Number(grant.proofBaseline?.meanIncrementalNetBps);
  const baseTail=r.map(x=>x.baselineResult?.maeBps).filter(Number.isFinite);
  const chTail=r.map(x=>x.challengerResult?.maeBps).filter(Number.isFinite);
  const tailDelta=baseTail.length&&chTail.length?q(chTail,.95)-q(baseTail,.95):null;
  let consecutiveLosses=0;
  for(const x of [...r].sort((a,b)=>Date.parse(b.settledAt??0)-Date.parse(a.settledAt??0))){
    if(x.incrementalNetBps<0) consecutiveLosses++; else break;
  }
  if(consecutiveLosses>=maxConsecutiveLosses) return Object.freeze({healthy:false,severity:'ROLLBACK',reason:'CONSECUTIVE_FAILURES',n:r.length,consecutiveLosses,liveMeanBps:liveMean,tailDelta95Bps:tailDelta});
  if(Number.isFinite(tailDelta)&&tailDelta>maxTailDeteriorationBps) return Object.freeze({healthy:false,severity:'ROLLBACK',reason:'TAIL_RISK_DEGRADATION',n:r.length,liveMeanBps:liveMean,tailDelta95Bps:tailDelta});
  if(Number.isFinite(proofMean)&&proofMean-liveMean>maxMeanDropBps) return Object.freeze({healthy:false,severity:'DEMOTE',reason:'EDGE_DEGRADATION',n:r.length,liveMeanBps:liveMean,proofMeanBps:proofMean,tailDelta95Bps:tailDelta});
  return Object.freeze({healthy:true,severity:'NONE',reason:'WITHIN_PROVEN_BOUNDS',n:r.length,liveMeanBps:liveMean,tailDelta95Bps:tailDelta});
}

export function revokeGrant(grant,health,{at=new Date().toISOString()}={}){
  if(health?.healthy!==false) throw Error('REVOCATION_REQUIRES_FAILED_HEALTH');
  const body={schema:'KISA_AUTHORITY_REVOCATION_V1',grantId:grant.grantId,subjectHash:grant.subjectHash,evidenceRoot:grant.evidenceRoot,status:'REVOKED',reason:health.reason,severity:health.severity,revokedAt:at,rollbackTo:grant.rollbackTo??null,health};
  return Object.freeze({...body,revocationId:sha256(body).slice(0,32)});
}

export async function watchAuthority({grant,rows,policy={},persist=putEvidence}={}){
  const health=evaluateGrantHealth(grant,rows,policy);
  await persist('authority_health',sha256({grantId:grant?.grantId,health}),{grantId:grant?.grantId,health,observedAt:new Date().toISOString()});
  if(health.healthy) return Object.freeze({health,revocation:null,transition:'HOLD'});
  const revocation=revokeGrant(grant,health);
  await persist('authority_revocation',revocation.revocationId,revocation);
  const transition=health.severity==='ROLLBACK'?'ROLLBACK':'DEMOTE';
  const event={schema:'KISA_AUTHORITY_TRANSITION_V1',grantId:grant.grantId,transition,rollbackTo:revocation.rollbackTo,reason:health.reason,revocationId:revocation.revocationId,at:revocation.revokedAt};
  await persist('authority_transition',revocation.revocationId,event);
  return Object.freeze({health,revocation,event,transition});
}
