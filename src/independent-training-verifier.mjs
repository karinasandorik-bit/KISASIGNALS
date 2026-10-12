import {createHash} from 'node:crypto';
const sha = x=>createHash('sha256').update(x).digest('hex');
export function canonical(value) {
 if(value===null||typeof value!=='object') {
  if(typeof value==='number'&&!Number.isFinite(value)) throw new Error('NONFINITE_EVIDENCE');
  if(typeof value==='undefined') throw new Error('UNDEFINED_EVIDENCE');
  return JSON.stringify(value);
 }
 if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export function verifyEvidence(payload,expectedHash) {
 try {
  const digest=sha(canonical(payload));
  return {verified:typeof expectedHash==='string'&&/^[0-9a-f]{64}$/i.test(expectedHash.replace(/^sha256:/,''))&&digest===expectedHash.replace(/^sha256:/,'').toLowerCase(),digest};
 } catch(e){return {verified:false,reason:e.message};}
}
// Return percentages, signed by side. Explicit bps costs frozen before decision.
export function independentlyRecalculatePnL({side,entryPrice,exitPrice,feeBps,slippageBps,fundingBps,reportedNetPct}) {
 const nums=[entryPrice,exitPrice,feeBps,slippageBps,fundingBps,reportedNetPct];
 if(!nums.every(x=>typeof x==='number'&&Number.isFinite(x)))return {verified:false,reason:'INVALID_NUMERIC_INPUT'};
 if(entryPrice<=0||exitPrice<=0||feeBps<0||slippageBps<0||!['LONG','SHORT'].includes(side))return {verified:false,reason:'INVALID_EXECUTION_CONTRACT'};
 const directional=(exitPrice/entryPrice-1)*100*(side==='LONG'?1:-1);
 const computed=directional-(feeBps+slippageBps+fundingBps)/100;
 const tolerance=1e-8;
 return {verified:Math.abs(computed-reportedNetPct)<=tolerance,computedNetPct:computed,reportedNetPct,deltaPct:computed-reportedNetPct};
}
// Approval requires external attestations bound to immutable hashes; not self-asserted labels.
export function approveDataset({rows=[],heldoutIds=[],featureManifestHash,independentVerifierReceipt,expectedRowsHash}={}) {
 const reasons=[];
 if(!Array.isArray(rows)||rows.length===0)reasons.push('EMPTY_TRAINING_DATA');
 if(!Array.isArray(heldoutIds)||heldoutIds.length===0)reasons.push('NO_HIDDEN_HOLDOUT');
 if(!/^[0-9a-f]{64}$/i.test(featureManifestHash??''))reasons.push('FEATURE_MANIFEST_UNFROZEN');
 if(!/^[0-9a-f]{64}$/i.test(expectedRowsHash??''))reasons.push('ROW_MANIFEST_UNFROZEN');
 let rowsHash=null;
 try{rowsHash=sha(canonical(rows));if(rowsHash!==expectedRowsHash)reasons.push('ROW_MANIFEST_MISMATCH');}catch{reasons.push('INVALID_ROWS');}
 if(rows.some(r=>!r?.evidenceVerified||!r?.pnlVerified||!r?.labelEligible))reasons.push('ROW_NOT_VERIFIED');
 if(rows.some(r=>heldoutIds.includes(r.decision_id)))reasons.push('HOLDOUT_CONTAMINATION');
 // Receipt must originate from an independently configured verifier, not merely a Boolean.
 if(!independentVerifierReceipt?.verified||independentVerifierReceipt.rowsHash!==rowsHash||independentVerifierReceipt.featureManifestHash!==featureManifestHash||independentVerifierReceipt.hiddenHoldoutDigest!==sha(canonical(heldoutIds)))reasons.push('INDEPENDENT_RECEIPT_MISSING_OR_MISMATCHED');
 return {approved:reasons.length===0,reasons,rowsHash};
}
export function datasetDigest(rows){return sha(canonical(rows));}
