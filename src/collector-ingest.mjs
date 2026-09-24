import crypto from 'node:crypto';
import {putEvidence} from './ledger.mjs';

const MAX_AGE_MS=Number(process.env.COLLECTOR_MAX_AGE_MS||120000);
const REQUIRED=['symbol','source','sourceObservedAt','capturedAt','markPrice','indexPrice','fundingRate','openInterest','bestBid','bestAsk','flowImbalance'];

function canonical(x){return JSON.stringify(Object.keys(x).sort().reduce((o,k)=>(o[k]=x[k],o),{}))}
function verifySignature(body,sig){const key=process.env.COLLECTOR_SHARED_SECRET;if(!key)return false;const expected=crypto.createHmac('sha256',key).update(body).digest('hex');try{return crypto.timingSafeEqual(Buffer.from(sig||'','hex'),Buffer.from(expected,'hex'))}catch{return false}}
function validate(x){const missing=REQUIRED.filter(k=>x[k]===undefined||x[k]===null);const ageMs=Date.now()-Date.parse(x.sourceObservedAt);const numeric=['markPrice','indexPrice','fundingRate','openInterest','bestBid','bestAsk','flowImbalance'];const finite=numeric.filter(k=>Number.isFinite(Number(x[k])));const completeness=(REQUIRED.length-missing.length)/REQUIRED.length;const fresh=Number.isFinite(ageMs)&&ageMs>=-30000&&ageMs<=MAX_AGE_MS;return{missing,ageMs,completeness,fresh,finite:finite.length/numeric.length,status:missing.length===0&&fresh&&finite.length===numeric.length?'VERIFIED':'DEGRADED'}}

export async function ingestCollectorSnapshot(snapshot,{signature,rawBody}={}){
 const body=rawBody||canonical(snapshot);if(!verifySignature(body,signature))throw Error('COLLECTOR_SIGNATURE_INVALID');
 const q=validate(snapshot);if(q.status!=='VERIFIED')throw Error('COLLECTOR_EVIDENCE_DEGRADED:'+JSON.stringify(q));
 const row={...snapshot,ageMs:q.ageMs,completeness:q.completeness,quality:'VERIFIED',transport:'signed-external-collector'};
 const id=[row.symbol,row.source,row.sourceObservedAt].join(':');await putEvidence('futures_state',id,row);
 await putEvidence('collector_health',row.capturedAt,{observedAt:row.capturedAt,source:row.source,status:'VERIFIED',ageMs:q.ageMs,completeness:q.completeness});
 return row;
}
