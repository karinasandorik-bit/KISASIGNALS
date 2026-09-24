import crypto from 'node:crypto';
export const VERSION='KISASIGNALS-v2.1.0';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const validExc=x=>x&&[x.mfe50,x.mae50,x.mae90].every(Number.isFinite)&&Math.min(x.mfe50,x.mae50,x.mae90)>=0&&x.mae50<=x.mae90;
export function metaGate(f,cfg={}){
 if(![f.pUp,f.pDown,f.pRange].every(Number.isFinite)||[f.pUp,f.pDown,f.pRange].some(p=>p<0||p>1)||Math.abs(f.pUp+f.pDown+f.pRange-1)>1e-8)
   return {action:'NO_TRADE',reason:'INVALID_PROBABILITIES',evBps:null,tailRiskBps:null,costBps:null};
 const L=f.LONG||f.long||(validExc(f)?f:null),S=f.SHORT||f.short||(validExc(f)?f:null);
 if(!validExc(L)||!validExc(S))return {action:'NO_TRADE',reason:'INVALID_OR_UNAVAILABLE_EXCURSIONS',evBps:null,tailRiskBps:null,costBps:null};
 const fees=cfg.feesBps??8,slip=cfg.slippageBps??4,funding=cfg.fundingBps??1,tau=cfg.tauEvBps??6,riskCap=cfg.riskCapBps??150,minRR=cfg.minRR??1.25;
 const cost=fees+slip+funding;
 const longEV=f.pUp*L.mfe50-f.pDown*L.mae50-cost,shortEV=f.pDown*S.mfe50-f.pUp*S.mae50-cost;
 const candidates=[{side:'LONG',ev:longEV,tail:L.mae90,exc:L},{side:'SHORT',ev:shortEV,tail:S.mae90,exc:S}].sort((a,b)=>b.ev-a.ev),best=candidates[0];
 const sl=clamp(best.tail,25,150),tp=clamp(Math.max(sl*minRR,best.exc.mfe50),40,300),rr=tp/sl;
 const action=(best.ev>tau&&best.tail<=riskCap&&rr>=minRR)?best.side:'NO_TRADE';
 const reason=action==='NO_TRADE'?(best.ev<=tau?'EV_BELOW_THRESHOLD':best.tail>riskCap?'TAIL_RISK_TOO_HIGH':'RR_BELOW_THRESHOLD'):'META_GATE_PASS';
 return {action,reason,preferredSide:best.side,evBps:+best.ev.toFixed(3),tailRiskBps:+best.tail.toFixed(2),costBps:cost,rr:+rr.toFixed(3),excursion:best.exc};
}
export function riskEngine(decision,equity=1000,riskFraction=.005){
 if(decision.action==='NO_TRADE')return{sizeUsd:0,slBps:null,tpBps:null,rr:null};
 const sl=clamp(decision.tailRiskBps,25,150),tp=clamp(Math.max(sl*1.25,decision.excursion?.mfe50||0),40,300);
 return{sizeUsd:+((equity*riskFraction)/(sl/10000)).toFixed(2),slBps:+sl.toFixed(2),tpBps:+tp.toFixed(2),rr:+(tp/sl).toFixed(3)};
}
export function makePrediction({ts,modelVersion,features,forecast,cfg,equity}){
 const featuresHash=crypto.createHash('sha256').update(JSON.stringify(features)).digest('hex'),decision=metaGate(forecast,cfg),risk=riskEngine(decision,equity);
 const predictionId=crypto.createHash('sha256').update(`${ts}|${modelVersion}|${featuresHash}`).digest('hex').slice(0,20);
 return{predictionId,ts,modelVersion,featuresHash,forecast,decision,risk};
}
export function settle(p,outcome){const a=p.decision.action;let pnlBps=0;if(a==='LONG')pnlBps=outcome.returnBps-p.decision.costBps;if(a==='SHORT')pnlBps=-outcome.returnBps-p.decision.costBps;return{...p,outcome:{...outcome,netPnlBps:+pnlBps.toFixed(3)}}}
export function metrics(rows){const settled=rows.filter(x=>x.outcome),traded=settled.filter(x=>x.decision.action!=='NO_TRADE'),losses=traded.map(x=>Math.max(0,-x.outcome.netPnlBps)).sort((a,b)=>b-a),n=Math.max(1,Math.ceil(losses.length*.05)),cvar95=losses.length?losses.slice(0,n).reduce((a,b)=>a+b,0)/n:0;let eq=0,peak=0,maxDD=0;for(const x of traded){eq+=x.outcome.netPnlBps;peak=Math.max(peak,eq);maxDD=Math.max(maxDD,peak-eq)}return{n:settled.length,trades:traded.length,coverage:settled.length?traded.length/settled.length:0,netPnlBps:+traded.reduce((s,x)=>s+x.outcome.netPnlBps,0).toFixed(3),cvar95LossBps:+cvar95.toFixed(3),maxDrawdownBps:+maxDD.toFixed(3)}}
