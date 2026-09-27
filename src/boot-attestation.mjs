import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadPriceNet,loadCalibration} from './pricenet.mjs';
import {putEvidence} from './ledger.mjs';

const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const sha256=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const gitCommit=()=>process.env.RAILWAY_GIT_COMMIT_SHA||process.env.GIT_COMMIT_SHA||process.env.VERCEL_GIT_COMMIT_SHA||(()=>{try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{return null}})();

let cached=null;
export async function attestBoot({mode=process.env.KISA_EXECUTION_MODE||'SHADOW',deploymentId=process.env.RAILWAY_DEPLOYMENT_ID||process.env.DEPLOYMENT_ID||null,persist=putEvidence,force=false}={}){
 if(cached&&!force)return cached;
 const model=loadPriceNet(),cal=loadCalibration(),body={
  schema:'KISA_BOOT_ATTESTATION_V1',processId:String(process.pid),deploymentId,mode,
  gitCommit:gitCommit(),modelSha256:model.sha256,modelSource:model.source,
  calibrationSha256:cal.sha256,calibrationVersion:cal.artifact.version,
  runtime:{node:process.version,platform:process.platform,arch:process.arch},
  bootedAt:new Date().toISOString()
 };
 const bootAttestationId=sha256(body);
 const attestation=Object.freeze({...body,bootAttestationId});
 const ok=await persist('boot_attestation',bootAttestationId,attestation);
 if(ok===false)throw Error('POSTGRES_BOOT_ATTESTATION_REQUIRED');
 cached=attestation;
 return attestation;
}
export function resetBootAttestationForTest(){cached=null}
