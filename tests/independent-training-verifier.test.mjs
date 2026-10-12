import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,verifyEvidence,independentlyRecalculatePnL,approveDataset,datasetDigest} from '../src/independent-training-verifier.mjs';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
test('hash canonicalization ignores key insertion order',()=>assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2})));
test('detects tampering',()=>{const p={venue:'bitget',price:100};const h=hash(canonical(p));assert.equal(verifyEvidence(p,h).verified,true);assert.equal(verifyEvidence({...p,price:101},h).verified,false)});
test('rejects nonfinite evidence',()=>assert.equal(verifyEvidence({bad:NaN},'x').verified,false));
test('recalculates long net PnL',()=>assert.equal(independentlyRecalculatePnL({side:'LONG',entryPrice:100,exitPrice:101,feeBps:10,slippageBps:5,fundingBps:2,reportedNetPct:0.83}).verified,true));
test('recalculates short net PnL',()=>assert.equal(independentlyRecalculatePnL({side:'SHORT',entryPrice:100,exitPrice:99,feeBps:10,slippageBps:5,fundingBps:2,reportedNetPct:0.83}).verified,true));
test('detects forged net PnL',()=>assert.equal(independentlyRecalculatePnL({side:'LONG',entryPrice:100,exitPrice:101,feeBps:10,slippageBps:5,fundingBps:2,reportedNetPct:1.2}).verified,false));
test('rejects invalid costs',()=>assert.equal(independentlyRecalculatePnL({side:'LONG',entryPrice:100,exitPrice:101,feeBps:-5,slippageBps:5,fundingBps:2,reportedNetPct:1}).verified,false));
test('approval rejects empty or unverifiable dataset',()=>assert.equal(approveDataset({}).approved,false));
test('approval rejects holdout contamination even with syntactically matching receipt',()=>{
 const rows=[{decision_id:'x',evidenceVerified:true,pnlVerified:true,labelEligible:true}],heldoutIds=['x'],rowsHash=datasetDigest(rows),featureManifestHash='a'.repeat(64);
 const receipt={verified:true,rowsHash,featureManifestHash,hiddenHoldoutDigest:hash(canonical(heldoutIds))};
 assert.ok(approveDataset({rows,heldoutIds,featureManifestHash,expectedRowsHash:rowsHash,independentVerifierReceipt:receipt}).reasons.includes('HOLDOUT_CONTAMINATION'));
});
test('approval fails with forged or absent receipt',()=>{
 const rows=[{decision_id:'x',evidenceVerified:true,pnlVerified:true,labelEligible:true}],rowsHash=datasetDigest(rows);
 assert.equal(approveDataset({rows,heldoutIds:['y'],featureManifestHash:'a'.repeat(64),expectedRowsHash:rowsHash}).approved,false);
});
