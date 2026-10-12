// Standalone read-only one-shot evaluator; never queries live model or creates trades.
import {readOosLedger} from './oos-postgres-reader.mjs';
import {evaluateOne,scorePaired} from './oos-independent-evaluator.mjs';
import {blockBootstrap} from './oos-block-bootstrap.mjs';
const costs=()=>JSON.parse(process.env.OOS_FROZEN_COSTS_JSON||'null');
export async function runOosEvaluation({read=readOosLedger,priceCosts=costs(),minTrades=100}={}){
 if(!priceCosts)throw Error('FROZEN_COSTS_MISSING');
 const snapshot=await read();
 const world=new Map(snapshot.worlds.map(x=>[x.id,x.payload]));
 const baseline=new Map(snapshot.baselines.map(x=>[x.id,x.payload]));
 const candidate=[],control=[],exclusions=[];
 for(const frozen of snapshot.predictions){
  const id=frozen.id,p=frozen.payload,w=world.get(id),b=baseline.get(id);
  if(!w||!b){exclusions.push({id,reason:!w?'WORLD_MISSING':'BASELINE_MISSING'});continue}
  try{
   if(b.predictionId!==id||b.frozenAt!==p.frozenAt)throw Error('BASELINE_NOT_PAIRED_PRECOMMITTED');
   const c=evaluateOne(p,w,priceCosts);
   const a=evaluateOne(b,w,priceCosts);
   const signalAt=p.market?.feature_timestamp??p.ts;
   candidate.push({...c,signalAt});control.push({...a,signalAt});
  }catch(e){exclusions.push({id,reason:e.message})}
 }
 const idx=candidate.map((x,i)=>i).sort((i,j)=>Date.parse(candidate[i].signalAt)-Date.parse(candidate[j].signalAt));
 const sorted=arr=>idx.map(i=>arr[i]);
 const c=sorted(candidate),b=sorted(control);
 const score=c.length?scorePaired(c,{minTrades}):null;
 const inference=c.length>=96?blockBootstrap(c,b):null;
 return {status:'RESEARCH_ONLY',snapshotHash:snapshot.snapshotHash,readAt:snapshot.readAt,
  nFrozen:snapshot.predictions.length,nMatched:c.length,excluded:exclusions,
  candidate:score,inference,promotionEligible:false,
  blockers:[...(!inference?['INSUFFICIENT_PAIRED_SAMPLE']:[]),...(!score||score.nTrades<minTrades?['INSUFFICIENT_MATURE_TRADES']:[]),
   'REQUIRES_INDEPENDENT_SOURCE_PROVENANCE_AUDIT','REQUIRES_INDEPENDENT_PROMOTION_REVIEW']};
}
if(import.meta.url===`file://${process.argv[1]}`)runOosEvaluation().then(x=>{
 console.log(JSON.stringify(x,null,2));if(x.blockers.length)process.exitCode=2
}).catch(e=>{console.error(JSON.stringify({status:'FAILED_CLOSED',error:e.message}));process.exitCode=1});
