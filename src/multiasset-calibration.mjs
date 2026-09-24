const entropy=p=>-p.filter(x=>x>0).reduce((s,x)=>s+x*Math.log(x),0)/Math.log(3);
export function calibrateAssetForecast({symbol,forecast,diagnostics={}}){
 const p=[forecast?.pUp,forecast?.pDown,forecast?.pRange];if(!p.every(Number.isFinite)||Math.abs(p.reduce((a,b)=>a+b,0)-1)>1e-6)return{symbol,status:'REJECTED',reason:'INVALID_PROBABILITIES'};
 const n=diagnostics.n??0,ece=diagnostics.ece??null,brier=diagnostics.brier??null,calibrated=n>=100&&Number.isFinite(ece)&&ece<=.08&&Number.isFinite(brier);
 return{symbol,status:calibrated?'CALIBRATED':'SHADOW_ONLY',n,ece,brier,uncertainty:+entropy(p).toFixed(4),forecast,tradeAuthority:calibrated?'MODEL_GATE':'NONE'};
}
