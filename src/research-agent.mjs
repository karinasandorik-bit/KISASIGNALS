import crypto from 'node:crypto';

export const RESEARCH_BRANCHES=Object.freeze(['A0','A1','A2']);
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
export const canonicalJSON=x=>JSON.stringify(stable(x));
export const sha256=x=>crypto.createHash('sha256').update(typeof x==='string'?x:canonicalJSON(x)).digest('hex');

export function freezeTrial(spec){
  for(const k of ['trialId','frozenAt','target','prior','frozenEvidence','residual','requiredObservation','acquisitionSpec','scoring']) if(spec[k]===undefined) throw new Error('MISSING_'+k);
  const core={schema:'KISA_RESEARCH_TRIAL_V1',...spec,status:'FROZEN'};
  return Object.freeze({...core,freezeHash:sha256(core)});
}

export async function executeResearchBranches({trial,a0,a1,a2,append=async()=>{}}){
  if(trial.freezeHash!==sha256(Object.fromEntries(Object.entries(trial).filter(([k])=>k!=='freezeHash')))) throw new Error('FREEZE_HASH_MISMATCH');
  const common={target:trial.target,prior:trial.prior,frozenEvidence:trial.frozenEvidence,scoring:trial.scoring};
  const r0=await a0(Object.freeze({...common,branch:'A0'}));
  const r1=await a1(Object.freeze({...common,branch:'A1',liveAcquisition:false}));
  const r2=await a2(Object.freeze({...common,branch:'A2',residual:trial.residual,requiredObservation:trial.requiredObservation,acquisitionSpec:trial.acquisitionSpec,liveAcquisition:true}));
  const branches=Object.freeze({A0:r0,A1:r1,A2:r2});
  const armed=Object.freeze({event:'RESEARCH_TRIAL_ARMED',trialId:trial.trialId,freezeHash:trial.freezeHash,armedAt:new Date().toISOString(),branches});
  await append(armed);
  return armed;
}

export function settleResearchTrial({armed,outcome,score,thetaPractical}){
  if(!armed?.branches?.A1||!armed?.branches?.A2) throw new Error('TRIAL_NOT_ARMED');
  if(typeof score!=='function') throw new Error('SCORE_REQUIRED');
  const s1=score(armed.branches.A1,outcome),s2=score(armed.branches.A2,outcome),delta21=s2-s1;
  const actionChange=canonicalJSON(armed.branches.A1.action)!==canonicalJSON(armed.branches.A2.action);
  const status=!actionChange?'CLOSURE_SURVIVES':delta21>thetaPractical?'PROSPECTIVE_HIT':'PROSPECTIVE_MISS';
  return Object.freeze({event:'RESEARCH_TRIAL_SETTLED',trialId:armed.trialId,freezeHash:armed.freezeHash,settledAt:new Date().toISOString(),actionChange,scoreA1:s1,scoreA2:s2,delta21,thetaPractical,status,outcome});
}
