// Deterministic, separately executed contract verifier. Never treats model assertions as proof.
import crypto from 'node:crypto';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function verifyTradeContract(c, evidence, {now=Date.now()}={}) {
 const errors=[];
 if(!c||!['LONG','SHORT'].includes(c.side))errors.push('DIRECTION');
 if(!c?.decisionId||!c?.symbol)errors.push('IDENTITY');
 if(!['SHADOW_ONLY'].includes(c?.mode))errors.push('MODE');
 const {entry,stopLoss,takeProfit,takeProfit2}=c||{};
 if(![entry,stopLoss,takeProfit,takeProfit2].every(positive))errors.push('LEVELS');
 else if(c.side==='LONG'?!(stopLoss<entry&&entry<takeProfit&&takeProfit<takeProfit2):!(takeProfit2<takeProfit&&takeProfit<entry&&entry<stopLoss))errors.push('LEVEL_ORDER');
 if(!positive(c?.riskFraction)||c.riskFraction>0.005)errors.push('RISK_CAP');
 const observed=Date.parse(evidence?.observedAt||''),expiry=Date.parse(c?.expiresAt||'');
 if(!Number.isFinite(observed)||observed>now+5000||now-observed>120000)errors.push('STALE_EVIDENCE');
 if(!Number.isFinite(expiry)||expiry<=now||expiry>now+86400000)errors.push('EXPIRY');
 const sources=evidence?.sources;
 if(!evidence?.futuresConsensus?.verified||evidence.futuresConsensus.sourceCount<2||!Array.isArray(sources)||new Set(sources).size<2)errors.push('INDEPENDENT_VENUES');
 if(!positive(evidence?.referencePrice)||Math.abs(entry/evidence.referencePrice-1)>0.005)errors.push('ENTRY_REFERENCE_DRIFT');
 const riskBps=positive(entry)&&positive(stopLoss)?Math.abs(entry-stopLoss)/entry*10000:NaN;
 const rewardBps=positive(entry)&&positive(takeProfit)?Math.abs(takeProfit-entry)/entry*10000:NaN;
 const netRR=Number.isFinite(riskBps)&&riskBps>0?(rewardBps-(evidence?.costBps??NaN))/(riskBps+(evidence?.costBps??NaN)):NaN;
 if(!Number.isFinite(netRR)||netRR<2)errors.push('NET_RR');
 if(!positive(evidence?.expectedMfe90Bps)||positive(entry)&&positive(takeProfit2)&&((Math.abs(takeProfit2-entry)/entry*10000)>evidence.expectedMfe90Bps))errors.push('TP2_EXCURSION');
 if(!positive(evidence?.expectedEvBps)||evidence.expectedEvBps<=0)errors.push('MODEL_EV');
 const evidenceHash=hash(evidence),contractHash=hash(c);
 return {eligible:errors.length===0,errors,netRR:Number.isFinite(netRR)?+netRR.toFixed(4):null,evidenceHash,contractHash,verifier:'trade-contract-verifier.v1'};
}
export function buildVerifiedEmailContract(row,{now=Date.now()}={}) {
 const side=row?.decision?.action,entry=row?.plan?.entry,sl=row?.plan?.stopLoss,tp1=row?.plan?.takeProfit;
 const ex=row?.forecast?.[side],costBps=row?.decision?.costBps;
 const tp2Bps=ex?.mfe90;
 const tp2=positive(entry)&&positive(tp2Bps)&&['LONG','SHORT'].includes(side)?+(entry*(1+(side==='LONG'?1:-1)*tp2Bps/10000)).toFixed(8):null;
 const observedAt=row?.market?.feature_timestamp||row?.market?.observed_at||null;
 const expiresAt=Number.isFinite(Date.parse(observedAt))?new Date(Date.parse(observedAt)+Math.min(2,Number(row.entryPolicy?.expiryHours)||2)*3600000).toISOString():null;
 const rawSources=row?.futuresConsensus?.sources;
 const sources=Array.isArray(rawSources)?rawSources.map(x=>typeof x==='string'?x:x?.source).filter(Boolean):[];
 const c={decisionId:row?.predictionId,symbol:row?.market?.symbol,side,mode:'SHADOW_ONLY',status:row?.status,entry,stopLoss:sl,takeProfit:tp1,takeProfit2:tp2,expiresAt,riskFraction:0.005};
 const evidence={observedAt,sources,futuresConsensus:{verified:row?.futuresConsensus?.verified===true,sourceCount:row?.futuresConsensus?.sourceCount||0},referencePrice:row?.market?.reference_close,costBps,expectedMfe90Bps:tp2Bps,expectedEvBps:row?.decision?.evBps};
 const attestation=verifyTradeContract(c,evidence,{now});
 return {...c,observedAt,netRR:attestation.netRR,sources,futuresConsensus:evidence.futuresConsensus,independentValidation:attestation.eligible,validation:{...attestation,kind:'DETERMINISTIC_INDEPENDENT_CODE_PATH',notProofOfProfitability:true}};
}
