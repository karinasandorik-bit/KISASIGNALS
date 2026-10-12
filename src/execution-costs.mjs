// Execution cost calibration from matched, independently sourced fills only.
const ok=x=>typeof x==='number'&&Number.isFinite(x);
export function executionCosts(fills,{minPairs=30}={}){
 if(!Array.isArray(fills)||!Number.isSafeInteger(minPairs)||minPairs<1)return{verified:false,reason:'INVALID_INPUT'};
 const pairs=[];
 for(const f of fills){
  if(!f?.independentlyReconciled||!f?.providerTradeId||!f?.decisionId||!['LONG','SHORT'].includes(f.side))continue;
  if(![f.referencePrice,f.entryPrice,f.exitPrice,f.entryFee,f.exitFee,f.fundingPaid,f.quantity].every(ok))continue;
  if([f.referencePrice,f.entryPrice,f.exitPrice,f.quantity].some(x=>x<=0)||f.entryFee<0||f.exitFee<0)continue;
  const notional=f.referencePrice*f.quantity;
  const entrySlippage=f.side==='LONG'?(f.entryPrice-f.referencePrice)/f.referencePrice:(f.referencePrice-f.entryPrice)/f.referencePrice;
  pairs.push({fee:(f.entryFee+f.exitFee)/notional,slippage:Math.max(0,entrySlippage),funding:Math.max(0,f.fundingPaid/notional)});
 }
 if(pairs.length<minPairs)return{verified:false,reason:'INSUFFICIENT_RECONCILED_FILLS',n:pairs.length};
 const upper=key=>{const sorted=pairs.map(x=>x[key]).sort((a,b)=>a-b);return sorted[Math.ceil(.95*sorted.length)-1]};
 return{verified:true,n:pairs.length,source:'RECONCILED_FILLS',feesUpper:upper('fee'),slippageUpper:upper('slippage'),fundingUpper:upper('funding'),warning:'Empirical p95, not statistical upper confidence bound; partial executions and exit slippage require separate audit'};
}
