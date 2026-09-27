import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {putEvidence} from './ledger.mjs';

const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;

export function verifyArtifactBytes(bytes,expectedSha256){
 const actualSha256=sha256(bytes);
 if(!expectedSha256||actualSha256!==expectedSha256) throw Error('ROLLBACK_ARTIFACT_HASH_MISMATCH');
 return actualSha256;
}

export async function physicallyRollback({
 transition,resolveArtifact,activePath,expectedSha256,persist=putEvidence,rename=fs.renameSync,write=fs.writeFileSync,read=fs.readFileSync
}={}){
 if(transition?.transition!=='ROLLBACK') throw Error('ROLLBACK_TRANSITION_REQUIRED');
 if(!transition.rollbackTo) throw Error('ROLLBACK_TARGET_REQUIRED');
 if(!activePath) throw Error('ROLLBACK_ACTIVE_PATH_REQUIRED');
 const artifact=await resolveArtifact(transition.rollbackTo);
 if(!artifact?.bytes) throw Error('ROLLBACK_ARTIFACT_UNRESOLVED');
 const targetSha256=expectedSha256??artifact.sha256;
 verifyArtifactBytes(artifact.bytes,targetSha256);

 const tmp=activePath+'.rollback-'+process.pid;
 fs.mkdirSync(path.dirname(activePath),{recursive:true});
 write(tmp,artifact.bytes);
 verifyArtifactBytes(read(tmp),targetSha256);
 rename(tmp,activePath);
 const runtimeSha256=verifyArtifactBytes(read(activePath),targetSha256);

 const body={schema:'KISA_ROLLBACK_ATTESTATION_V1',transitionId:transition.revocationId??null,rollbackTo:transition.rollbackTo,activePath,targetSha256,runtimeSha256,verified:runtimeSha256===targetSha256,activatedAt:new Date().toISOString()};
 const attestationHash=sha256(Buffer.from(JSON.stringify(stable(body))));
 const attestation=Object.freeze({...body,attestationHash});
 await persist('rollback_attestation',attestationHash,attestation);
 return attestation;
}

export function createArtifactResolver({root=process.env.KISA_ARTIFACT_STORE||'artifacts/proven'}={}){
 return async rollbackTo=>{
  const manifestPath=path.join(root,rollbackTo,'manifest.json');
  if(!fs.existsSync(manifestPath)) throw Error('ROLLBACK_MANIFEST_NOT_FOUND');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const filePath=path.join(root,rollbackTo,manifest.file);
  const bytes=fs.readFileSync(filePath);
  verifyArtifactBytes(bytes,manifest.sha256);
  return {bytes,sha256:manifest.sha256,manifest};
 };
}
