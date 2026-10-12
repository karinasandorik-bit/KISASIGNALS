import {createHash} from 'node:crypto';
import {verifyEV} from './ev-verifier.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const number=x=>typeof x==='number'&&Number.isFinite(x);
const abstain=reason=>({action:'NO_TRADE',reason,scope:'SHADOW_ONLY'});
/** Immutable prospective candidate, including gated-out candidates for counterfactual accounting. */
export function freezeShadowCandidate(prediction){
 const side=prediction?.decision?.blockedAction??prediction?.decision?.action;
 const at=prediction?.market?.feature_timestamp??prediction?.ts;
 const entry=prediction?.market?.reference_close;
 if(!prediction?.predictionId||!['LONG','SHORT'].includes(side)||!at||!number(entry)||entry<=0)return null;
 const item={id:prediction.predictionId,at,side,entry,modelHash:prediction.model?.sha256??null,forecast:prediction.forecast??null,authorized:prediction.decision?.action===side,gate:prediction.evGate?.reason??null};
 return Object.freeze({...item,hash:digest(item)});
}
/** Settlement uses independent time-ordered future candles. No intrabar path guessing. */
export function shadowExecution(candidate,bars,{horizonMs=4*3600000,roundTripFeesBps=null,slippageBps=null,fundingBps=null}={}){
 if(!candidate||!Array.isArray(bars)||![roundTripFeesBps,slippageBps,fundingBps].every(x=>number(x)&&x>=0))return{status:'COST_EVIDENCE_MISSING'};
 const t0=Date.parse(candidate.at);
 if(!number(t0)||bars.some(b=>!number(b.t)||!number(b.c)||b.c<=0))return{status:'INVALID_MARKET_DATA'};
 const forward=bars.filter(b=>b.t*1000>t0&&b.t*1000<=t0+horizonMs).sort((a,b)=>a.t-b.t);
 if(forward.length<4||forward.at(-1).t*1000<t0+horizonMs-3600000)return{status:'PENDING'};
 const last=forward.at(-1).c;
 const raw=(last/candidate.entry-1)*(candidate.side==='LONG'?1:-1)*10000;
 const netBps=raw-roundTripFeesBps-slippageBps-fundingBps;
 return{status:'SETTLED',id:candidate.id,candidateHash:candidate.hash,side:candidate.side,rawBps:raw,netBps,costBps:roundTripFeesBps+slippageBps+fundingBps,observations:forward.length,terminalAt:new Date(forward.at(-1).t*1000).toISOString()};
}
/** Exact disjoint train vs evaluation IDs, one-sided empirical Hoeffding bound; non-iid dependence not solved. */
export function independentCalibration(training,evaluation,{confidence=.95,minTrain=100,minEval=100}={}){
 if(!Array.isArray(training)||!Array.isArray(evaluation)||!number(confidence)||confidence<=0||confidence>=1)return{status:'INVALID_INPUT'};
 const good=x=>typeof x?.id==='string'&&number(x?.pWin)&&x.pWin>=0&&x.pWin<=1&&(x.y===0||x.y===1);
 if(!training.every(good)||!evaluation.every(good))return{status:'INVALID_OBSERVATIONS'};
 const ids=new Set(training.map(x=>x.id));
 if(ids.size!==training.length||new Set(evaluation.map(x=>x.id)).size!==evaluation.length||evaluation.some(x=>ids.has(x.id)))return{status:'LEAKAGE'};
 if(training.length<minTrain||evaluation.length<minEval)return{status:'INSUFFICIENT_HOLDOUT',nTrain:training.length,nEval:evaluation.length};
 const brier=rows=>rows.reduce((s,r)=>s+(r.pWin-r.y)**2,0)/rows.length;
 const rate=evaluation.reduce((s,r)=>s+r.y,0)/evaluation.length;
 const radius=Math.sqrt(Math.log(1/(1-confidence))/(2*evaluation.length));
 return{status:'INDEPENDENT_HOLDOUT_EVALUATED',nTrain:training.length,nEval:evaluation.length,brier:brier(evaluation),trainBrier:brier(training),holdoutWinRate:rate,pWinLower:Math.max(0,rate-radius),confidence,observationHash:digest(evaluation),caveat:'Requires frozen policy, exchangeable outcomes and separately validated payoff bounds; not a production calibration certificate'};
}
export function closeShadowLoop({prediction,bars,executionCosts,training=[],evaluation=[],payoffs=null}={}){
 const candidate=freezeShadowCandidate(prediction);
 if(!candidate)return{decision:abstain('NO_CANDIDATE'),candidate:null};
 const costs=executionCosts?.verified===true?executionCosts:null;
 const execution=shadowExecution(candidate,bars,{roundTripFeesBps:costs?.feesUpper==null?null:costs.feesUpper*10000,slippageBps:costs?.slippageUpper==null?null:costs.slippageUpper*10000,fundingBps:costs?.fundingUpper==null?null:costs.fundingUpper*10000});
 const calibration=independentCalibration(training,evaluation);
 const q=calibration.status==='INDEPENDENT_HOLDOUT_EVALUATED'&&payoffs&&costs&&execution.status==='SETTLED'?{side:candidate.side,prospective:true,independentHoldout:true,n:calibration.nEval,evidenceFresh:true,executionVerified:true,pWinLower:calibration.pWinLower,winLower:payoffs.winLower,lossUpper:payoffs.lossUpper,costs:{feesUpper:costs.feesUpper,slippageUpper:costs.slippageUpper,fundingUpper:costs.fundingUpper,modelErrorUpper:payoffs.modelErrorUpper}}:null;
 const ev=verifyEV(q);
 return{candidate,execution,calibration,ev,decision:ev.verified?{action:candidate.side,scope:'SHADOW_ONLY',reason:'EV_PASS'}:abstain(ev.reason),baselineNoTradeBps:0,baselineRuleBps:null,status:'RESEARCH_ONLY'};
}
