const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
export function optimalEntry({side,referencePrice,forecast,costBps=13,expiryHours=2}){
 if(!['LONG','SHORT'].includes(side)||!Number.isFinite(referencePrice))return{action:'EXPIRE',reason:'NO_CALIBRATED_DIRECTION'};
 const ex=forecast?.[side];if(!ex||![ex.mfe50,ex.mae50,ex.mae90].every(Number.isFinite))return{action:'WAIT',reason:'ENTRY_DISTRIBUTION_UNAVAILABLE'};
 const edge=ex.mfe50-ex.mae50-costBps,offset=clip(Math.round(ex.mae50*.45),8,50),limit=side==='LONG'?referencePrice*(1-offset/10000):referencePrice*(1+offset/10000);
 if(edge<=0)return{action:'EXPIRE',reason:'NON_POSITIVE_EXECUTION_EDGE',expiryHours};
 if(ex.mae50>=35)return{action:'LIMIT',price:+limit.toFixed(8),offsetBps:offset,expiryHours,reason:'EXPECTED_ADVERSE_EXCURSION_SUPPORTS_PATIENCE'};
 if(edge<25)return{action:'WAIT',expiryHours,reason:'EDGE_TOO_THIN_FOR_IMMEDIATE_ENTRY'};
 return{action:'ENTER_NOW',price:referencePrice,offsetBps:0,expiryHours,reason:'EDGE_SUPPORTS_IMMEDIATE_ENTRY'};
}
export function probabilisticEV({side,forecast,costBps=13}){const ex=forecast?.[side];if(!ex)return null;const win=side==='LONG'?forecast.pUp:forecast.pDown,lose=side==='LONG'?forecast.pDown:forecast.pUp;if(![win,lose,ex.mfe50,ex.mae50].every(Number.isFinite))return null;return +(win*ex.mfe50-lose*ex.mae50-costBps).toFixed(3)};
