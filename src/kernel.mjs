import crypto from 'node:crypto';
export const VERSION='KISASIGNALS-v2.0.0';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function metaGate(f,cfg={}){
 if(![f.pUp,f.pDown,f.pRange,f.mfe50,f.mae50,f.mae90].every(Number.isFinite) ||
    [f.pUp,f.pDown,f.pRange].some(p=>p<0||p>1) || Math.abs(f.pUp+f.pDown+f.pRange-1)>1e-8 ||
    Math.min(f.mfe50,f.mae50,f.mae90)<0 || f.mae50>f.mae90)
   return {action:'NO_TRADE',reason:'INVALID_OR_UNAVAILABLE_FORECAST',evBps:null,tailRiskBps:null,costBps:null};
 const fees=cfg.feesBps??8, slip=cfg.slippageBps??4, funding=cfg.fundingBps??1, tau=cfg.tauEvBps??6, riskCap=cfg.riskCapBps??120;
 const longEV=f.pUp*f.mfe50-f.pDown*f.mae50-fees-slip-funding;
 const shortEV=f.pDown*f.mfe50-f.pUp*f.mae50-fees-slip-funding;
 const side=longEV>=shortEV?'LONG':'SHORT', ev=Math.max(longEV,shortEV), tail=f.mae90;
 const action=(ev>tau&&tail<riskCap)?side:'NO_TRADE';
 return {action,evBps:ev,tailRiskBps:tail,costBps:fees+slip+funding};
}
export function riskEngine(decision,equity=1000,riskFraction=.005){
 if(decision.action==='NO_TRADE') return {sizeUsd:0,slBps:null,tpBps:null};
 const sl=clamp(decision.tailRiskBps,25,150), tp=clamp(Math.max(sl*1.5,decision.evBps*2),40,300);
 return {sizeUsd:+((equity*riskFraction)/(sl/10000)).toFixed(2),slBps:+sl.toFixed(2),tpBps:+tp.toFixed(2)};
}
export function makePrediction({ts,modelVersion,features,forecast,cfg,equity}){
 const featuresHash=crypto.createHash('sha256').update(JSON.stringify(features)).digest('hex');
 const decision=metaGate(forecast,cfg), risk=riskEngine(decision,equity);
 const predictionId=crypto.createHash('sha256').update(`${ts}|${modelVersion}|${featuresHash}`).digest('hex').slice(0,20);
 return {predictionId,ts,modelVersion,featuresHash,forecast,decision,risk};
}
export function settle(p,outcome){
 const a=p.decision.action; let pnlBps=0;
 if(a==='LONG') pnlBps=outcome.returnBps-p.decision.costBps;
 if(a==='SHORT') pnlBps=-outcome.returnBps-p.decision.costBps;
 return {...p,outcome:{...outcome,netPnlBps:+pnlBps.toFixed(3)}};
}
export function metrics(rows){
 const settled=rows.filter(x=>x.outcome); const traded=settled.filter(x=>x.decision.action!=='NO_TRADE');
 const losses=traded.map(x=>Math.max(0,-x.outcome.netPnlBps)).sort((a,b)=>b-a); const n=Math.max(1,Math.ceil(losses.length*.05));
 const cvar95=losses.length?losses.slice(0,n).reduce((a,b)=>a+b,0)/n:0;
 let eq=0,peak=0,maxDD=0; for(const x of traded){eq+=x.outcome.netPnlBps;peak=Math.max(peak,eq);maxDD=Math.max(maxDD,peak-eq)}
 return {n:settled.length,trades:traded.length,coverage:settled.length?traded.length/settled.length:0,netPnlBps:+traded.reduce((s,x)=>s+x.outcome.netPnlBps,0).toFixed(3),cvar95LossBps:+cvar95.toFixed(3),maxDrawdownBps:+maxDD.toFixed(3)};
}
