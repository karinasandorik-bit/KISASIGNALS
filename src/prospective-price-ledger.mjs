import pg from 'pg';
const shaOk=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
export function validateFrozenPrediction(p,at=Date.now()){
 if(!p||!p.decisionId||!shaOk(p.modelSha256)||!shaOk(p.evidenceSha256))throw Error('INVALID_PROVENANCE');
 const e=Date.parse(p.evidenceAt),t=Date.parse(p.targetAt);
 if(!Number.isFinite(e)||!Number.isFinite(t)||e>at||t<=at||t-at!==4*3600000)throw Error('INVALID_PROSPECTIVE_HORIZON');
 if(!['NO_TRADE','LONG','SHORT'].includes(p.side)||!(p.entryPrice>0)||!p.symbol||!p.venue)throw Error('INVALID_FORECAST');
 return true;
}
export function evaluateNet(p,o){
 if(!p||!o||p.decisionId!==o.decisionId||o.quality!=='EXACT_INDEPENDENT')throw Error('UNVERIFIED_OUTCOME');
 if(p.venue===o.venue||!shaOk(o.sourceSha256))throw Error('DEPENDENT_OR_UNVERIFIED_SOURCE');
 const target=Date.parse(p.targetAt),observed=Date.parse(o.observedAt);
 if(!Number.isFinite(observed)||Math.abs(observed-target)>1000)throw Error('INEXACT_HORIZON');
 if(!(o.exitPrice>0)||![o.feeBps,o.slippageBps,o.fundingBps].every(Number.isFinite)||o.feeBps<0||o.slippageBps<0)throw Error('UNKNOWN_COST');
 if(p.side==='NO_TRADE')return {eligibleTrade:false,netReturnPct:null,reason:'ABSTENTION_ONLY'};
 const direction=p.side==='LONG'?1:-1;
 const gross=direction*(o.exitPrice/p.entryPrice-1)*100;
 const net=gross-(o.feeBps+o.slippageBps+o.fundingBps)/100;
 return {eligibleTrade:true,grossReturnPct:gross,netReturnPct:net,reason:'EVALUATED_NOT_PROMOTED'};
}
export async function freezePricePrediction({connectionString=process.env.DATABASE_URL,prediction}){
 validateFrozenPrediction(prediction);
 const c=new pg.Client({connectionString});await c.connect();
 try{
  const r=await c.query(`INSERT INTO owl_research.price_predictions(decision_id,model_sha256,evidence_at,target_at,venue,symbol,entry_price,proposed_side,prediction,evidence_sha256)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) ON CONFLICT DO NOTHING RETURNING decision_id`,
   [prediction.decisionId,prediction.modelSha256,prediction.evidenceAt,prediction.targetAt,prediction.venue,prediction.symbol,prediction.entryPrice,prediction.side,JSON.stringify(prediction),prediction.evidenceSha256]);
  if(!r.rowCount)throw Error('ALREADY_FROZEN_NO_REWRITE');
  return r.rows[0];
 }finally{await c.end()}
}
